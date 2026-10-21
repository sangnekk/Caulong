<?php

namespace App\Console\Commands;

use App\Models\Coupon;
use App\Models\User;
use App\Services\CouponService;
use App\Support\DemoData;
use Illuminate\Console\Command;

/**
 * Personal vouchers for the demo customers who have paid the shop the most. Local only: the
 * accounts are sample data and would otherwise sit among real customers.
 */
class DemoVip extends Command
{
    protected $signature = 'shop:demo-vip
        {--count=5 : Số khách chi tiêu lớn được tặng mã}
        {--force : Cho chạy cả khi APP_ENV không phải local}';

    protected $description = 'Tặng mã giảm giá riêng cho các khách mẫu chi tiêu lớn nhất';

    public function handle(CouponService $coupons): int
    {
        if (! DemoData::shownByDefault() && ! $this->option('force')) {
            $this->error('Lệnh này chỉ chạy trên máy local. Thêm --force nếu thật sự muốn tạo dữ liệu mẫu ở môi trường khác.');

            return self::FAILURE;
        }

        $count = max(1, min(20, (int) $this->option('count')));
        $users = User::query()
            ->where('is_admin', false)
            ->where('email', 'like', '%@'.DemoData::EMAIL_DOMAIN)
            ->withSum(['orders as collected' => fn ($query) => $query->where('is_demo', true)->where('payment_status', 'paid')], 'total')
            ->orderByDesc('collected')
            ->limit($count)
            ->get()
            ->filter(fn (User $user): bool => (int) $user->getAttribute('collected') > 0)
            ->values();

        if ($users->isEmpty()) {
            $this->warn('Chưa có khách mẫu nào đã thanh toán. Hãy chạy php artisan shop:demo-sales trước.');

            return self::SUCCESS;
        }

        $rows = [];
        foreach ($users as $index => $user) {
            // Replace last run's voucher for this customer, keeping any voucher made by hand.
            Coupon::query()->where('user_id', $user->id)->where('campaign', 'demo-vip')->delete();
            $percent = max(5, 15 - $index * 2);
            $coupon = $coupons->issue($user, [
                'name' => 'Tri ân khách chi tiêu lớn #'.($index + 1),
                'type' => 'percent',
                'value' => $percent,
                'min_order' => 500000,
                'max_discount' => 500000,
                'expires_at' => now()->addDays(30),
                'campaign' => 'demo-vip',
            ]);
            $rows[] = [$user->name, number_format((int) $user->getAttribute('collected'), 0, ',', '.').' ₫', $percent.'%', $coupon->code];
        }

        $this->info('Đã tặng '.count($rows).' mã riêng cho khách mẫu chi tiêu lớn.');
        $this->table(['Khách mẫu', 'Đã thu', 'Giảm', 'Mã riêng'], $rows);

        return self::SUCCESS;
    }
}
