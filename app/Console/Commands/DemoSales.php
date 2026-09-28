<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\ProductVariant;
use App\Services\CartService;
use Carbon\CarbonImmutable;
use Database\Seeders\DemoCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A year of made-up orders for the demo rackets, so the report (doanh số, lãi gộp, đã thu) can be
 * tried before the shop has real sales. Every order is is_demo, named "Khách mẫu", and only
 * uses demo products; reports and the dashboard leave them out unless "Tính cả đơn mẫu" is on.
 * Same seed, same data: rerunning replaces the previous demo sales.
 */
class DemoSales extends Command
{
    protected $signature = 'shop:demo-sales
        {--months=12 : Số tháng dữ liệu, tính tới hôm nay}
        {--clear : Chỉ xóa đơn mẫu đã tạo, không tạo mới}';

    protected $description = 'Tạo (hoặc xóa) đơn hàng mẫu có gắn nhãn để thử báo cáo doanh thu và lãi gộp';

    /** Marks the orders this command made, so it never touches other orders (demo or real). */
    public const TOKEN = 'demo-sales-';

    public function handle(CartService $cart): int
    {
        $removed = $this->clear();
        if ($this->option('clear')) {
            $this->info('Đã xóa '.$removed.' đơn mẫu.');

            return self::SUCCESS;
        }
        $months = max(1, min(24, (int) $this->option('months')));

        $this->callSilently('db:seed', ['--class' => DemoCatalogSeeder::class, '--force' => true]);
        $variants = ProductVariant::query()->whereHas('product', fn ($query) => $query->where('is_demo', true))
            ->where('is_active', true)->with('product:id,name')->orderBy('id')->get();
        if ($variants->isEmpty()) {
            $this->error('Không có sản phẩm demo để tạo đơn mẫu.');

            return self::FAILURE;
        }

        mt_srand(2026);
        $zone = (string) config('shop.timezone');
        $now = CarbonImmutable::now($zone);
        $first = $now->startOfDay()->subMonthsNoOverflow($months);
        $days = (int) $first->diffInDays($now->startOfDay());
        $made = 0;
        $sales = 0;

        DB::transaction(function () use ($variants, $cart, $zone, $now, $first, $days, &$made, &$sales) {
            for ($day = 0; $day <= $days; $day++) {
                $date = $first->addDays($day);
                // A shop that grows through the year, busier at weekends.
                $expected = 0.6 + 1.4 * $day / max(1, $days) + ($date->isWeekend() ? 0.7 : 0);
                $count = $this->draw($expected);
                for ($n = 0; $n < $count; $n++) {
                    $placed = $date->setTime(mt_rand(8, 21), mt_rand(0, 59));
                    if ($placed->greaterThan($now)) {
                        continue;
                    }
                    $order = $this->order($variants->all(), $cart, $placed, $now, $zone);
                    $made++;
                    $sales += $order->status === 'cancelled' ? 0 : $order->total;
                }
            }
        });

        $this->info('Đã tạo '.$made.' đơn mẫu trong '.$months.' tháng (doanh số mẫu '.number_format($sales, 0, ',', '.').' ₫).');
        $this->line('Xem ở Quản trị → Báo cáo, bật “Tính cả đơn mẫu”. Xóa bằng: php artisan shop:demo-sales --clear');

        return self::SUCCESS;
    }

    private function clear(): int
    {
        return Order::where('is_demo', true)->where('checkout_token', 'like', self::TOKEN.'%')->delete();
    }

    /** Poisson draw: how many orders arrive on a day that averages $mean. */
    private function draw(float $mean): int
    {
        $limit = exp(-$mean);
        $count = 0;
        for ($p = mt_rand() / mt_getrandmax(); $p > $limit; $p *= mt_rand() / mt_getrandmax()) {
            $count++;
        }

        return $count;
    }

