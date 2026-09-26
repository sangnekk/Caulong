<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
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
