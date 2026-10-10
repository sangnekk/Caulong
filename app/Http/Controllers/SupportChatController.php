<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\SupportConversation;
use App\Services\SupportChat;
use App\Services\SupportChatResponder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** The customer's side of the support chat: the widget on every shop page (JSON). */
class SupportChatController extends Controller
{
    /** Wrong codes one address may try before the lookup stops answering for a while. */
    private const LOOKUP_ATTEMPTS = 5;

    private const LOOKUP_MINUTES = 10;

    public function context(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['purchased_products' => []]);
        }

        $products = Order::query()
            ->where('user_id', $user->id)
            ->where('is_demo', false)
            ->where('status', '!=', 'cancelled')
            ->with(['items:id,order_id,product_name'])
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->flatMap(fn (Order $order) => $order->items->pluck('product_name'))
            ->filter(fn (string $name) => $name !== '')
            ->unique()
            ->take(4)
            ->values()
            ->all();

        return response()->json(['purchased_products' => $products]);
    }

    public function index(Request $request, SupportChat $chat): JsonResponse
    {
        return response()->json($this->state($chat, $chat->current($request)));
    }

    public function store(Request $request, SupportChat $chat, SupportChatResponder $responder): JsonResponse
    {
        $validated = $request->validate(['message' => ['required', 'string', 'max:1000']]);
        $body = trim($validated['message']);
        if ($body === '') {
            throw ValidationException::withMessages(['message' => 'Nhập nội dung tin nhắn.']);
        }

        $visitorKey = $request->session()->get('support_chat_rate_key');
        if (! is_string($visitorKey)) {
            $visitorKey = (string) Str::uuid();
            $request->session()->put('support_chat_rate_key', $visitorKey);
        }
        $sessionRateKey = 'support-chat-session:'.hash_hmac('sha256', $visitorKey, (string) config('app.key'));
        if (RateLimiter::tooManyAttempts($sessionRateKey, 8)) {
            return response()->json(['message' => 'Bạn đã gửi đủ số tin trong phút này. Vui lòng đợi một chút.'], 429);
        }
        RateLimiter::hit($sessionRateKey, 60);

        $conversation = $chat->current($request);
        if (! $conversation || $conversation->status === 'closed') {
            $conversation = $chat->start($request);
        }
        $chat->customerWrote($conversation, $body, $responder->reply($body, $request->user() === null));

        return response()->json($this->state($chat, $conversation->refresh()));
    }

    /**
     * A code to read this conversation again later, on any device and without an account.
     * Only once the conversation is solved or closed, and only for whoever is still in it.
     */
    public function code(Request $request, SupportChat $chat): JsonResponse
    {
        $conversation = $chat->current($request);
        if (! $conversation || ! in_array($conversation->status, ['resolved', 'closed'], true)) {
            return response()->json(['message' => 'Mã xem lại chỉ có khi cuộc trò chuyện đã được giải quyết hoặc đã đóng.'], 422);
        }
        $issued = $chat->issueCode($conversation);

        return response()->json(['code' => $issued['code'], 'expires_at' => $issued['expires_at']->toIso8601String()]);
    }

    /** Reads a finished conversation with its code. Wrong codes are counted per address. */
    public function lookup(Request $request, SupportChat $chat): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40']]);
        $attempts = 'support-chat-lookup:'.$request->ip();
        if (RateLimiter::tooManyAttempts($attempts, self::LOOKUP_ATTEMPTS)) {
            return response()->json(['message' => 'Bạn đã nhập sai mã nhiều lần. Vui lòng thử lại sau '.self::LOOKUP_MINUTES.' phút.'], 429);
        }
        $conversation = $chat->byCode($data['code']);
        if (! $conversation) {
            RateLimiter::hit($attempts, self::LOOKUP_MINUTES * 60);

            // The same answer for a code that never existed and one that ran out.
            return response()->json(['message' => 'Mã không đúng hoặc đã hết hạn.'], 404);
        }

        return response()->json($this->transcript($chat, $conversation));
    }

    /** One of the signed-in customer's own conversations, for the history on their account page. */
    public function show(Request $request, SupportConversation $conversation, SupportChat $chat): JsonResponse
    {
        abort_unless($conversation->user_id !== null && $conversation->user_id === $request->user()?->id, 404);

        return response()->json($this->transcript($chat, $conversation));
    }

    /**
     * What the widget shows: the conversation the visitor is in, if any.
     *
     * @return array<string, mixed>
     */
    private function state(SupportChat $chat, ?SupportConversation $conversation): array
    {
        return [
            'status' => $conversation?->status,
            'messages' => $conversation ? $chat->messages($conversation) : [],
            // Whether a code to read it again can be asked for, and until when the last one is good.
            'can_request_code' => $conversation !== null && in_array($conversation->status, ['resolved', 'closed'], true),
            'code_expires_at' => $conversation?->access_code_expires_at?->isFuture() ? $conversation->access_code_expires_at->toIso8601String() : null,
        ];
    }

    /** @return array<string, mixed> */
    private function transcript(SupportChat $chat, SupportConversation $conversation): array
    {
        return [
            'status' => $conversation->status,
            'started_at' => $conversation->created_at->toIso8601String(),
            'closed_at' => $conversation->closed_at?->toIso8601String(),
            'messages' => $chat->messages($conversation, 200),
        ];
    }
}
