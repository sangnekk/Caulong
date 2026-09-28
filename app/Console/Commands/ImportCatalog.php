<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\CatalogImporter;
use App\Services\ImportImages;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ImportCatalog extends Command
{
    protected $signature = 'shop:import-catalog
        {file : File CSV UTF-8, mỗi dòng một SKU}
        {--images= : Thư mục hoặc tệp .zip chứa ảnh được nhắc trong cột anh}
        {--publish : Mở bán ngay sản phẩm mới (mặc định: ẩn để kiểm tra)}
        {--keep-stock : Không đổi tồn kho của SKU đã có}
        {--dry-run : Chỉ kiểm tra, không ghi gì}
        {--retire-demo : Ẩn sản phẩm demo sau khi nhập thành công}
        {--force : Bỏ qua xác nhận}';

    protected $description = 'Nhập catalog thật của shop (sản phẩm, SKU, giá, tồn kho, ảnh) từ file CSV';

    public function handle(CatalogImporter $importer): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path)) {
            $this->error('Không thấy file: '.$path);

            return self::FAILURE;
        }
        $file = $importer->read($path);
        $images = null;
        if ($source = $this->option('images')) {
            try {
                $images = is_dir($source) ? ImportImages::fromDirectory($source) : ImportImages::fromZip($source);
            } catch (RuntimeException $exception) {
                $this->error($exception->getMessage());

                return self::FAILURE;
            }
        }
        $options = ['publish' => (bool) $this->option('publish'), 'update_stock' => ! $this->option('keep-stock')];
        $plan = $importer->plan($file, $images, $options);

        foreach ($plan['warnings'] as $warning) {
            $this->warn(($warning['line'] ? 'Dòng '.$warning['line'].': ' : '').$warning['message']);
        }
        foreach ($plan['errors'] as $error) {
            $this->error(($error['line'] ? 'Dòng '.$error['line'].': ' : '').$error['message']);
        }
        $summary = $plan['summary'];
        $this->table(['Sản phẩm mới', 'Cập nhật', 'SKU mới', 'SKU cập nhật', 'Hãng mới', 'Danh mục mới', 'Ảnh'], [[
            $summary['products_new'], $summary['products_updated'], $summary['variants_new'], $summary['variants_updated'],
            implode(', ', $summary['brands_new']) ?: '—', implode(', ', $summary['categories_new']) ?: '—', $summary['images'],
        ]]);
        if ($plan['errors']) {
            $this->error('File còn lỗi, chưa nhập gì.');

            return self::FAILURE;
        }
        if ($this->option('dry-run')) {
            $this->info('Kiểm tra xong, chưa ghi gì (--dry-run).');

            return self::SUCCESS;
        }
        if (! $this->option('force') && ! $this->confirm('Nhập vào cơ sở dữ liệu?', true)) {
            $this->warn('Đã hủy.');

            return self::FAILURE;
        }

        try {
            $result = $importer->commit($file, $images, $options, $plan['fingerprint']);
        } catch (ValidationException $exception) {
            $this->error(collect($exception->errors())->flatten()->implode(' '));

            return self::FAILURE;
        }
        $this->info(sprintf('Đã nhập %d sản phẩm mới, %d cập nhật, %d SKU mới, %d SKU cập nhật.',
            $result['products_new'], $result['products_updated'], $result['variants_new'], $result['variants_updated']));
        if ($result['products_new'] && ! $options['publish']) {
            $this->line('Sản phẩm mới đang ẩn. Kiểm tra ở /admin/products rồi bật “Đang bán”.');
        }
        if ($this->option('retire-demo')) {
            $hidden = Product::where('is_demo', true)->where('is_active', true)->update(['is_active' => false]);
            $this->info('Đã ẩn '.$hidden.' sản phẩm demo.');
        }

        return self::SUCCESS;
    }
}
