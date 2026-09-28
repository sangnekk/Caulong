<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CatalogImporter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(CatalogImporter $importer): Response
    {
        // Demo orders and products are labelled everywhere; they never count as work or money.
        $orders = fn () => Order::where('is_demo', false);
        $products = fn () => Product::where('is_demo', false);
        // Only what customers can buy, and only 1–5 left: sold-out items are their own task.
        $lowStock = ProductVariant::where('is_active', true)->whereBetween('stock', [1, 5])
            ->whereHas('product', fn ($query) => $query->where('is_active', true)->where('is_demo', false));
        $sellable = fn ($query) => $query->where('is_active', true)->where('stock', '>', 0);
        // "Today" and "last 7 days" are shop days (Vietnam), the database is UTC.
        $today = CarbonImmutable::now((string) config('shop.timezone'))->startOfDay();
        $week = $today->subDays(6);
        $kept = fn (CarbonImmutable $from) => $orders()->where('status', '!=', 'cancelled')->where('created_at', '>=', $from->utc());
        $costed = OrderItem::whereIn('order_id', $kept($week)->select('id'))->whereNotNull('unit_cost');

        return Inertia::render('admin/dashboard', [
            'todo' => [
                'pending_orders' => $orders()->where('status', 'pending')->count(),
                'confirmed_orders' => $orders()->where('status', 'confirmed')->count(),
                'uncollected' => $orders()->where('status', 'delivered')->where('payment_status', '!=', 'paid')->count(),
                'low_stock' => (clone $lowStock)->count(),
                'sold_out' => $products()->where('is_active', true)->whereDoesntHave('variants', $sellable)->count(),
                'stocked_hidden' => $importer->stockedHidden()->count(),
                'demo_visible' => Product::where('is_demo', true)->where('is_active', true)->count(),
            ],
            'stats' => [
                'today_sales' => (int) $kept($today)->sum('total'),
                'today_orders' => $kept($today)->count(),
                'week_sales' => (int) $kept($week)->sum('total'),
                'week_orders' => $kept($week)->count(),
                'week_profit' => (int) (clone $costed)->sum(DB::raw('line_total - unit_cost * quantity')),
                'week_costed' => (int) (clone $costed)->sum('line_total'),
                'week_collected' => (int) $orders()->where('paid_at', '>=', $week->utc())->sum('total'),
                'orders_open' => $orders()->whereIn('status', ['pending', 'confirmed', 'shipped'])->count(),
                'products_active' => $products()->where('is_active', true)->count(),
                'products_in_stock' => $products()->where('is_active', true)->whereHas('variants', $sellable)->count(),
                'customers' => User::where('is_admin', false)->count(),
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
                ->get(['id', 'public_id', 'name', 'phone', 'status', 'payment_status', 'total', 'is_demo', 'created_at']),
        ]);
    }
}
