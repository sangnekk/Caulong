<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Services\SupportChat;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The staff's inbox: conversations the automatic assistant handed over. A member of staff
 * takes a ticket, answers, marks it solved and closes it; only whoever took it may write.
 */
class SupportChatController extends Controller
{
    /** "active" is the work in hand: open (the shop's turn) and pending (the customer's). */
    private const FILTERS = ['active', ...SupportChat::STATUSES, 'all'];

    public function index(Request $request, SupportChat $chat): Response|RedirectResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(self::FILTERS)],
            'conversation' => ['nullable', 'integer', 'min:1'],
        ]);
        $status = $filters['status'] ?? 'active';
        $tickets = fn (): Builder => SupportConversation::query()->where('needs_human', true);
        $conversations = $tickets()
            ->with(['latestHumanMessage', 'assignedUser:id,name', 'user:id,name'])
            ->withCount(['messages as unread_count' => fn ($query) => $query->where('sender', 'customer')->whereNull('read_at')])
            ->when($status === 'active', fn (Builder $query) => $query->whereIn('status', ['open', 'pending']))
            ->when(in_array($status, SupportChat::STATUSES, true), fn (Builder $query) => $query->where('status', $status))
            ->orderByDesc('last_message_at')->orderByDesc('id')
            ->paginate(20)->withQueryString()
            ->through(fn (SupportConversation $conversation) => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'customer_name' => $conversation->user?->name,
                'assigned_to' => $conversation->assigned_to,
                'assigned_name' => $conversation->assignedUser?->name,
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
                // What a person said last; `last_from_staff` tells whose turn that leaves.
                'last_message' => $conversation->latestHumanMessage?->body,
                'last_from_staff' => $conversation->latestHumanMessage?->sender === 'admin',
                'unread_count' => (int) $conversation->getAttribute('unread_count'),
            ]);

        // The inbox opens on the first ticket of the list, by its number in the address. The list
        // changes as customers write: named in the address, the conversation on screen stays the
        // same through every refresh and every action, so a reply being written for one
        // customer is never sent into another's conversation.
        $firstConversation = $conversations->getCollection()->first();
        if (! isset($filters['conversation']) && $firstConversation !== null) {
            return redirect()->route('admin.support-chat.index', [...$request->query(), 'status' => $status, 'conversation' => $firstConversation['id']]);
        }
        $selectedId = $filters['conversation'] ?? null;
        // Any conversation can be read by its number (a customer's page links to all of theirs);
        // only tickets are listed and worked on.
        $selected = $selectedId
            ? SupportConversation::query()->whereKey((int) $selectedId)->with(['assignedUser:id,name', 'user:id,name'])->first()
            : null;
        $messages = [];
        if ($selected) {
            $selected->messages()->where('sender', 'customer')->whereNull('read_at')->update(['read_at' => now()]);
            $messages = array_values($selected->messages()->latest('id')->limit(200)->get()->reverse()
                ->map(fn (SupportMessage $message) => [
                    'id' => $message->id,
                    'sender' => $message->sender,
                    'body' => $message->body,
                    'created_at' => $message->created_at->toIso8601String(),
                ])->all());
        }

        $unreadCount = SupportMessage::query()
            ->where('sender', 'customer')->whereNull('read_at')
            ->whereHas('conversation', fn ($query) => $query->where('status', 'open')->where('needs_human', true))
            ->count();

        return Inertia::render('admin/support-chat', [
            'conversations' => $conversations,
            'selected' => $selected ? [
                'id' => $selected->id,
                'status' => $selected->status,
                'is_ticket' => $selected->needs_human,
                'customer_name' => $selected->user?->name,
                'assigned_to' => $selected->assigned_to,
                'assigned_name' => $selected->assignedUser?->name,
                'can_reply' => $selected->needs_human && $selected->assigned_to === $request->user()?->id,
                'started_at' => $selected->created_at->toIso8601String(),
            ] : null,
            'messages' => $messages,
            // Who the customer is and what they did before.
            'context' => $selected ? $chat->context($selected) : null,
            'filters' => ['status' => $status],
            'counts' => array_replace(
                array_fill_keys(SupportChat::STATUSES, 0),
                $tickets()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            ),
            'unread_count' => $unreadCount,
            // Links to a customer's page and orders are for those who may open them.
            'can_manage_shop' => (bool) $request->user()?->can('manage-shop'),
        ]);
    }

    public function claim(Request $request, SupportConversation $conversation): RedirectResponse
    {
        if (! $conversation->needs_human || $conversation->status === 'closed') {
            throw ValidationException::withMessages(['claim' => 'Ticket không còn mở để nhận.']);
        }

        if ($conversation->assigned_to === $request->user()?->id) {
            return back()->with('success', 'Bạn đang tiếp nhận ticket này.');
        }

        $claimed = SupportConversation::query()
            ->whereKey($conversation->id)
            ->where('status', '!=', 'closed')
            ->where('needs_human', true)
            ->whereNull('assigned_to')
            ->update(['assigned_to' => $request->user()?->id, 'updated_at' => now()]);

        if ($claimed === 0) {
            return back()->with('error', 'Ticket vừa được nhân viên khác nhận. Danh sách đã được cập nhật.');
        }

        return back()->with('success', 'Bạn đã nhận xử lý ticket này.');
    }

    public function reply(Request $request, SupportConversation $conversation, SupportChat $chat): RedirectResponse
    {
        if ($conversation->status === 'closed' || ! $conversation->needs_human) {
            throw ValidationException::withMessages(['message' => 'Ticket không còn mở để xử lý.']);
        }
        if ($conversation->assigned_to !== $request->user()?->id) {
            throw ValidationException::withMessages(['message' => 'Hãy nhận ticket trước khi phản hồi.']);
        }
        $data = $request->validate(['message' => ['required', 'string', 'max:2000']]);
        $body = trim($data['message']);
        if ($body === '') {
            throw ValidationException::withMessages(['message' => 'Nhập nội dung phản hồi.']);
        }
        // Answered: the conversation now waits for the customer.
        $chat->staffReplied($conversation, $body);

        return back()->with('success', 'Đã gửi phản hồi cho khách.');
    }

    /** Solved as far as the shop can tell. The customer can still write, which opens it again. */
    public function resolve(Request $request, SupportConversation $conversation, SupportChat $chat): RedirectResponse
    {
        $this->mine($request, $conversation, 'đánh dấu đã giải quyết');
        if (! in_array($conversation->status, ['open', 'pending'], true)) {
            throw ValidationException::withMessages(['claim' => 'Ticket này không còn đang xử lý.']);
        }
        $chat->resolve($conversation);

        return back()->with('success', 'Đã đánh dấu đã giải quyết. Khách nhắn tiếp thì ticket mở lại; nếu không, ticket tự đóng sau '
            .(int) config('shop.support.resolved_days').' ngày.');
    }

    public function close(Request $request, SupportConversation $conversation, SupportChat $chat): RedirectResponse
    {
        $this->mine($request, $conversation, 'đóng');
        if ($conversation->status !== 'closed') {
            $chat->close($conversation);
        }

        return back()->with('success', 'Đã đóng cuộc trò chuyện.');
    }

    private function mine(Request $request, SupportConversation $conversation, string $action): void
    {
        if ($conversation->assigned_to !== $request->user()?->id) {
            throw ValidationException::withMessages(['claim' => 'Chỉ người đang nhận ticket mới có thể '.$action.'.']);
        }
    }
}
