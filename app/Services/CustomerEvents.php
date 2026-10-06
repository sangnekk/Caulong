<?php

namespace App\Services;

use App\Models\CustomerEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * The one place customer events are written: what a visitor did in the shop that no other
 * table records. Orders, accounts and reviews already say when they were made; the customer
 * timeline reads those from their own tables.
 *
 * Staff accounts are not customers: nothing is recorded for an admin.
 */
class CustomerEvents
{
    /**
     * Every event the shop records, with the metadata it may carry. A key that is not listed
     * here is dropped, so no caller can store an address, a password or a token by accident.
     */
    public const EVENTS = [
        'product_view' => [],
        'search' => ['q', 'results'],
        'add_to_cart' => ['variant_id', 'quantity', 'price'],
        'remove_from_cart' => ['variant_id'],
        'checkout_started' => ['items', 'subtotal'],
        // Entered and accepted for the cart; its use on an order is in coupon_redemptions.
        'coupon_applied' => ['code'],
        // Ties the visit to the order it ended in; the order itself is in `orders`.
        'order_placed' => ['items', 'total'],
        'wishlist_added' => [],
        'chat_started' => [],
    ];

    /**
     * Events only the browser can report: Next.js renders (and prefetches) those pages, so a
     * request reaching Laravel does not mean someone is looking at the page.
     */
    public const FROM_BROWSER = ['product_view', 'search', 'checkout_started'];

    /** The same page looked at again within this time is the same visit, not a new event. */
    private const REPEAT_MINUTES = 30;

    private const TEXT_LIMIT = 100;

    /**
     * Records one event for whoever makes the request. Never fails the request it is part of:
     * a lost event must not cost the customer their cart or their order.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function record(Request $request, string $name, ?int $productId = null, ?int $orderId = null, array $metadata = []): ?CustomerEvent
    {
        if (! isset(self::EVENTS[$name])) {
            throw new InvalidArgumentException("Unknown customer event: {$name}");
        }

        return rescue(function () use ($request, $name, $productId, $orderId, $metadata): ?CustomerEvent {
            $user = $request->user();
            $sessionKey = $this->sessionKey($request);
            if ($user?->is_admin || ($user === null && $sessionKey === null)) {
                return null;
            }
            $metadata = $this->clean($name, $metadata);
            if (in_array($name, self::FROM_BROWSER, true) && $this->repeated($user?->id, $sessionKey, $name, $productId, $metadata)) {
                return null;
            }

            return CustomerEvent::create([
                'user_id' => $user?->id,
                'session_key' => $sessionKey,
                'name' => $name,
                'product_id' => $productId,
                'order_id' => $orderId,
                'metadata' => $metadata ?: null,
            ]);
        });
    }

    /** A visitor who signs in: what they did as a guest during this visit becomes theirs. */
    public function claim(Request $request, User $user): void
    {
        if ($user->is_admin || ! $request->hasSession() || ! is_string($request->session()->get('visitor_key'))) {
            return;
        }
        rescue(fn () => CustomerEvent::query()->whereNull('user_id')
            ->where('session_key', $this->sessionKey($request))->update(['user_id' => $user->id]));
    }

    /**
     * Groups the events of one visit. Derived from a random value kept in the session, never
     * from the session id itself (which is a credential) and never from anything personal.
     */
    public function sessionKey(Request $request): ?string
    {
        if (! $request->hasSession()) {
            return null;
        }
        $visitor = $request->session()->get('visitor_key');
        if (! is_string($visitor)) {
            $visitor = (string) Str::uuid();
            $request->session()->put('visitor_key', $visitor);
        }

        return hash_hmac('sha256', $visitor, (string) config('app.key'));
    }

    /**
     * Only the listed keys, only whole numbers, booleans and short text.
     *
     * @param  array<string, mixed>  $metadata
     * @return array<string, int|string|bool>
     */
    private function clean(string $name, array $metadata): array
    {
        $clean = [];
        foreach (self::EVENTS[$name] as $key) {
            $value = $metadata[$key] ?? null;
            if (is_int($value) || is_bool($value)) {
                $clean[$key] = $value;
            } elseif (is_string($value) && trim($value) !== '') {
                $clean[$key] = mb_substr(trim($value), 0, self::TEXT_LIMIT);
            }
        }

        return $clean;
    }

    /** @param  array<string, int|string|bool>  $metadata */
    private function repeated(?int $userId, ?string $sessionKey, string $name, ?int $productId, array $metadata): bool
    {
        return CustomerEvent::query()->where('name', $name)
            ->where('created_at', '>=', now()->subMinutes(self::REPEAT_MINUTES))
            ->where(fn (Builder $query) => $userId !== null
                ? $query->where('user_id', $userId)
                : $query->whereNull('user_id')->where('session_key', $sessionKey))
            ->when($productId !== null, fn (Builder $query) => $query->where('product_id', $productId))
            ->when($name === 'search', fn (Builder $query) => $query->where('metadata->q', $metadata['q'] ?? ''))
            ->exists();
    }
}
