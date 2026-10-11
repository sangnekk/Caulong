<?php

namespace App\Console\Commands;

use App\Services\PaymentService;
use Illuminate\Console\Command;

class CancelUnpaidOrders extends Command
{
    protected $signature = 'orders:cancel-unpaid';

    protected $description = 'Hủy các đơn chuyển khoản quá hạn mà cửa hàng chưa nhận được tiền, hoàn tồn kho (chạy 15 phút một lần theo lịch)';

    public function handle(PaymentService $payments): int
    {
        $this->info('Đã hủy '.$payments->expireOverdue().' đơn chuyển khoản quá hạn thanh toán.');

        return self::SUCCESS;
    }
}
