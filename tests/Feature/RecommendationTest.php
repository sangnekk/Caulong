<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\RecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RecommendationTest extends TestCase
{
    use RefreshDatabase;

    private Brand $brand;

    private Brand $other;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brand = Brand::create(['name' => 'Hãng A', 'slug' => 'hang-a']);
        $this->other = Brand::create(['name' => 'Hãng B', 'slug' => 'hang-b']);
        $this->category = Category::create(['name' => 'Vợt', 'slug' => 'vot']);
    }

    /** A product on sale with one version. `price`, `stock` and `list` go to the version. */
    private function product(string $name, array $attributes = []): Product
    {
        $version = ['price' => $attributes['price'] ?? 1000000, 'stock' => $attributes['stock'] ?? 0, 'compare_at_price' => $attributes['list'] ?? null];
        unset($attributes['price'], $attributes['stock'], $attributes['list']);
        $product = Product::create(array_merge([
            'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)), 'description' => 'Mô tả',
            'brand_id' => $this->brand->id, 'category_id' => $this->category->id,
            'play_style' => 'attack', 'skill_level' => 'intermediate', 'is_active' => true,
        ], $attributes));
        $product->variants()->create(['sku' => (string) Str::uuid(), 'name' => '4U', 'is_active' => true, ...$version]);

        return $product;
    }

    /** @param  array<int, Product>  $products */
    private function order(array $products, array $attributes = []): Order
    {
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(),
            'name' => 'Khách', 'phone' => '0900000000', 'address' => 'Địa chỉ',
            'subtotal' => 0, 'shipping_fee' => 0, 'total' => 0,
        ], $attributes));
        foreach ($products as $product) {
            $variant = $product->variants()->firstOrFail();
            $order->items()->create([
                'variant_id' => $variant->id, 'product_name' => $product->name, 'variant_name' => $variant->name,
                'sku' => $variant->sku, 'unit_price' => $variant->price, 'quantity' => 1, 'line_total' => $variant->price,
            ]);
        }

        return $order;
    }

    /** @return list<string> */
    private function names(iterable $products): array
    {
        return collect($products)->map(fn ($product) => is_array($product) ? $product['name'] : $product->name)->values()->all();
    }

    public function test_related_stays_in_the_brand_and_ranks_by_what_products_share(): void
    {
        $seed = $this->product('Vợt gốc');
        $this->product('Cùng lối, gần giá, còn hàng', ['price' => 1100000, 'stock' => 3]);
        $this->product('Cùng lối, gần giá', ['price' => 1100000]);
        $this->product('Cùng lối, xa giá', ['price' => 3000000]);
        $this->product('Khác lối, xa giá', ['price' => 3000000, 'play_style' => 'speed', 'skill_level' => 'advanced']);
        $this->product('Hãng khác', ['brand_id' => $this->other->id, 'stock' => 9]);
        $this->product('Đang ẩn', ['is_active' => false, 'stock' => 9]);
        $this->product('Dữ liệu mẫu', ['is_demo' => true, 'stock' => 9]);
        ProductVariant::whereIn('product_id', [$this->product('Không có phiên bản bán', ['stock' => 9])->id])->update(['is_active' => false]);

        $related = app(RecommendationService::class)->related($seed, 10);

        $this->assertSame(['Cùng lối, gần giá, còn hàng', 'Cùng lối, gần giá', 'Cùng lối, xa giá', 'Khác lối, xa giá'], $this->names($related));
        $this->assertSame(['Cùng lối, gần giá, còn hàng'], $this->names(app(RecommendationService::class)->related($seed, 1)));
    }

    public function test_similar_are_other_brands_playing_the_same_way(): void
    {
        $seed = $this->product('Vợt gốc', ['specs' => ['balance' => 'Nặng Đầu', 'stiffness' => 'Cứng']]);
        $this->product('Cùng hãng', ['stock' => 5]);
        $this->product('Khác hãng, khác lối', ['brand_id' => $this->other->id, 'play_style' => 'speed', 'stock' => 5]);
        $this->product('Khác hãng, xa giá', ['brand_id' => $this->other->id, 'price' => 5000000]);
        $this->product('Khác hãng, gần giá', ['brand_id' => $this->other->id, 'price' => 950000]);
        $this->product('Không hãng, cùng thông số', ['brand_id' => null, 'price' => 950000, 'specs' => ['balance' => 'nặng đầu', 'stiffness' => 'Cứng']]);

        $service = app(RecommendationService::class);

        $this->assertSame(['Không hãng, cùng thông số', 'Khác hãng, gần giá', 'Khác hãng, xa giá'], $this->names($service->similar($seed, 10)));
        // The two lists of a product page never repeat each other.
        $this->assertSame([], array_intersect($this->names($service->related($seed, 10)), $this->names($service->similar($seed, 10))));
        // A real product never points at sample data, and sample data stays among itself.
        $demo = $this->product('Mẫu một', ['is_demo' => true, 'brand_id' => $this->other->id]);
        $this->product('Mẫu hai', ['is_demo' => true]);
        $this->assertSame(['Mẫu hai'], $this->names($service->similar($demo, 10)));
    }

    public function test_sales_signals_count_real_orders_that_were_not_cancelled(): void
    {
        $seed = $this->product('Vợt gốc');
        $partner = $this->product('Mua cùng hai lần', ['brand_id' => $this->other->id, 'play_style' => 'speed']);
        $once = $this->product('Mua cùng một lần', ['brand_id' => $this->other->id, 'play_style' => 'speed']);
        $demoOnly = $this->product('Chỉ trong đơn mẫu', ['brand_id' => $this->other->id, 'play_style' => 'speed']);
        $this->order([$seed, $partner]);
        $this->order([$seed, $partner, $once]);
        $this->order([$seed, $demoOnly], ['is_demo' => true]);
        $this->order([$seed, $demoOnly], ['is_demo' => true]);
        $this->order([$seed, $once], ['status' => 'cancelled']);
        $this->order([$seed], ['created_at' => now()->subDays(200)]);

        $service = app(RecommendationService::class);

        $this->assertSame(['Mua cùng hai lần'], $this->names($service->boughtTogether($seed)));
        $this->assertSame([], $this->names($service->boughtTogether($once)));
        $this->assertSame(3, $service->soldCount($seed), 'two recent real orders and one old one');
        $this->assertSame(0, $service->soldCount($demoOnly));
        // Popular: recent real sales only, best seller first.
        $this->assertSame([$seed->id => 2, $partner->id => 2, $once->id => 1], $service->sales());
        $this->assertSame(['Vợt gốc', 'Mua cùng hai lần', 'Mua cùng một lần'], $this->names($service->popular()));
        $this->assertSame(['Mua cùng hai lần'], $this->names($service->popular(1, [$seed->id])));
    }

    public function test_a_best_seller_outranks_an_equal_match(): void
    {
        $seed = $this->product('Vợt gốc');
        $plain = $this->product('Giống hệt');
        $selling = $this->product('Giống hệt, bán chạy');
        $this->order([$selling]);

        $this->assertSame(['Giống hệt, bán chạy', 'Giống hệt'], $this->names(app(RecommendationService::class)->related($seed)));
        $this->assertGreaterThan($plain->id, $selling->id, 'the newer product would also win a tie, so the order above is the score');
        Cache::flush();
        Order::query()->update(['status' => 'cancelled']);
        $this->assertSame(['Giống hệt, bán chạy', 'Giống hệt'], $this->names(app(RecommendationService::class)->related($seed)), 'equal scores: newer first');
    }

    public function test_product_page_carries_gallery_list_price_and_recommendations(): void
    {
        $seed = $this->product('Vợt gốc', ['price' => 900000, 'list' => 1200000, 'image_path' => 'products/main.webp']);
        $seed->images()->createMany([
            ['path' => 'products/side.webp', 'hash' => str_repeat('b', 64), 'position' => 2],
            ['path' => 'products/back.webp', 'hash' => str_repeat('a', 64), 'position' => 1],
        ]);
        $seed->variants()->create(['sku' => 'no-saving', 'name' => '3U', 'price' => 900000, 'compare_at_price' => 900000, 'stock' => 1, 'is_active' => true]);
        $related = $this->product('Cùng hãng', ['list' => 1500000, 'stock' => 2]);
        $similar = $this->product('Hãng khác', ['brand_id' => $this->other->id]);
        $partner = $this->product('Mua cùng', ['brand_id' => $this->other->id]);
        $this->order([$seed, $partner]);
        $this->order([$seed, $partner]);

        $this->get('/products/'.$seed->slug)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/product', false)
            ->where('product.images', array_map(fn ($path) => Storage::disk('public')->url($path), ['products/main.webp', 'products/back.webp', 'products/side.webp']))
            ->where('product.variants.0.compare_at_price', 1200000)
            // A list price that is no saving is not shown as one.
            ->where('product.variants.1.compare_at_price', null)
            ->where('sold', 2)
            ->where('boughtTogether', fn ($cards) => $this->names($cards) === ['Mua cùng'])
            ->where('related.0', [
                'id' => $related->id, 'name' => 'Cùng hãng', 'slug' => $related->slug, 'image_url' => '/models/hyper-core-poster.png',
                'play_style' => 'attack', 'is_demo' => false, 'brand' => 'Hãng A', 'price' => 1000000, 'compare_at_price' => 1500000, 'in_stock' => true,
            ])
            // What orders hold together is suggested once, not again as "similar".
            ->where('similar', fn ($cards) => $this->names($cards) === ['Hãng khác']));
        // The list page stays light: no gallery there.
        $this->get('/products')->assertOk()->assertInertia(fn (Assert $page) => $page->missing('products.data.0.images'));
        $this->assertSame($similar->id, $similar->fresh()->id);
    }

    public function test_recently_viewed_keeps_the_browsers_order_and_drops_what_is_gone(): void
    {
        $first = $this->product('Xem trước');
        $second = $this->product('Xem sau', ['brand_id' => $this->other->id]);
        $hidden = $this->product('Đã ẩn', ['is_active' => false]);

        $this->getJson('/recommendations?viewed='.implode(',', [$second->id, $hidden->id, 999999, $first->id, $second->id]))
            ->assertOk()
            ->assertJsonPath('viewed.0.name', 'Xem sau')->assertJsonPath('viewed.1.name', 'Xem trước')->assertJsonCount(2, 'viewed')
            ->assertJsonPath('viewed.0.brand', 'Hãng B')
            ->assertJsonPath('basis', null)->assertJsonPath('suggested', []);
        // The product on screen is not "recently viewed".
        $this->getJson('/recommendations?viewed='.$second->id.','.$first->id.'&product='.$second->id)
            ->assertOk()->assertJsonCount(1, 'viewed')->assertJsonPath('viewed.0.name', 'Xem trước');
        $this->getJson('/recommendations')->assertOk()->assertExactJson(['viewed' => [], 'basis' => null, 'suggested' => []]);
    }

    public function test_recommendation_input_is_validated(): void
    {
        foreach (['viewed=1,abc', 'viewed=1;2', 'viewed='.implode(',', range(1, 13)), 'viewed=12345678901', 'viewed[]=1', 'product=abc', 'suggest=maybe'] as $query) {
            $this->getJson('/recommendations?'.$query)->assertUnprocessable();
        }
        $this->getJson('/recommendations?viewed='.implode(',', range(1, 12)).'&product=1&suggest=1')->assertOk();
    }

    public function test_suggestions_follow_purchases_then_views_then_what_sells(): void
    {
        $bought = $this->product('Đã mua', ['play_style' => 'speed', 'skill_level' => 'advanced']);
        $viewed = $this->product('Đã xem', ['brand_id' => $this->other->id, 'play_style' => 'balanced']);
        foreach (range(1, 4) as $number) {
            $this->product('Giống đồ đã mua '.$number, ['play_style' => 'speed', 'skill_level' => 'advanced']);
            $this->product('Giống đồ đã xem '.$number, ['brand_id' => $this->other->id, 'play_style' => 'balanced']);
        }
        $this->product('Không liên quan', ['brand_id' => null, 'play_style' => 'attack']);
        $customer = User::factory()->create();
        $this->order([$bought], ['user_id' => $customer->id]);

        // A guest who looked at one racket: suggestions resemble it, and never repeat it.
        $guest = $this->getJson('/recommendations?suggest=1&viewed='.$viewed->id)->assertOk()->assertJsonPath('basis', 'personal')->json('suggested');
        $this->assertSame(['Giống đồ đã xem 4', 'Giống đồ đã xem 3', 'Giống đồ đã xem 2', 'Giống đồ đã xem 1'], array_slice($this->names($guest), 0, 4));
        $this->assertNotContains('Đã xem', $this->names($guest));
        $this->assertNotContains('Không liên quan', $this->names($guest));

        // Signed in: what they bought weighs more than what they looked at.
        $member = $this->actingAs($customer)->getJson('/recommendations?suggest=1&viewed='.$viewed->id)->assertOk()->assertJsonPath('basis', 'personal')->json('suggested');
        $this->assertCount(8, $member);
        $this->assertSame(['Giống đồ đã mua 4', 'Giống đồ đã mua 3', 'Giống đồ đã mua 2', 'Giống đồ đã mua 1'], array_slice($this->names($member), 0, 4));
        $this->assertNotContains('Đã mua', $this->names($member));
    }

    public function test_without_history_suggestions_are_what_sells_or_nothing(): void
    {
        $products = collect(range(1, 5))->map(fn ($number) => $this->product('Vợt '.$number));

        // No history and no sales: no list, rather than a made-up one.
        $this->getJson('/recommendations?suggest=1')->assertOk()->assertExactJson(['viewed' => [], 'basis' => null, 'suggested' => []]);

        foreach ($products->take(4) as $index => $product) {
            foreach (range(0, 3 - $index) as $ignored) {
                $this->order([$product]);
            }
        }
        Cache::flush();
        $this->getJson('/recommendations?suggest=1')->assertOk()->assertJsonPath('basis', 'popular')
            ->assertJsonPath('suggested.0.name', 'Vợt 1')->assertJsonPath('suggested.3.name', 'Vợt 4')->assertJsonCount(4, 'suggested');
    }
}
