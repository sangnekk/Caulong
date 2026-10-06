<?php

namespace App\Services;

use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\User;
use App\Support\CustomerFacts;
use App\Support\DemoData;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

/**
 * Puts each customer account in one group, by rule, from their orders and what they did in
 * the shop. The thresholds are the owner's (ShopSettings::segments()).
 *
 * Someone with nothing at all for `lost_days` is LOST. A buyer is VIP from `vip_spend`
 * received, else INACTIVE after `inactive_days` without an order, else ACTIVE. An account
 * that has not bought is POTENTIAL when it shows interest, NEW for its first `new_days`, and
 * INACTIVE after that. Staff accounts have no group.
 *
 * As everywhere else, sample orders count on a local machine only.
 */
class CustomerSegmentation
{
    public const SEGMENTS = ['new', 'potential', 'active', 'vip', 'inactive', 'lost'];

    /** What counts as interest from an account that has not bought yet, and how recent. */
    private const INTEREST = ['product_view', 'add_to_cart', 'wishlist_added', 'checkout_started'];

    private const INTEREST_DAYS = 30;

    public function __construct(private ShopSettings $settings) {}

    /**
     * The rule itself.
     *
     * @return value-of<self::SEGMENTS>
     */
    public function classify(CustomerFacts $facts, ?CarbonInterface $now = null): string
    {
        $rules = $this->settings->segments();
        $now = ($now ?? now())->getTimestamp();
        $daysSince = fn (CarbonInterface $moment): float => ($now - $moment->getTimestamp()) / 86400;
        $seen = max(array_map(
            fn (?CarbonInterface $moment): int => $moment?->getTimestamp() ?? 0,
            [$facts->registeredAt, $facts->lastOrderAt, $facts->lastEventAt],
        ));

        if (($now - $seen) / 86400 > $rules['lost_days']) {
            return 'lost';
        }
        if ($facts->orders > 0) {
            if ($facts->spent >= $rules['vip_spend']) {
                return 'vip';
            }

            return $facts->lastOrderAt !== null && $daysSince($facts->lastOrderAt) > $rules['inactive_days'] ? 'inactive' : 'active';
        }
        if ($facts->interest >= $rules['potential_events']) {
            return 'potential';
        }

        return $daysSince($facts->registeredAt) <= $rules['new_days'] ? 'new' : 'inactive';
    }

    /** One customer, now: after they order, or before a group coupon is checked. */
    public function refresh(User $user): ?string
    {
        $segment = $user->is_admin
            ? null
            : $this->classify($this->facts([$user->id => $user->created_at ?? now()])[$user->id]);
        if ($user->segment !== $segment) {
            $user->forceFill(['segment' => $segment, 'segment_updated_at' => now()])->save();
        }

        return $segment;
    }

    /**
     * Every customer (`php artisan crm:segment`, scheduled daily).
     *
     * @return array<value-of<self::SEGMENTS>, int> customers per group
     */
    public function refreshAll(): array
    {
        $counts = array_fill_keys(self::SEGMENTS, 0);
        User::query()->where('is_admin', true)->whereNotNull('segment')->toBase()->update(['segment' => null, 'segment_updated_at' => now()]);
        User::query()->where('is_admin', false)->select(['id', 'created_at', 'segment'])
            ->chunkById(500, function (Collection $users) use (&$counts): void {
                /** @var Collection<int, User> $users */
                $facts = $this->facts($users->mapWithKeys(fn (User $user) => [$user->id => $user->created_at ?? now()])->all());
                $moved = [];
                foreach ($users as $user) {
                    $segment = $this->classify($facts[$user->id]);
                    $counts[$segment]++;
                    if ($user->segment !== $segment) {
                        $moved[$segment][] = $user->id;
                    }
                }
                foreach ($moved as $segment => $ids) {
                    User::query()->whereKey($ids)->toBase()->update(['segment' => $segment, 'segment_updated_at' => now()]);
                }
            });

        return $counts;
    }

    /**
     * The facts for a set of accounts, in two grouped queries.
     *
     * @param  array<int, CarbonInterface>  $registered  sign-up time by user id
     * @return array<int, CustomerFacts>
     */
    private function facts(array $registered): array
    {
        $ids = array_keys($registered);
        $orders = Order::query()->whereIn('user_id', $ids)
            ->when(! DemoData::shownByDefault(), fn ($query) => $query->where('is_demo', false))
            ->toBase()->groupBy('user_id')
            ->selectRaw(
                "user_id, sum(case when status != 'cancelled' then 1 else 0 end) as kept, "
                ."sum(case when payment_status = 'paid' then total else 0 end) as spent, "
                ."max(case when status != 'cancelled' then created_at end) as last_order_at"
            )->get()->keyBy('user_id');
        $events = CustomerEvent::query()->whereIn('user_id', $ids)->toBase()->groupBy('user_id')
            ->selectRaw(
                'user_id, max(created_at) as last_event_at, '
                .'sum(case when name in (?, ?, ?, ?) and created_at >= ? then 1 else 0 end) as interest',
                [...self::INTEREST, now()->subDays(self::INTEREST_DAYS)->toDateTimeString()],
            )->get()->keyBy('user_id');
        $time = fn (mixed $value): ?CarbonInterface => $value === null ? null : Carbon::parse((string) $value);

        $facts = [];
        foreach ($registered as $id => $registeredAt) {
            $bought = $orders->get($id);
            $did = $events->get($id);
            $facts[$id] = new CustomerFacts(
                registeredAt: $registeredAt,
                orders: (int) ($bought->kept ?? 0),
                spent: (int) ($bought->spent ?? 0),
                lastOrderAt: $time($bought->last_order_at ?? null),
                lastEventAt: $time($did->last_event_at ?? null),
                interest: (int) ($did->interest ?? 0),
            );
        }

        return $facts;
    }
}
