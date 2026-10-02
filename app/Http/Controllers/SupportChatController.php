<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Services\SupportChatResponder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SupportChatController extends Controller
{
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

    public function index(Request $request): JsonResponse
    {
        $conversation = $this->conversation($request);

        return response()->json([
            'status' => $conversation?->status,
            'messages' => $conversation ? $this->messages($conversation) : [],
        ]);
    }

    public function store(Request $request, SupportChatResponder $responder): JsonResponse
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

        $conversation = $this->conversation($request);
        if (! $conversation || $conversation->status === 'closed') {
            $sessionKey = hash_hmac('sha256', $request->session()->getId(), (string) config('app.key'));
            $conversation = SupportConversation::create(['session_key' => $sessionKey]);
            $request->session()->put('support_conversation_id', $conversation->id);
        }

        $guest = $request->user() === null;
        DB::transaction(function () use ($conversation, $body, $responder, $guest): void {
            $reply = $responder->reply($body, $guest);
            $conversation->messages()->create([
                'sender' => 'customer',
                'body' => $body,
                'read_at' => $reply['needs_human'] ? null : now(),
            ]);
            $conversation->messages()->create([
                'sender' => 'bot',
                'body' => $reply['body'],
                'action_url' => $reply['action_url'],
                'action_label' => $reply['action_label'],
            ]);
            $conversation->forceFill([
                'needs_human' => $conversation->needs_human || $reply['needs_human'],
                'last_message_at' => now(),
            ])->save();
        });
        $conversation->refresh();

        return response()->json([
            'status' => $conversation->status,
            'messages' => $this->messages($conversation),
        ]);
    }

    /** @return list<array{id: int, sender: string, body: string, action_url: string|null, action_label: string|null, created_at: string}> */
    private function messages(SupportConversation $conversation): array
    {
        return array_values($conversation->messages()->oldest('id')->limit(100)->get()
            ->map(fn (SupportMessage $message) => [
                'id' => $message->id,
                'sender' => $message->sender,
                'body' => $message->body,
                'action_url' => $message->action_url,
                'action_label' => $message->action_label,
                'created_at' => $message->created_at->toIso8601String(),
            ])->all());
    }

    private function conversation(Request $request): ?SupportConversation
    {
        $id = $request->session()->get('support_conversation_id');

        return is_numeric($id) ? SupportConversation::find((int) $id) : null;
    }
}
