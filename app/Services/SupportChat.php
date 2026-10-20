<?php

namespace App\Services;

use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Models\User;
use App\Support\DemoData;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The support chat's rules: whose conversation a request is in, how a conversation moves on,
 * the code a finished one is read again with, and what staff see about who they are answering.
 *
 * A conversation is `open` while it waits for the shop, `pending` once staff answered and it
 * waits for the customer, `resolved` when staff consider it solved (a new message from the
 * customer opens it again) and `closed` when it is over: the next message starts another one.
 */
class SupportChat
{
    public const STATUSES = ['open', 'pending', 'resolved', 'closed'];

    /** Letters and digits that are not mistaken for one another when read or typed. */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /** Ten of them: about 10^15 codes, far beyond what the lookup's attempt limit lets anyone try. */
    private const CODE_LENGTH = 10;

    public function __construct(private CustomerEvents $events, private CustomerProfile $profile, private StringingService $stringing) {}

    /**
     * The conversation this visitor is in: the one their browser session started, or, for a
     * customer who signed in elsewhere, the one on their account that is not over yet.
     */
    public function current(Request $request): ?SupportConversation
    {
        $customer = $this->customer($request);
        $id = $request->session()->get('support_conversation_id');
        $conversation = is_numeric($id) ? SupportConversation::find((int) $id) : null;
        // A conversation that belongs to an account is its owner's alone, whatever a session says.
        if ($conversation !== null && $conversation->user_id !== null && $conversation->user_id !== $customer?->id) {
            $conversation = null;
        }
        if ($customer !== null && ($conversation === null || $conversation->status === 'closed')) {
            $conversation = $customer->conversations()->where('status', '!=', 'closed')->latest('id')->first() ?? $conversation;
        }
        if ($conversation !== null && (int) $id !== $conversation->id) {
            $request->session()->put('support_conversation_id', $conversation->id);
        }

        return $conversation;
    }

    public function start(Request $request): SupportConversation
    {
        $conversation = SupportConversation::create([
            'session_key' => $this->events->sessionKey($request) ?? hash('sha256', (string) Str::uuid()),
            'user_id' => $this->customer($request)?->id,
        ]);
        $request->session()->put('support_conversation_id', $conversation->id);
        $this->events->record($request, 'chat_started');

        return $conversation;
    }

    /** A visitor who signs in: the conversation they began as a guest during this visit becomes theirs. */
    public function claim(Request $request, User $user): void
    {
        if ($user->is_admin || ! $request->hasSession()) {
            return;
        }
        $id = $request->session()->get('support_conversation_id');
        $visit = is_string($request->session()->get('visitor_key')) ? $this->events->sessionKey($request) : null;
        if (! is_numeric($id) && $visit === null) {
            return;
        }
        rescue(fn () => SupportConversation::query()->whereNull('user_id')
            ->where(fn (Builder $query) => $query->whereKey(is_numeric($id) ? (int) $id : 0)
                ->when($visit !== null, fn (Builder $query) => $query->orWhere('session_key', $visit)))
            ->update(['user_id' => $user->id]));
    }

    /**
     * The customer's message and the assistant's answer to it. In a ticket every message is
     * for the staff to read, and puts the conversation back in their hands.
     *
     * @param  array{body: string, action_url: string|null, action_label: string|null, needs_human: bool}  $reply
     */
    public function customerWrote(SupportConversation $conversation, string $body, array $reply): void
    {
        DB::transaction(function () use ($conversation, $body, $reply): void {
            $ticket = $conversation->needs_human || $reply['needs_human'];
            $conversation->messages()->create(['sender' => 'customer', 'body' => $body, 'read_at' => $ticket ? null : now()]);
            $conversation->messages()->create([
                'sender' => 'bot',
                'body' => $reply['body'],
                'action_url' => $reply['action_url'],
                'action_label' => $reply['action_label'],
            ]);
            $conversation->forceFill(['needs_human' => $ticket, 'status' => 'open', 'resolved_at' => null, 'last_message_at' => now()])->save();
        });
    }

    public function staffReplied(SupportConversation $conversation, string $body): void
    {
        DB::transaction(function () use ($conversation, $body): void {
            $conversation->messages()->create(['sender' => 'admin', 'body' => $body]);
            $conversation->forceFill(['status' => 'pending', 'resolved_at' => null, 'last_message_at' => now()])->save();
        });
    }

