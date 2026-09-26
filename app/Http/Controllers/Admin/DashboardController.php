<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('admin/dashboard', [
            'stats' => [
                'products' => Product::count(),
                'pending_orders' => Order::where('status', 'pending')->count(),
                'low_stock' => ProductVariant::where('is_active', true)->where('stock', '<=', 5)->count(),
            ],
            'orders' => Order::latest('id')->limit(8)->get(['id', 'public_id', 'name', 'status', 'payment_status', 'total', 'is_demo', 'created_at']),
        ]);
    }
}
