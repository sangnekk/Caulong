<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CartService;
use App\Services\OrderService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminReportsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->admin = User::factory()->create(['is_admin' => true]);
        // 10:00 on 28/9 in the shop's time zone (03:00 UTC).
        $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00', 'Asia/Ho_Chi_Minh'));
    }

    private function variant(array $product = []): ProductVariant
    {
        $model = Product::create(array_merge([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $product));

        return $model->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 250000, 'stock' => 10, 'is_active' => true]);
    }

    /** An order of `quantity` × 250.000 ₫ placed at a UTC time. */
    private function order(ProductVariant $variant, string $placedUtc, int $quantity = 1, array $attributes = []): Order
    {
        $total = 250000 * $quantity;
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(),
            'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => $total, 'shipping_fee' => 0, 'total' => $total, 'created_at' => $placedUtc,
        ], $attributes));
        $order->items()->create([
            'variant_id' => $variant->id, 'product_name' => $variant->product->name, 'variant_name' => $variant->name,
            'sku' => $variant->sku, 'unit_price' => 250000, 'quantity' => $quantity, 'line_total' => $total,
        ]);

        return $order;
    }

    public function test_report_counts_real_orders_by_shop_day_and_compares_with_the_previous_period(): void
    {
        $brand = Brand::create(['name' => 'Hãng A', 'slug' => 'hang-a']);
        $variant = $this->variant(['name' => 'Vợt A', 'brand_id' => $brand->id]);
        // Placed 27/9, collected 28/9 (shop time).
        $this->order($variant, '2026-09-27 03:00:00', 2, ['status' => 'delivered', 'payment_status' => 'paid', 'paid_at' => '2026-09-28 01:00:00']);
        // 17:30 UTC on 27/9 is already 00:30 on 28/9 in Vietnam.
        $this->order($variant, '2026-09-27 17:30:00');
        $this->order($variant, '2026-09-20 03:00:00', 1, ['status' => 'cancelled']);
        $this->order($variant, '2026-09-27 03:00:00', 4, ['is_demo' => true]);
        // Previous 30 days: 31/7 – 29/8.
        $this->order($variant, '2026-08-15 03:00:00', 3);
        $this->order($variant, '2026-07-01 03:00:00', 8);

        $this->actingAs($this->admin)->get('/admin/reports')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/reports')
            ->where('filters', ['period' => '30d', 'demo' => false])
            ->where('range', ['from' => '2026-08-30', 'to' => '2026-09-28', 'monthly' => false])
            ->where('totals', ['sales' => 750000, 'collected' => 500000, 'orders' => 2, 'placed' => 3, 'cancelled' => 1, 'average' => 375000, 'items' => 3, 'goods' => 750000, 'costed' => 0, 'profit' => 0])
            ->where('previous.sales', 750000)
            ->where('previous.orders', 1)
            ->has('series', 30)
            ->where('series.29', ['key' => '2026-09-28', 'sales' => 250000, 'collected' => 500000, 'orders' => 1, 'profit' => 0])
            ->where('series.28', ['key' => '2026-09-27', 'sales' => 500000, 'collected' => 0, 'orders' => 1, 'profit' => 0])
            ->where('statuses', ['cancelled' => 1, 'delivered' => 1, 'pending' => 1])
            ->where('topProducts', [['name' => 'Vợt A', 'quantity' => 3, 'revenue' => 750000, 'profit' => null]])
            ->where('byBrand', [['name' => 'Hãng A', 'revenue' => 750000, 'quantity' => 3]])
            ->where('byStyle', [['name' => 'attack', 'revenue' => 750000, 'quantity' => 3]])
            ->where('customers.buyers', 1));

        $this->get('/admin/reports?demo=1')->assertInertia(fn (Assert $page) => $page
            ->where('filters.demo', true)
            ->where('totals.sales', 1750000)
            ->where('series.28.sales', 1500000));
    }

    public function test_year_view_groups_by_month_and_rejects_unknown_periods(): void
    {
        $variant = $this->variant();
        $this->order($variant, '2025-10-05 03:00:00');
        $this->order($variant, '2025-09-30 03:00:00');

        $this->actingAs($this->admin)->get('/admin/reports?period=12m')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('range', ['from' => '2025-10-01', 'to' => '2026-09-28', 'monthly' => true])
            ->has('series', 12)
            ->where('series.0', ['key' => '2025-10', 'sales' => 250000, 'collected' => 0, 'orders' => 1, 'profit' => 0])
            ->where('previous.sales', 250000));

        $this->from('/admin/reports')->get('/admin/reports?period=5y')->assertSessionHasErrors('period');
    }

    public function test_status_changes_record_when_they_happened(): void
    {
        $order = $this->order($this->variant(), '2026-09-27 03:00:00');
        $service = app(OrderService::class);
        foreach (['confirmed', 'shipped', 'delivered'] as $status) {
            $service->transition($order, $status);
        }
        $service->markCodPaid($order);

        $order->refresh();
        foreach (['confirmed_at', 'shipped_at', 'delivered_at', 'paid_at'] as $column) {
            $this->assertTrue(now()->equalTo($order->{$column}), $column);
        }
        $this->assertNull($order->cancelled_at);
    }

    public function test_settings_change_delivery_fees_and_the_contact_customers_see(): void
    {
        $this->actingAs($this->admin)->get('/admin/settings')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/settings')
            ->where('settings', ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000, 'hotline' => '', 'contact_email' => '', 'contact_address' => '', 'contact_chat_url' => '']));

        $this->put('/admin/settings', [
            'shipping_fee' => 25000, 'free_shipping_threshold' => 0, 'hotline' => '0901 234 567', 'contact_email' => 'lienhe@shop.vn',
            'contact_address' => '36 Thạch Lam, Tân Phú', 'contact_chat_url' => 'https://zalo.me/0866815722',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->app->forgetScopedInstances();
        $cart = app(CartService::class);
        // Threshold 0 turns free delivery by order value off.
        $this->assertSame(25000, $cart->shippingFee(5000000));
        $this->assertSame(0, $cart->shippingFee(0));
        $this->get('/products')->assertInertia(fn (Assert $page) => $page
            ->where('shop.contact', ['hotline' => '0901 234 567', 'email' => 'lienhe@shop.vn', 'address' => '36 Thạch Lam, Tân Phú', 'chat_url' => 'https://zalo.me/0866815722'])
            ->where('shop.free_shipping_from', 0));

        $this->put('/admin/settings', ['shipping_fee' => 0, 'free_shipping_threshold' => 500000, 'hotline' => '', 'contact_email' => '', 'contact_address' => '', 'contact_chat_url' => ''])
            ->assertSessionHasNoErrors();
        $this->app->forgetScopedInstances();
        $this->assertSame(0, app(CartService::class)->shippingFee(100000));

        $this->put('/admin/settings', ['shipping_fee' => -1, 'free_shipping_threshold' => 'x', 'hotline' => 'gọi tôi', 'contact_email' => 'no', 'contact_address' => str_repeat('a', 256), 'contact_chat_url' => 'javascript:alert(1)'])
            ->assertSessionHasErrors(['shipping_fee', 'free_shipping_threshold', 'hotline', 'contact_email', 'contact_address', 'contact_chat_url']);
    }

    public function test_bulk_actions_change_only_the_chosen_products(): void
    {
        $hidden = [$this->variant(['is_active' => false])->product_id, $this->variant(['is_active' => false])->product_id];
        $other = $this->variant(['is_active' => false])->product_id;

        $this->actingAs($this->admin)->post('/admin/products/bulk', ['ids' => $hidden, 'action' => 'publish'])
            ->assertRedirect()->assertSessionHas('success', 'Đã mở bán 2 sản phẩm.');
        $this->assertSame([true, true], Product::whereIn('id', $hidden)->pluck('is_active')->all());
        $this->assertFalse(Product::find($other)->is_active);

        $this->post('/admin/products/bulk', ['ids' => [$hidden[0]], 'action' => 'feature'])->assertSessionHas('success', 'Đã đánh dấu nổi bật 1 sản phẩm.');
        $this->assertTrue(Product::find($hidden[0])->is_featured);

        $this->post('/admin/products/bulk', ['ids' => [], 'action' => 'hide'])->assertSessionHasErrors('ids');
        $this->post('/admin/products/bulk', ['ids' => [$other], 'action' => 'delete'])->assertSessionHasErrors('action');
        $this->post('/admin/products/bulk', ['ids' => [999999], 'action' => 'hide'])->assertSessionHasErrors('ids.0');
    }

    public function test_order_export_is_a_csv_of_real_orders_in_the_chosen_days(): void
    {
        $variant = $this->variant();
        $this->order($variant, '2026-09-27 17:30:00', 1, ['name' => 'Trần Bình', 'phone' => '0911111111']);
        $this->order($variant, '2026-08-01 03:00:00', 1, ['name' => 'Lê Chi']);
        $this->order($variant, '2026-09-27 03:00:00', 1, ['name' => 'Đơn Mẫu', 'is_demo' => true]);

        $response = $this->actingAs($this->admin)->get('/admin/orders/export?from=2026-09-28&to=2026-09-28');
        $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF\"Mã đơn\",", $csv);
        $this->assertStringContainsString('Trần Bình', $csv);
        $this->assertStringContainsString('28/09/2026 00:30', $csv);
        $this->assertStringNotContainsString('Lê Chi', $csv);
        $this->assertStringNotContainsString('Đơn Mẫu', $csv);

        $all = $this->get('/admin/orders/export?q=0911111111')->streamedContent();
        $this->assertStringContainsString('Trần Bình', $all);
        $this->assertStringNotContainsString('Lê Chi', $all);
        $this->assertSame(3, substr_count($this->get('/admin/orders/export')->streamedContent(), "\n"));

        $this->get('/admin/orders/export?from=2026-09-28&to=2026-09-01')->assertSessionHasErrors('to');
    }

    public function test_reports_settings_bulk_and_export_are_for_admins_only(): void
    {
        $customer = User::factory()->create();
        $this->actingAs($customer)->get('/admin/reports')->assertForbidden();
        $this->get('/admin/settings')->assertForbidden();
        $this->put('/admin/settings', ['shipping_fee' => 0, 'free_shipping_threshold' => 0])->assertForbidden();
        $this->post('/admin/products/bulk', ['ids' => [1], 'action' => 'publish'])->assertForbidden();
        $this->get('/admin/orders/export')->assertForbidden();
    }
}