    public function resolve(SupportConversation $conversation): void
    {
        $conversation->forceFill(['status' => 'resolved', 'resolved_at' => now()])->save();
    }

    public function close(SupportConversation $conversation): void
    {
        $conversation->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
    }

    /**
     * Conversations staff marked as solved and the customer left at that: closed once the
     * days in config shop.support.resolved_days have passed (`php artisan support:close-resolved`, daily).
     */
    public function closeResolved(): int
    {
        return SupportConversation::query()->where('status', 'resolved')
            ->where('resolved_at', '<=', now()->subDays((int) config('shop.support.resolved_days')))
            ->update(['status' => 'closed', 'closed_at' => now()]);
    }

    /**
     * A new code to read this conversation again with, replacing any earlier one. The code
     * itself is shown once and never stored: only a hash keyed with the app key is.
     *
     * @return array{code: string, expires_at: CarbonInterface}
     */
    public function issueCode(SupportConversation $conversation): array
    {
        do {
            $code = '';
            for ($i = 0; $i < self::CODE_LENGTH; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
        } while (SupportConversation::query()->where('access_code_hash', $this->hash($code))->exists());
        $expires = now()->addDays((int) config('shop.support.code_days'));
        $conversation->forceFill(['access_code_hash' => $this->hash($code), 'access_code_expires_at' => $expires])->save();

        return ['code' => substr($code, 0, 5).'-'.substr($code, 5), 'expires_at' => $expires];
    }

    /** The conversation a typed code opens, however it was spaced or cased; null when wrong or out of date. */
    public function byCode(string $typed): ?SupportConversation
    {
        $code = (string) preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($typed));
        if (strlen($code) !== self::CODE_LENGTH) {
            return null;
        }

        return SupportConversation::query()->where('access_code_hash', $this->hash($code))
            ->where('access_code_expires_at', '>', now())->first();
    }

    /**
     * The latest messages of a conversation, oldest first, as the customer's side shows them.
     *
     * @return list<array{id: int, sender: string, body: string, action_url: string|null, action_label: string|null, created_at: string}>
     */
    public function messages(SupportConversation $conversation, int $limit = 100): array
    {
        return array_values($conversation->messages()->latest('id')->limit($limit)->get()->reverse()
            ->map(fn (SupportMessage $message) => [
                'id' => $message->id,
                'sender' => $message->sender,
                'body' => $message->body,
                'action_url' => $message->action_url,
                'action_label' => $message->action_label,
                'created_at' => $message->created_at->toIso8601String(),
            ])->all());
    }

    /**
     * A customer's conversations, the latest first, each with how it began.
     *
     * @return list<array{id: int, status: string, needs_human: bool, started_at: string, last_message_at: string|null, excerpt: string, messages: int, assigned_name: string|null}>
     */
    public function history(User $customer, int $limit = 20): array
    {
        return $this->summaries($customer->conversations()->latest('id')->limit($limit));
    }

