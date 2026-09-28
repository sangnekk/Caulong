<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoCatalogSeeder extends Seeder
{
    public function run(): void
    {
        // Explicit opt-in only: never call this seeder from DatabaseSeeder.
        DB::transaction(function () {
            $brand = Brand::firstOrCreate(['slug' => 'demo-may-viet'], ['name' => 'Mây Việt (demo hư cấu)']);
            $categories = [];
            foreach (['attack' => 'Tấn công', 'speed' => 'Tốc độ', 'balanced' => 'Cân bằng'] as $style => $name) {
                $categories[$style] = Category::firstOrCreate(['slug' => 'demo-'.$style], ['name' => $name.' (demo)']);
            }

            $rackets = [
                ['demo-may-viet-binh-minh', 'Bình Minh', 'balanced', 'beginner', 490000],
                ['demo-may-viet-gio-nhe', 'Gió Nhẹ', 'speed', 'beginner', 590000],
                ['demo-may-viet-song-xanh', 'Sóng Xanh', 'balanced', 'all', 790000],
                ['demo-may-viet-chop-bac', 'Chớp Bạc', 'speed', 'intermediate', 990000],
                ['demo-may-viet-lua-hong', 'Lửa Hồng', 'attack', 'intermediate', 1190000],
                ['demo-may-viet-dinh-may', 'Đỉnh Mây', 'attack', 'advanced', 1490000],
            ];

            foreach ($rackets as $index => [$slug, $name, $style, $level, $price]) {
                // Reruns preserve edited products, prices and stock, including purchased demo items.
                $product = Product::firstOrCreate(['slug' => $slug], [
                    'brand_id' => $brand->id,
                    'category_id' => $categories[$style]->id,
                    'name' => 'Mây Việt '.$name.' (demo)',
                    'description' => 'Vợt hư cấu dùng để thử cửa hàng. Giá, tồn kho và thông số là dữ liệu demo, không phải hàng hóa đang bán.',
                    'image_path' => '/models/hyper-core-poster.png',
                    'specs' => [
                        'weight' => '4U / 5U (demo)',
                        'balance' => ($style === 'attack' ? 'Nặng đầu' : ($style === 'speed' ? 'Nhẹ đầu' : 'Cân bằng')).' (demo)',
                        'stiffness' => 'Trung bình (demo)',
                        'material' => 'Carbon (demo)',
                        'max_tension' => '26 lbs (demo)',
                    ],
                    'play_style' => $style,
                    'skill_level' => $level,
                    'is_active' => true,
                    'is_featured' => $index < 3,
                    'is_demo' => true,
                ]);

                if (! $product->is_demo) {
                    throw new RuntimeException('Trùng đường dẫn với sản phẩm thật. Không tạo dữ liệu demo.');
                }

                foreach (['4U', '5U'] as $variantIndex => $weight) {
                    // Model normalizes SKU to lowercase; match that so reruns stay idempotent.
                    $variant = $product->variants()->firstOrCreate(['sku' => 'demo-mv-'.($index + 1).'-'.strtolower($weight)], [
                        'name' => $weight.' / G5 (demo)',
                        'price' => $price + $variantIndex * 50000,
                        'stock' => 10,
                        'is_active' => true,
                    ]);
                    // Demo cost (58–68% of price) so the profit report has something to show.
                    if ($variant->cost_price === null) {
                        $variant->update(['cost_price' => (int) round($variant->price * [0.62, 0.66, 0.6, 0.68, 0.63, 0.58][$index], -3)]);
                    }
                }
            }
        });
    }
}
