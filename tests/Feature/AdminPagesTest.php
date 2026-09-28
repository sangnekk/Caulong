<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPagesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->admin = User::factory()->create(['is_admin' => true]);
    }

    private function product(array $attributes = [], array $variants = [['stock' => 10]]): Product
    {
        $product = Product::create(array_merge([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        foreach ($variants as $variant) {
            $product->variants()->create(array_merge([
                'sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 500000, 'stock' => 10, 'is_active' => true,
            ], $variant));
        }

        return $product;
    }

    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(),
            'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000,
        ], $attributes));
    }

    public function test_dashboard_lists_real_work_and_ignores_demo_data(): void
    {
        $this->order(['status' => 'pending']);
        $this->order(['status' => 'pending', 'is_demo' => true]);
        $this->order(['status' => 'delivered', 'payment_status' => 'unpaid']);
        $this->order(['status' => 'delivered', 'payment_status' => 'paid', 'total' => 1200000]);
        $this->product([], [['stock' => 3]]);
        $this->product(['is_active' => false], [['stock' => 4]]);
        $this->product(['is_demo' => true]);
        User::factory()->create();

        $this->actingAs($this->admin)->get('/admin')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/dashboard')
            ->where('todo.pending_orders', 1)
            ->where('todo.uncollected', 1)
            ->where('todo.low_stock', 1)
            ->where('todo.stocked_hidden', 1)
            ->where('todo.demo_visible', 1)
            ->where('todo.sold_out', 0)
            ->where('stats.products_active', 1)
            ->where('stats.products_in_stock', 1)
            ->where('stats.orders_open', 1)
            ->where('stats.week_sales', 2200000)
            ->where('stats.week_collected', 0)
            ->where('stats.customers', 1)
            ->has('lowStock', 1)
            ->where('shop.pending_orders', 1));
    }

    public function test_products_filter_by_status_stock_brand_and_sku(): void
    {
        $brand = Brand::create(['name' => 'Hãng A', 'slug' => 'hang-a']);
        $low = $this->product(['brand_id' => $brand->id, 'play_style' => 'attack'], [['stock' => 2, 'sku' => 'lowsku1']]);
        $out = $this->product([], [['stock' => 0]]);
        $hidden = $this->product(['is_active' => false]);
        $this->product(['is_demo' => true]);
        $ids = fn (string $query) => collect($this->actingAs($this->admin)->get('/admin/products?'.$query)->assertOk()
            ->viewData('page')['props']['products']['data'])->pluck('id')->all();

        $this->assertSame([$low->id], $ids('stock=low'));
        $this->assertSame([$out->id], $ids('stock=out'));
        $this->assertSame([$hidden->id], $ids('status=hidden'));
        $this->assertSame([$low->id], $ids('brand='.$brand->id.'&style=attack'));
        $this->assertSame([$low->id], $ids('q=LOWSKU'));
        $this->get('/admin/products')->assertInertia(fn (Assert $page) => $page
            ->where('counts', ['all' => 4, 'active' => 2, 'hidden' => 1, 'demo' => 1])
            ->where('products.data.0.brand', null)
            ->has('products.data.0.image_url'));
        $this->get('/admin/products?status=bogus')->assertSessionHasErrors('status');
    }

    public function test_orders_search_by_number_name_or_phone_with_status_counts(): void
    {
        $first = $this->order(['name' => 'Trần Bình', 'phone' => '0987000111']);
        $this->order(['name' => 'Lê Chi', 'status' => 'shipped']);
        $this->order(['name' => 'Phạm Dũng', 'status' => 'delivered', 'payment_status' => 'paid']);
        $ids = fn (string $query) => collect($this->actingAs($this->admin)->get('/admin/orders?'.$query)->assertOk()
            ->viewData('page')['props']['orders']['data'])->pluck('id')->all();

        $this->assertSame([$first->id], $ids('q=%23'.$first->id));
        $this->assertSame([$first->id], $ids('q=0987000'));
        $this->assertSame([$first->id], $ids('q=Bình'));
        $this->assertCount(2, $ids('payment=unpaid'));
        $this->get('/admin/orders?q=Chi')->assertInertia(fn (Assert $page) => $page
            ->where('counts.all', 1)->where('counts.shipped', 1)->where('counts.pending', 0));
    }

    public function test_order_detail_shows_other_orders_from_the_same_phone(): void
    {
        $order = $this->order();
        $earlier = $this->order(['status' => 'delivered']);
        $this->order(['phone' => '0911111111']);

        $this->actingAs($this->admin)->get('/admin/orders/'.$order->id)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/order')->has('related', 1)->where('related.0.id', $earlier->id)->where('order.user', null));
    }

    public function test_customers_and_taxonomies_pages(): void
    {
        $customer = User::factory()->create(['name' => 'Khách Một']);
        Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $customer->id,
            'name' => 'Khách Một', 'phone' => '0901234567', 'address' => 'Huế', 'status' => 'delivered',
            'payment_status' => 'paid', 'subtotal' => 700000, 'shipping_fee' => 0, 'total' => 700000,
        ]);
        $brand = Brand::create(['name' => 'Hãng B', 'slug' => 'hang-b']);
        $this->product(['brand_id' => $brand->id]);
        $this->product(['brand_id' => $brand->id, 'is_active' => false]);

        $this->actingAs($this->admin)->get('/admin/customers?role=customer')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/customers')->has('customers.data', 1)
            ->where('customers.data.0.name', 'Khách Một')->where('customers.data.0.orders', 1)
            ->where('customers.data.0.collected', 700000)->where('counts', ['all' => 2, 'admins' => 1]));
        $this->get('/admin/customers?q=khong-co')->assertInertia(fn (Assert $page) => $page->has('customers.data', 0));
        $this->get('/admin/taxonomies')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/taxonomies')->where('brands.0.name', 'Hãng B')
            ->where('brands.0.products', 2)->where('brands.0.active', 1));
    }

    public function test_new_admin_pages_are_admin_only(): void
    {
        $customer = User::factory()->create();
        foreach (['/admin/customers', '/admin/taxonomies'] as $url) {
            $this->actingAs($customer)->get($url)->assertForbidden();
        }
    }
}
