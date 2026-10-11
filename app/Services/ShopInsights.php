<?php

namespace App\Services;

use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductReview;
use App\Models\ServiceOrder;
use App\Models\SupportConversation;
use App\Models\User;
use App\Support\DemoData;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * What the shop's reports say besides sales: how visitors move from looking to buying, which
 * groups its customers are in, what coupons and each way of paying brought in, and how the
 * stringing counter and the support inbox are doing.
 *
 * Read-only. Every figure is counted from rows other services wrote; nothing is estimated,
 * and a period with nothing in it reads as zeros.
 */
class ShopInsights
{
    /** The steps from looking at a racket to ordering it, as App\Services\CustomerEvents names them. */
    private const FUNNEL = ['viewed' => 'product_view', 'carted' => 'add_to_cart', 'checkout' => 'checkout_started', 'ordered' => 'order_placed'];

    /**
     * How many visitors got how far, between two moments. A visitor is an account, or for
     * someone not signed in one visit (CustomerEvents' session key). Each step counts those
     * who also took every step before it in the period, so the numbers only go down. Staff
     * are never recorded. Without `$demo`, sample goods and sample orders do not count.
     *
     * @return list<array{key: string, visitors: int}>
     */
    public function funnel(CarbonImmutable $from, CarbonImmutable $to, bool $demo): array
    {
        // is_demo is 0 or 1: "at most 0" keeps real goods and orders only, "at most 1" keeps all.
        // A racket or an order since deleted counts as a real one.
        $sample = $demo ? 1 : 0;
        $rows = DB::table('customer_events as e')
            ->leftJoin('products as p', 'p.id', '=', 'e.product_id')
            ->leftJoin('orders as o', 'o.id', '=', 'e.order_id')
            ->whereBetween('e.created_at', [$from->utc(), $to->utc()])
            ->whereIn('e.name', array_values(self::FUNNEL))
            ->where(fn ($query) => $query->whereNotNull('e.user_id')->orWhereNotNull('e.session_key'))
            // One row per visitor: the account, or the visit of someone not signed in.
            ->groupByRaw('e.user_id, case when e.user_id is null then e.session_key end')
            ->selectRaw("max(case when e.name = 'product_view' and coalesce(p.is_demo, 0) <= ? then 1 else 0 end) as viewed", [$sample])
            ->selectRaw("max(case when e.name = 'add_to_cart' and coalesce(p.is_demo, 0) <= ? then 1 else 0 end) as carted", [$sample])
            ->selectRaw("max(case when e.name = 'checkout_started' then 1 else 0 end) as checkout")
            ->selectRaw("max(case when e.name = 'order_placed' and coalesce(o.is_demo, 0) <= ? then 1 else 0 end) as ordered", [$sample])
            ->get();

        $reached = array_fill_keys(array_keys(self::FUNNEL), 0);
        foreach ($rows as $row) {
            foreach (array_keys(self::FUNNEL) as $key) {
                if ((int) $row->{$key} !== 1) {
                    break;
                }
                $reached[$key]++;
            }
        }

        return array_map(fn (string $key) => ['key' => $key, 'visitors' => $reached[$key]], array_keys(self::FUNNEL));
    }

    /**
     * The customer accounts in each group right now (CustomerSegmentation), in the order a
     * customer moves through them. "none" are accounts not grouped yet.
     *
     * @return list<array{segment: string, customers: int}>
     */
    public function segments(bool $demo): array
    {
        $counts = User::query()->where('is_admin', false)->when(! $demo, fn ($query) => DemoData::withoutDemoCustomers($query))
            ->toBase()->selectRaw('segment, count(*) as total')->groupBy('segment')->get()
            ->mapWithKeys(fn ($row) => [(string) ($row->segment ?? 'none') => (int) $row->total]);
        $groups = [...CustomerSegmentation::SEGMENTS, ...($counts->has('none') ? ['none'] : [])];

        return array_map(fn (string $segment) => ['segment' => $segment, 'customers' => (int) ($counts[$segment] ?? 0)], $groups);
    }

    /**
     * What coupons did among the orders placed in the period and not cancelled.
     *
     * @param  callable(): Builder<Order>  $orders  the orders the report counts (real ones, or sample ones too)
     * @return array{orders: int, of: int, discount: int, sales: int, top: list<array{code: string, orders: int, discount: int, sales: int}>}
     */
    public function coupons(callable $orders, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $kept = $orders()->whereBetween('created_at', [$from->utc(), $to->utc()])->where('status', '!=', 'cancelled');
        $discounted = (clone $kept)->whereNotNull('coupon_code')->where('discount_total', '>', 0);

        return [
            'orders' => (clone $discounted)->count(),
            'of' => (clone $kept)->count(),
            'discount' => (int) (clone $discounted)->sum('discount_total'),
            'sales' => (int) (clone $discounted)->sum('total'),
            'top' => array_values((clone $discounted)->toBase()
                ->selectRaw('coupon_code as code, count(*) as orders, sum(discount_total) as discount, sum(total) as sales')
                ->groupBy('coupon_code')->orderByDesc('discount')->orderBy('coupon_code')->limit(5)->get()
                ->map(fn ($row) => ['code' => (string) $row->code, 'orders' => (int) $row->orders, 'discount' => (int) $row->discount, 'sales' => (int) $row->sales])
                ->all()),
        ];
    }

