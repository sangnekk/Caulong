<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SupportChatController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', 'in:open,closed,all'],
            'conversation' => ['nullable', 'integer', 'min:1'],
        ]);
        $status = $filters['status'] ?? 'open';
        $conversations = SupportConversation::query()
            ->where('needs_human', true)
            ->with(['latestMessage', 'assignedUser'])
            ->withCount(['messages as unread_count' => fn ($query) => $query->where('sender', 'customer')->whereNull('read_at')])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->orderByDesc('last_message_at')->orderByDesc('id')
            ->paginate(20)->withQueryString()
            ->through(fn (SupportConversation $conversation) => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'assigned_to' => $conversation->assigned_to,
                'assigned_name' => $conversation->assignedUser?->name,
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
                'last_message' => $conversation->latestMessage?->body,
                'unread_count' => (int) $conversation->getAttribute('unread_count'),
            ]);

        $firstConversation = $conversations->getCollection()->first();
        $selectedId = $filters['conversation'] ?? ($firstConversation['id'] ?? null);
        $selected = $selectedId
            ? SupportConversation::query()->where('needs_human', true)->whereKey((int) $selectedId)->with('assignedUser')->first()
            : null;
        $messages = [];
        if ($selected) {
            $selected->messages()->where('sender', 'customer')->whereNull('read_at')->update(['read_at' => now()]);
            $messages = $selected->messages()->oldest('id')->limit(200)->get()
                ->map(fn (SupportMessage $message) => [
                    'id' => $message->id,
                    'sender' => $message->sender,
                    'body' => $message->body,
                    'created_at' => $message->created_at->toIso8601String(),
                ])->all();
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
                'assigned_to' => $selected->assigned_to,
                'assigned_name' => $selected->assignedUser?->name,
                'can_reply' => $selected->assigned_to === $request->user()?->id,
            ] : null,
            'messages' => $messages,
            'filters' => ['status' => $status],
            'unread_count' => $unreadCount,
        ]);
    }

    public function reply(Request $request, SupportConversation $conversation): RedirectResponse
    {
        if ($conversation->status !== 'open' || ! $conversation->needs_human) {
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
        $conversation->messages()->create(['sender' => 'admin', 'body' => $body]);
        $conversation->forceFill(['last_message_at' => now()])->save();

        return back()->with('success', 'Đã gửi phản hồi cho khách.');
    }

    public function claim(Request $request, SupportConversation $conversation): RedirectResponse
    {
        if (! $conversation->needs_human || $conversation->status !== 'open') {
            throw ValidationException::withMessages(['claim' => 'Ticket không còn mở để nhận.']);
        }

        if ($conversation->assigned_to === $request->user()?->id) {
            return back()->with('success', 'Bạn đang tiếp nhận ticket này.');
        }

        $claimed = SupportConversation::query()
            ->whereKey($conversation->id)
            ->where('status', 'open')
            ->where('needs_human', true)
            ->whereNull('assigned_to')
            ->update(['assigned_to' => $request->user()?->id, 'updated_at' => now()]);

        if ($claimed === 0) {
            return back()->with('error', 'Ticket vừa được nhân viên khác nhận. Danh sách đã được cập nhật.');
        }

        return back()->with('success', 'Bạn đã nhận xử lý ticket này.');
    }

    public function close(Request $request, SupportConversation $conversation): RedirectResponse
    {
        if ($conversation->assigned_to !== $request->user()?->id) {
            throw ValidationException::withMessages(['claim' => 'Chỉ người đang nhận ticket mới có thể đóng.']);
        }
        $conversation->forceFill(['status' => 'closed'])->save();

        return back()->with('success', 'Đã đóng cuộc trò chuyện.');
    }
}
