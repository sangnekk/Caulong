<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sales and stock over a chosen period, compared with the period before. Three kinds of money:
 * "doanh số" is the value of orders placed (not cancelled), counted on the day of the order;
 * "lãi gộp" is goods sold minus their cost, only over lines whose cost was known when sold;
 * "đã thu" is COD cash recorded as collected, counted on the day it was collected.
 */
class ReportController extends Controller
{
    private const PERIODS = ['7d', '30d', '90d', '12m'];

    /** Profit of order lines with a known cost; SUM skips the unknown ones (NULL). */
    private const PROFIT = 'sum(case when order_items.unit_cost is null then null else order_items.line_total - order_items.unit_cost * order_items.quantity end)';

    public function __invoke(Request $request): Response
    {
        $validated = $request->validate([
            'period' => ['nullable', Rule::in(self::PERIODS)],
            'demo' => ['nullable', 'boolean'],
        ]);
        $period = $validated['period'] ?? '30d';
        $demo = (bool) ($validated['demo'] ?? false);
        $zone = (string) config('shop.timezone');
        $now = CarbonImmutable::now($zone);
        $monthly = $period === '12m';
        $start = $monthly ? $now->startOfMonth()->subMonths(11) : $now->startOfDay()->subDays((int) $period - 1);
        $previous = $monthly ? $start->subMonths(12) : $start->subDays((int) $period);

        $orders = fn (): Builder => Order::query()->when(! $demo, fn ($query) => $query->where('is_demo', false));
        $current = $this->totals($orders, $start, $now);
        $before = $this->totals($orders, $previous, $start);

        return Inertia::render('admin/reports', [
            'filters' => ['period' => $period, 'demo' => $demo],
            'range' => ['from' => $start->toDateString(), 'to' => $now->toDateString(), 'monthly' => $monthly],
            'totals' => $current,
            'previous' => $before,
            'series' => $this->series($orders, $start, $now, $monthly),
            'statuses' => $orders()->whereBetween('created_at', $this->utc($start, $now))
                ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
                ->map(fn ($total) => (int) $total),
            'topProducts' => $this->sold($orders, $start, $now)
                ->selectRaw('order_items.product_name as name, sum(order_items.quantity) as quantity, sum(order_items.line_total) as revenue, '.self::PROFIT.' as profit')
                ->groupBy('order_items.product_name')->orderByDesc('revenue')->limit(8)->get()
                ->map(fn ($row) => [
                    'name' => $row->getAttribute('name'),
                    'quantity' => (int) $row->getAttribute('quantity'),
                    'revenue' => (int) $row->getAttribute('revenue'),
                    'profit' => $row->getAttribute('profit') === null ? null : (int) $row->getAttribute('profit'),
                ]),
            'byBrand' => $this->breakdown($orders, $start, $now, 'brand'),
            'byStyle' => $this->breakdown($orders, $start, $now, 'style'),
            'stock' => $this->stock($demo),
            'customers' => [
                'new' => User::where('is_admin', false)->whereBetween('created_at', $this->utc($start, $now))->count(),
                'buyers' => $orders()->whereBetween('created_at', $this->utc($start, $now))->where('status', '!=', 'cancelled')
                    ->distinct()->count('phone'),
            ],
        ]);
    }

    /**
     * @param  callable(): Builder<Order>  $orders
     * @return array{sales: int, collected: int, orders: int, placed: int, cancelled: int, average: int, items: int, goods: int, costed: int, profit: int}
     */
    private function totals(callable $orders, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $range = $this->utc($from, $to);
        $placed = $orders()->whereBetween('created_at', $range);
        $kept = (clone $placed)->where('status', '!=', 'cancelled');
        $sales = (int) (clone $kept)->sum('total');
        $keptCount = (clone $kept)->count();
        $lines = OrderItem::whereIn('order_id', (clone $kept)->select('id'));
        $costed = (clone $lines)->whereNotNull('unit_cost');

        return [
            'sales' => $sales,
            'collected' => (int) $orders()->whereBetween('paid_at', $range)->sum('total'),
            'orders' => $keptCount,
            'placed' => (clone $placed)->count(),
            'cancelled' => (clone $placed)->where('status', 'cancelled')->count(),
            'average' => $keptCount ? intdiv($sales, $keptCount) : 0,
            'items' => (int) (clone $lines)->sum('quantity'),
            // Goods only (no delivery fee): the base the margin is measured on.
            'goods' => (int) (clone $lines)->sum('line_total'),
            'costed' => (int) (clone $costed)->sum('line_total'),
            'profit' => (int) (clone $costed)->sum(DB::raw('line_total - unit_cost * quantity')),
        ];
    }

