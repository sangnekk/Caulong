<?php

namespace App\Console\Commands;

use App\Services\CatalogImporter;
use Illuminate\Console\Command;

class PublishStocked extends Command
{
    protected $signature = 'shop:publish-stocked {--force : Bỏ qua xác nhận}';

    protected $description = 'Mở bán các sản phẩm thật đang ẩn đã có tồn kho (bỏ qua sản phẩm chưa nhập số lượng)';

    public function handle(CatalogImporter $importer): int
    {
        $count = $importer->stockedHidden()->count();
        if ($count === 0) {
            $this->info('Không có sản phẩm ẩn nào đã có tồn kho.');

            return self::SUCCESS;
        }
        if (! $this->option('force') && ! $this->confirm('Mở bán '.$count.' sản phẩm đã có tồn kho?', true)) {
            $this->warn('Đã hủy.');

            return self::FAILURE;
        }
        $this->info('Đã mở bán '.$importer->stockedHidden()->update(['is_active' => true]).' sản phẩm.');

        return self::SUCCESS;
    }
}