    /** @param  array<int, ProductVariant>  $variants */
    private function order(array $variants, CartService $cart, CarbonImmutable $placed, CarbonImmutable $now, string $zone): Order
    {
        $lines = [];
        foreach ((array) array_rand($variants, mt_rand(1, 100) <= 82 ? 1 : 2) as $index) {
            $variant = $variants[$index];
            $quantity = mt_rand(1, 100) <= 88 ? 1 : 2;
            $lines[] = [
                'variant_id' => $variant->id,
                'product_name' => $variant->product->name,
                'variant_name' => $variant->name,
                'sku' => $variant->sku,
                'unit_price' => $variant->price,
                'unit_cost' => $variant->cost_price,
                'quantity' => $quantity,
                'line_total' => $variant->price * $quantity,
            ];
        }
        $subtotal = array_sum(array_column($lines, 'line_total'));
        $shipping = $cart->shippingFee($subtotal);
        $customer = mt_rand(1, 160);
        $timeline = $this->timeline($placed, $now);

        $order = Order::create([
            'public_id' => (string) Str::uuid(),
            'checkout_token' => self::TOKEN.Str::uuid(),
            'name' => 'Khách mẫu '.str_pad((string) $customer, 3, '0', STR_PAD_LEFT),
            'phone' => '0900'.str_pad((string) $customer, 6, '0', STR_PAD_LEFT),
            'address' => 'Địa chỉ mẫu số '.$customer.', TP. Hồ Chí Minh',
            'notes' => 'Đơn mẫu tạo bằng shop:demo-sales, không phải đơn thật.',
            'payment_method' => 'cod',
            'payment_status' => $timeline['paid_at'] ? 'paid' : 'unpaid',
            'status' => $timeline['status'],
            'subtotal' => $subtotal,
            'shipping_fee' => $shipping,
            'total' => $subtotal + $shipping,
            'is_demo' => true,
            'confirmed_at' => $timeline['confirmed_at']?->utc(),
            'shipped_at' => $timeline['shipped_at']?->utc(),
            'delivered_at' => $timeline['delivered_at']?->utc(),
            'cancelled_at' => $timeline['cancelled_at']?->utc(),
            'paid_at' => $timeline['paid_at']?->utc(),
            'created_at' => $placed->utc(),
            'updated_at' => ($timeline['paid_at'] ?? $timeline['delivered_at'] ?? $timeline['cancelled_at'] ?? $placed)->utc(),
        ]);
        $order->items()->createMany($lines);

        return $order;
    }

    /**
     * How far an order placed at $placed has got by now: old ones are delivered and collected
     * (or cancelled), recent ones are still on the way.
     *
     * @return array{status: string, confirmed_at: CarbonImmutable|null, shipped_at: CarbonImmutable|null, delivered_at: CarbonImmutable|null, cancelled_at: CarbonImmutable|null, paid_at: CarbonImmutable|null}
     */
    private function timeline(CarbonImmutable $placed, CarbonImmutable $now): array
    {
        $steps = ['status' => 'pending', 'confirmed_at' => null, 'shipped_at' => null, 'delivered_at' => null, 'cancelled_at' => null, 'paid_at' => null];
        if (mt_rand(1, 100) <= 9) {
            $cancelled = $placed->addHours(mt_rand(2, 30));

            return $cancelled->lessThanOrEqualTo($now) ? [...$steps, 'status' => 'cancelled', 'cancelled_at' => $cancelled] : $steps;
        }
        $at = [
            'confirmed_at' => $placed->addMinutes(mt_rand(30, 300)),
        ];
        $at['shipped_at'] = $at['confirmed_at']->addHours(mt_rand(12, 30));
        $at['delivered_at'] = $at['shipped_at']->addHours(mt_rand(24, 72));
        $at['paid_at'] = $at['delivered_at']->addDays(mt_rand(1, 4));
        foreach (['confirmed_at' => 'confirmed', 'shipped_at' => 'shipped', 'delivered_at' => 'delivered'] as $key => $status) {
            if ($at[$key]->greaterThan($now)) {
                break;
            }
            $steps[$key] = $at[$key];
            $steps['status'] = $status;
        }
        if ($steps['status'] === 'delivered' && $at['paid_at']->lessThanOrEqualTo($now)) {
            $steps['paid_at'] = $at['paid_at'];
        }

        return $steps;
    }
}
