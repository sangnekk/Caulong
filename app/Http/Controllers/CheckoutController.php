<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\CartService;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function index(Request $request, CartService $cart): Response
    {
        $summary = $cart->summary($request);
        $token = $request->session()->get('checkout_token');
        $completed = $request->session()->get('checkout_orders', []);
        if (! $token || (isset($completed[$token]) && $summary['count'] > 0)) {
            $token = (string) Str::uuid();
            $request->session()->put('checkout_token', $token);
        }
        $request->session()->put('checkout_prices', array_column($summary['items'], 'price', 'variant_id'));

        return Inertia::render('shop/checkout', [
            'cart' => $summary,
            'checkoutToken' => $token,
            'paymentMethods' => [['id' => 'cod', 'label' => 'Thanh toán khi nhận hàng']],
        ]);
    }

    public function store(Request $request, OrderService $orders): RedirectResponse
    {
        $data = $request->validate([
            'checkout_token' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'regex:/^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/'],
            'address' => ['required', 'string', 'max:500'],
            'email' => ['nullable', 'email', 'max:190'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['required', 'in:cod'],
            'accept_terms' => ['accepted'],
        ], [
            'checkout_token.required' => 'Phiên đặt hàng đã hết hạn. Vui lòng mở lại trang thanh toán.',
            'checkout_token.uuid' => 'Mã phiên đặt hàng không hợp lệ.',
            'name.required' => 'Vui lòng nhập họ tên người nhận.',
            'name.string' => 'Họ tên người nhận không hợp lệ.',
            'name.max' => 'Họ tên không được vượt quá 120 ký tự.',
            'phone.required' => 'Vui lòng nhập số điện thoại người nhận.',
            'phone.string' => 'Số điện thoại không hợp lệ.',
            'phone.regex' => 'Vui lòng nhập số điện thoại Việt Nam hợp lệ, bắt đầu bằng 0 hoặc +84, không có dấu cách.',
            'address.required' => 'Vui lòng nhập địa chỉ giao hàng.',
            'address.string' => 'Địa chỉ giao hàng không hợp lệ.',
            'address.max' => 'Địa chỉ không được vượt quá 500 ký tự.',
            'email.email' => 'Địa chỉ email không hợp lệ.',
            'email.max' => 'Email không được vượt quá 190 ký tự.',
            'notes.string' => 'Ghi chú không hợp lệ.',
            'notes.max' => 'Ghi chú không được vượt quá 1000 ký tự.',
            'payment_method.required' => 'Vui lòng chọn thanh toán khi nhận hàng.',
            'payment_method.in' => 'Cửa hàng hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).',
            'accept_terms.accepted' => 'Vui lòng đồng ý điều khoản đặt hàng.',
        ]);
        $order = $orders->checkout($request, $data);

        return redirect()->route('orders.show', ['order' => $order->public_id])
            ->with('order_placed', $order->public_id);
    }

    public function show(Request $request, Order $order): Response
    {
        $ownsOrder = $request->user() && $order->user_id !== null && (int) $request->user()->id === (int) $order->user_id;
        abort_unless($ownsOrder || in_array($order->public_id, $request->session()->get('order_access', []), true), 404);
        $data = $order->only([
            'public_id', 'name', 'phone', 'address', 'email', 'notes', 'status',
            'payment_status', 'payment_method', 'subtotal', 'shipping_fee', 'total', 'is_demo', 'created_at',
        ]);
        $data['items'] = $order->items->map(fn ($item) => $item->only(['product_name', 'variant_name', 'sku', 'unit_price', 'quantity', 'line_total']))->all();

        return Inertia::render('shop/order', [
            'order' => $data,
            'trackingUrl' => route('orders.show', ['order' => $order->public_id], false),
            // "Order placed" only right after checkout; reopening it later shows it as an order.
            'justPlaced' => $request->session()->get('order_placed') === $order->public_id,
        ]);
    }
}
