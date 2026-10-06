<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\CouponService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminCouponTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_admin' => true]);
    }

    /** What the form sends for a plain coupon for everyone. */
    private function form(array $changes = []): array
    {
        return array_merge([
            'code' => 'GIAM10', 'name' => 'Giảm 10% toàn cửa hàng', 'type' => 'percent', 'value' => 10, 'min_order' => 500000, 'max_discount' => 200000,
            'starts_on' => '', 'expires_on' => '', 'usage_limit' => '', 'per_customer_limit' => 1, 'audience' => 'all',
            'customer_email' => '', 'segment' => '', 'campaign' => '', 'category_ids' => [], 'product_ids' => [], 'is_active' => true,
        ], $changes);
    }

    private function product(string $name, array $attributes = []): Product
    {
        $product = Product::create(array_merge([
            'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(['sku' => 'SKU-'.Str::upper(Str::random(6)), 'name' => '4U', 'price' => 1000000, 'stock' => 5, 'is_active' => true]);

        return $product;
    }

    public function test_coupons_are_managed_by_staff_only(): void
    {
        $coupon = Coupon::create(['code' => 'GIAM10', 'name' => 'Giảm 10%', 'type' => 'percent', 'value' => 10]);
        $requests = [
            ['get', route('admin.coupons.index')], ['get', route('admin.coupons.create')], ['get', route('admin.coupons.edit', $coupon)],
            ['get', route('admin.coupons.products', ['q' => 'vot'])], ['post', route('admin.coupons.store')],
            ['put', route('admin.coupons.update', $coupon)], ['delete', route('admin.coupons.destroy', $coupon)],
        ];
        foreach ($requests as [$method, $url]) {
            $this->{$method}($url, $this->form(['code' => 'KHAC']))->assertRedirect(route('login'));
        }
        $this->actingAs(User::factory()->create());
        foreach ($requests as [$method, $url]) {
            $this->{$method}($url, $this->form(['code' => 'KHAC']))->assertForbidden();
        }
        $this->assertSame(['GIAM10'], Coupon::pluck('code')->all());
    }

    public function test_admin_creates_a_coupon_for_everyone_a_customer_or_a_group(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-06 03:00:00'));
        $category = Category::create(['name' => 'Vợt', 'slug' => 'vot']);
        $product = $this->product('Astrox 88');
        $customer = User::factory()->create(['email' => 'khach@example.com']);

        $this->actingAs($this->admin)->get(route('admin.coupons.create'))->assertInertia(fn (Assert $page) => $page
            ->component('admin/coupon-form')->where('coupon', null)->where('customer', null)
            ->where('suggestedCode', fn ($code) => strlen($code) === 10)
            ->has('categories', 1)->where('segments', ['new', 'potential', 'active', 'vip', 'inactive', 'lost']));

        // Typed in any case; dates are whole shop days (UTC+7) stored in UTC.
        $this->post(route('admin.coupons.store'), $this->form([
            'code' => ' giam10 ', 'starts_on' => '2026-10-10', 'expires_on' => '2026-10-31', 'usage_limit' => 100, 'campaign' => 'Khai trương',
            'category_ids' => [$category->id], 'product_ids' => [$product->id],
        ]))->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã tạo mã GIAM10.');
        $coupon = Coupon::sole();
        $this->assertSame(['GIAM10', 'percent', 10, 500000, 200000, 100, 1, null, null, 'Khai trương', true], array_values($coupon->only([
            'code', 'type', 'value', 'min_order', 'max_discount', 'usage_limit', 'per_customer_limit', 'user_id', 'segment', 'campaign', 'is_active',
        ])));
        $this->assertSame(['2026-10-09 17:00:00', '2026-10-31 16:59:59'], [$coupon->starts_at->toDateTimeString(), $coupon->expires_at->toDateTimeString()]);
        $this->assertSame([[$category->id], [$product->id]], [$coupon->categories->modelKeys(), $coupon->products->modelKeys()]);
        $this->get(route('admin.coupons.edit', $coupon))->assertInertia(fn (Assert $page) => $page
            ->where('coupon.starts_on', '2026-10-10')->where('coupon.expires_on', '2026-10-31')
            ->where('coupon.products', [['id' => $product->id, 'name' => 'Astrox 88']])->where('coupon.category_ids', [$category->id])
            ->where('coupon.used', 0));

        // For one customer (prefilled from their page), and for a group. A fixed amount has no ceiling.
        $this->get(route('admin.coupons.create', ['customer' => $customer->id]))->assertInertia(fn (Assert $page) => $page
            ->where('customer', ['id' => $customer->id, 'name' => $customer->name, 'email' => 'khach@example.com']));
        $this->post(route('admin.coupons.store'), $this->form([
            'code' => 'RIENG-AN', 'type' => 'fixed', 'value' => 100000, 'audience' => 'customer', 'customer_email' => 'khach@example.com', 'segment' => 'vip',
        ]))->assertSessionHasNoErrors();
        $this->post(route('admin.coupons.store'), $this->form(['code' => 'VIP15', 'value' => 15, 'audience' => 'segment', 'segment' => 'vip', 'customer_email' => 'khach@example.com']))
            ->assertSessionHasNoErrors();
        $this->assertSame([$customer->id, null, null], array_values(Coupon::where('code', 'RIENG-AN')->sole()->only(['user_id', 'segment', 'max_discount'])));
        $this->assertSame([null, 'vip'], array_values(Coupon::where('code', 'VIP15')->sole()->only(['user_id', 'segment'])));
    }

    public function test_what_the_form_refuses(): void
    {
        Coupon::create(['code' => 'DACO', 'name' => 'Đã có', 'type' => 'percent', 'value' => 10]);
        $this->actingAs($this->admin);
        $refused = fn (array $changes, string|array $fields) => $this->post(route('admin.coupons.store'), $this->form($changes))->assertSessionHasErrors($fields);

        $refused(['code' => 'daco'], ['code' => 'Mã này đã có. Chọn mã khác.']);
        $refused(['code' => 'GIẢM 10'], 'code');
        $refused(['code' => ''], 'code');
        $refused(['value' => 101], ['value' => 'Phần trăm giảm phải từ 1 đến 100.']);
        $refused(['type' => 'fixed', 'value' => 0], 'value');
        $refused(['type' => 'gift'], 'type');
        $refused(['starts_on' => '2026-11-01', 'expires_on' => '2026-10-01'], 'expires_on');
        $refused(['usage_limit' => 0, 'per_customer_limit' => 0, 'min_order' => -1, 'max_discount' => 5], ['usage_limit', 'per_customer_limit', 'min_order', 'max_discount']);
        $refused(['audience' => 'customer', 'customer_email' => 'khong-co@example.com'], 'customer_email');
        // A coupon is for customers: not for a staff account.
        $refused(['audience' => 'customer', 'customer_email' => $this->admin->email], 'customer_email');
        $refused(['audience' => 'segment', 'segment' => 'friends'], 'segment');
        $refused(['product_ids' => [999999], 'category_ids' => [999999]], ['product_ids.0', 'category_ids.0']);
        $this->assertSame(1, Coupon::count());
    }

    public function test_the_list_shows_where_each_coupon_stands_and_how_much_it_was_used(): void
    {
        $make = fn (string $code, array $attributes = []) => Coupon::create(['code' => $code, 'name' => 'Mã '.$code, 'type' => 'fixed', 'value' => 50000, ...$attributes]);
        $running = $make('DANGCHAY', ['campaign' => 'Khai trương']);
        $make('SAPCHAY', ['starts_at' => now()->addDay()]);
        $make('HETHAN', ['expires_at' => now()->subDay()]);
        $usedUp = $make('HETLUOT', ['usage_limit' => 1]);
        $make('DATAT', ['is_active' => false]);
        foreach ([[$running, 50000], [$usedUp, 30000]] as [$coupon, $amount]) {
            $order = Order::create([
                'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Khách', 'phone' => '0900000000',
                'address' => 'Địa chỉ', 'subtotal' => 500000, 'shipping_fee' => 0, 'discount_total' => $amount, 'total' => 500000 - $amount,
            ]);
            app(CouponService::class)->redeem($coupon, $order, $amount);
        }
        $codes = fn (array $query) => fn (Assert $page) => $page->component('admin/coupons')
            ->where('coupons.data', fn ($rows) => collect($rows)->pluck('code')->sort()->values()->all() === $query['codes']);

        $this->actingAs($this->admin)->get(route('admin.coupons.index'))->assertInertia(fn (Assert $page) => $page
            ->has('coupons.data', 5)
            ->where('counts', ['all' => 5, 'active' => 1, 'scheduled' => 1, 'ended' => 2, 'off' => 1])
            ->where('coupons.data.4.code', 'DANGCHAY')->where('coupons.data.4.used', 1)->where('coupons.data.4.discounted', 50000)
            ->where('coupons.data.4.state', 'active')
            ->where('coupons.data.1.state', 'used_up')->where('coupons.data.2.state', 'expired')
            ->where('coupons.data.3.state', 'scheduled')->where('coupons.data.0.state', 'off'));
        $this->get(route('admin.coupons.index', ['state' => 'active']))->assertInertia($codes(['codes' => ['DANGCHAY']]));
        $this->get(route('admin.coupons.index', ['state' => 'scheduled']))->assertInertia($codes(['codes' => ['SAPCHAY']]));
        $this->get(route('admin.coupons.index', ['state' => 'ended']))->assertInertia($codes(['codes' => ['HETHAN', 'HETLUOT']]));
        $this->get(route('admin.coupons.index', ['state' => 'off']))->assertInertia($codes(['codes' => ['DATAT']]));
        $this->get(route('admin.coupons.index', ['q' => 'khai trương']))->assertInertia($codes(['codes' => ['DANGCHAY']]));
        $this->get(route('admin.coupons.index', ['state' => 'gone']))->assertSessionHasErrors('state');
    }

    public function test_admin_edits_switches_off_and_deletes_only_unused_coupons(): void
    {
        $unused = Coupon::create(['code' => 'CHUADUNG', 'name' => 'Chưa dùng', 'type' => 'percent', 'value' => 10, 'max_discount' => 50000]);
        $used = Coupon::create(['code' => 'DADUNG', 'name' => 'Đã dùng', 'type' => 'fixed', 'value' => 50000]);
        $order = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Khách', 'phone' => '0900000000',
            'address' => 'Địa chỉ', 'subtotal' => 500000, 'shipping_fee' => 0, 'discount_total' => 50000, 'coupon_code' => 'DADUNG', 'total' => 450000,
        ]);
        app(CouponService::class)->redeem($used, $order, 50000);

        $this->actingAs($this->admin)->put(route('admin.coupons.update', $unused), $this->form([
            'code' => 'CHUADUNG', 'name' => 'Giảm 20%', 'value' => 20, 'type' => 'fixed', 'max_discount' => 70000, 'is_active' => false,
        ]))->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã lưu mã giảm giá.');
        $this->assertSame(['Giảm 20%', 'fixed', 20, null, false], array_values($unused->fresh()->only(['name', 'type', 'value', 'max_discount', 'is_active'])));
        // Keeping its own code is not a clash; taking another coupon's is.
        $this->put(route('admin.coupons.update', $unused), $this->form(['code' => 'DADUNG']))->assertSessionHasErrors('code');

        $this->delete(route('admin.coupons.destroy', $used))->assertSessionHasErrors('coupon');
        $this->delete(route('admin.coupons.destroy', $unused))->assertRedirect(route('admin.coupons.index'));
        $this->assertSame(['DADUNG'], Coupon::pluck('code')->all());
        $this->assertSame('DADUNG', $order->fresh()->coupon_code);
    }

    public function test_the_product_picker_finds_real_products_by_name_or_sku(): void
    {
        $astrox = $this->product('Astrox 88 Play');
        $nanoflare = $this->product('Nanoflare 700');
        $this->product('Astrox mẫu', ['is_demo' => true]);
        $sku = $nanoflare->variants->first()->sku;

        $this->actingAs($this->admin)->getJson(route('admin.coupons.products', ['q' => 'astrox']))
            ->assertOk()->assertExactJson([['id' => $astrox->id, 'name' => 'Astrox 88 Play']]);
        $this->getJson(route('admin.coupons.products', ['q' => substr($sku, 0, 7)]))->assertJsonPath('0.id', $nanoflare->id);
        $this->getJson(route('admin.coupons.products', ['q' => 'a']))->assertJsonValidationErrors('q');
    }
}
