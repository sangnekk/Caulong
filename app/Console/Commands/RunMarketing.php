<?php

namespace App\Console\Commands;

use App\Services\MarketingAutomation;
use Illuminate\Console\Command;

class RunMarketing extends Command
{
    protected $signature = 'marketing:run {automation? : abandoned_cart, winback, post_purchase hoặc vip; bỏ trống để chạy mọi automation đang bật}';

    protected $description = 'Xếp vào hàng đợi các email tự động đang bật ở /admin/settings (chạy theo lịch)';

    public function handle(MarketingAutomation $marketing): int
    {
        $only = $this->argument('automation');
        if ($only !== null && ! in_array($only, MarketingAutomation::AUTOMATIONS, true)) {
            $this->error('Không có automation “'.$only.'”. Chọn một trong: '.implode(', ', MarketingAutomation::AUTOMATIONS).'.');

            return self::FAILURE;
        }
        $queued = $marketing->run($only);
        if ($queued === []) {
            $this->info('Không có automation nào đang bật'.($only === null ? '' : ' (“'.$only.'” đang tắt)').'. Bật ở /admin/settings.');

            return self::SUCCESS;
        }
        $this->table(['Automation', 'Email đã xếp hàng'], array_map(null, array_keys($queued), array_values($queued)));

        return self::SUCCESS;
    }
}
