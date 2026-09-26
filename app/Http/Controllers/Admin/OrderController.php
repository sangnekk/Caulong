<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate(['status' => ['nullable', Rule::in(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])]]);

        return Inertia::render('admin/orders', [
            'orders' => Order::when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
                ->latest('id')->paginate(20)->withQueryString(),
            'filters' => ['status' => $filters['status'] ?? ''],
        ]);
    }

    public function show(Order $order): Response
    {
        return Inertia::render('admin/order', ['order' => $order->load('items')]);
    }

    public function update(Request $request, Order $order, OrderService $service): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['confirmed', 'shipped', 'delivered', 'cancelled'])]]);
        $service->transition($order, $data['status']);

        return back()->with('success', 'Đã cập nhật trạng thái đơn hàng.');
    }

    public function collected(Order $order, OrderService $service): RedirectResponse
    {
        $service->markCodPaid($order);

        return back()->with('success', 'Đã xác nhận thu tiền COD.');
    }
}
