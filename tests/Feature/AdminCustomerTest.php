<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use App\Services\CustomerProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminCustomerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_admin' => true]);
        $this->customer = User::factory()->create(['name' => 'Lê Thu Hà', 'created_at' => '2026-01-05 08:00:00']);
    }

    private function product(string $name, array $attributes = []): Product
    {
        $product = Product::create(array_merge([
            'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 1000000, 'stock' => 5, 'is_active' => true]);

        return $product;
    }

    /** @param  array<int, array{0: Product, 1: int}>  $lines  product and quantity */
    private function order(array $lines, array $attributes = [], ?User $customer = null): Order
    {
        $total = array_sum(array_map(fn (array $line) => 1000000 * $line[1], $lines));
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => ($customer ?? $this->customer)->id,
            'name' => 'Lê Thu Hà', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => $total, 'shipping_fee' => 0, 'total' => $total,
        ], $attributes));
        foreach ($lines as [$product, $quantity]) {
            $variant = $product->variants->first();
            $order->items()->create([
                'variant_id' => $variant->id, 'product_name' => $product->name, 'variant_name' => $variant->name, 'sku' => $variant->sku,
                'unit_price' => 1000000, 'quantity' => $quantity, 'line_total' => 1000000 * $quantity,
            ]);
        }

        return $order;
    }

    private function event(string $name, string $at, ?Product $product = null, array $metadata = []): CustomerEvent
    {
        return CustomerEvent::create([
            'user_id' => $this->customer->id, 'name' => $name, 'product_id' => $product?->id,
            'metadata' => $metadata ?: null, 'created_at' => $at,
        ]);
    }

    public function test_the_customer_page_is_for_staff_only(): void
    {
        $this->get(route('admin.customers.show', $this->customer))->assertRedirect(route('login'));
        $this->actingAs($this->customer)->get(route('admin.customers.show', $this->customer))->assertForbidden();
        $this->actingAs($this->admin)->get(route('admin.customers.show', 999999))->assertNotFound();
        $this->get(route('admin.customers.show', ['user' => $this->customer, 'tab' => 'secrets']))->assertSessionHasErrors('tab');
    }

    public function test_overview_counts_real_orders_and_money_actually_received(): void
    {
        $racket = $this->product('Vợt A');
        $this->order([[$racket, 1]], ['status' => 'delivered', 'payment_status' => 'paid', 'created_at' => '2026-03-01 10:00:00']);
        $latest = $this->order([[$racket, 2]], ['status' => 'pending', 'created_at' => '2026-04-01 10:00:00']);
        $this->order([[$racket, 1]], ['status' => 'cancelled', 'created_at' => '2026-05-01 10:00:00']);
        // Sample orders and another customer's orders are not this customer's history.
        $this->order([[$racket, 5]], ['is_demo' => true, 'status' => 'delivered', 'payment_status' => 'paid']);
        $this->order([[$racket, 3]], ['status' => 'delivered', 'payment_status' => 'paid'], User::factory()->create());

        $this->actingAs($this->admin)->get(route('admin.customers.show', $this->customer))->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/customer')
                ->where('tab', 'overview')
                ->where('customer.email', $this->customer->email)
                ->missing('customer.password')
                ->where('overview.orders', 2)->where('overview.open', 1)->where('overview.cancelled', 1)
                ->where('overview.ordered', 3000000)->where('overview.spent', 1000000)->where('overview.average', 1500000)
                ->where('overview.first_order_at', Carbon::parse('2026-03-01 10:00:00')->toIso8601String())
                ->where('overview.last_order_at', Carbon::parse('2026-04-01 10:00:00')->toIso8601String())
                ->has('recentOrders', 3)
                ->where('recentOrders.1.id', $latest->id)->where('recentOrders.1.items_count', 1)
                ->missing('recentOrders.0.checkout_token')
                ->has('timeline.entries')
                ->where('orders', null)->where('products', null)->where('reviews', null));

        $this->get(route('admin.customers.show', ['user' => $this->customer, 'tab' => 'orders']))
            ->assertInertia(fn (Assert $page) => $page->has('orders.data', 3)->where('orders.total', 3)->where('recentOrders', null)->where('timeline', null));

        $empty = User::factory()->create();
        $this->get(route('admin.customers.show', $empty))->assertInertia(fn (Assert $page) => $page
            ->where('overview.orders', 0)->where('overview.spent', 0)->where('overview.average', 0)->where('overview.last_order_at', null)
            ->has('recentOrders', 0)->has('timeline.entries', 1)->where('timeline.entries.0.type', 'register'));
    }

    public function test_timeline_tells_what_the_customer_did_and_what_happened_to_their_orders(): void
    {
        $racket = $this->product('Vợt A');
        $this->event('product_view', '2026-02-01 09:00:00', $racket);
        $this->event('search', '2026-02-01 09:01:00', null, ['q' => 'astrox', 'results' => 4]);
        $this->event('add_to_cart', '2026-02-01 09:02:00', $racket, ['variant_id' => 1, 'quantity' => 2, 'price' => 1000000]);
        $this->event('checkout_started', '2026-02-01 09:03:00', null, ['items' => 2, 'subtotal' => 2000000]);
        // Steps recorded in the same second still read in the order they happen.
        $order = $this->order([[$racket, 2]], [
            'status' => 'delivered', 'payment_status' => 'paid', 'created_at' => '2026-02-01 09:05:00',
            'confirmed_at' => '2026-02-03 15:00:00', 'shipped_at' => '2026-02-03 15:00:00',
            'delivered_at' => '2026-02-03 15:00:00', 'paid_at' => '2026-02-03 15:00:00',
        ]);
        // The order is told once, from the orders table.
        $this->event('order_placed', '2026-02-01 09:05:00')->update(['order_id' => $order->id]);
        ProductReview::create(['user_id' => $this->customer->id, 'product_id' => $racket->id, 'rating' => 5, 'status' => 'published', 'created_at' => '2026-02-10 20:00:00']);
        // Someone else's activity never shows here.
        CustomerEvent::create(['user_id' => User::factory()->create()->id, 'name' => 'product_view', 'product_id' => $racket->id]);

        $this->actingAs($this->admin)->get(route('admin.customers.show', ['user' => $this->customer, 'tab' => 'timeline']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('timeline.next', null)
                ->where('timeline.entries', fn ($entries) => collect($entries)->pluck('type')->all() === [
                    'review', 'order_paid', 'order_delivered', 'order_shipped', 'order_confirmed', 'order_placed',
                    'checkout_started', 'add_to_cart', 'search', 'product_view', 'register',
                ])
                ->where('timeline.entries.0.product.name', 'Vợt A')->where('timeline.entries.0.data.rating', 5)
                ->where('timeline.entries.1.order.id', $order->id)->where('timeline.entries.1.order.total', 2000000)
                ->where('timeline.entries.7.data.quantity', 2)
                ->where('timeline.entries.8.data.q', 'astrox')
                ->where('timeline.entries.10.at', Carbon::parse('2026-01-05 08:00:00')->toIso8601String()));
    }

    public function test_timeline_pages_lose_nothing_when_several_things_share_a_second(): void
    {
        $racket = $this->product('Vợt A');
        foreach (range(1, 5) as $ignored) {
            $this->event('product_view', '2026-02-01 09:00:00', $racket);
        }
        $this->event('search', '2026-02-02 09:00:00', null, ['q' => 'astrox']);
        $profile = $this->app->make(CustomerProfile::class);

        $seen = [];
        $cursor = ['before' => null, 'skip' => 0];
        $pages = 0;
        do {
            $page = $profile->timeline($this->customer, false, $cursor['before'] ? Carbon::parse($cursor['before']) : null, $cursor['skip'], 2);
            $seen = [...$seen, ...array_column($page['entries'], 'key')];
            $cursor = $page['next'];
            $pages++;
        } while ($cursor !== null && $pages < 10);

        // 1 search + 5 views in the same second + the account itself, two at a time.
        $this->assertSame(4, $pages);
        $this->assertCount(7, $seen);
        $this->assertCount(7, array_unique($seen));
        $this->assertSame('0:account', end($seen));
    }

    public function test_products_tab_lists_what_was_bought_looked_at_and_saved(): void
    {
        $yonex = Brand::create(['name' => 'Yonex', 'slug' => 'yonex']);
        $lining = Brand::create(['name' => 'Li-Ning', 'slug' => 'li-ning']);
        $astrox = $this->product('Astrox 88', ['brand_id' => $yonex->id]);
        $nanoflare = $this->product('Nanoflare 700', ['brand_id' => $yonex->id]);
        $axforce = $this->product('Axforce 80', ['brand_id' => $lining->id]);
        $this->order([[$astrox, 1], [$axforce, 1]], ['status' => 'delivered', 'created_at' => '2026-03-01 10:00:00']);
        $this->order([[$astrox, 2]], ['status' => 'pending', 'created_at' => '2026-04-01 10:00:00']);
        $this->order([[$nanoflare, 4]], ['status' => 'cancelled']);
        $this->event('product_view', '2026-04-02 09:00:00', $nanoflare);
        $this->event('product_view', '2026-04-03 09:00:00', $nanoflare);
        $this->event('product_view', '2026-04-01 09:00:00', $axforce);
        $this->event('add_to_cart', '2026-04-04 09:00:00', $astrox);
        $this->customer->wishlist()->attach($nanoflare->id);

        $this->actingAs($this->admin)->get(route('admin.customers.show', ['user' => $this->customer, 'tab' => 'products']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.purchased', 2)
                ->where('products.purchased.0.name', 'Astrox 88')->where('products.purchased.0.units', 3)->where('products.purchased.0.spent', 3000000)
                ->where('products.purchased.0.last_at', Carbon::parse('2026-04-01 10:00:00')->toIso8601String())
                ->where('products.purchased.1.name', 'Axforce 80')
                ->where('products.brands', [['name' => 'Yonex', 'units' => 3], ['name' => 'Li-Ning', 'units' => 1]])
                ->where('products.categories', [])
                ->has('products.viewed', 2)
                ->where('products.viewed.0.id', $nanoflare->id)->where('products.viewed.0.views', 2)
                ->where('products.viewed.1.id', $axforce->id)
                ->has('products.wishlist', 1)->where('products.wishlist.0.name', 'Nanoflare 700'));
    }

    public function test_reviews_tab_and_the_list_link_to_the_customer(): void
    {
        $racket = $this->product('Vợt A');
        ProductReview::create(['user_id' => $this->customer->id, 'product_id' => $racket->id, 'rating' => 2, 'body' => 'Cán hơi nhỏ.', 'status' => 'pending']);

        $this->actingAs($this->admin)->get(route('admin.customers.show', ['user' => $this->customer, 'tab' => 'reviews']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('reviews', 1)
                ->where('reviews.0.rating', 2)->where('reviews.0.status', 'pending')->where('reviews.0.product.slug', $racket->slug));
        $this->get(route('admin.customers.index'))->assertInertia(fn (Assert $page) => $page
            ->where('customers.data', fn ($rows) => collect($rows)->contains('id', $this->customer->id)));
    }
}
