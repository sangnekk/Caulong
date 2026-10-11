<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\CartService;
use App\Services\OrderService;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function index(Request $request, CartService $cart, PaymentService $payments): Response
    {
        $summary = $cart->summary($request);
        $token = $request->session()->get('checkout_token');
        $completed = $request->session()->get('checkout_orders', []);
        if (! $token || (isset($completed[$token]) && $summary['count'] > 0)) {
            $token = (string) Str::uuid();
            $request->session()->put('checkout_token', $token);
        }
        $request->session()->put('checkout_prices', array_column($summary['items'], 'price', 'variant_id'));
        // What the page shows the coupon taking off; the order is refused if that has changed.
        $request->session()->put('checkout_discount', $summary['discount']);

        return Inertia::render('shop/checkout', [
            'cart' => $summary,
            'checkoutToken' => $token,
            'paymentMethods' => $payments->methods($summary),
        ]);
    }

    public function store(Request $request, OrderService $orders, CartService $cart, PaymentService $payments): RedirectResponse
    {
        // A token sent again answers with the order it made: its cart is already empty.
        $token = $request->input('checkout_token');
        $methods = is_string($token) && isset($request->session()->get('checkout_orders', [])[$token])
            ? ['cod', PaymentService::METHOD]
            : array_column($payments->methods($cart->summary($request)), 'id');
        $data = $request->validate([
            'checkout_token' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'regex:/^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/'],
            'address' => ['required', 'string', 'max:500'],
            'email' => ['nullable', 'email', 'max:190'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['required', Rule::in($methods)],
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
            'payment_method.required' => 'Vui lòng chọn cách thanh toán.',
            'payment_method.in' => in_array(PaymentService::METHOD, $methods, true)
                ? 'Vui lòng chọn thanh toán khi nhận hàng hoặc chuyển khoản.'
                : 'Cửa hàng hiện chỉ nhận thanh toán khi nhận hàng (COD) cho đơn này.',
            'accept_terms.accepted' => 'Vui lòng đồng ý điều khoản đặt hàng.',
        ]);
        $order = $orders->checkout($request, $data);

        return redirect()->route('orders.show', ['order' => $order->public_id])
            ->with('order_placed', $order->public_id);
    }

    public function show(Request $request, Order $order, PaymentService $payments): Response
    {
        $ownsOrder = $request->user() && $order->user_id !== null && (int) $request->user()->id === (int) $order->user_id;
        // The link in the order's emails carries a signature that opens this one order for a
        // limited time (App\Support\Frontend::order), on any device and without an account.
        abort_unless($ownsOrder || in_array($order->public_id, $request->session()->get('order_access', []), true)
            || $request->hasValidRelativeSignature(), 404);
        $data = $order->only([
            'public_id', 'name', 'phone', 'address', 'email', 'notes', 'status',
            'payment_status', 'payment_method', 'subtotal', 'shipping_fee', 'discount_total', 'coupon_code', 'total', 'is_demo', 'created_at',
        ]);
        $data['items'] = $order->items->map(fn ($item) => $item->only(['product_name', 'variant_name', 'sku', 'unit_price', 'quantity', 'line_total']))->all();

        return Inertia::render('shop/order', [
            'order' => $data,
            // The transfer this order waits for, or what became of it; null for cash on delivery.
            'payment' => $payments->summary($order),
            'trackingUrl' => route('orders.show', ['order' => $order->public_id], false),
            // "Order placed" only right after checkout; reopening it later shows it as an order.
            'justPlaced' => $request->session()->get('order_placed') === $order->public_id,
        ]);
    }
}
