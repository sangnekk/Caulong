<?php

namespace App\Services;

use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CartService
{
    /** Session key of the coupon code the customer entered for this cart. */
    public const COUPON = 'cart_coupon';

    public function __construct(private ShopSettings $settings, private CouponService $coupons) {}

    /** @return array<int, int> */
    public function quantities(Request $request): array
    {
        $cart = $request->session()->get('shopping_cart', []);
        if (! is_array($cart)) {
            throw ValidationException::withMessages(['cart' => 'Giỏ hàng không hợp lệ. Vui lòng tạo lại giỏ hàng.']);
        }
        $normalized = [];
        foreach ($cart as $id => $quantity) {
            if (! ctype_digit((string) $id) || (int) $id < 1 || ! is_int($quantity) || $quantity < 1 || $quantity > 20) {
                throw ValidationException::withMessages(['cart' => 'Số lượng trong giỏ hàng phải từ 1 đến 20.']);
            }
            $normalized[(int) $id] = $quantity;
        }
        ksort($normalized, SORT_NUMERIC);

        return $normalized;
    }

    public function count(Request $request): int
    {
        return array_sum($this->quantities($request));
    }

    public function shippingFee(int $subtotal): int
    {
        // A threshold of 0 means no free delivery by order value; a fee of 0 means delivery is always free.
        $threshold = $this->settings->freeShippingThreshold();

        return $subtotal === 0 || ($threshold > 0 && $subtotal >= $threshold) ? 0 : $this->settings->shippingFee();
    }

    public function lineTotal(int $price, int $quantity, int $subtotal = 0): int
    {
        if ($price < 0 || $price > intdiv(PHP_INT_MAX - $subtotal - $this->settings->shippingFee(), $quantity)) {
            throw ValidationException::withMessages(['cart' => 'Giá trị giỏ hàng vượt giới hạn. Vui lòng liên hệ cửa hàng.']);
        }

        return $price * $quantity;
    }

    /**
     * The cart as the customer sees it. `discount` is what the entered coupon takes off right
     * now; a code that no longer applies stays listed with the reason and takes off nothing.
     *
     * @return array{items: list<array<string, mixed>>, subtotal: int, shipping_fee: int, discount: int, coupon: array{code: string, name: string|null, error: string|null}|null, total: int, count: int}
     */
    public function summary(Request $request): array
    {
        $cart = $this->quantities($request);
        if ($cart === []) {
            return ['items' => [], 'subtotal' => 0, 'shipping_fee' => 0, 'discount' => 0, 'coupon' => null, 'total' => 0, 'count' => 0];
        }
        $variants = ProductVariant::with('product')->whereIn('id', array_keys($cart))->get()->keyBy('id');
        $items = [];
        $lines = [];
        $subtotal = 0;
        foreach ($cart as $id => $quantity) {
            $variant = $variants->get($id);
            $product = $variant?->product;
            $available = $variant && $variant->is_active && $product?->is_active;
            $price = (int) ($variant->price ?? 0);
            $lineTotal = $this->lineTotal($price, $quantity, $subtotal);
            $subtotal += $lineTotal;
            $items[] = [
                'variant_id' => (int) $id,
                'product_id' => $product?->id,
                'slug' => $product?->slug,
                'name' => $product->name ?? 'Sản phẩm không còn bán',
                'variant_name' => $variant->name ?? 'Không còn bán',
                'sku' => $variant->sku ?? '',
                'image_url' => $product->image_url ?? '/models/hyper-core-poster.png',
                'price' => $price,
                'quantity' => $quantity,
                'stock' => $available ? (int) $variant->stock : 0,
                'line_total' => $lineTotal,
                'is_demo' => (bool) $product?->is_demo,
                'is_available' => (bool) $available,
            ];
            $lines[] = [
                'product_id' => $product?->id, 'category_id' => $product?->category_id,
                'line_total' => $lineTotal, 'is_demo' => (bool) $product?->is_demo,
            ];
        }
        $shipping = $this->shippingFee($subtotal);
        $discount = 0;
        $coupon = null;
        $code = $request->session()->get(self::COUPON);
        if (is_string($code)) {
            try {
                $quote = $this->coupons->quote($code, $request->user(), $lines);
                $discount = $quote['discount'];
                $coupon = ['code' => $quote['coupon']->code, 'name' => $quote['coupon']->name, 'error' => null];
            } catch (ValidationException $rejected) {
                $coupon = ['code' => $code, 'name' => null, 'error' => $rejected->validator->errors()->first()];
            }
        }

        return [
            'items' => $items, 'subtotal' => $subtotal, 'shipping_fee' => $shipping,
            'discount' => $discount, 'coupon' => $coupon,
            // Delivery is charged on the goods before the coupon, so a coupon never brings a fee back.
            'total' => $subtotal - $discount + $shipping, 'count' => (int) array_sum($cart),
        ];
    }
}
