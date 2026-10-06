<?php

namespace App\Console\Commands;

use App\Services\CustomerSegmentation;
use Illuminate\Console\Command;

class SegmentCustomers extends Command
{
    protected $signature = 'crm:segment';

    protected $description = 'Xếp lại nhóm cho mọi khách hàng theo đơn hàng và hoạt động của họ (chạy mỗi ngày theo lịch)';

    public function handle(CustomerSegmentation $segments): int
    {
        $counts = $segments->refreshAll();
        $this->table(['Nhóm', 'Số khách'], array_map(null, array_keys($counts), array_values($counts)));

        return self::SUCCESS;
    }
}
