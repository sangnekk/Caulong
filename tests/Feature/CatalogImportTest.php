<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class CatalogImportTest extends TestCase
{
    use RefreshDatabase;

    private const HEADER = 'Tên sản phẩm;Hãng;Danh mục;Mô tả;Lối chơi;Trình độ;Trọng lượng;Ảnh;Tên phiên bản;SKU;Giá bán;Tồn kho';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Storage::fake('local');
        Storage::fake('public');
        if (! Route::has('admin.imports.index')) {
            Route::middleware('web')->group(base_path('routes/admin.php'));
        }
    }

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    /** @param  list<string>  $rows */
    private function csv(array $rows, string $header = self::HEADER): string
    {
        // Excel's UTF-8 export: BOM, semicolons, CRLF.
        return "\xEF\xBB\xBF".implode("\r\n", [$header, ...$rows])."\r\n";
    }

    private function upload(User $admin, string $csv, array $fields = [], ?UploadedFile $images = null): TestResponse
    {
        return $this->actingAs($admin)->post('/admin/imports', [
            'catalog' => UploadedFile::fake()->createWithContent('hang.csv', $csv),
            'images' => $images,
            'update_stock' => true,
            'publish' => false,
            ...$fields,
        ]);
    }

    /** @return array{0: TestResponse, 1: array<string, mixed>, 2: string} */
    private function preview(User $admin, string $csv, array $fields = [], ?UploadedFile $images = null): array
    {
        $location = $this->upload($admin, $csv, $fields, $images)->assertRedirect()->headers->get('Location');
        $response = $this->actingAs($admin)->get($location)->assertOk();

        return [$response, $response->viewData('page')['props']['plan'], $location];
    }

    private function rows(): array
    {
        return [
            'Vợt Tia Chớp 300;Hãng Thử;Vợt cầu lông;Mô tả do shop viết.;tấn công;trung bình;4U;;4U / G5;TC300-4U;1.290.000;12',
            'Vợt Tia Chớp 300;;;;;;;;3U / G5;TC300-3U;1.340.000 đ;4',
            'Vợt Gió Sớm;Hãng Thử;Vợt cầu lông;Vợt nhẹ đầu cho người mới.;Tốc độ;;5U;;;GS-5U;990000;0',
        ];
    }

    public function test_guests_and_customers_cannot_import(): void
    {
        $this->get('/admin/imports')->assertRedirect();
        $this->actingAs(User::factory()->create())->get('/admin/imports')->assertForbidden();
        $this->actingAs(User::factory()->create())->post('/admin/imports', [])->assertForbidden();
        $this->actingAs(User::factory()->create())->post('/admin/imports/retire-demo')->assertForbidden();
    }

    public function test_preview_writes_nothing_and_commit_creates_hidden_real_products(): void
    {
        $admin = $this->admin();
        [$response, $plan, $location] = $this->preview($admin, $this->csv($this->rows()));
        $response->assertInertia(fn (Assert $page) => $page->component('admin/import-preview', false)
            ->where('plan.summary.products_new', 2)
            ->where('plan.summary.variants_new', 3)
            ->where('plan.summary.brands_new', ['Hãng Thử'])
            ->where('plan.errors', []));
        $this->assertDatabaseCount('products', 0);
        $this->assertStringContainsString('chưa ghi trình độ', collect($plan['warnings'])->pluck('message')->implode(' '));

        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']])
            ->assertRedirect('/admin/products')->assertSessionHas('success');

        $racket = Product::with('variants', 'brand', 'category')->where('slug', 'vot-tia-chop-300')->firstOrFail();
        $this->assertFalse($racket->is_active, 'new products wait for review');
        $this->assertFalse($racket->is_demo);
        $this->assertSame(['attack', 'intermediate', '4U'], [$racket->play_style, $racket->skill_level, $racket->specs['weight']]);
        $this->assertSame(['Hãng Thử', 'Vợt cầu lông'], [$racket->brand->name, $racket->category->name]);
        $this->assertSame([1290000, 1340000], $racket->variants->sortBy('id')->pluck('price')->all());
        $this->assertSame([12, 4], $racket->variants->sortBy('id')->pluck('stock')->all());
        $single = Product::with('variants')->where('slug', 'vot-gio-som')->firstOrFail();
        $this->assertSame(['speed', 'all', 'Tiêu chuẩn', 'gs-5u'], [$single->play_style, $single->skill_level, $single->variants[0]->name, $single->variants[0]->sku]);
        Storage::disk('local')->assertMissing('imports/'.basename($location).'/catalog.csv');
    }

    public function test_reimport_updates_by_sku_and_never_duplicates(): void
    {
        $admin = $this->admin();
        [, $plan, $location] = $this->preview($admin, $this->csv($this->rows()));
        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']]);
        Product::where('slug', 'vot-gio-som')->update(['is_active' => true]);

        [, $plan, $location] = $this->preview($admin, $this->csv([
            'Vợt Tia Chớp 300;;;;;;;;4U / G5;tc300-4u;1.250.000;9',
            'Vợt Tia Chớp 300;;;;;;;;2U / G4;TC300-2U;1.390.000;2',
        ]));
        $this->assertSame([0, 0, 1, 1], [$plan['summary']['products_new'], $plan['summary']['products_updated'], $plan['summary']['variants_new'], $plan['summary']['variants_updated']]);
        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']])->assertRedirect('/admin/products');

        $this->assertSame(2, Product::count());
        $this->assertSame(4, ProductVariant::count());
        $this->assertSame([1250000, 9], [ProductVariant::where('sku', 'tc300-4u')->value('price'), ProductVariant::where('sku', 'tc300-4u')->value('stock')]);
        $this->assertTrue(Product::where('slug', 'vot-gio-som')->value('is_active'), 'products absent from the file are untouched');
        $this->assertSame('Mô tả do shop viết.', Product::where('slug', 'vot-tia-chop-300')->value('description'), 'blank cells keep values');
    }

    public function test_keep_stock_option_preserves_existing_counts(): void
    {
        $admin = $this->admin();
        [, $plan, $location] = $this->preview($admin, $this->csv($this->rows()));
        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']]);

        [, $plan, $location] = $this->preview($admin, $this->csv(['Vợt Tia Chớp 300;;;;;;;;4U / G5;TC300-4U;1.290.000;99']), ['update_stock' => false]);
        $this->assertSame(12, $plan['products'][0]['variants'][0]['stock']);
        $this->assertSame('unchanged', $plan['products'][0]['variants'][0]['action']);
        $this->assertSame(12, ProductVariant::where('sku', 'tc300-4u')->value('stock'));
    }

    public function test_invalid_rows_are_listed_by_line_and_block_the_commit(): void
    {
        $admin = $this->admin();
        $other = Product::create(['name' => 'Sản phẩm có sẵn', 'slug' => 'san-pham-co-san', 'description' => 'x', 'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true]);
        $other->variants()->create(['sku' => 'CO-SAN', 'name' => 'Tiêu chuẩn', 'price' => 100000, 'stock' => 1, 'is_active' => true]);
        [, $plan, $location] = $this->preview($admin, $this->csv([
            'Vợt A;;;Mô tả;tấn công;;;;;A-1;12,5;3',
            'Vợt B;;;Mô tả;phòng thủ;;;;;B-1;100000;3',
            'Vợt C;;;;cân bằng;;;;;C-1;100000;3',
            'Vợt D;;;Mô tả;cân bằng;;;;;co-san;100000;3',
            'Vợt E;;;Mô tả;cân bằng;;;;;B-1;100000;-2',
        ]));
        $messages = collect($plan['errors'])->map(fn ($issue) => $issue['line'].': '.$issue['message'])->all();
        $this->assertContains('2: Giá “12,5” không hợp lệ. Ghi số đồng, ví dụ 1290000 hoặc 1.290.000.', $messages);
        $this->assertContains('3: Lối chơi “phòng thủ” không hợp lệ. Dùng: tấn công, tốc độ, cân bằng.', $messages);
        $this->assertContains('4: Sản phẩm mới “Vợt C” cần mô tả (cột mo_ta).', $messages);
        $this->assertContains('5: SKU “co-san” đang thuộc sản phẩm “Sản phẩm có sẵn”.', $messages);
        $this->assertContains('6: SKU “B-1” lặp với dòng 3.', $messages);
        $this->assertContains('6: Tồn kho “-2” phải là số nguyên từ 0.', $messages);

        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']])
            ->assertRedirect($location)->assertSessionHasErrors('import');
        $this->assertSame(1, Product::count());
    }

    public function test_missing_columns_and_wrong_encoding_are_explained(): void
    {
        $admin = $this->admin();
        [, $plan] = $this->preview($admin, $this->csv(['Vợt A;Mô tả'], 'Tên sản phẩm;Mô tả'));
        $this->assertSame(['Thiếu cột bắt buộc “sku”.', 'Thiếu cột bắt buộc “gia”.', 'Thiếu cột bắt buộc “ton_kho”.'], collect($plan['errors'])->pluck('message')->all());

        [, $plan] = $this->preview($admin, mb_convert_encoding("Tên sản phẩm,SKU,Giá,Tồn kho\r\nVợt A,A,100000,1", 'Windows-1252', 'UTF-8'));
        $this->assertStringContainsString('UTF-8', $plan['errors'][0]['message']);
    }

    public function test_commit_refuses_when_stock_changed_after_the_preview(): void
    {
        $admin = $this->admin();
        [, $plan, $location] = $this->preview($admin, $this->csv($this->rows()));
        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']]);

        [, $plan, $location] = $this->preview($admin, $this->csv(['Vợt Tia Chớp 300;;;;;;;;4U / G5;TC300-4U;1.290.000;20']));
        // An order lands between the preview and the commit.
        ProductVariant::where('sku', 'tc300-4u')->first()->update(['stock' => 11]);

        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']])
            ->assertRedirect($location)->assertSessionHasErrors('import');
        $this->assertSame(11, ProductVariant::where('sku', 'tc300-4u')->value('stock'), 'the newer order is not overwritten');
    }

    public function test_zip_photos_are_checked_in_the_preview_and_stored_on_commit(): void
    {
        $admin = $this->admin();
        $png = $this->png();
        $images = $this->zip(['anh/tc300.png' => $png, 'gia.jpg' => 'không phải ảnh', '__MACOSX/._tc300.png' => 'x']);
        [, $plan] = $this->preview($admin, $this->csv([
            'Vợt Tia Chớp 300;;;Mô tả;tấn công;;;tc300.png;;TC300-4U;1290000;3',
            'Vợt Gió Sớm;;;Mô tả;tốc độ;;;gia.jpg;;GS-5U;990000;3',
            'Vợt Khác;;;Mô tả;tốc độ;;;thieu.webp;;K-1;990000;3',
        ]), [], $images);
        $this->assertSame([
            '“gia.jpg” không phải ảnh JPEG, PNG hoặc WebP hợp lệ.',
            'Không thấy ảnh “thieu.webp” trong bộ ảnh.',
        ], collect($plan['errors'])->pluck('message')->all());

        [, $plan, $location] = $this->preview($admin, $this->csv(['Vợt Tia Chớp 300;;;Mô tả;tấn công;;;TC300.PNG;;TC300-4U;1290000;3']), [], $this->zip(['anh/tc300.png' => $png]));
        $this->assertSame(1, $plan['summary']['images']);
        $this->actingAs($admin)->post($location, ['fingerprint' => $plan['fingerprint']])->assertRedirect('/admin/products');
        $path = Product::where('slug', 'vot-tia-chop-300')->value('image_path');
        $this->assertMatchesRegularExpression('~\Aproducts/[A-Za-z0-9]{40}\.png\z~', $path);
        Storage::disk('public')->assertExists($path);

        // Same photo again: kept, not copied a second time.
        [, $plan] = $this->preview($admin, $this->csv(['Vợt Tia Chớp 300;;;;;;;tc300.png;;TC300-4U;1290000;3']), [], $this->zip(['tc300.png' => $png]));
        $this->assertSame([0, 'unchanged'], [$plan['summary']['images'], $plan['products'][0]['action']]);
    }

    public function test_demo_products_cannot_be_overwritten_and_are_retired_on_request(): void
    {
        $admin = $this->admin();
        $demo = Product::create(['name' => 'Demo', 'slug' => 'vot-tia-chop-300', 'description' => 'x', 'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => true]);
        $real = Product::create(['name' => 'Thật', 'slug' => 'that', 'description' => 'x', 'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true]);
        [, $plan] = $this->preview($admin, $this->csv($this->rows()));
        $this->assertStringContainsString('sản phẩm demo', $plan['errors'][0]['message']);

        $this->actingAs($admin)->get('/admin/imports')->assertInertia(fn (Assert $page) => $page->component('admin/import', false)->where('demoActive', 1));
        $this->actingAs($admin)->post('/admin/imports/retire-demo')->assertRedirect('/admin/imports')->assertSessionHas('success');
        $this->assertFalse($demo->fresh()->is_active);
        $this->assertTrue($real->fresh()->is_active);
    }

    public function test_bulk_publish_only_opens_hidden_real_products_with_stock(): void
    {
        $admin = $this->admin();
        $make = function (string $slug, int $stock, bool $demo = false, bool $variantActive = true): Product {
            $product = Product::create(['name' => $slug, 'slug' => $slug, 'description' => 'x', 'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => false, 'is_demo' => $demo]);
            $product->variants()->create(['sku' => $slug, 'name' => 'Tiêu chuẩn', 'price' => 100000, 'stock' => $stock, 'is_active' => $variantActive]);

            return $product;
        };
        $stocked = $make('co-hang', 3);
        $empty = $make('het-hang', 0);
        $demo = $make('demo-co-hang', 3, true);
        $inactiveVariant = $make('phien-ban-an', 5, false, false);

        $this->actingAs($admin)->get('/admin/imports')->assertInertia(fn (Assert $page) => $page
            ->component('admin/import', false)->where('hidden', 3)->where('stockedHidden', 1));
        $this->actingAs($admin)->post('/admin/imports/publish-stocked')->assertRedirect('/admin/imports')->assertSessionHas('success');
        $this->assertSame([true, false, false, false], [
            $stocked->fresh()->is_active, $empty->fresh()->is_active, $demo->fresh()->is_active, $inactiveVariant->fresh()->is_active,
        ]);

        ProductVariant::where('sku', 'het-hang')->update(['stock' => 2]);
        $this->artisan('shop:publish-stocked', ['--force' => true])->assertSuccessful();
        $this->assertTrue($empty->fresh()->is_active);
        $this->actingAs(User::factory()->create())->post('/admin/imports/publish-stocked')->assertForbidden();
    }

    public function test_template_download_has_bom_and_every_column(): void
    {
        $response = $this->actingAs($this->admin())->get('/admin/imports/template')->assertOk();
        $this->assertStringStartsWith("\xEF\xBB\xBFten_san_pham,duong_dan,hang,", $response->streamedContent());
    }

    public function test_command_checks_then_imports_with_a_photo_folder(): void
    {
        $directory = sys_get_temp_dir().'/shop-import-'.uniqid();
        mkdir($directory.'/anh', 0777, true);
        file_put_contents($directory.'/anh/tc300.png', $this->png());
        file_put_contents($directory.'/hang.csv', $this->csv(['Vợt Tia Chớp 300;Hãng Thử;;Mô tả;tấn công;;;tc300.png;;TC300-4U;1290000;3']));
        Brand::create(['name' => 'hãng thử', 'slug' => 'hang-thu']);

        $this->artisan('shop:import-catalog', ['file' => $directory.'/hang.csv', '--images' => $directory, '--dry-run' => true])->assertSuccessful();
        $this->assertSame(0, Product::count());

        $this->artisan('shop:import-catalog', ['file' => $directory.'/hang.csv', '--images' => $directory, '--publish' => true, '--force' => true])->assertSuccessful();
        $product = Product::firstOrFail();
        $this->assertTrue($product->is_active);
        $this->assertSame(1, Brand::count(), 'brand matched case-insensitively, not duplicated');
        Storage::disk('public')->assertExists($product->image_path);
    }

    private function png(): string
    {
        $image = imagecreatetruecolor(4, 4);
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    /** @param  array<string, string>  $files */
    private function zip(array $files): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'zip');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        foreach ($files as $name => $content) {
            $zip->addFromString($name, $content);
        }
        $zip->close();

        return new UploadedFile($path, 'anh.zip', 'application/zip', null, true);
    }
}
