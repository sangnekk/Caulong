<?php

namespace Tests\Feature;

use App\Console\Commands\DemoSales;
use App\Models\Brand;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Cost prices and profit, the product list's quick tools, demo sales and the store filters. */
class CostAndCatalogToolsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->admin = User::factory()->create(['is_admin' => true]);
        if (! Route::has('checkout.store')) {
            Route::middleware('web')->group(base_path('routes/checkout.php'));
        }
    }

    private function product(array $attributes = [], array $variants = [['stock' => 10]]): Product
    {
        $product = Product::create([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
            ...$attributes,
        ]);
        foreach ($variants as $variant) {
            $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 1000000, 'stock' => 10, 'is_active' => true, ...$variant]);
        }

        return $product->load('variants');
    }

    public function test_cost_is_kept_on_the_order_line_and_never_reaches_the_storefront(): void
    {
        $product = $this->product([], [['price' => 1000000, 'cost_price' => 640000, 'stock' => 5]]);
        $variant = $product->variants->first();

        $this->get('/products/'.$product->slug)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->missing('product.variants.0.cost_price'));
        $this->assertStringNotContainsString('640000', $this->get('/products')->getContent());

        $this->withSession(['shopping_cart' => [$variant->id => 2]])->get('/checkout')->assertOk();
        $this->post('/checkout', [
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'address' => '12 Nguyễn Huệ, TP. Hồ Chí Minh', 'payment_method' => 'cod', 'accept_terms' => true,
        ])->assertRedirect();
        $item = OrderItem::firstOrFail();
        $this->assertSame(640000, $item->unit_cost);

        // A later cost change does not rewrite what that sale earned.
        $variant->update(['cost_price' => 900000]);
        $this->assertSame(640000, $item->fresh()->unit_cost);
        $order = Order::firstOrFail();
        $page = $this->get('/orders/'.$order->public_id)->assertOk();
        $this->assertStringNotContainsString('unit_cost', $page->getContent());
    }

    public function test_product_form_saves_the_cost_and_shows_it_to_the_admin_only(): void
    {
        $product = $this->product();
        $variant = $product->variants->first();

        $this->actingAs($this->admin)->get('/admin/products/'.$product->id.'/edit')->assertInertia(fn (Assert $page) => $page
            ->where('product.variants.0.cost_price', null));
        $this->put('/admin/products/'.$product->id, [
            ...$product->only(['name', 'slug', 'description', 'play_style', 'skill_level']),
            'is_active' => true, 'is_featured' => false, 'is_demo' => false,
            'variants' => [['id' => $variant->id, 'sku' => $variant->sku, 'name' => '4U', 'price' => 1000000, 'cost_price' => 700000, 'stock' => 10, 'expected_stock' => 10, 'is_active' => true]],
        ])->assertSessionHasNoErrors();
        $this->assertSame(700000, $variant->fresh()->cost_price);
        $this->get('/admin/products/'.$product->id.'/edit')->assertInertia(fn (Assert $page) => $page
            ->where('product.variants.0.cost_price', 700000));
        $this->get('/admin/products')->assertInertia(fn (Assert $page) => $page
            ->where('products.data.0.variants.0.cost_price', 700000));
    }

    public function test_quick_edit_changes_price_cost_and_stock_without_overwriting_a_new_sale(): void
    {
        $product = $this->product([], [['stock' => 0], ['stock' => 4]]);
        [$first, $second] = $product->variants->all();
        $other = $this->product()->variants->first();
        $url = '/admin/products/'.$product->id.'/variants';

        $this->actingAs($this->admin)->patch($url, ['variants' => [
            ['id' => $first->id, 'price' => 1200000, 'cost_price' => 800000, 'stock' => 7, 'expected_stock' => 0],
            ['id' => $second->id, 'price' => 1100000, 'cost_price' => null, 'stock' => 4, 'expected_stock' => 4],
        ]])->assertRedirect()->assertSessionHasNoErrors()->assertSessionHas('success');
        $this->assertSame([1200000, 800000, 7], [$first->fresh()->price, $first->fresh()->cost_price, $first->fresh()->stock]);

        // Someone bought one meanwhile: the screen said 4, the shelf says 3.
        $second->update(['stock' => 3]);
        $this->patch($url, ['variants' => [['id' => $second->id, 'price' => 1100000, 'stock' => 10, 'expected_stock' => 4]]])
            ->assertSessionHasErrors('variants.0.stock');
        $this->assertSame(3, $second->fresh()->stock);

        $this->patch($url, ['variants' => [['id' => $other->id, 'price' => 1, 'stock' => 1, 'expected_stock' => 10]]])
            ->assertSessionHasErrors('variants.0.id');
        $this->patch($url, ['variants' => [['id' => $first->id, 'price' => -1, 'stock' => 'x', 'expected_stock' => 7]]])
            ->assertSessionHasErrors(['variants.0.price', 'variants.0.stock']);
        $this->actingAs(User::factory()->create())->patch($url, ['variants' => []])->assertForbidden();
    }

    public function test_bulk_can_act_on_every_product_matching_the_filters(): void
    {
        $brand = Brand::create(['name' => 'Hãng A', 'slug' => 'hang-a']);
        $matching = collect(range(1, 30))->map(fn () => $this->product(['brand_id' => $brand->id, 'is_active' => false])->id);
        $other = $this->product(['is_active' => false]);

        $this->actingAs($this->admin)->post('/admin/products/bulk', ['all' => 1, 'action' => 'publish', 'brand' => $brand->id, 'status' => 'hidden'])
            ->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã mở bán 30 sản phẩm.');
        $this->assertSame(30, Product::whereIn('id', $matching)->where('is_active', true)->count());
        $this->assertFalse($other->fresh()->is_active);

        $this->post('/admin/products/bulk', ['action' => 'hide'])->assertSessionHasErrors('ids');
        $this->post('/admin/products/bulk', ['all' => 1, 'action' => 'hide', 'status' => 'nope'])->assertSessionHasErrors('status');
    }

    public function test_report_shows_gross_profit_only_where_the_cost_is_known(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00', 'Asia/Ho_Chi_Minh'));
        $costed = $this->product(['name' => 'Có giá nhập'], [['price' => 1000000, 'cost_price' => 600000, 'stock' => 3]])->variants->first();
        $unknown = $this->product(['name' => 'Chưa có giá nhập'], [['price' => 500000, 'stock' => 2]])->variants->first();
        $order = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'An', 'phone' => '0901234567',
            'address' => 'Hà Nội', 'subtotal' => 2500000, 'shipping_fee' => 0, 'total' => 2500000, 'created_at' => '2026-09-27 03:00:00',
        ]);
        foreach ([[$costed, 2, 600000], [$unknown, 1, null]] as [$variant, $quantity, $cost]) {
            $order->items()->create([
                'variant_id' => $variant->id, 'product_name' => $variant->product->name, 'variant_name' => '4U', 'sku' => $variant->sku,
                'unit_price' => $variant->price, 'unit_cost' => $cost, 'quantity' => $quantity, 'line_total' => $variant->price * $quantity,
            ]);
        }

        $this->actingAs($this->admin)->get('/admin/reports')->assertInertia(fn (Assert $page) => $page
            ->where('totals.goods', 2500000)
            ->where('totals.costed', 2000000)
            ->where('totals.profit', 800000)
            ->where('series.28.profit', 800000)
            ->where('topProducts.0', ['name' => 'Có giá nhập', 'quantity' => 2, 'revenue' => 2000000, 'profit' => 800000])
            ->where('topProducts.1.profit', null)
            ->where('stock.cost_value', 3 * 600000)
            ->where('stock.costed_units', 3)
            ->where('stock.units', 5));
    }

    public function test_demo_sales_are_labelled_repeatable_and_removable(): void
    {
        $real = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Khách thật', 'phone' => '0901234567',
            'address' => 'Hà Nội', 'subtotal' => 100000, 'shipping_fee' => 0, 'total' => 100000,
        ]);

        $this->artisan('shop:demo-sales', ['--months' => 2])->assertSuccessful();
        $demo = Order::where('checkout_token', 'like', DemoSales::TOKEN.'%');
        $count = $demo->count();
        $this->assertGreaterThan(20, $count);
        $this->assertSame($count, Order::where('is_demo', true)->count(), 'every generated order is demo');
        $this->assertSame(0, OrderItem::whereNull('unit_cost')->whereIn('order_id', (clone $demo)->select('id'))->count());
        $this->assertTrue(Product::whereIn('id', ProductVariant::whereIn('id', OrderItem::select('variant_id'))->select('product_id'))->where('is_demo', false)->doesntExist(), 'only demo products are sold');
        $this->assertSame(0, (clone $demo)->where('created_at', '>', now())->count());
        $this->assertSame(0, (clone $demo)->whereNotNull('paid_at')->where('status', '!=', 'delivered')->count());

        $this->artisan('shop:demo-sales', ['--months' => 2])->assertSuccessful();
        $this->assertSame($count, Order::where('checkout_token', 'like', DemoSales::TOKEN.'%')->count(), 'a rerun replaces, not adds');

        $this->actingAs($this->admin)->get('/admin/reports')->assertInertia(fn (Assert $page) => $page->where('totals.placed', 1));
        $this->get('/admin/orders')->assertInertia(fn (Assert $page) => $page->where('orders.total', 1)->where('demoCount', $count));
        $this->get('/admin/orders?demo=1')->assertInertia(fn (Assert $page) => $page->where('orders.total', $count + 1));

        $this->artisan('shop:demo-sales', ['--clear' => true])->assertSuccessful();
        $this->assertSame(0, Order::where('is_demo', true)->count());
        $this->assertTrue($real->fresh()->exists);
    }

    public function test_store_lists_what_can_be_bought_first_and_filters_by_price_and_stock(): void
    {
        $soldOut = $this->product(['name' => 'Hết hàng'], [['price' => 900000, 'stock' => 0]]);
        $cheap = $this->product(['name' => 'Rẻ'], [['price' => 800000, 'stock' => 2]]);
        $dear = $this->product(['name' => 'Đắt'], [['price' => 2500000, 'stock' => 1], ['price' => 900000, 'stock' => 0, 'is_active' => false]]);
        $soldOut->forceFill(['created_at' => now()->addDay()])->save();

        $this->get('/products')->assertInertia(fn (Assert $page) => $page
            ->where('products.data.2.id', $soldOut->id)->where('inStock', 2));
        $this->get('/products?stock=in')->assertInertia(fn (Assert $page) => $page->where('products.total', 2));
        $this->get('/products?price=under-1m')->assertInertia(fn (Assert $page) => $page
            ->where('products.total', 2)->where('products.data.0.id', $cheap->id));
        $this->get('/products?price=2m-3m')->assertInertia(fn (Assert $page) => $page
            ->where('products.total', 1)->where('products.data.0.id', $dear->id));
        $this->getJson('/products?price=cheap')->assertJsonValidationErrors('price');
        $this->getJson('/products?stock=some')->assertJsonValidationErrors('stock');
    }

    public function test_import_reads_an_optional_cost_column(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $csv = "\xEF\xBB\xBF".implode("\r\n", [
            'Tên sản phẩm;Mô tả;Lối chơi;SKU;Giá bán;Giá nhập;Tồn kho',
            'Vợt Có Giá Nhập;Mô tả của shop.;tấn công;CGN-1;1.290.000;950.000;3',
            'Vợt Chưa Có;Mô tả của shop.;cân bằng;CCG-1;990000;;1',
        ])."\r\n";
        $location = $this->actingAs($this->admin)->post('/admin/imports', [
            'catalog' => UploadedFile::fake()->createWithContent('hang.csv', $csv), 'update_stock' => true, 'publish' => false,
        ])->assertRedirect()->headers->get('Location');
        $plan = $this->get($location)->viewData('page')['props']['plan'];
        $this->post($location, ['fingerprint' => $plan['fingerprint']])->assertRedirect('/admin/products');

        $this->assertSame(950000, ProductVariant::where('sku', 'cgn-1')->value('cost_price'));
        $this->assertNull(ProductVariant::where('sku', 'ccg-1')->value('cost_price'));
    }
}
