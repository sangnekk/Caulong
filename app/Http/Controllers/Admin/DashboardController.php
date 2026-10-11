<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CatalogImporter;
use App\Services\PaymentService;
use App\Services\ShopInsights;
use App\Support\DemoData;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, CatalogImporter $importer, ShopInsights $insights): Response|RedirectResponse
    {
        // Support staff work in the inbox: the shop's figures are not theirs to see.
        if ($request->user()?->cannot('manage-shop')) {
            return redirect()->route('admin.support-chat.index');
        }
        $demo = (bool) ($request->validate(['demo' => ['nullable', 'boolean']])['demo'] ?? DemoData::shownByDefault());
        // Demo orders and products are labelled everywhere; they only count when the demo switch is on.
        $orders = fn () => Order::query()->when(! $demo, fn ($query) => $query->where('is_demo', false));
        $products = fn () => Product::query()->when(! $demo, fn ($query) => $query->where('is_demo', false));
        // Only what customers can buy, and only 1–5 left: sold-out items are their own task.
        $lowStock = ProductVariant::where('is_active', true)->whereBetween('stock', [1, 5])
            ->whereHas('product', fn ($query) => $query->where('is_active', true)->when(! $demo, fn ($query) => $query->where('is_demo', false)));
        $sellable = fn ($query) => $query->where('is_active', true)->where('stock', '>', 0);
        // "Today" and "last 7 days" are shop days (Vietnam), the database is UTC.
        $today = CarbonImmutable::now((string) config('shop.timezone'))->startOfDay();
        $week = $today->subDays(6);
        $kept = fn (CarbonImmutable $from) => $orders()->where('status', '!=', 'cancelled')->where('created_at', '>=', $from->utc());
        $costed = OrderItem::whereIn('order_id', $kept($week)->select('id'))->whereNotNull('unit_cost');
        $awaiting = fn ($query) => $query->where('payment_method', PaymentService::METHOD)->where('payment_status', 'unpaid');
        // Sales, profit and money collected are the owner's to see (as the reports are); staff
        // get the same page without them.
        $figures = (bool) $request->user()?->can('administer-shop');

        return Inertia::render('admin/dashboard', [
            'figures' => $figures,
            'demo' => $demo,
            'demoDefault' => DemoData::shownByDefault(),
            'todo' => [
                // To call and confirm; an order still waiting for its bank transfer is its own task.
                'pending_orders' => $orders()->where('status', 'pending')->whereNot($awaiting)->count(),
                'awaiting_transfer' => $orders()->where('status', 'pending')->where($awaiting)->count(),
                'confirmed_orders' => $orders()->where('status', 'confirmed')->count(),
                'uncollected' => $orders()->where('status', 'delivered')->where('payment_status', '!=', 'paid')->count(),
                'low_stock' => (clone $lowStock)->count(),
                'sold_out' => $products()->where('is_active', true)->whereDoesntHave('variants', $sellable)->count(),
                'stocked_hidden' => $importer->stockedHidden()->count(),
                'demo_visible' => Product::where('is_demo', true)->where('is_active', true)->count(),
                // Besides orders and stock: the stringing counter, the support inbox, reviews, emails.
                ...$insights->waiting(),
            ],
            'stats' => [
                'today_sales' => $figures ? (int) $kept($today)->sum('total') : 0,
                'today_orders' => $kept($today)->count(),
                'week_sales' => $figures ? (int) $kept($week)->sum('total') : 0,
                'week_orders' => $kept($week)->count(),
                // Less the share of the week's coupons that falls on the lines with a known cost.
                'week_profit' => $figures
                    ? (int) (clone $costed)->sum(DB::raw('line_total - unit_cost * quantity'))
                        - (($goods = (int) $kept($week)->sum('subtotal')) > 0
                            ? intdiv((int) $kept($week)->sum('discount_total') * (int) (clone $costed)->sum('line_total'), $goods)
                            : 0)
                    : 0,
                'week_costed' => $figures ? (int) (clone $costed)->sum('line_total') : 0,
                'week_collected' => $figures ? (int) $orders()->where('paid_at', '>=', $week->utc())->sum('total') : 0,
                // Paid at the stringing counter in the same seven days; not part of the orders' money.
                'week_service' => $figures ? $insights->serviceCollected($week) : 0,
                'orders_open' => $orders()->whereIn('status', ['pending', 'confirmed', 'shipped'])->count(),
                'products_active' => $products()->where('is_active', true)->count(),
                'products_in_stock' => $products()->where('is_active', true)->whereHas('variants', $sellable)->count(),
                'customers' => User::where('is_admin', false)
                    ->when(! $demo, fn ($query) => DemoData::withoutDemoCustomers($query))->count(),
            ],
            'lowStock' => (clone $lowStock)->with('product:id,name')->orderBy('stock')->limit(6)
                ->get(['id', 'product_id', 'sku', 'name', 'stock'])
                ->map(fn (ProductVariant $variant) => [
                    'product_id' => $variant->product_id,
                    'product' => $variant->product->name,
                    'variant' => $variant->name,
                    'sku' => $variant->sku,
                    'stock' => $variant->stock,
                ]),
            'orders' => $orders()->withCount('items')->latest('id')->limit(8)
                ->get(['id', 'public_id', 'name', 'phone', 'status', 'payment_status', 'payment_method', 'total', 'is_demo', 'created_at']),
        ]);
    }
}
