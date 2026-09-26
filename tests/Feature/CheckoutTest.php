<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        if (! Route::has('checkout.store')) {
            Route::middleware('web')->group(base_path('routes/checkout.php'));
        }
    }

    private function variant(int $stock = 5, int $price = 250000): ProductVariant
    {
        $product = Product::create([
            'name' => 'Vợt thử nghiệm', 'slug' => 'vot-'.Str::uuid(), 'description' => 'Dữ liệu kiểm thử',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => true,
        ]);

        return $product->variants()->create(['sku' => 'TEST-'.Str::uuid(), 'name' => '4U', 'price' => $price, 'stock' => $stock, 'is_active' => true]);
    }

    private function startCheckout(ProductVariant $variant, int $quantity = 1): string
    {
        $this->withSession(['shopping_cart' => [$variant->id => $quantity]])->get('/checkout')->assertOk();

        return session('checkout_token');
    }

    private function data(string $token): array
    {
        return ['checkout_token' => $token, 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ, TP. Hồ Chí Minh', 'payment_method' => 'cod', 'accept_terms' => true];
    }

    public function test_session_cart_validates_quantity_stock_and_variant_then_updates_and_removes(): void
    {
        $variant = $this->variant(3);
        foreach ([0, -1, 21, 1.5, 'abc'] as $quantity) {
            $this->post('/cart/items', ['variant_id' => $variant->id, 'quantity' => $quantity])->assertSessionHasErrors('quantity');
        }
        $this->post('/cart/items', ['variant_id' => 999999, 'quantity' => 1])->assertSessionHasErrors('variant_id');
        $this->post('/cart/items', ['variant_id' => $variant->id, 'quantity' => 2, 'price' => 1])->assertRedirect();
        $this->assertSame(2, session('shopping_cart')[$variant->id]);
        $this->post('/cart/items', ['variant_id' => $variant->id, 'quantity' => 2])->assertSessionHasErrors('quantity');
        $this->patch('/cart/items/'.$variant->id, ['quantity' => 3])->assertRedirect();
        $this->get('/cart')->assertInertia(fn (Assert $page) => $page->component('shop/cart', false)->where('cart.subtotal', 750000)->where('cart.count', 3));
        $this->delete('/cart/items/'.$variant->id)->assertRedirect();
        $this->assertSame([], session('shopping_cart'));
        $this->assertSame(3, $variant->fresh()->stock);
    }

    public function test_checkout_token_persists_and_invalid_cross_session_or_empty_checkout_fails(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant);
        $this->get('/checkout')->assertInertia(fn (Assert $page) => $page->component('shop/checkout', false)->where('checkoutToken', $token)->has('paymentMethods', 1));
        $this->post('/checkout', $this->data((string) Str::uuid()))->assertSessionHasErrors('checkout_token');
        $this->withSession(['checkout_token' => null])->post('/checkout', $this->data($token))->assertSessionHasErrors('checkout_token');
        $this->withSession(['checkout_token' => $token, 'shopping_cart' => []])->post('/checkout', $this->data($token))->assertSessionHasErrors('cart');
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $variant->fresh()->stock);
    }

    public function test_checkout_validation_is_explicit_and_cod_only(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant);
        $data = array_replace($this->data($token), ['name' => '', 'phone' => '123', 'address' => '', 'email' => 'bad', 'notes' => str_repeat('x', 1001), 'payment_method' => 'card', 'accept_terms' => false]);
        $this->post('/checkout', $data)->assertSessionHasErrors(['name', 'phone', 'address', 'email', 'notes', 'payment_method', 'accept_terms']);
        $this->assertSame('Vui lòng nhập họ tên người nhận.', session('errors')->first('name'));
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_checkout_uses_integer_server_money_snapshots_and_idempotent_token(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant, 2);
        $data = $this->data($token) + ['total' => 1, 'shipping_fee' => 0, 'unit_price' => 1, 'status' => 'delivered', 'payment_status' => 'paid'];
        $this->post('/checkout', $data)->assertRedirect();
        $order = Order::firstOrFail();
        $this->assertSame(500000, $order->subtotal);
        $this->assertSame(30000, $order->shipping_fee);
        $this->assertSame(530000, $order->total);
        $this->assertSame('pending', $order->status);
        $this->assertSame('unpaid', $order->payment_status);
        $this->assertTrue($order->is_demo);
        $this->assertSame(3, $variant->fresh()->stock);
        $this->assertNull(session('shopping_cart'));
        $variant->update(['price' => 400000, 'name' => 'Đã đổi tên']);
        $variant->product->update(['name' => 'Tên mới']);
        $this->post('/checkout', $data)->assertRedirect('/orders/'.$order->public_id);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        $this->assertSame(3, $variant->fresh()->stock);
        $this->assertSame(250000, $order->items->first()->unit_price);
        $this->assertSame('Vợt thử nghiệm', $order->items->first()->product_name);
        $this->assertSame('4U', $order->items->first()->variant_name);
        $newToken = $this->startCheckout($variant);
        $this->assertNotSame($token, $newToken);
        $this->post('/checkout', $data)->assertRedirect('/orders/'.$order->public_id);
        $this->assertSame([$variant->id => 1], session('shopping_cart'));
        $this->assertSame($newToken, session('checkout_token'));
    }

    public function test_price_change_requires_review_before_order_submission(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant);
        $variant->update(['price' => 300000]);
        $this->post('/checkout', $this->data($token))->assertSessionHasErrors('cart');
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $variant->fresh()->stock);
        $this->get('/checkout')->assertOk();
        $this->post('/checkout', $this->data($token))->assertRedirect();
        $this->assertSame(300000, Order::firstOrFail()->subtotal);
    }

    public function test_stale_stock_and_unavailable_items_reject_whole_order_without_partial_decrement(): void
    {
        $first = $this->variant();
        $second = $this->variant();
        $this->withSession(['shopping_cart' => [$first->id => 2, $second->id => 2]])->get('/checkout')->assertOk();
        $token = session('checkout_token');
        $second->update(['stock' => 1]);
        $this->post('/checkout', $this->data($token))->assertSessionHasErrors('cart');
        $this->assertSame(5, $first->fresh()->stock);
        $second->update(['stock' => 5, 'is_active' => false]);
        $this->get('/cart')->assertInertia(fn (Assert $page) => $page->component('shop/cart', false)->has('cart.items', 2)->where('cart.items.1.is_available', false));
        $this->post('/checkout', $this->data($token))->assertSessionHasErrors('cart');
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $first->fresh()->stock);
    }

    public function test_competing_sessions_cannot_oversell_last_item(): void
    {
        $variant = $this->variant(1);
        $firstToken = $this->startCheckout($variant);
        $this->post('/checkout', $this->data($firstToken))->assertRedirect();
        $this->assertSame(0, $variant->fresh()->stock);

        // A distinct session with its own valid token competes for the last item.
        session()->flush();
        $secondToken = (string) Str::uuid();
        $this->withSession([
            'shopping_cart' => [$variant->id => 1],
            'checkout_token' => $secondToken,
            'checkout_prices' => [$variant->id => 250000],
        ])->post('/checkout', $this->data($secondToken))->assertSessionHasErrors('cart');
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(0, $variant->fresh()->stock);
    }

    public function test_order_page_is_private_and_does_not_serialize_internal_identifiers(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant);
        $this->post('/checkout', $this->data($token))->assertRedirect();
        $order = Order::firstOrFail();
        $url = '/orders/'.$order->public_id;
        $this->get($url)->assertInertia(fn (Assert $page) => $page->component('shop/order', false)->where('order.public_id', $order->public_id)->missing('order.id')->missing('order.checkout_token')->missing('order.items.0.id')->where('trackingUrl', $url));
        session()->flush();
        $this->get($url)->assertNotFound();
        $this->post('/checkout', $this->data($token))->assertSessionHasErrors('checkout_token');
        $owner = User::factory()->create();
        $order->update(['user_id' => $owner->id]);
        $this->actingAs(User::factory()->create())->get($url)->assertNotFound();
        $this->actingAs($owner)->get($url)->assertOk();
    }

    public function test_cancellation_restocks_exactly_once_even_using_stale_order_instance(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant, 2);
        $this->post('/checkout', $this->data($token))->assertRedirect();
        $order = Order::firstOrFail();
        $service = app(OrderService::class);
        $service->transition($order, 'confirmed');
        $service->transition($order, 'cancelled');
        $service->transition($order, 'cancelled');
        $this->assertSame(5, $variant->fresh()->stock);
        $this->assertSame('cancelled', $order->fresh()->status);
        $this->expectException(ValidationException::class);
        $service->transition($order, 'confirmed');
    }

    public function test_delivered_cod_requires_separate_explicit_payment_confirmation(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant, 4);
        $this->post('/checkout', $this->data($token))->assertRedirect();
        $order = Order::firstOrFail();
        $this->assertSame(0, $order->shipping_fee);
        $service = app(OrderService::class);
        try {
            $service->markCodPaid($order);
            $this->fail('Pending COD must not be marked paid.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('payment_status', $exception->errors());
        }
        try {
            $service->transition($order, 'delivered');
            $this->fail('State transitions cannot be skipped.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }
        foreach (['confirmed', 'shipped', 'delivered'] as $status) {
            $service->transition($order, $status);
        }
        $this->assertSame('unpaid', $order->fresh()->payment_status);
        $service->markCodPaid($order);
        $service->markCodPaid($order);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(1, $variant->fresh()->stock);
        $this->expectException(ValidationException::class);
        $service->transition($order, 'cancelled');
    }

    public function test_mixed_demo_and_real_cart_is_rejected_without_stock_change(): void
    {
        $demo = $this->variant();
        $realProduct = Product::create([
            'name' => 'Vợt thật', 'slug' => 'vot-that-'.Str::uuid(), 'description' => 'Dữ liệu kiểm thử',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ]);
        $real = $realProduct->variants()->create(['sku' => 'REAL-'.Str::uuid(), 'name' => '3U', 'price' => 500000, 'stock' => 5, 'is_active' => true]);
        $this->withSession(['shopping_cart' => [$demo->id => 1, $real->id => 1]])->get('/checkout')->assertOk();
        $token = session('checkout_token');
        $this->post('/checkout', $this->data($token))->assertSessionHasErrors('cart');
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $demo->fresh()->stock);
        $this->assertSame(5, $real->fresh()->stock);
    }

    public function test_foreign_session_cannot_reuse_or_view_another_sessions_order(): void
    {
        $variant = $this->variant();
        $token = $this->startCheckout($variant);
        $this->post('/checkout', $this->data($token))->assertRedirect();
        $order = Order::firstOrFail();
        session()->flush();
        $this->withSession(['checkout_token' => $token, 'shopping_cart' => [$variant->id => 1]])
            ->post('/checkout', $this->data($token))->assertSessionHasErrors('checkout_token');
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(4, $variant->fresh()->stock);
        $this->get('/orders/'.$order->public_id)->assertNotFound();
    }
}
