<?php

namespace Tests\Feature;

use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\CustomerSegmentation;
use App\Services\OrderService;
use App\Support\CustomerFacts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerSegmentationTest extends TestCase
{
    use RefreshDatabase;

    private function order(User $customer, array $attributes = []): Order
    {
        return Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $customer->id,
            'name' => $customer->name, 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 1000000, 'shipping_fee' => 0, 'total' => 1000000,
        ], $attributes));
    }

    public function test_the_rules_put_every_customer_in_exactly_one_group(): void
    {
        $segments = $this->app->make(CustomerSegmentation::class);
        $now = Carbon::parse('2026-10-06 12:00:00');
        $ago = fn (int $days) => $now->copy()->subDays($days);
        // Defaults: VIP from 10,000,000 received, inactive after 90 days, lost after 365, new for 30, potential from 5 signs.
        $cases = [
            'new' => new CustomerFacts(registeredAt: $ago(3)),
            'still new on day 30' => new CustomerFacts(registeredAt: $ago(30)),
            'inactive: signed up long ago, never bought' => new CustomerFacts(registeredAt: $ago(31)),
            'potential' => new CustomerFacts(registeredAt: $ago(200), lastEventAt: $ago(1), interest: 5),
            'not yet potential' => new CustomerFacts(registeredAt: $ago(200), lastEventAt: $ago(1), interest: 4),
            'active' => new CustomerFacts(registeredAt: $ago(400), orders: 1, spent: 2000000, lastOrderAt: $ago(90)),
            'inactive buyer' => new CustomerFacts(registeredAt: $ago(400), orders: 3, spent: 9999999, lastOrderAt: $ago(91)),
            'vip' => new CustomerFacts(registeredAt: $ago(400), orders: 4, spent: 10000000, lastOrderAt: $ago(10)),
            // Rackets are not bought every month: a big spender stays a VIP between purchases...
            'vip between purchases' => new CustomerFacts(registeredAt: $ago(400), orders: 4, spent: 12000000, lastOrderAt: $ago(200)),
            // ...until there is no sign of them at all for a year.
            'lost vip' => new CustomerFacts(registeredAt: $ago(900), orders: 4, spent: 12000000, lastOrderAt: $ago(366)),
            'lost: never bought' => new CustomerFacts(registeredAt: $ago(366)),
            'not lost: still visiting' => new CustomerFacts(registeredAt: $ago(900), orders: 1, spent: 500000, lastOrderAt: $ago(800), lastEventAt: $ago(2)),
            // Ordered but nothing received yet (cash on delivery): a buyer, not a VIP.
            'active with unpaid orders' => new CustomerFacts(registeredAt: $ago(5), orders: 2, spent: 0, lastOrderAt: $ago(1)),
        ];

        $this->assertSame([
            'new' => 'new', 'still new on day 30' => 'new', 'inactive: signed up long ago, never bought' => 'inactive',
            'potential' => 'potential', 'not yet potential' => 'inactive',
            'active' => 'active', 'inactive buyer' => 'inactive', 'vip' => 'vip', 'vip between purchases' => 'vip',
            'lost vip' => 'lost', 'lost: never bought' => 'lost', 'not lost: still visiting' => 'inactive',
            'active with unpaid orders' => 'active',
        ], array_map(fn (CustomerFacts $facts) => $segments->classify($facts, $now), $cases));
    }

    public function test_the_daily_run_groups_customers_from_real_orders_and_their_own_activity(): void
    {
        $product = Product::create(['name' => 'Vợt A', 'slug' => 'vot-a', 'description' => 'Mô tả', 'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true]);
        $admin = User::factory()->create(['is_admin' => true]);
        $admin->forceFill(['segment' => 'vip'])->save();
        $newcomer = User::factory()->create();
        $browser = User::factory()->create(['created_at' => now()->subDays(100)]);
        foreach (range(1, 5) as $ignored) {
            CustomerEvent::create(['user_id' => $browser->id, 'name' => 'product_view', 'product_id' => $product->id, 'created_at' => now()->subDays(2)]);
        }
        // Looking around long ago, or only searching, is not interest in buying now.
        $drifted = User::factory()->create(['created_at' => now()->subDays(100)]);
        foreach (range(1, 6) as $ignored) {
            CustomerEvent::create(['user_id' => $drifted->id, 'name' => 'product_view', 'product_id' => $product->id, 'created_at' => now()->subDays(40)]);
            CustomerEvent::create(['user_id' => $drifted->id, 'name' => 'search', 'metadata' => ['q' => 'vợt'], 'created_at' => now()->subDay()]);
        }
        $buyer = User::factory()->create(['created_at' => now()->subDays(100)]);
        $this->order($buyer, ['status' => 'pending']);
        $vip = User::factory()->create(['created_at' => now()->subDays(100)]);
        $this->order($vip, ['status' => 'delivered', 'payment_status' => 'paid', 'total' => 6000000, 'paid_at' => now()]);
        $this->order($vip, ['status' => 'delivered', 'payment_status' => 'paid', 'total' => 4000000, 'paid_at' => now()]);
        // Sample orders and cancelled orders make nobody a buyer, let alone a VIP.
        $pretend = User::factory()->create(['created_at' => now()->subDays(100)]);
        $this->order($pretend, ['is_demo' => true, 'status' => 'delivered', 'payment_status' => 'paid', 'total' => 50000000]);
        $this->order($pretend, ['status' => 'cancelled', 'total' => 50000000]);
        $quiet = User::factory()->create(['created_at' => now()->subDays(400)]);
        $this->order($quiet, ['status' => 'delivered', 'payment_status' => 'paid', 'created_at' => now()->subDays(120)]);
        $gone = User::factory()->create(['created_at' => now()->subDays(500)]);

        $this->artisan('crm:segment')->assertSuccessful();

        $this->assertSame([
            'admin' => null, 'newcomer' => 'new', 'browser' => 'potential', 'drifted' => 'inactive', 'buyer' => 'active',
            'vip' => 'vip', 'pretend' => 'inactive', 'quiet' => 'inactive', 'gone' => 'lost',
        ], array_map(fn (User $user) => $user->fresh()->segment, compact('admin', 'newcomer', 'browser', 'drifted', 'buyer', 'vip', 'pretend', 'quiet', 'gone')));
        $this->assertNotNull($vip->fresh()->segment_updated_at);

        // Run again with nothing changed: nobody is touched.
        $stamp = $vip->fresh()->segment_updated_at;
        $this->travel(1)->hours();
        $this->artisan('crm:segment')->assertSuccessful();
        $this->assertTrue($stamp->equalTo($vip->fresh()->segment_updated_at));
    }

    public function test_an_order_moves_its_customer_without_waiting_for_the_daily_run(): void
    {
        $customer = User::factory()->create();
        $service = $this->app->make(OrderService::class);
        $order = $this->order($customer, ['status' => 'pending', 'total' => 12000000]);

        $order = $service->transition($order, 'confirmed');
        $this->assertSame('active', $customer->fresh()->segment);
        $order = $service->transition($service->transition($order, 'shipped'), 'delivered');
        $service->markCodPaid($order);
        $this->assertSame('vip', $customer->fresh()->segment);

        // A guest order has no account to group.
        $guest = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Khách', 'phone' => '0900000000',
            'address' => 'Địa chỉ', 'subtotal' => 100000, 'shipping_fee' => 0, 'total' => 100000,
        ]);
        $this->assertSame('cancelled', $service->transition($guest, 'cancelled')->status);
    }

    public function test_the_owner_sets_the_thresholds_and_customers_are_regrouped(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $customer = User::factory()->create(['created_at' => now()->subDays(100)]);
        $this->order($customer, ['status' => 'delivered', 'payment_status' => 'paid', 'total' => 3000000, 'created_at' => now()->subDays(40)]);
        $this->artisan('crm:segment');
        $this->assertSame('active', $customer->fresh()->segment);
        $settings = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000];

        $this->actingAs($admin)->put('/admin/settings', $settings + [
            'segment_vip_spend' => 3000000, 'segment_inactive_days' => 30, 'segment_lost_days' => 180, 'segment_new_days' => 14, 'segment_potential_events' => 3,
        ])->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã lưu cài đặt. Nhóm khách hàng đang được xếp lại theo ngưỡng mới.');
        $this->get('/admin/settings')->assertInertia(fn (Assert $page) => $page
            ->where('settings.segment_vip_spend', 3000000)->where('settings.segment_inactive_days', 30)->where('settings.segment_lost_days', 180));
        $this->assertSame('vip', $customer->fresh()->segment);

        // "Lost" comes after "inactive", and the amounts and days have to make sense.
        $this->put('/admin/settings', $settings + [
            'segment_vip_spend' => 50, 'segment_inactive_days' => 60, 'segment_lost_days' => 60, 'segment_new_days' => 0, 'segment_potential_events' => 0,
        ])->assertSessionHasErrors(['segment_vip_spend', 'segment_lost_days', 'segment_new_days', 'segment_potential_events']);
        // Saving the delivery fees alone leaves the thresholds as they are.
        $this->put('/admin/settings', $settings)->assertSessionHas('success', 'Đã lưu cài đặt. Giỏ hàng và thanh toán dùng mức phí mới ngay.');
        $this->get('/admin/settings')->assertInertia(fn (Assert $page) => $page->where('settings.segment_vip_spend', 3000000));
    }

    public function test_staff_filter_customers_by_group_and_the_customer_never_sees_theirs(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $vip = User::factory()->create();
        $this->order($vip, ['status' => 'delivered', 'payment_status' => 'paid', 'total' => 15000000]);
        $newcomer = User::factory()->create();
        $this->artisan('crm:segment');

        $this->actingAs($admin)->get('/admin/customers?segment=vip')->assertInertia(fn (Assert $page) => $page
            ->has('customers.data', 1)->where('customers.data.0.id', $vip->id)->where('customers.data.0.segment', 'vip')
            ->where('filters.segment', 'vip')
            ->where('segments', ['new' => 1, 'potential' => 0, 'active' => 0, 'vip' => 1, 'inactive' => 0, 'lost' => 0]));
        $this->get('/admin/customers?segment=friends')->assertSessionHasErrors('segment');
        $this->get(route('admin.customers.show', $newcomer))->assertInertia(fn (Assert $page) => $page->where('customer.segment', 'new'));

        // The group is the shop's reading of a customer: it is not sent to their browser.
        $this->actingAs($vip)->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.email', $vip->email)->missing('auth.user.segment')->missing('auth.user.segment_updated_at')->missing('account.segment'));
    }
}
