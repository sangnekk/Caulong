<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        private CartService $cart,
        private CustomerEvents $events,
        private CouponService $coupons,
        private CustomerSegmentation $segments,
    ) {}

    /** @param array<string, mixed> $data */
    public function checkout(Request $request, array $data): Order
    {
        $token = $data['checkout_token'];
        $completed = $request->session()->get('checkout_orders', []);
        $isReplay = isset($completed[$token]);
        if (! $isReplay && $request->session()->get('checkout_token') !== $token) {
            throw ValidationException::withMessages(['checkout_token' => 'Phiên đặt hàng không hợp lệ hoặc đã hết hạn. Vui lòng mở lại trang thanh toán.']);
        }
        // Session-blocking routes serialize duplicate submits; the unique DB token is the final guard.
        $order = DB::transaction(function () use ($request, $data, $token, $isReplay, $completed) {
            if ($existing = Order::where('checkout_token', $token)->first()) {
                // Reuse only the order this session actually placed.
                if (! $isReplay || ($completed[$token] ?? null) !== $existing->public_id) {
                    throw ValidationException::withMessages(['checkout_token' => 'Phiên đặt hàng không hợp lệ hoặc đã hết hạn. Vui lòng mở lại trang thanh toán.']);
                }

                return $existing;
            }
            if ($isReplay) {
                throw ValidationException::withMessages(['checkout_token' => 'Đơn hàng không còn tồn tại. Vui lòng mở lại trang thanh toán.']);
            }
            $quantities = $this->cart->quantities($request);
            if ($quantities === []) {
                throw ValidationException::withMessages(['cart' => 'Giỏ hàng đang trống. Vui lòng thêm sản phẩm trước khi đặt hàng.']);
            }
            // Lock products then variants, both sorted by id, matching admin product->variants order.
            $variantIds = array_map('intval', array_keys($quantities));
            $productIds = ProductVariant::whereIn('id', $variantIds)->pluck('product_id')->filter()->unique()->sort()->values()->all();
            $products = Product::whereIn('id', $productIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $variants = ProductVariant::whereIn('id', $variantIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $prices = $request->session()->get('checkout_prices', []);
            $items = [];
            $lines = [];
            $subtotal = 0;
            $hasDemo = false;
            $hasReal = false;
            foreach ($quantities as $id => $quantity) {
                $variant = $variants->get((int) $id);
                $product = $variant ? $products->get($variant->product_id) : null;
                if (! $variant || ! $variant->is_active || ! $product || ! $product->is_active) {
                    throw ValidationException::withMessages(['cart' => 'Có sản phẩm không còn bán. Vui lòng xóa sản phẩm đó khỏi giỏ hàng.']);
                }
                if ($variant->stock < $quantity) {
                    throw ValidationException::withMessages(['cart' => "Sản phẩm {$product->name} chỉ còn {$variant->stock} sản phẩm. Vui lòng cập nhật giỏ hàng."]);
                }
                $price = (int) $variant->price;
                if (! array_key_exists((int) $id, $prices) || (int) $prices[(int) $id] !== $price) {
                    throw ValidationException::withMessages(['cart' => 'Giá sản phẩm đã thay đổi. Vui lòng tải lại trang thanh toán, xem giá mới rồi đặt hàng lại.']);
                }
                $lineTotal = $this->cart->lineTotal($price, $quantity, $subtotal);
                $subtotal += $lineTotal;
                if ($product->is_demo) {
                    $hasDemo = true;
                } else {
                    $hasReal = true;
                }
                $items[] = [
                    'variant_id' => $variant->id,
                    'product_name' => $product->name,
                    'variant_name' => $variant->name,
                    'sku' => $variant->sku,
                    'unit_price' => $price,
                    'unit_cost' => $variant->cost_price,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                ];
                $lines[] = [
                    'product_id' => (int) $product->id, 'category_id' => $product->category_id,
                    'line_total' => $lineTotal, 'is_demo' => (bool) $product->is_demo,
                ];
            }
            if ($hasDemo && $hasReal) {
                throw ValidationException::withMessages(['cart' => 'Không thể đặt chung sản phẩm demo và sản phẩm thật trong cùng một đơn. Vui lòng tách riêng giỏ hàng.']);
            }
            $shipping = $this->cart->shippingFee($subtotal);
            // The coupon is worked out again here, with the coupon row held so two orders
            // cannot both take its last use. The figure must be the one the page showed.
            $shown = (int) $request->session()->get('checkout_discount', 0);
            $quote = null;
            $code = $request->session()->get(CartService::COUPON);
            if (is_string($code)) {
                try {
                    $quote = $this->coupons->quote($code, $request->user(), $lines, $data['phone'], lock: true);
                } catch (ValidationException $rejected) {
                    // Shown as not applying: the order goes ahead without it. Otherwise the customer is told.
                    if ($shown > 0) {
                        throw ValidationException::withMessages(['coupon' => $rejected->validator->errors()->first()
                            .' Bỏ mã ở giỏ hàng hoặc tải lại trang thanh toán rồi đặt lại.']);
                    }
                }
            }
            $discount = $quote['discount'] ?? 0;
            if ($discount !== $shown) {
                throw ValidationException::withMessages(['cart' => 'Mức giảm giá đã thay đổi. Vui lòng tải lại trang thanh toán, xem lại tổng tiền rồi đặt hàng lại.']);
            }
            $order = Order::create([
                'public_id' => (string) Str::uuid(),
                'checkout_token' => $token,
                'user_id' => $request->user()?->id,
                'name' => $data['name'],
                'phone' => $data['phone'],
                'address' => $data['address'],
                'email' => $data['email'] ?? null,
                'notes' => $data['notes'] ?? null,
                'payment_method' => 'cod',
                'payment_status' => 'unpaid',
                'status' => 'pending',
                'subtotal' => $subtotal,
                'shipping_fee' => $shipping,
                'discount_total' => $discount,
                'coupon_code' => $discount > 0 ? $quote['coupon']->code : null,
                'total' => $subtotal - $discount + $shipping,
                'is_demo' => $hasDemo,
            ]);
            if ($quote !== null && $discount > 0) {
                $this->coupons->redeem($quote['coupon'], $order, $discount);
            }
            foreach ($items as $item) {
                $changed = ProductVariant::whereKey($item['variant_id'])
                    ->where('is_active', true)->where('stock', '>=', $item['quantity'])
                    ->decrement('stock', $item['quantity']);
                if ($changed !== 1) {
                    throw ValidationException::withMessages(['cart' => 'Số lượng tồn kho vừa thay đổi. Vui lòng kiểm tra lại giỏ hàng.']);
                }
            }
            $order->items()->createMany($items);

            return $order;
        }, 3);
        if (! $isReplay) {
            $request->session()->forget(['shopping_cart', 'checkout_prices', 'checkout_discount', CartService::COUPON]);
            $this->events->record($request, 'order_placed', orderId: $order->id, metadata: [
                'items' => (int) $order->items()->sum('quantity'), 'total' => (int) $order->total,
            ]);
        }
        $completed[$token] = $order->public_id;
        $request->session()->put('checkout_orders', array_slice($completed, -25, null, true));
        $access = $request->session()->get('order_access', []);
        $access[] = $order->public_id;
        $request->session()->put('order_access', array_slice(array_values(array_unique($access)), -25));
        $this->regroup($order);

        return $order;
    }

    public function transition(Order $order, string $status): Order
    {
        $order = DB::transaction(function () use ($order, $status) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $allowed = [
                'pending' => ['confirmed', 'cancelled'],
                'confirmed' => ['shipped', 'cancelled'],
                'shipped' => ['delivered'],
                'delivered' => [],
                'cancelled' => [],
            ];
            if ($locked->status === $status && array_key_exists($status, $allowed)) {
                return $locked;
            }
            if (! in_array($status, $allowed[$locked->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => 'Không thể chuyển đơn hàng sang trạng thái này.']);
            }
            if ($status === 'cancelled') {
                if ($locked->payment_status === 'paid') {
                    throw ValidationException::withMessages(['status' => 'Đơn hàng đã thu tiền không thể hủy. Vui lòng xử lý hoàn tiền riêng.']);
                }
                $items = $locked->items()->orderBy('variant_id')->get();
                ProductVariant::whereIn('id', $items->pluck('variant_id')->filter())->orderBy('id')->lockForUpdate()->get();
                foreach ($items as $item) {
                    if ($item->variant_id !== null) {
                        ProductVariant::whereKey($item->variant_id)->increment('stock', $item->quantity);
                    }
                }
                // The coupon was not used after all: its use goes back to the customer.
                $this->coupons->release($locked);
            }
            $locked->update(['status' => $status, $status.'_at' => now()]);

            return $locked;
        }, 3);
        $this->regroup($order);

        return $order;
    }

    public function markCodPaid(Order $order): Order
    {
        $order = DB::transaction(function () use ($order) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->payment_method !== 'cod' || $locked->status !== 'delivered') {
                throw ValidationException::withMessages(['payment_status' => 'Chỉ xác nhận đã thu tiền COD cho đơn đã giao thành công.']);
            }
            if ($locked->payment_status !== 'paid') {
                $locked->update(['payment_status' => 'paid', 'paid_at' => now()]);
            }

            return $locked;
        }, 3);
        $this->regroup($order);

        return $order;
    }

    /** An order placed, cancelled or paid can move its customer to another group. */
    private function regroup(Order $order): void
    {
        if ($order->user_id !== null && ($user = User::find($order->user_id)) !== null) {
            rescue(fn () => $this->segments->refresh($user));
        }
    }
}
