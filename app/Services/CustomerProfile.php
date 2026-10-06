<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * What the shop knows about one account, for the admin's customer page: figures from their
 * orders, the products behind them, and a timeline of what they did.
 *
 * `$demo` says whether sample orders count (the admin shows them on a local machine only).
 */
class CustomerProfile
{
    /** Orders read for the timeline, and order lines read for the products: years of buying. */
    private const ORDERS = 200;

    private const LINES = 500;

    /**
     * @return array{orders: int, open: int, cancelled: int, ordered: int, spent: int, average: int, first_order_at: string|null, last_order_at: string|null}
     */
    public function overview(User $user, bool $demo): array
    {
        $row = Order::query()->where('user_id', $user->id)
            ->when(! $demo, fn ($query) => $query->where('is_demo', false))
            ->toBase()->selectRaw(
                "sum(case when status != 'cancelled' then 1 else 0 end) as kept, "
                ."sum(case when status in ('pending', 'confirmed', 'shipped') then 1 else 0 end) as open_orders, "
                ."sum(case when status = 'cancelled' then 1 else 0 end) as cancelled, "
                ."sum(case when status != 'cancelled' then total else 0 end) as ordered, "
                ."sum(case when payment_status = 'paid' then total else 0 end) as spent, "
                ."min(case when status != 'cancelled' then created_at end) as first_order_at, "
                ."max(case when status != 'cancelled' then created_at end) as last_order_at"
            )->first();
        $kept = (int) ($row->kept ?? 0);
        $ordered = (int) ($row->ordered ?? 0);
        $time = fn (?string $value): ?string => $value === null ? null : Carbon::parse($value)->toIso8601String();

        return [
            // Cancelled orders are not purchases: they count apart.
            'orders' => $kept,
            'open' => (int) ($row->open_orders ?? 0),
            'cancelled' => (int) ($row->cancelled ?? 0),
            'ordered' => $ordered,
            // Money the shop has actually received.
            'spent' => (int) ($row->spent ?? 0),
            'average' => $kept > 0 ? intdiv($ordered, $kept) : 0,
            'first_order_at' => $time($row->first_order_at ?? null),
            'last_order_at' => $time($row->last_order_at ?? null),
        ];
    }