    /**
     * How the period's orders (placed, not cancelled) are paid for, the transfers the shop is
     * waiting for right now, and those that ended in the period without a sale: sent back, or
     * never made.
     *
     * @param  callable(): Builder<Order>  $orders
     * @return array{methods: list<array{method: string, orders: int, sales: int}>, awaiting: array{orders: int, amount: int}, refunded: array{payments: int, amount: int}, expired: int}
     */
    public function payments(callable $orders, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $range = [$from->utc(), $to->utc()];
        $methods = $orders()->whereBetween('created_at', $range)->where('status', '!=', 'cancelled')->toBase()
            ->selectRaw('payment_method as method, count(*) as orders, sum(total) as sales')->groupBy('payment_method')->get()->keyBy('method');
        $awaiting = $orders()->where('payment_method', PaymentService::METHOD)->where('payment_status', 'unpaid')->where('status', 'pending');
        $refunded = Payment::query()->where('status', 'refunded')->whereBetween('refunded_at', $range);

        return [
            'methods' => array_map(fn (string $method) => [
                'method' => $method,
                'orders' => (int) ($methods[$method]->orders ?? 0),
                'sales' => (int) ($methods[$method]->sales ?? 0),
            ], ['cod', PaymentService::METHOD]),
            'awaiting' => ['orders' => (clone $awaiting)->count(), 'amount' => (int) (clone $awaiting)->sum('total')],
            'refunded' => ['payments' => (clone $refunded)->count(), 'amount' => (int) (clone $refunded)->sum('amount')],
            // Orders that ran out of time: counted on the day they were cancelled.
            'expired' => Payment::query()->where('status', 'expired')
                ->whereHas('order', fn ($query) => $query->whereBetween('cancelled_at', $range))->count(),
        ];
    }

    /**
     * The stringing service: requests received in the period, rackets handed back in it and
     * what was collected for them at the counter, and what is waiting right now.
     *
     * @return array{received: int, cancelled: int, completed: array{requests: int, rackets: int, collected: int}, waiting: array{pending: int, ready: int}}
     */
    public function services(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $range = [$from->utc(), $to->utc()];
        $received = ServiceOrder::query()->whereBetween('created_at', $range);
        $completed = ServiceOrder::query()->where('status', 'completed')->whereBetween('completed_at', $range);

        return [
            'received' => (clone $received)->count(),
            'cancelled' => (clone $received)->where('status', 'cancelled')->count(),
            'completed' => [
                'requests' => (clone $completed)->count(),
                'rackets' => (int) (clone $completed)->sum('quantity'),
                'collected' => (int) (clone $completed)->sum('total'),
            ],
            'waiting' => [
                'pending' => ServiceOrder::query()->where('status', 'pending')->count(),
                'ready' => ServiceOrder::query()->where('status', 'ready')->count(),
            ],
        ];
    }

    /**
     * The support chat: conversations started in the period, how many of them needed a person
     * (tickets), tickets solved in it, and those waiting right now.
     *
     * @return array{conversations: int, tickets: int, solved: int, waiting: array{open: int, pending: int}}
     */
    public function support(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $range = [$from->utc(), $to->utc()];
        $started = SupportConversation::query()->whereBetween('created_at', $range);
        $tickets = fn (): Builder => SupportConversation::query()->where('needs_human', true);

        return [
            'conversations' => (clone $started)->count(),
            'tickets' => (clone $started)->where('needs_human', true)->count(),
            // Marked as solved, or closed without that step, in the period.
            'solved' => $tickets()->where(fn ($query) => $query->whereBetween('resolved_at', $range)
                ->orWhere(fn ($query) => $query->whereNull('resolved_at')->whereBetween('closed_at', $range)))->count(),
            'waiting' => [
                'open' => $tickets()->where('status', 'open')->count(),
                'pending' => $tickets()->where('status', 'pending')->count(),
            ],
        ];
    }

    /**
     * Work waiting outside the orders list, for the dashboard: stringing requests to answer
     * and rackets to hand back, tickets waiting for the shop, reviews to read, and emails of
     * the last seven days that could not be sent.
     *
     * @return array{service_pending: int, service_ready: int, support_open: int, reviews_pending: int, emails_failed: int}
     */
    public function waiting(): array
    {
        return [
            'service_pending' => ServiceOrder::query()->where('status', 'pending')->count(),
            'service_ready' => ServiceOrder::query()->where('status', 'ready')->count(),
            'support_open' => SupportConversation::query()->where('needs_human', true)->where('status', 'open')->count(),
            'reviews_pending' => ProductReview::query()->where('status', 'pending')->count(),
            'emails_failed' => EmailLog::query()->where('status', 'failed')->where('created_at', '>=', now()->subDays(7))->count(),
        ];
    }

    /** Dong collected at the stringing counter since a moment: rackets handed back and paid for. */
    public function serviceCollected(CarbonImmutable $since): int
    {
        return (int) ServiceOrder::query()->where('status', 'completed')->where('completed_at', '>=', $since->utc())->sum('total');
    }
}