    /**
     * One point per day (or per month over a year), in the shop's time zone.
     *
     * @param  callable(): Builder<Order>  $orders
     * @return list<array{key: string, sales: int, collected: int, orders: int, profit: int}>
     */
    private function series(callable $orders, CarbonImmutable $from, CarbonImmutable $to, bool $monthly): array
    {
        $zone = (string) config('shop.timezone');
        $format = $monthly ? 'Y-m' : 'Y-m-d';
        $points = [];
        for ($day = $from; $day <= $to; $day = $monthly ? $day->addMonth() : $day->addDay()) {
            $points[$day->format($format)] = ['key' => $day->format($format), 'sales' => 0, 'collected' => 0, 'orders' => 0, 'profit' => 0];
        }
        $range = $this->utc($from, $to);
        $rows = $orders()->where(fn ($query) => $query->whereBetween('created_at', $range)->orWhereBetween('paid_at', $range))
            ->select(['id', 'status', 'total', 'created_at', 'paid_at'])
            ->addSelect(['profit' => OrderItem::query()->selectRaw(self::PROFIT)->whereColumn('order_items.order_id', 'orders.id')])
            ->get();
        foreach ($rows as $order) {
            $placed = $order->created_at?->setTimezone($zone)->format($format);
            if ($placed !== null && isset($points[$placed]) && $order->status !== 'cancelled') {
                $points[$placed]['sales'] += $order->total;
                $points[$placed]['orders']++;
                $points[$placed]['profit'] += (int) $order->getAttribute('profit');
            }
            $paid = $order->paid_at?->setTimezone($zone)->format($format);
            if ($paid !== null && isset($points[$paid])) {
                $points[$paid]['collected'] += $order->total;
            }
        }

        return array_values($points);
    }

    /**
     * Order lines of kept (not cancelled) orders placed in the period.
     *
     * @param  callable(): Builder<Order>  $orders
     * @return Builder<OrderItem>
     */
    private function sold(callable $orders, CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return OrderItem::query()->whereIn('order_items.order_id', $orders()
            ->whereBetween('created_at', $this->utc($from, $to))->where('status', '!=', 'cancelled')->select('id'));
    }

    /**
     * Revenue of the period's sold lines grouped by the product's brand or play style.
     *
     * @param  callable(): Builder<Order>  $orders
     * @param  'brand'|'style'  $by
     * @return list<array{name: string, revenue: int, quantity: int}>
     */
    private function breakdown(callable $orders, CarbonImmutable $from, CarbonImmutable $to, string $by): array
    {
        $query = $this->sold($orders, $from, $to)
            ->leftJoin('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->leftJoin('products', 'products.id', '=', 'product_variants.product_id');
        if ($by === 'brand') {
            $query->leftJoin('brands', 'brands.id', '=', 'products.brand_id')
                ->selectRaw('brands.name as name, sum(order_items.line_total) as revenue, sum(order_items.quantity) as quantity')
                ->groupBy('brands.name');
        } else {
            $query->selectRaw('products.play_style as name, sum(order_items.line_total) as revenue, sum(order_items.quantity) as quantity')
                ->groupBy('products.play_style');
        }

        return array_values($query->orderByDesc('revenue')->limit(8)->get()
            ->map(fn ($row) => [
                // Lines whose variant was later removed keep their money but lose the grouping.
                'name' => (string) ($row->getAttribute('name') ?? ''),
                'revenue' => (int) $row->getAttribute('revenue'),
                'quantity' => (int) $row->getAttribute('quantity'),
            ])->all());
    }

    /**
     * Stock right now (not per period). Demo products count only when the demo switch is on.
     *
     * @return array{on_sale: int, hidden: int, units: int, value: int, cost_value: int, costed_units: int, out: int, low: int}
     */
    private function stock(bool $demo): array
    {
        $sellable = ProductVariant::query()->where('product_variants.is_active', true)
            ->whereHas('product', fn ($query) => $query->where('is_active', true)->when(! $demo, fn ($query) => $query->where('is_demo', false)));
        $real = fn () => Product::query()->when(! $demo, fn ($query) => $query->where('is_demo', false));

        return [
            'on_sale' => $real()->where('is_active', true)->count(),
            'hidden' => $real()->where('is_active', false)->count(),
            'units' => (int) (clone $sellable)->sum('stock'),
            'value' => (int) (clone $sellable)->sum(DB::raw('stock * price')),
            'cost_value' => (int) (clone $sellable)->whereNotNull('cost_price')->sum(DB::raw('stock * cost_price')),
            'costed_units' => (int) (clone $sellable)->whereNotNull('cost_price')->sum('stock'),
            'out' => $real()->where('is_active', true)
                ->whereDoesntHave('variants', fn ($query) => $query->where('is_active', true)->where('stock', '>', 0))->count(),
            'low' => (clone $sellable)->whereBetween('stock', [1, 5])->count(),
        ];
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function utc(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return [$from->utc(), $to->utc()];
    }
}
