<?php

namespace App\Console\Commands;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\ServiceOrder;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\CartService;
use App\Services\CouponService;
use App\Services\CustomerSegmentation;
use App\Services\SupportChat;
use App\Support\DemoData;
use Carbon\CarbonImmutable;
use Database\Seeders\DemoCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One customer account with sample data in every state the shop can show: orders, payments,
 * stringing requests, reviews, coupons and support conversations. Local only by default; the
 * orders are marked as demo so reports can leave them out.
 */
class DemoCustomer extends Command
{
    protected $signature = 'shop:demo-customer
        {email=khach@test.local : Email của tài khoản khách mẫu}
        {--password=password : Mật khẩu đăng nhập}
        {--force : Cho chạy cả khi APP_ENV không phải local}';

    protected $description = 'Tạo tài khoản khách mẫu với đơn hàng, thanh toán, đan dây, đánh giá, mã giảm giá và hội thoại ở đủ mọi trạng thái';

    /** Marks what this command made, so a rerun replaces only its own rows. */
    private const MARK = 'Dữ liệu mẫu của shop:demo-customer.';

    public function handle(CartService $cart, CouponService $coupons, SupportChat $chat, CustomerSegmentation $segments): int
    {
        if (! DemoData::shownByDefault() && ! $this->option('force')) {
            $this->error('Lệnh này chỉ chạy trên máy local. Thêm --force nếu thật sự muốn tạo dữ liệu mẫu ở môi trường khác.');

            return self::FAILURE;
        }

        $email = mb_strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Email không hợp lệ.');

            return self::FAILURE;
        }
        $password = (string) $this->option('password');
        if (strlen($password) < 8) {
            $this->error('Mật khẩu phải có ít nhất 8 ký tự.');

            return self::FAILURE;
        }

        $this->callSilently('db:seed', ['--class' => DemoCatalogSeeder::class, '--force' => true]);
        $variants = ProductVariant::query()
            ->whereHas('product', fn ($query) => $query->where('is_demo', true)->where('is_active', true))
            ->where('is_active', true)->with('product:id,name')->orderByDesc('price')->get();
        $products = Product::query()->where('is_demo', true)->where('is_active', true)->orderBy('id')->get();
        if ($variants->count() < 3 || $products->count() < 3) {
            $this->error('Không đủ sản phẩm demo. Hãy chạy php artisan db:seed --class=DemoCatalogSeeder.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', $email)->first();
        if ($user?->is_admin) {
            $this->error('Email này thuộc một tài khoản nhân viên, không dùng làm khách mẫu được.');

            return self::FAILURE;
        }
        if ($user === null) {
            $user = User::forceCreate([
                'name' => 'Khách Thử nghiệm',
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
            ]);
        }
        $user->forceFill([
            'name' => 'Khách Thử nghiệm',
            'password' => Hash::make($password),
            'email_verified_at' => now(),
            'is_admin' => false,
            'role' => null,
        ])->save();

        $code = null;
        $couponCodes = [];
        DB::transaction(function () use ($user, $variants, $products, $cart, $coupons, $chat, $segments, &$code, &$couponCodes): void {
            $this->clear($user);
            $zone = (string) config('shop.timezone');
            $now = CarbonImmutable::now($zone);
            $admin = User::query()->where('is_admin', true)->orderBy('id')->first();

            $orders = $this->orders($user, $variants, $cart, $now, $admin);
            $couponCodes = $this->coupons($user, $orders, $coupons, $now);
            $this->services($user, $now, $admin);
            $this->reviews($user, $products, $now);
            $this->wishlist($user, $products, $now);
            $this->events($user, $products, $variants, $now, $couponCodes);
            $closed = $this->conversations($user, $now, $admin);

            if ($closed !== null) {
                $issued = $chat->issueCode($closed);
                $code = $issued['code'].' · hết hạn '.$issued['expires_at']->format('d/m/Y');
            }
            $segments->refresh($user);
        });

        $user->refresh();
        $this->info('Đã tạo dữ liệu mẫu cho '.$email.'.');
        $this->line('Mật khẩu đăng nhập: '.$password.' (chỉ dùng trên máy local)');
        $this->newLine();
        $this->table(['Hạng mục', 'Số lượng'], [
            ['Đơn hàng', (string) Order::query()->where('user_id', $user->id)->where('checkout_token', 'like', 'demo-customer-%')->count()],
            ['Yêu cầu đan dây', (string) ServiceOrder::query()->where('user_id', $user->id)->where('notes', 'like', self::MARK.'%')->count()],
            ['Đánh giá', (string) ProductReview::query()->where('user_id', $user->id)->count()],
            ['Mã giảm giá riêng', (string) Coupon::query()->where('user_id', $user->id)->where('campaign', 'demo-customer')->count()],
            ['Hội thoại hỗ trợ', (string) SupportConversation::query()->where('user_id', $user->id)->count()],
            ['Nhóm khách', (string) ($user->segment ?? 'chưa tính')],
        ]);
        if ($couponCodes !== []) {
            $this->line('Mã giảm giá để thử:');
            foreach ($couponCodes as $label => $couponCode) {
                $this->line('  - '.$label.': '.$couponCode);
            }
        }
        if ($code !== null) {
            $this->line('Mã xem lại hội thoại đã đóng: '.$code);
        }
        $this->line('Xem tại: /admin/customers/'.$user->id.' (thanh bên trái có đủ các tab).');

        return self::SUCCESS;
    }

