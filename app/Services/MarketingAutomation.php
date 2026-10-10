<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Support\DemoData;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * The shop's promotional emails that send themselves (`php artisan marketing:run`, scheduled):
 * a reminder of a cart left behind, an offer to a buyer who went quiet, a review invitation
 * after a delivery, a thank-you to a new VIP.
 *
 * Each one is off until the owner turns it on in /admin/settings, goes only to customers who
 * agreed to promotional email, and is sent once: email_logs remembers who was written to, and
 * an offer's coupon remembers the offer for good. Real orders only; nothing here runs inside
 * a customer's request.
 */
class MarketingAutomation
{
    public const AUTOMATIONS = ['abandoned_cart', 'winback', 'post_purchase', 'vip'];

    /** A cart older than this is no longer worth a reminder, and one reminder a week is enough. */
    private const CART_DAYS = 7;

    /**
     * The longest wait the owner can set before the reminder. It leaves four of the cart's
     * seven days to send it in: a night or a weekend without the scheduler loses none.
     */
    public const CART_MAX_HOURS = 72;

    /** How long after its day an order can still get its review invitation (missed runs). */
    private const LATE_DAYS = 14;

    public function __construct(
        private ShopSettings $settings,
        private EmailService $emails,
        private CouponService $coupons,
        private RecommendationService $recommendations,
    ) {}

    /**
     * Runs the automations that are switched on (or the one named, when it is on).
     *
     * @return array<value-of<self::AUTOMATIONS>, int> emails queued by each
     */
    public function run(?string $only = null): array
    {
        $rules = $this->settings->marketing();
        $queued = [];
        foreach (self::AUTOMATIONS as $automation) {
            if (($only === null || $only === $automation) && $rules[$automation]) {
                $queued[$automation] = match ($automation) {
                    'abandoned_cart' => $this->abandonedCarts($rules['abandoned_cart_hours']),
                    'winback' => $this->winback($rules['winback_percent'], $rules['winback_valid_days']),
                    'post_purchase' => $this->postPurchase($rules['post_purchase_days']),
                    'vip' => $this->vip($rules['vip_percent'], $rules['vip_valid_days']),
                };
            }
        }

        return $queued;
    }

    /**
     * Customers who put rackets in a cart, then neither ordered nor came back for `$hours`.
     * Carts live in the browser, so the email names the rackets (those still in stock).
     */
    private function abandonedCarts(int $hours): int
    {
        $oldest = now()->subDays(self::CART_DAYS);
        $carts = CustomerEvent::query()->where('name', 'add_to_cart')->where('created_at', '>=', $oldest)
            ->whereIn('user_id', $this->audience()->select('id'))
            ->whereNotIn('user_id', $this->sent('abandoned_cart', 'user_id')->where('created_at', '>=', $oldest))
            ->groupBy('user_id')->havingRaw('max(created_at) <= ?', [now()->subHours($hours)->toDateTimeString()])
            ->toBase()->selectRaw('user_id, max(created_at) as last_added')->limit($this->batch())->get();

        $queued = 0;
        foreach ($carts as $cart) {
            $user = User::query()->whereKey((int) $cart->user_id)->first();
            // An order placed after the last racket went in is that cart, bought.
            if ($user === null || Order::query()->where('user_id', $user->id)->where('created_at', '>=', Carbon::parse($cart->last_added))->exists()) {
                continue;
            }
            $left = $this->leftInCart($user, $oldest);
            if ($left !== [] && $this->emails->products($user, 'abandoned_cart', $left) !== null) {
                $queued++;
            }
        }

        return $queued;
    }

    /**
     * Buyers the shop has not heard from (group "inactive") get a coupon of their own, at
     * most once in `winback_every_days`.
     */
    private function winback(int $percent, int $validDays): int
    {
        $since = now()->subDays((int) config('shop.marketing.winback_every_days'));
        $users = $this->audience()->where('segment', 'inactive')
            ->whereHas('orders', fn (Builder $query) => $query->where('is_demo', false)->where('status', '!=', 'cancelled'))
            ->whereNotIn('id', $this->sent('winback', 'user_id')->where('created_at', '>=', $since))
            ->whereNotIn('id', $this->offered('winback')->where('created_at', '>=', $since))
            ->limit($this->batch())->get();

        return $users->filter(fn (User $user) => $this->offer($user, 'winback', 'Ưu đãi mừng bạn quay lại', $percent, $validDays))->count();
    }

