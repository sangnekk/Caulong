<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (! Route::has('admin.dashboard')) {
            Route::middleware('web')->group(base_path('routes/admin.php'));
        }
    }

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'name' => 'Vợt quản trị '.Str::random(6), 'slug' => 'vot-quan-tri-'.strtolower(Str::random(6)),
            'description' => 'Mô tả kiểm thử', 'play_style' => 'balanced', 'skill_level' => 'all',
            'is_active' => true, 'is_featured' => false, 'is_demo' => false, 'specs' => [],
            'variants' => [['sku' => 'ADM-'.Str::random(6), 'name' => '4U', 'price' => 500000, 'stock' => 8, 'is_active' => true, 'expected_stock' => null]],
        ], $overrides);
    }

    public function test_non_admin_cannot_open_admin(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden();
        $this->get('/admin')->assertForbidden();
    }

    public function test_product_create_and_edit_payload_exposes_image_url(): void
    {
        $admin = $this->admin();
        $brand = Brand::create(['name' => 'Hãng thử', 'slug' => 'hang-thu']);
        $category = Category::create(['name' => 'Danh mục thử', 'slug' => 'danh-muc-thu']);
        $payload = $this->payload(['brand_id' => $brand->id, 'category_id' => $category->id]);

        $response = $this->actingAs($admin)->post('/admin/products', $payload);
        $response->assertRedirect();
        $product = Product::with('variants')->firstOrFail();
        $this->assertSame(8, $product->variants->first()->stock);
        $this->actingAs($admin)->get('/admin/products/'.$product->id.'/edit')->assertInertia(fn (Assert $page) => $page
            ->component('admin/product-form', false)->where('product.id', $product->id)->where('product.image_url', '/models/hyper-core-poster.png'));
    }

    public function test_gallery_photos_and_list_price_are_saved_from_the_product_form(): void
    {
        Storage::fake('public');
        $admin = $this->admin();
        $payload = $this->payload();
        $payload['variants'][0]['compare_at_price'] = 650000;

        $this->actingAs($admin)->post('/admin/products', [...$payload, 'gallery' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.png')]])->assertRedirect();
        $product = Product::with('images', 'variants')->firstOrFail();
        $variant = $product->variants[0];
        $this->assertSame(650000, $variant->compare_at_price);
        $this->assertSame([1, 2], $product->images->pluck('position')->all());
        [$first, $second] = $product->images->all();
        Storage::disk('public')->assertExists([$first->path, $second->path]);
        $this->assertSame(hash('sha256', (string) Storage::disk('public')->get($first->path)), $first->hash);
        $this->actingAs($admin)->get('/admin/products/'.$product->id.'/edit')->assertInertia(fn (Assert $page) => $page
            ->where('product.images', [['id' => $first->id, 'url' => $first->url], ['id' => $second->id, 'url' => $second->url]])
            ->where('product.variants.0.compare_at_price', 650000));

        // Removing a photo deletes its file; another product's photo cannot be removed from here.
        $other = Product::create(['name' => 'Vợt khác', 'slug' => 'vot-khac', 'description' => 'Mô tả', 'play_style' => 'balanced', 'skill_level' => 'all']);
        $foreign = $other->images()->create(['path' => 'products/foreign.png', 'hash' => str_repeat('f', 64), 'position' => 1]);
        Storage::disk('public')->put('products/foreign.png', 'x');
        $update = fn (array $version, array $extra = []) => $this->actingAs($admin)->put('/admin/products/'.$product->id, [
            ...$payload, ...$extra,
            'variants' => [['id' => $variant->id, 'sku' => $variant->sku, 'name' => '4U', 'price' => 500000, 'stock' => 8, 'is_active' => true, 'expected_stock' => 8, ...$version]],
        ]);
        $update(['compare_at_price' => null], ['remove_images' => [$first->id, $foreign->id], 'gallery' => [UploadedFile::fake()->image('c.jpg')]])->assertRedirect();
        $product->refresh()->load('images');
        $this->assertSame([$second->id, 3], [$product->images[0]->id, $product->images[1]->position]);
        Storage::disk('public')->assertMissing($first->path);
        Storage::disk('public')->assertExists('products/foreign.png');
        $this->assertModelExists($foreign);
        $this->assertNull($variant->fresh()->compare_at_price, 'an emptied list price is cleared');

        // A list price is a higher price; a file that is not a photo is refused; nothing is saved.
        $update(['compare_at_price' => 500000])->assertSessionHasErrors(['variants.0.compare_at_price' => 'Giá niêm yết phải cao hơn giá bán, hoặc để trống.']);
        $update([], ['gallery' => [UploadedFile::fake()->create('x.svg', 4, 'image/svg+xml')]])->assertSessionHasErrors('gallery.0');
        $update([], ['gallery' => array_map(fn ($number) => UploadedFile::fake()->image($number.'.jpg'), range(1, 11))])->assertSessionHasErrors('gallery');
        $this->assertSame(2, $product->images()->count());
        $this->assertCount(3, Storage::disk('public')->files('products'), 'photos of a refused save are not left behind');
    }

    public function test_sku_is_normalized_to_lowercase(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->post('/admin/products', $this->payload([
            'variants' => [['sku' => 'Mixed-CASE_1', 'name' => '4U', 'price' => 500000, 'stock' => 8, 'is_active' => true, 'expected_stock' => null]],
        ]))->assertRedirect();

        $this->assertDatabaseHas('product_variants', ['sku' => 'mixed-case_1']);
    }

    public function test_stale_expected_stock_rejects_admin_update(): void
    {
        $admin = $this->admin();
        $product = Product::create(['name' => 'Vợt cũ', 'slug' => 'vot-cu', 'description' => 'Mô tả', 'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true]);
        $variant = $product->variants()->create(['sku' => 'STALE-1', 'name' => '4U', 'price' => 400000, 'stock' => 5, 'is_active' => true]);
        $payload = $this->payload(['name' => 'Không được lưu', 'slug' => 'khong-duoc-luu', 'variants' => [['id' => $variant->id, 'sku' => $variant->sku, 'name' => $variant->name, 'price' => $variant->price, 'stock' => 99, 'is_active' => true, 'expected_stock' => 4]]]);

        $this->actingAs($admin)->put('/admin/products/'.$product->id, $payload)->assertSessionHasErrors('variants.0.stock');
        $this->assertSame(5, $variant->fresh()->stock);
        $this->assertSame('Vợt cũ', $product->fresh()->name);
    }
}