    private function clear(User $user): void
    {
        Order::query()->where('user_id', $user->id)->where('checkout_token', 'like', 'demo-customer-%')->delete();
        ServiceOrder::query()->where('user_id', $user->id)->where('notes', 'like', self::MARK.'%')->delete();
        ProductReview::query()->where('user_id', $user->id)->delete();
        Coupon::query()->where('user_id', $user->id)->where('campaign', 'demo-customer')->delete();
        SupportConversation::query()->where('user_id', $user->id)->delete();
        CustomerEvent::query()->where('user_id', $user->id)->delete();
        DB::table('wishlists')->where('user_id', $user->id)->delete();
    }

    /**
     * @param  Collection<int, ProductVariant>  $variants
     * @return array<string, Order>
     */
    private function orders(User $user, $variants, CartService $cart, CarbonImmutable $now, ?User $admin): array
    {
        $variants = $variants->values();
        $pick = fn (int $index): ProductVariant => $variants[$index % $variants->count()];

        $make = function (array $lines, CarbonImmutable $placed, string $status, string $method, string $paymentStatus, array $steps = [], ?string $paymentState = null) use ($user, $cart, $now, $admin): Order {
            $rows = [];
            foreach ($lines as [$variant, $quantity]) {
                /** @var ProductVariant $variant */
                $rows[] = [
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
            $subtotal = (int) array_sum(array_column($rows, 'line_total'));
            $shipping = $cart->shippingFee($subtotal);
            $at = fn (?CarbonImmutable $moment): ?CarbonImmutable => $moment?->utc();
            $updated = $steps['paid_at'] ?? $steps['cancelled_at'] ?? $steps['delivered_at'] ?? $steps['shipped_at'] ?? $steps['confirmed_at'] ?? $placed;

            $order = Order::create([
                'public_id' => (string) Str::uuid(),
                'checkout_token' => 'demo-customer-'.Str::uuid(),
                'user_id' => $user->id,
                'name' => $user->name,
                'phone' => '0909000002',
                'address' => 'Địa chỉ mẫu 2, TP. Hồ Chí Minh',
                'email' => $user->email,
                'notes' => self::MARK.' Đơn mẫu trạng thái '.$status.'.',
                'payment_method' => $method,
                'payment_status' => $paymentStatus,
                'status' => $status,
                'subtotal' => $subtotal,
                'shipping_fee' => $shipping,
                'discount_total' => 0,
                'coupon_code' => null,
                'total' => $subtotal + $shipping,
                'is_demo' => true,
                'confirmed_at' => $at($steps['confirmed_at'] ?? null),
                'shipped_at' => $at($steps['shipped_at'] ?? null),
                'delivered_at' => $at($steps['delivered_at'] ?? null),
                'cancelled_at' => $at($steps['cancelled_at'] ?? null),
                'paid_at' => $at($steps['paid_at'] ?? null),
                'created_at' => $placed->utc(),
                'updated_at' => $updated->utc(),
            ]);
            $order->items()->createMany($rows);

            if ($method === 'bank_transfer') {
                $paid = in_array($paymentState, ['paid', 'refunded'], true);
                $order->payments()->create([
                    'method' => 'bank_transfer',
                    'amount' => $order->total,
                    'reference' => 'DEMO'.$order->id.'-'.Str::upper(Str::random(8)),
                    'status' => $paymentState ?? 'pending',
                    'expires_at' => $placed->addHours(24)->utc(),
                    'paid_at' => $paid ? ($steps['paid_at'] ?? $placed)->utc() : null,
                    'confirmed_by' => $paid ? $admin?->id : null,
                    'refunded_at' => $paymentState === 'refunded' ? ($steps['cancelled_at'] ?? $now)->utc() : null,
                    'refunded_by' => $paymentState === 'refunded' ? $admin?->id : null,
                    'created_at' => $placed->utc(),
                    'updated_at' => $updated->utc(),
                ]);
            }

            return $order;
        };

        $pending = $make([[$pick(3), 1]], $now->subHours(6), 'pending', 'bank_transfer', 'unpaid', [], 'pending');
        $confirmed = $make([[$pick(0), 3]], $now->subDays(3), 'confirmed', 'bank_transfer', 'paid', [
            'confirmed_at' => $now->subDays(2)->subHours(4),
            'paid_at' => $now->subDays(2)->subHours(3),
        ], 'paid');
        $shipped = $make([[$pick(1), 2]], $now->subDays(5), 'shipped', 'cod', 'unpaid', [
            'confirmed_at' => $now->subDays(4),
            'shipped_at' => $now->subDays(2),
        ]);
        $delivered = $make([[$pick(0), 5]], $now->subDays(20), 'delivered', 'cod', 'paid', [
            'confirmed_at' => $now->subDays(19),
            'shipped_at' => $now->subDays(17),
            'delivered_at' => $now->subDays(14),
            'paid_at' => $now->subDays(14)->addHours(2),
        ]);
        $expired = $make([[$pick(2), 1]], $now->subDays(30), 'cancelled', 'bank_transfer', 'unpaid', [
            'cancelled_at' => $now->subDays(29),
        ], 'expired');
        $cancelled = $make([[$pick(4), 2]], $now->subDays(40), 'cancelled', 'bank_transfer', 'unpaid', [
            'cancelled_at' => $now->subDays(39),
        ], 'cancelled');
        $refunded = $make([[$pick(1), 2]], $now->subDays(50), 'cancelled', 'bank_transfer', 'refunded', [
            'confirmed_at' => $now->subDays(49),
            'paid_at' => $now->subDays(49)->addHours(2),
            'cancelled_at' => $now->subDays(48),
        ], 'refunded');

        return compact('pending', 'confirmed', 'shipped', 'delivered', 'expired', 'cancelled', 'refunded');
    }

    /**
     * @param  array<string, Order>  $orders
     * @return array<string, string> the code of each coupon, by what it is for
     */
    private function coupons(User $user, array $orders, CouponService $coupons, CarbonImmutable $now): array
    {
        $make = fn (array $terms): Coupon => Coupon::create([
            ...$terms,
            'code' => $coupons->newCode(),
            'user_id' => $user->id,
            'segment' => null,
            'campaign' => 'demo-customer',
        ]);

        $active = $make([
            'name' => 'Ưu đãi khách thân thiết',
            'type' => 'percent',
            'value' => 15,
            'min_order' => 500000,
            'max_discount' => 300000,
            'expires_at' => $now->addDays(30)->utc(),
            'usage_limit' => null,
            'per_customer_limit' => 1,
            'is_active' => true,
        ]);
        $scheduled = $make([
            'name' => 'Mã khách quay lại',
            'type' => 'fixed',
            'value' => 100000,
            'min_order' => 1000000,
            'max_discount' => null,
            'starts_at' => $now->addDays(7)->utc(),
            'expires_at' => $now->addDays(37)->utc(),
            'usage_limit' => 5,
            'per_customer_limit' => 1,
            'is_active' => true,
        ]);
        $expired = $make([
            'name' => 'Mã đã hết hạn',
            'type' => 'percent',
            'value' => 10,
            'min_order' => 0,
            'max_discount' => 100000,
            'expires_at' => $now->subDays(2)->utc(),
            'usage_limit' => 10,
            'per_customer_limit' => 1,
            'is_active' => true,
        ]);
        $used = $make([
            'name' => 'Mã đã dùng hết lượt',
            'type' => 'fixed',
            'value' => 50000,
            'min_order' => 0,
            'max_discount' => null,
            'expires_at' => $now->addDays(20)->utc(),
            'usage_limit' => 1,
            'per_customer_limit' => 1,
            'is_active' => true,
        ]);
        $off = $make([
            'name' => 'Mã đã tắt',
            'type' => 'fixed',
            'value' => 200000,
            'min_order' => 2000000,
            'max_discount' => null,
            'expires_at' => $now->addDays(20)->utc(),
            'usage_limit' => null,
            'per_customer_limit' => 1,
            'is_active' => false,
        ]);

        $order = $orders['delivered'];
        $discount = 50000;
        $order->forceFill([
            'discount_total' => $discount,
            'coupon_code' => $used->code,
            'total' => max(0, $order->subtotal - $discount + $order->shipping_fee),
        ])->save();
        CouponRedemption::create([
            'coupon_id' => $used->id,
            'user_id' => $user->id,
            'order_id' => $order->id,
            'amount' => $discount,
            'created_at' => $order->created_at,
        ]);

        return [
            'đang dùng được' => $active->code,
            'sắp bắt đầu' => $scheduled->code,
            'đã hết hạn' => $expired->code,
            'đã dùng hết lượt' => $used->code,
            'đã tắt' => $off->code,
        ];
    }

    private function services(User $user, CarbonImmutable $now, ?User $admin): void
    {
        $base = [
            'name' => $user->name,
            'phone' => '0909000002',
            'email' => $user->email,
            'service_type' => 'own_string',
            'racket' => 'Yonex Astrox 88D (demo)',
            'service_string_id' => null,
            'string_name' => 'Dây khách mang tới (demo)',
            'tension_kg' => 11.5,
            'quantity' => 1,
            'notes' => self::MARK.' Yêu cầu đan dây mẫu.',
            'technician_id' => $admin?->id,
            'string_price' => 0,
            'labor_fee' => 100000,
            'total' => 100000,
        ];
        $make = function (array $extra) use ($user, $base): ServiceOrder {
            return ServiceOrder::create([
                ...$base,
                ...$extra,
                'public_id' => (string) Str::uuid(),
                'booking_token' => (string) Str::uuid(),
                'user_id' => $user->id,
            ]);
        };

        $make([
            'status' => 'pending',
            'preferred_at' => $now->addDays(2)->utc(),
            'created_at' => $now->subDays(1)->utc(),
            'updated_at' => $now->subDays(1)->utc(),
        ]);
        $make([
            'status' => 'confirmed',
            'preferred_at' => $now->subDays(3)->utc(),
            'confirmed_at' => $now->subDays(5)->utc(),
            'created_at' => $now->subDays(6)->utc(),
            'updated_at' => $now->subDays(5)->utc(),
        ]);
        $make([
            'status' => 'in_progress',
            'preferred_at' => $now->subDays(7)->utc(),
            'confirmed_at' => $now->subDays(10)->utc(),
            'in_progress_at' => $now->subDays(9)->utc(),
            'created_at' => $now->subDays(12)->utc(),
            'updated_at' => $now->subDays(9)->utc(),
        ]);
        $make([
            'status' => 'ready',
            'preferred_at' => $now->subDays(9)->utc(),
            'confirmed_at' => $now->subDays(13)->utc(),
            'in_progress_at' => $now->subDays(12)->utc(),
            'ready_at' => $now->subDays(1)->utc(),
            'created_at' => $now->subDays(15)->utc(),
            'updated_at' => $now->subDays(1)->utc(),
        ]);
        $make([
            'status' => 'completed',
            'preferred_at' => $now->subDays(20)->utc(),
            'confirmed_at' => $now->subDays(22)->utc(),
            'in_progress_at' => $now->subDays(21)->utc(),
            'ready_at' => $now->subDays(18)->utc(),
            'completed_at' => $now->subDays(17)->utc(),
            'created_at' => $now->subDays(24)->utc(),
            'updated_at' => $now->subDays(17)->utc(),
        ]);
        $make([
            'status' => 'cancelled',
            'preferred_at' => $now->subDays(4)->utc(),
            'cancelled_at' => $now->subDays(3)->utc(),
            'created_at' => $now->subDays(5)->utc(),
            'updated_at' => $now->subDays(3)->utc(),
        ]);
    }

    /** @param  Collection<int, Product>  $products */
    private function reviews(User $user, $products, CarbonImmutable $now): void
    {
        $rows = [
            ['pending', 5, 'Vợt đánh rất đầm tay, đang chờ shop duyệt đánh giá này.'],
            ['published', 4, 'Giao hàng nhanh, đóng gói kỹ. Vợt đúng mô tả.'],
            ['hidden', 2, 'Đánh giá mẫu đang bị ẩn để thử trạng thái kiểm duyệt.'],
        ];
        foreach ($rows as $index => [$status, $rating, $body]) {
            ProductReview::create([
                'user_id' => $user->id,
                'product_id' => $products[$index % $products->count()]->id,
                'order_item_id' => null,
                'rating' => $rating,
                'body' => $body,
                'status' => $status,
                'created_at' => $now->subDays(12 - $index * 3)->utc(),
                'updated_at' => $now->subDays(12 - $index * 3)->utc(),
            ]);
        }
    }

    /** @param  Collection<int, Product>  $products */
    private function wishlist(User $user, $products, CarbonImmutable $now): void
    {
        foreach (array_slice($products->all(), 0, 2) as $index => $product) {
            DB::table('wishlists')->insertOrIgnore([
                'user_id' => $user->id,
                'product_id' => $product->id,
                'created_at' => $now->subDays(5 - $index)->utc(),
                'updated_at' => $now->subDays(5 - $index)->utc(),
            ]);
        }
    }

    /**
     * @param  Collection<int, Product>  $products
     * @param  Collection<int, ProductVariant>  $variants
     * @param  array<string, string>  $couponCodes
     */
    private function events(User $user, $products, $variants, CarbonImmutable $now, array $couponCodes): void
    {
        $record = fn (string $name, ?int $productId, CarbonImmutable $at, array $metadata = []): CustomerEvent => CustomerEvent::create([
            'user_id' => $user->id,
            'session_key' => null,
            'name' => $name,
            'product_id' => $productId,
            'order_id' => null,
            'metadata' => $metadata ?: null,
            'created_at' => $at->utc(),
        ]);

        $record('product_view', $products[0]->id, $now->subHours(3));
        $record('product_view', $products[1]->id, $now->subDays(1)->subHours(2));
        $record('search', null, $now->subDays(1)->subHours(3), ['q' => 'vợt cầu lông', 'results' => $products->count()]);
        $record('add_to_cart', $products[1]->id, $now->subDays(1)->subHours(1), [
            'variant_id' => $variants[1]->id,
            'quantity' => 1,
            'price' => $variants[1]->price,
        ]);
        $record('checkout_started', null, $now->subHours(20), ['items' => 1, 'subtotal' => $variants[1]->price]);
        $record('wishlist_added', $products[2]->id, $now->subDays(2));
        if (isset($couponCodes['đang dùng được'])) {
            $record('coupon_applied', null, $now->subDays(1)->subHours(1), ['code' => $couponCodes['đang dùng được']]);
        }
    }

    /**
     * Four conversations, one in each status. The closed one gets a review code.
     *
     * @return SupportConversation|null the closed conversation
     */
    private function conversations(User $user, CarbonImmutable $now, ?User $admin): ?SupportConversation
    {
        $make = function (string $status, bool $needsHuman, ?User $assigned, array $messages, CarbonImmutable $started, ?CarbonImmutable $resolvedAt = null, ?CarbonImmutable $closedAt = null) use ($user): SupportConversation {
            $last = $messages[count($messages) - 1][2];
            $conversation = SupportConversation::create([
                'session_key' => 'demo-customer-'.Str::uuid(),
                'user_id' => $user->id,
                'status' => $status,
                'needs_human' => $needsHuman,
                'assigned_to' => $assigned?->id,
                'last_message_at' => $last->utc(),
                'resolved_at' => $resolvedAt?->utc(),
                'closed_at' => $closedAt?->utc(),
                'created_at' => $started->utc(),
                'updated_at' => ($closedAt ?? $resolvedAt ?? $last)->utc(),
            ]);
            foreach ($messages as [$sender, $body, $at]) {
                $conversation->messages()->create([
                    'sender' => $sender,
                    'body' => $body,
                    'read_at' => $sender === 'customer' && ! $needsHuman ? $at->utc() : null,
                    'created_at' => $at->utc(),
                    'updated_at' => $at->utc(),
                ]);
            }

            return $conversation;
        };

        $closed = $make('closed', true, $admin, [
            ['customer', 'Mã giảm giá của em không áp dụng được.', $now->subDays(10)],
            ['admin', 'Mình đã kiểm tra, mã đã hết hạn. Shop gửi bạn mã mới trong tài khoản nhé.', $now->subDays(10)->addHours(1)],
            ['customer', 'Cảm ơn shop, em đã dùng được rồi.', $now->subDays(9)],
        ], $now->subDays(10), $now->subDays(9), $now->subDays(9));

        $make('resolved', true, $admin, [
            ['customer', 'Em đã nhận được vợt, cảm ơn shop.', $now->subDays(3)],
            ['admin', 'Cảm ơn bạn! Chúc bạn chơi vui. Nếu cần gì cứ nhắn shop nhé.', $now->subDays(3)->addHours(1)],
        ], $now->subDays(3), $now->subDays(2));

        $make('pending', true, $admin, [
            ['customer', 'Đơn hàng của em đã giao chưa ạ?', $now->subDays(1)],
            ['admin', 'Chào bạn, đơn đang trên đường giao, dự kiến mai tới nơi nhé.', $now->subDays(1)->addHours(1)],
        ], $now->subDays(1), null);

        // Created last so the signed-in customer's widget opens on this one after the demo.
        $make('open', true, null, [
            ['customer', 'Shop ơi, em muốn hỏi vợt nào phù hợp cho người mới chơi?', $now->subHours(3)],
            ['bot', 'Chào bạn! Bạn cho mình biết ngân sách và lối chơi để mình gợi ý nhé.', $now->subHours(3)->addMinute()],
            ['customer', 'Ngân sách khoảng 1 triệu, em thích đánh tấn công.', $now->subHours(1)],
        ], $now->subHours(3));

        return $closed;
    }
}