    /**
     * `$days` after an order was delivered: an invitation to review what was received, with a
     * few rackets that go with it. One per order, and not more than one per customer in `$days`.
     */
    private function postPurchase(int $days): int
    {
        $orders = Order::query()->where('is_demo', false)->where('status', 'delivered')
            ->whereBetween('delivered_at', [now()->subDays($days + self::LATE_DAYS), now()->subDays($days)])
            ->whereIn('user_id', $this->audience()->select('id'))
            ->whereNotIn('id', $this->sent('post_purchase', 'order_id'))
            ->whereNotIn('user_id', $this->sent('post_purchase', 'user_id')->where('created_at', '>=', now()->subDays($days)))
            ->with('items.variant:id,product_id')->oldest('delivered_at')->limit($this->batch())->get();

        $queued = 0;
        $written = [];
        foreach ($orders as $order) {
            $user = User::find($order->user_id);
            $bought = array_values($order->items->map(fn ($item) => $item->variant?->product_id)->filter()->unique()->map(fn ($id) => (int) $id)->all());
            if ($user === null || $bought === [] || isset($written[$user->id])) {
                continue;
            }
            if ($this->emails->products($user, 'post_purchase', $bought, $this->goesWith($bought), $order) !== null) {
                $written[$user->id] = true;
                $queued++;
            }
        }

        return $queued;
    }

    /** A customer who became a VIP is thanked once, with a coupon of their own. */
    private function vip(int $percent, int $validDays): int
    {
        $users = $this->audience()->where('segment', 'vip')
            ->whereNotIn('id', $this->sent('vip', 'user_id'))
            ->whereNotIn('id', $this->offered('vip'))
            ->limit($this->batch())->get();

        return $users->filter(fn (User $user) => $this->offer($user, 'vip', 'Ưu đãi khách thân thiết', $percent, $validDays))->count();
    }

    /** Makes the customer's coupon and queues its email; without the email there is no coupon. */
    private function offer(User $user, string $campaign, string $name, int $percent, int $validDays): bool
    {
        $coupon = $this->coupons->issue($user, [
            'name' => $name,
            'type' => 'percent',
            'value' => $percent,
            'max_discount' => (int) config('shop.marketing.max_discount'),
            // Through the last of its days, in the shop's own time.
            'expires_at' => CarbonImmutable::now((string) config('shop.timezone'))->addDays($validDays)->endOfDay()->utc(),
            'campaign' => $campaign,
        ]);
        if ($this->emails->coupon($coupon) === null) {
            $coupon->delete();

            return false;
        }

        return true;
    }

    /**
     * Who may get promotional email at all: customers who said yes, with a verified address.
     *
     * @return Builder<User>
     */
    private function audience(): Builder
    {
        return DemoData::withoutDemoCustomers(User::query()->where('is_admin', false)
            ->whereNotNull('marketing_opt_in_at')->whereNotNull('email_verified_at'));
    }

    /**
     * The customers (or orders) an automation already wrote to, sent or still queued.
     *
     * @return Builder<EmailLog>
     */
    private function sent(string $type, string $column): Builder
    {
        return EmailLog::query()->where('type', $type)->where('status', '!=', 'failed')->whereNotNull($column)->select($column);
    }

    /**
     * The customers who hold an offer's coupon. It is in their account whether or not its
     * email arrived, and it is kept when the email log (a year) has forgotten: no second one.
     *
     * @return Builder<Coupon>
     */
    private function offered(string $campaign): Builder
    {
        return Coupon::query()->where('campaign', $campaign)->whereNotNull('user_id')->select('user_id');
    }

    /**
     * Rackets the customer added and did not take out again since their last order, the
     * latest first: the ones still sold and in stock.
     *
     * @return list<int>
     */
    private function leftInCart(User $user, CarbonInterface $oldest): array
    {
        $lastOrder = Order::query()->where('user_id', $user->id)->max('created_at');
        $events = CustomerEvent::query()->where('user_id', $user->id)->whereIn('name', ['add_to_cart', 'remove_from_cart'])
            ->whereNotNull('product_id')->where('created_at', '>=', $lastOrder === null ? $oldest : max($oldest, Carbon::parse($lastOrder)))
            ->oldest('created_at')->oldest('id')->get(['name', 'product_id']);
        $cart = [];
        foreach ($events as $event) {
            unset($cart[$event->product_id]);
            if ($event->name === 'add_to_cart') {
                $cart[$event->product_id] = true;
            }
        }
        $ids = array_reverse(array_map('intval', array_keys($cart)));

        return array_values($this->recommendations->products($ids, false)
            ->filter(fn (Product $product) => $product->variants->contains(fn ($variant) => $variant->stock > 0))
            ->take(4)->map(fn (Product $product) => $product->id)->all());
    }

    /**
     * Up to four rackets that go with what was bought: what orders hold together with it,
     * then alternatives that play the same way.
     *
     * @param  list<int>  $bought
     * @return list<int>
     */
    private function goesWith(array $bought): array
    {
        $product = Product::find($bought[0]);
        if ($product === null) {
            return [];
        }
        $together = $this->recommendations->boughtTogether($product)->map(fn (Product $product) => $product->id)->all();
        $similar = $this->recommendations->similar($product, 4, [...$bought, ...$together])->map(fn (Product $product) => $product->id)->all();

        return array_slice(array_values(array_diff([...$together, ...$similar], $bought)), 0, 4);
    }

    private function batch(): int
    {
        return max(1, (int) config('shop.marketing.batch'));
    }
}