    /**
     * What staff see next to a conversation: who the customer is, what they ordered and
     * looked at, and what they wrote to the shop before. For a visitor without an account,
     * only what happened during the same visit is known.
     *
     * @param  bool  $includeNonTickets  false for support staff: what the assistant handled alone is not theirs to read.
     * @return array{
     *     customer: array{id: int, name: string, email: string, segment: string|null, verified: bool, joined: string|null}|null,
     *     overview: array{orders: int, open: int, cancelled: int, ordered: int, spent: int, average: int, first_order_at: string|null, last_order_at: string|null}|null,
     *     orders: list<array{id: int, code: string, status: string, payment_status: string, total: int, is_demo: bool, created_at: string}>,
     *     purchased: list<array{name: string, units: int}>,
     *     viewed: list<array{id: int, name: string}>,
     *     services: list<array{id: int, public_id: string, code: string, status: string, racket: string, string_name: string|null, service_type: string, tension_kg: float, quantity: int, total: int, created_at: string}>,
     *     conversations: list<array{id: int, status: string, needs_human: bool, started_at: string, last_message_at: string|null, excerpt: string, messages: int, assigned_name: string|null}>
     * }
     */
    public function context(SupportConversation $conversation, bool $includeNonTickets = true): array
    {
        $demo = DemoData::shownByDefault();
        // Read in full: callers may have loaded the customer with a few columns only.
        $customer = $conversation->user_id === null ? null : User::find($conversation->user_id);
        // Without an account there is the visit itself: what was looked at and ordered during it.
        $visit = fn (string $event): Builder => CustomerEvent::query()->where('customer_events.name', $event)
            ->whereNull('customer_events.user_id')->where('customer_events.session_key', $conversation->session_key);

        $orders = Order::query()->when(! $demo, fn (Builder $query) => $query->where('is_demo', false))
            ->when($customer !== null, fn (Builder $query) => $query->where('user_id', $customer?->id), fn (Builder $query) => $query
                ->whereIn('id', $visit('order_placed')->whereNotNull('order_id')->select('order_id')))
            ->latest('id')->limit(5)->get();
        $products = $customer !== null ? $this->profile->products($customer, $demo) : null;
        $viewed = $products !== null
            ? array_map(fn (array $product) => ['id' => $product['id'], 'name' => $product['name']], array_slice($products['viewed'], 0, 5))
            : array_values($visit('product_view')
                ->join('products', 'products.id', '=', 'customer_events.product_id')
                ->groupBy('products.id', 'products.name')->orderByRaw('max(customer_events.created_at) desc')->limit(5)->toBase()
                ->get(['products.id as id', 'products.name as name'])
                ->map(fn (object $row) => ['id' => (int) $row->id, 'name' => (string) $row->name])->all());

        $earlier = ($customer !== null
            ? $customer->conversations()->getQuery()
            : SupportConversation::query()->whereNull('user_id')->where('session_key', $conversation->session_key))
            ->whereKeyNot($conversation->id)
            ->when(! $includeNonTickets, fn (Builder $query) => $query->where('needs_human', true))
            ->latest('id')->limit(6);

        return [
            'customer' => $customer === null ? null : [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'segment' => $customer->segment,
                'verified' => $customer->hasVerifiedEmail(),
                'joined' => $customer->created_at?->toIso8601String(),
            ],
            'overview' => $customer === null ? null : $this->profile->overview($customer, $demo),
            'orders' => array_values($orders->map(fn (Order $order) => [
                'id' => (int) $order->id,
                'code' => $order->code,
                'status' => (string) $order->status,
                'payment_status' => (string) $order->payment_status,
                'total' => (int) $order->total,
                'is_demo' => (bool) $order->is_demo,
                'created_at' => Carbon::parse($order->created_at)->toIso8601String(),
            ])->all()),
            'purchased' => $products === null ? [] : array_map(
                fn (array $product) => ['name' => $product['name'], 'units' => $product['units']],
                array_slice($products['purchased'], 0, 5),
            ),
            'viewed' => $viewed,
            // The rackets they had strung, or asked to: the stringing service's own requests.
            'services' => $customer === null ? [] : $this->stringing->history($customer, 3),
            'conversations' => $this->summaries($earlier),
        ];
    }

    /** The account a conversation can belong to: staff answer customers, they are not one. */
    private function customer(Request $request): ?User
    {
        $user = $request->user();

        return $user instanceof User && ! $user->is_admin ? $user : null;
    }

    private function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /**
     * @param  Builder<SupportConversation>|HasMany<SupportConversation, User>  $conversations
     * @return list<array{id: int, status: string, needs_human: bool, started_at: string, last_message_at: string|null, excerpt: string, messages: int, assigned_name: string|null}>
     */
    private function summaries($conversations): array
    {
        return array_values($conversations->with(['firstMessage', 'assignedUser:id,name'])->withCount('messages')->get()
            ->map(fn (SupportConversation $conversation) => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'needs_human' => $conversation->needs_human,
                'started_at' => $conversation->created_at->toIso8601String(),
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
                // A conversation starts with what the customer wrote.
                'excerpt' => Str::limit((string) $conversation->firstMessage?->body, 90),
                'messages' => (int) $conversation->getAttribute('messages_count'),
                'assigned_name' => $conversation->assignedUser?->name,
            ])->all());
    }
}