    /**
     * What the customer bought, what they tend to buy, what they looked at and what they saved.
     *
     * @return array{
     *     purchased: list<array{id: int|null, name: string, units: int, spent: int, last_at: string|null}>,
     *     brands: list<array{name: string, units: int}>,
     *     categories: list<array{name: string, units: int}>,
     *     viewed: list<array{id: int, name: string, views: int, last_at: string|null}>,
     *     wishlist: list<array{id: int, name: string, added_at: string|null}>
     * }
     */
    public function products(User $user, bool $demo): array
    {
        $lines = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->leftJoin('products', 'products.id', '=', 'product_variants.product_id')
            ->leftJoin('brands', 'brands.id', '=', 'products.brand_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('orders.user_id', $user->id)->where('orders.status', '!=', 'cancelled')
            ->when(! $demo, fn ($query) => $query->where('orders.is_demo', false))
            ->orderByDesc('order_items.id')->limit(self::LINES)->toBase()
            ->get([
                'order_items.product_name', 'order_items.quantity', 'order_items.line_total', 'orders.created_at as ordered_at',
                'products.id as product_id', 'products.name as current_name', 'brands.name as brand', 'categories.name as category',
            ]);
        $time = fn (?string $value): ?string => $value === null ? null : Carbon::parse($value)->toIso8601String();
        $purchased = [];
        $brands = [];
        $categories = [];
        foreach ($lines as $line) {
            $key = $line->product_id !== null ? 'id:'.$line->product_id : 'name:'.$line->product_name;
            // Newest line first: the first one seen gives the date of the last purchase.
            $purchased[$key] ??= [
                'id' => $line->product_id === null ? null : (int) $line->product_id,
                'name' => (string) ($line->current_name ?? $line->product_name),
                'units' => 0,
                'spent' => 0,
                'last_at' => $time($line->ordered_at),
            ];
            $purchased[$key]['units'] += (int) $line->quantity;
            $purchased[$key]['spent'] += (int) $line->line_total;
            if ($line->brand !== null) {
                $brands[$line->brand] = ($brands[$line->brand] ?? 0) + (int) $line->quantity;
            }
            if ($line->category !== null) {
                $categories[$line->category] = ($categories[$line->category] ?? 0) + (int) $line->quantity;
            }
        }
        $top = function (array $units): array {
            arsort($units);
            $rows = [];
            foreach (array_slice($units, 0, 5, true) as $name => $count) {
                $rows[] = ['name' => (string) $name, 'units' => (int) $count];
            }

            return $rows;
        };

        $viewed = CustomerEvent::query()->join('products', 'products.id', '=', 'customer_events.product_id')
            ->where('customer_events.user_id', $user->id)->where('customer_events.name', 'product_view')
            ->groupBy('products.id', 'products.name')
            ->orderByRaw('max(customer_events.created_at) desc')->limit(12)->toBase()
            ->selectRaw('products.id as id, products.name as name, count(*) as views, max(customer_events.created_at) as last_at')
            ->get();

        return [
            'purchased' => array_values($purchased),
            'brands' => $top($brands),
            'categories' => $top($categories),
            'viewed' => array_values($viewed->map(fn (object $row) => [
                'id' => (int) $row->id, 'name' => (string) $row->name, 'views' => (int) $row->views, 'last_at' => $time($row->last_at),
            ])->all()),
            'wishlist' => array_values($user->wishlist()->limit(50)->get(['products.id', 'products.name'])
                ->map(fn (Product $product) => [
                    'id' => $product->id, 'name' => $product->name,
                    'added_at' => $product->getRelation('pivot')->getAttribute('created_at')?->toIso8601String(),
                ])->all()),
        ];
    }

    /**
     * Coupons made for this customer, and every order of theirs a coupon was used on.
     *
     * @return array{
     *     personal: list<array<string, mixed>>,
     *     used: list<array{id: int, code: string, amount: int, at: string|null, order: array{id: int, total: int}}>
     * }
     */
    public function coupons(User $user): array
    {
        return [
            'personal' => array_values($user->coupons()->withCount('redemptions')->latest('id')->limit(50)->get()
                ->map(fn (Coupon $coupon) => [
                    ...$coupon->only(['id', 'code', 'name', 'type', 'value', 'min_order', 'max_discount', 'campaign']),
                    'expires_at' => $coupon->expires_at?->toIso8601String(),
                    'state' => $coupon->state((int) $coupon->getAttribute('redemptions_count')),
                ])->all()),
            'used' => array_values(CouponRedemption::query()->where('user_id', $user->id)
                ->with(['coupon:id,code', 'order:id,total'])->latest('id')->limit(50)->get()
                ->map(fn (CouponRedemption $redemption) => [
                    'id' => $redemption->id,
                    'code' => $redemption->coupon->code,
                    'amount' => $redemption->amount,
                    'at' => $redemption->created_at->toIso8601String(),
                    'order' => ['id' => $redemption->order->id, 'total' => (int) $redemption->order->total],
                ])->all()),
        ];
    }

    /**
     * The customer's activity, newest first: what they did in the shop (customer_events), what
     * happened to their orders (orders), their reviews, and the day the account was made.
     *
     * A page is continued with `next`: entries up to that moment, skipping the ones that share
     * it and were already shown.
     *
     * @return array{entries: list<array<string, mixed>>, next: array{before: string, skip: int}|null}
     */
    public function timeline(User $user, bool $demo, ?CarbonInterface $before = null, int $skip = 0, int $limit = 40): array
    {
        $entries = [];
        $add = function (string $type, ?CarbonInterface $at, string $key, array $about = []) use (&$entries, $before): void {
            if ($at !== null && ($before === null || $at->getTimestamp() <= $before->getTimestamp())) {
                $entries[] = ['type' => $type, 'at' => $at, 'key' => $key, ...$about];
            }
        };

        // Keys order what shares a second, newest first: the order, the coupon it used, what
        // led to it, and the account itself last.
        $add('register', $user->created_at, '0:account');
        $events = $user->events()->where('name', '!=', 'order_placed')
            ->when($before, fn ($query) => $query->where('created_at', '<=', $before))
            ->with('product:id,name')->latest('created_at')->latest('id')->limit($skip + $limit + 1)->get();
        foreach ($events as $event) {
            $add($event->name, $event->created_at, sprintf('1:event:%012d', $event->id), [
                'product' => $event->product?->only(['id', 'name']),
                'data' => $event->metadata,
            ]);
        }
        $orders = $user->orders()->when(! $demo, fn ($query) => $query->where('is_demo', false))->latest('id')->limit(self::ORDERS)
            ->get(['id', 'total', 'is_demo', 'created_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at', 'paid_at']);
        foreach ($orders as $order) {
            $about = ['order' => $order->only(['id', 'total', 'is_demo'])];
            // In the order they happen, so steps recorded in the same second still read right.
            $steps = ['placed' => $order->created_at, 'confirmed' => $order->confirmed_at, 'shipped' => $order->shipped_at,
                'delivered' => $order->delivered_at, 'cancelled' => $order->cancelled_at, 'paid' => $order->paid_at];
            foreach (array_keys($steps) as $position => $step) {
                $add('order_'.$step, $steps[$step], sprintf('3:order:%012d:%d', $order->id, $position), $about);
            }
        }
        $used = CouponRedemption::query()->where('user_id', $user->id)->with(['coupon:id,code', 'order:id,total,is_demo'])->latest('id')->limit(self::ORDERS)->get();
        foreach ($used as $redemption) {
            $add('coupon_used', $redemption->created_at, sprintf('2:coupon:%012d', $redemption->id), [
                'order' => $redemption->order->only(['id', 'total', 'is_demo']),
                'data' => ['code' => $redemption->coupon->code, 'amount' => $redemption->amount],
            ]);
        }
        foreach ($user->reviews()->with('product:id,name')->get() as $review) {
            /** @var ProductReview $review */
            $add('review', $review->created_at, sprintf('4:review:%012d', $review->id), [
                'product' => $review->product->only(['id', 'name']),
                'data' => ['rating' => $review->rating],
            ]);
        }

        usort($entries, fn (array $a, array $b) => [$b['at']->getTimestamp(), $b['key']] <=> [$a['at']->getTimestamp(), $a['key']]);
        $entries = array_slice($entries, $skip);
        $page = array_slice($entries, 0, $limit);
        $next = null;
        if (count($entries) > $limit) {
            $last = $page[count($page) - 1]['at'];
            $shown = count(array_filter($page, fn (array $entry) => $entry['at']->getTimestamp() === $last->getTimestamp()));
            $next = [
                'before' => $last->toIso8601String(),
                // Still inside the moment this page started from: those entries stay skipped too.
                'skip' => $shown + ($before !== null && $before->getTimestamp() === $last->getTimestamp() ? $skip : 0),
            ];
        }

        return [
            'entries' => array_map(fn (array $entry) => [...$entry, 'at' => $entry['at']->toIso8601String()], $page),
            'next' => $next,
        ];
    }
}
