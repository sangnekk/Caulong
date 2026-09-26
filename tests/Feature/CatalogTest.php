<?php

namespace Tests\Feature;

use App\Http\Resources\ProductResource;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use Database\Seeders\DemoCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        // Worker tests remain runnable before parent wires the shared route file.
        if (! Route::has('products.index')) {
            Route::middleware('web')->group(base_path('routes/catalog.php'));
        }
    }

    private function product(array $attributes = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Test racket', 'slug' => (string) Str::uuid(), 'description' => 'Test description',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true,
        ], $attributes));
    }

    private function variant(Product $product, array $attributes = []): ProductVariant
    {
        return $product->variants()->create(array_merge([
            'sku' => (string) Str::uuid(), 'name' => '4U / G5', 'price' => 500000, 'stock' => 5, 'is_active' => true,
        ], $attributes));
    }

    public function test_public_catalog_hides_inactive_products_and_variants(): void
    {
        $active = $this->product(['is_demo' => true, 'specs' => ['weight' => '4U']]);
        $hidden = $this->product(['is_active' => false]);
        $variant = $this->variant($active, ['stock' => 0]);
        $this->variant($active, ['is_active' => false]);
        $this->variant($hidden);

        $this->get('/products')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/products', false)->has('products.data', 1)->where('products.data.0.id', $active->id)
            ->has('products.data.0.variants', 1)->where('products.per_page', 12)->has('products.links')
            ->where('filters', ['q' => '', 'category' => '', 'brand' => '', 'style' => '', 'sort' => 'featured']));
        $this->get('/products/'.$active->slug)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/product', false)->where('product.id', $active->id)
            ->where('product.is_demo', true)->where('product.specs.weight', '4U')
            ->where('product.brand', null)->where('product.category', null)
            ->where('product.image_url', '/models/hyper-core-poster.png')
            ->has('product.variants', 1)->where('product.variants.0', [
                'id' => $variant->id, 'sku' => $variant->sku, 'name' => '4U / G5',
                'price' => 500000, 'stock' => 0, 'is_active' => true,
            ])->missing('product.image_path')->missing('product.is_active')->missing('product.created_at'));
        $this->get('/products/'.$hidden->slug)->assertNotFound();
        $this->get('/products/missing')->assertNotFound();
    }

    public function test_filters_match_name_taxonomy_and_style_together(): void
    {
        $brand = Brand::create(['name' => 'Test brand', 'slug' => 'test-brand']);
        $category = Category::create(['name' => 'Test category', 'slug' => 'test-category']);
        $attributes = ['name' => 'Swift test', 'brand_id' => $brand->id, 'category_id' => $category->id, 'play_style' => 'speed'];
        $match = $this->product($attributes);
        $this->product(array_merge($attributes, ['name' => 'Other']));
        $this->product(array_merge($attributes, ['brand_id' => null]));
        $this->product(array_merge($attributes, ['category_id' => null]));
        $this->product(array_merge($attributes, ['play_style' => 'attack']));
        $filters = ['q' => 'Swift', 'brand' => $brand->slug, 'category' => $category->slug, 'style' => 'speed', 'sort' => 'newest'];

        $this->get('/products?'.http_build_query($filters))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('products.data', 1)->where('products.data.0.id', $match->id)->where('filters', $filters)
            ->where('products.data.0.brand', $brand->only(['id', 'name', 'slug']))
            ->where('products.data.0.category', $category->only(['id', 'name', 'slug']))
            ->has('brands', 1)->has('categories', 1));
        $this->get('/products?brand=not-found')->assertOk()->assertInertia(fn (Assert $page) => $page->has('products.data', 0));
        $this->get('/products?q='.urlencode("' OR 1=1 --"))->assertOk()->assertInertia(fn (Assert $page) => $page->has('products.data', 0));
    }

    public function test_prices_sort_by_minimum_active_variant_with_null_prices_last(): void
    {
        $cheap = $this->product();
        $expensive = $this->product();
        $unavailable = $this->product();
        $this->variant($cheap, ['price' => 100]);
        $this->variant($cheap, ['price' => 900]);
        $this->variant($expensive, ['price' => 200]);
        $this->variant($expensive, ['price' => 1, 'is_active' => false]);
        $this->variant($unavailable, ['price' => 0, 'is_active' => false]);
        DB::enableQueryLog();

        foreach (['price_asc' => [$cheap->id, $expensive->id], 'price_desc' => [$expensive->id, $cheap->id]] as $sort => $ids) {
            $this->get('/products?sort='.$sort)->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('products.data.0.id', $ids[0])->where('products.data.1.id', $ids[1])
                ->where('products.data.2.id', $unavailable->id)->has('products.data.2.variants', 0)
                ->missing('products.data.0.catalog_price'));
        }
        $this->assertTrue(collect(DB::getQueryLog())->contains(fn ($query) => str_contains($query['query'], 'select MIN(price)')));
        DB::disableQueryLog();
    }

    public function test_featured_newest_and_pagination_are_stable(): void
    {
        $featured = $this->product(['is_featured' => true]);
        $featured->forceFill(['created_at' => now()->subDay()])->save();
        $newest = $this->product();
        $newest->forceFill(['created_at' => now()->addDay()])->save();
        for ($i = 0; $i < 11; $i++) {
            $this->product();
        }
        $this->get('/products')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('products.data', 12)->where('products.total', 13)->where('products.data.0.id', $featured->id));
        $this->get('/products?sort=newest')->assertOk()->assertInertia(fn (Assert $page) => $page->where('products.data.0.id', $newest->id));
        $this->get('/products?page=2')->assertOk()->assertInertia(fn (Assert $page) => $page->has('products.data', 1)->where('products.current_page', 2));
    }

    public function test_filter_boundaries_return_plain_validation_messages(): void
    {
        foreach ([
            ['q' => str_repeat('x', 101)], ['q' => ['bad']], ['category' => str_repeat('x', 161)],
            ['category' => '../bad'], ['brand' => str_repeat('x', 161)], ['brand' => ['bad']],
            ['style' => 'unknown'], ['sort' => 'price;DROP'], ['page' => 0], ['page' => ['bad']],
        ] as $query) {
            $field = array_key_first($query);
            $this->getJson('/products?'.http_build_query($query))->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->getJson('/products?sort=bad')->assertJsonPath('errors.sort.0', 'Cách sắp xếp không hợp lệ.');
        $this->get('/products?'.http_build_query(['q' => str_repeat('x', 100), 'category' => str_repeat('x', 160), 'brand' => str_repeat('x', 160)]))->assertOk();
    }

    public function test_image_accessor_rejects_external_unsafe_and_non_image_paths(): void
    {
        $product = new Product;
        foreach ([null, '', '/models/hyper-core-poster.png', 'https://evil.test/x.png', '//evil.test/x.png', '../x.png', 'catalog/../x.png', 'catalog/./x.png', 'catalog/%2e%2e/x.png', 'x.svg', 'x.png?bad=1', 'C:\\x.png'] as $path) {
            $product->image_path = $path;
            $this->assertSame('/models/hyper-core-poster.png', $product->image_url);
        }
        $product->image_path = 'catalog/test-image.webp';
        $this->assertSame(Storage::disk('public')->url('catalog/test-image.webp'), $product->image_url);
    }

    public function test_resource_preserves_preloaded_variant_constraints(): void
    {
        $product = $this->product();
        $allowed = $this->variant($product, ['price' => 100]);
        $this->variant($product, ['price' => 900]);
        $product->load(['brand', 'category', 'variants' => fn ($query) => $query->active()->where('price', '<=', 100)]);
        $data = (new ProductResource($product))->resolve();
        $this->assertSame([$allowed->id], array_column($data['variants'], 'id'));
    }

    public function test_named_demo_seeder_is_idempotent_and_preserves_changed_stock(): void
    {
        $this->assertDatabaseCount('products', 0);
        $this->seed(DemoCatalogSeeder::class);
        $variant = ProductVariant::firstOrFail();
        $variant->update(['stock' => 3, 'price' => 123456]);
        $this->seed(DemoCatalogSeeder::class);
        $this->assertDatabaseCount('products', 6);
        $this->assertDatabaseCount('product_variants', 12);
        $this->assertDatabaseCount('brands', 1);
        $this->assertDatabaseCount('categories', 3);
        $this->assertSame(6, Product::where('is_demo', true)->count());
        $this->assertSame(3, $variant->fresh()->stock);
        $this->assertSame(123456, $variant->fresh()->price);
        foreach (Product::with('variants')->get() as $product) {
            $this->assertCount(2, $product->variants);
            $this->assertStringContainsString('(demo)', $product->name);
        }
        foreach (Brand::all()->concat(Category::all()) as $taxonomy) {
            $this->assertStringContainsString('demo', $taxonomy->name);
            $this->assertStringStartsWith('demo-', $taxonomy->slug);
        }
    }
}
