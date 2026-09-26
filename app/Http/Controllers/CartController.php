<?php

namespace App\Http\Controllers;

use App\Models\ProductVariant;
use App\Services\CartService;
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

    public function store(Request $request, CartService $cart): RedirectResponse
    {
        $data = $request->validate([
            'variant_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'between:1,20'],
        ], $this->messages());
        $quantities = $cart->quantities($request);
        $quantity = ($quantities[$data['variant_id']] ?? 0) + (int) $data['quantity'];
        $this->checkStock((int) $data['variant_id'], $quantity);
        $quantities[$data['variant_id']] = $quantity;
        $request->session()->put('shopping_cart', $quantities);

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

    public function destroy(Request $request, string $variant, CartService $cart): RedirectResponse
    {
        $quantities = $cart->quantities($request);
        unset($quantities[$variant]);
        $request->session()->put('shopping_cart', $quantities);

        return back()->with('success', 'Đã xóa sản phẩm khỏi giỏ hàng.');
    }

    private function checkStock(int $id, int $quantity): void
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
