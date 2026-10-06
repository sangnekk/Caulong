<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\ProductVariant;
use App\Services\CartService;
use App\Services\CustomerEvents;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CartController extends Controller
{
    public function index(Request $request, CartService $cart): Response
    {
        return Inertia::render('shop/cart', ['cart' => $cart->summary($request)]);
    }

    public function store(Request $request, CartService $cart, CustomerEvents $events): RedirectResponse
    {
        $data = $request->validate([
            'variant_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'between:1,20'],
        ], $this->messages());
        $quantities = $cart->quantities($request);
        $quantity = ($quantities[$data['variant_id']] ?? 0) + (int) $data['quantity'];
        $variant = $this->checkStock((int) $data['variant_id'], $quantity);
        $quantities[$data['variant_id']] = $quantity;
        $request->session()->put('shopping_cart', $quantities);
        $events->record($request, 'add_to_cart', $variant->product_id, metadata: [
            'variant_id' => $variant->id, 'quantity' => (int) $data['quantity'], 'price' => (int) $variant->price,
        ]);

        return back()->with('success', 'Đã thêm sản phẩm vào giỏ hàng.');
    }

    public function update(Request $request, string $variant, CartService $cart): RedirectResponse
    {
        $data = $request->validate(['quantity' => ['required', 'integer', 'between:1,20']], $this->messages());
        $quantities = $cart->quantities($request);
        if (! isset($quantities[$variant])) {
            throw ValidationException::withMessages(['cart' => 'Sản phẩm không có trong giỏ hàng.']);
        }
        $this->checkStock((int) $variant, (int) $data['quantity']);
        $quantities[$variant] = (int) $data['quantity'];
        $request->session()->put('shopping_cart', $quantities);

        return back()->with('success', 'Đã cập nhật giỏ hàng.');
    }

    public function destroy(Request $request, string $variant, CartService $cart, CustomerEvents $events): RedirectResponse
    {
        $quantities = $cart->quantities($request);
        if (isset($quantities[$variant])) {
            unset($quantities[$variant]);
            $request->session()->put('shopping_cart', $quantities);
            $productId = ProductVariant::whereKey((int) $variant)->value('product_id');
            $events->record($request, 'remove_from_cart', $productId === null ? null : (int) $productId, metadata: ['variant_id' => (int) $variant]);
        }

        return back()->with('success', 'Đã xóa sản phẩm khỏi giỏ hàng.');
    }

    /**
     * Keeps the code with the cart when it applies to it as it is now. Why it does not is told
     * in the customer's words; a code that is not theirs is told nothing more than "not valid".
     */
    public function applyCoupon(Request $request, CartService $cart, CustomerEvents $events): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40']], [
            'code.*' => 'Nhập mã giảm giá (tối đa 40 ký tự).',
        ]);
        $previous = $request->session()->get(CartService::COUPON);
        $request->session()->put(CartService::COUPON, Coupon::normalize($data['code']));
        $coupon = $cart->summary($request)['coupon'];
        if ($coupon === null || $coupon['error'] !== null) {
            // The cart keeps whatever applied before.
            if ($previous === null) {
                $request->session()->forget(CartService::COUPON);
            } else {
                $request->session()->put(CartService::COUPON, $previous);
            }
            throw ValidationException::withMessages(['coupon' => $coupon['error'] ?? 'Giỏ hàng đang trống: thêm sản phẩm rồi nhập mã.']);
        }
        $events->record($request, 'coupon_applied', metadata: ['code' => $coupon['code']]);

        return back()->with('success', 'Đã áp dụng mã '.$coupon['code'].'.');
    }

    public function removeCoupon(Request $request): RedirectResponse
    {
        $request->session()->forget(CartService::COUPON);

        return back()->with('success', 'Đã bỏ mã giảm giá.');
    }

    private function checkStock(int $id, int $quantity): ProductVariant
    {
        $variant = ProductVariant::with('product')->find($id);
        if (! $variant || ! $variant->is_active || ! $variant->product->is_active) {
            throw ValidationException::withMessages(['variant_id' => 'Sản phẩm không còn bán. Vui lòng chọn sản phẩm khác.']);
        }
        if ($quantity > 20) {
            throw ValidationException::withMessages(['quantity' => 'Mỗi phiên bản chỉ được mua tối đa 20 sản phẩm.']);
        }
        if ($quantity > $variant->stock) {
            throw ValidationException::withMessages(['quantity' => "Chỉ còn {$variant->stock} sản phẩm. Vui lòng giảm số lượng."]);
        }

        return $variant;
    }

    /** @return array<string, string> */
    private function messages(): array
    {
        return [
            'variant_id.required' => 'Vui lòng chọn phiên bản sản phẩm.',
            'variant_id.integer' => 'Phiên bản sản phẩm không hợp lệ.',
            'variant_id.min' => 'Phiên bản sản phẩm không hợp lệ.',
            'quantity.required' => 'Vui lòng nhập số lượng.',
            'quantity.integer' => 'Số lượng phải là số nguyên.',
            'quantity.between' => 'Số lượng phải từ 1 đến 20.',
        ];
    }
}
