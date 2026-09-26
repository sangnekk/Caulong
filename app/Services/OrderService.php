<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(private CartService $cart) {}

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
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                ];
            }
            if ($hasDemo && $hasReal) {
                throw ValidationException::withMessages(['cart' => 'Không thể đặt chung sản phẩm demo và sản phẩm thật trong cùng một đơn. Vui lòng tách riêng giỏ hàng.']);
            }
            $shipping = $this->cart->shippingFee($subtotal);
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
                'total' => $subtotal + $shipping,
                'is_demo' => $hasDemo,
            ]);
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
            $request->session()->forget(['shopping_cart', 'checkout_prices']);
        }
        $completed[$token] = $order->public_id;
        $request->session()->put('checkout_orders', array_slice($completed, -25, null, true));
        $access = $request->session()->get('order_access', []);
        $access[] = $order->public_id;
        $request->session()->put('order_access', array_slice(array_values(array_unique($access)), -25));

        return $order;
    }

    public function transition(Order $order, string $status): Order
    {
        return DB::transaction(function () use ($order, $status) {
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
            }
            $locked->update(['status' => $status]);

            return $locked;
        }, 3);
    }

    public function markCodPaid(Order $order): Order
    {
        return DB::transaction(function () use ($order) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->payment_method !== 'cod' || $locked->status !== 'delivered') {
                throw ValidationException::withMessages(['payment_status' => 'Chỉ xác nhận đã thu tiền COD cho đơn đã giao thành công.']);
            }
            if ($locked->payment_status !== 'paid') {
                $locked->update(['payment_status' => 'paid']);
            }

            return $locked;
        }, 3);
    }
}
