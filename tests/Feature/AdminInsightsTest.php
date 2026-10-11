<?php

namespace Tests\Feature;

use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ServiceOrder;
use App\Models\SupportConversation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * What the reports say besides sales, and the work the dashboard lists besides orders: every
 * figure counted from the rows it stands for, inside the period asked for.
 */
class AdminInsightsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    /** Yesterday, inside every period; and a day long before any of them. */
    private const INSIDE = '2026-09-27 05:00:00';

    private const BEFORE = '2025-01-10 05:00:00';

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_admin' => true, 'segment' => null]);
        // 10:00 on 28/9 in the shop's time zone (03:00 UTC).
        $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00', 'Asia/Ho_Chi_Minh'));
    }

    /** @return array<string, mixed> the report's "insights" for the last 30 days */
    private function insights(string $query = 'demo=0'): array
    {
        return $this->actingAs($this->admin)->get('/admin/reports?'.$query)->assertOk()->viewData('page')['props']['insights'];
    }

    private function product(bool $demo = false): Product
    {
        return Product::create([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => $demo,
        ]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'address' => '12 Nguyễn Huệ', 'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000, 'created_at' => self::INSIDE,
        ], $attributes));
    }

    /**
     * What one visitor did, in order.
     *
     * @param  int|string  $visitor  an account's id, or the key of a visit by someone not signed in
     * @param  list<string>  $events
     */
    private function visit(int|string $visitor, array $events, ?Product $product = null, ?Order $order = null, string $at = self::INSIDE): void
    {
        foreach ($events as $name) {
            CustomerEvent::create([
                'user_id' => is_int($visitor) ? $visitor : null, 'session_key' => is_int($visitor) ? Str::random(64) : str_pad($visitor, 64, '0'),
                'name' => $name, 'product_id' => in_array($name, ['product_view', 'add_to_cart'], true) ? $product?->id : null,
                'order_id' => $name === 'order_placed' ? $order?->id : null, 'created_at' => $at,
            ]);
        }
    }

    /** @param  array<string, mixed>  $attributes */
    private function stringing(array $attributes = []): ServiceOrder
    {
        return ServiceOrder::create(array_merge([
            'public_id' => (string) Str::uuid(), 'booking_token' => (string) Str::uuid(), 'name' => 'Lê Bình', 'phone' => '0912345678',
            'service_type' => 'own_string', 'racket' => 'Astrox 88', 'tension_kg' => 11, 'quantity' => 1, 'total' => 30000,
            'created_at' => self::INSIDE,
        ], $attributes));
    }

    public function test_the_funnel_counts_visitors_who_got_each_step_further(): void
    {
        $racket = $this->product();
        $sample = $this->product(demo: true);
        $buyer = User::factory()->create();

        // Looked, put in the cart, opened the checkout and ordered.
        $this->visit('all-the-way', ['product_view', 'add_to_cart', 'checkout_started', 'order_placed'], $racket, $this->order());
        // An account, seen from two devices: one visitor, who stopped at the cart.
        $this->visit($buyer->id, ['product_view', 'product_view'], $racket);
        $this->visit($buyer->id, ['add_to_cart'], $racket);
        // Only looked.
        $this->visit('looked', ['product_view'], $racket);
        // Ordered in the period, but looked before it began: not someone the period brought in.
        $this->visit('came-back', ['product_view'], $racket, at: self::BEFORE);
        $this->visit('came-back', ['add_to_cart', 'checkout_started', 'order_placed'], $racket, $this->order());
        // Long ago.
        $this->visit('old', ['product_view', 'add_to_cart'], $racket, at: self::BEFORE);
        // Trying the shop with sample goods.
        $this->visit('trial', ['product_view', 'add_to_cart', 'checkout_started', 'order_placed'], $sample, $this->order(['is_demo' => true]));

        $this->assertSame(
            [['key' => 'viewed', 'visitors' => 3], ['key' => 'carted', 'visitors' => 2], ['key' => 'checkout', 'visitors' => 1], ['key' => 'ordered', 'visitors' => 1]],
            $this->insights()['funnel'],
        );
        // With sample data counted, the trial visit is a visitor like any other.
        $this->assertSame([4, 3, 2, 2], array_column($this->insights('demo=1')['funnel'], 'visitors'));
        // A shorter period that the visits fall outside of is empty, not an error.
        $this->travelTo(now()->addDays(40));
        $this->assertSame([0, 0, 0, 0], array_column($this->insights()['funnel'], 'visitors'));
    }

    public function test_the_customer_groups_are_the_accounts_as_they_stand(): void
    {
        foreach (['vip' => 2, 'active' => 3, 'lost' => 1] as $segment => $count) {
            User::factory()->count($count)->create(['segment' => $segment]);
        }
        User::factory()->create(['segment' => null]);
        // Staff and sample customers are not customers.
        User::factory()->create(['is_admin' => true, 'role' => 'support', 'segment' => null]);
        User::factory()->create(['segment' => 'vip', 'email' => 'khach-mau-001@khach-mau.invalid']);

        $this->assertSame([
            ['segment' => 'new', 'customers' => 0], ['segment' => 'potential', 'customers' => 0], ['segment' => 'active', 'customers' => 3],
            ['segment' => 'vip', 'customers' => 2], ['segment' => 'inactive', 'customers' => 0], ['segment' => 'lost', 'customers' => 1],
            ['segment' => 'none', 'customers' => 1],
        ], $this->insights()['segments']);
        $this->assertSame(3, collect($this->insights('demo=1')['segments'])->firstWhere('segment', 'vip')['customers']);
    }

    public function test_coupons_are_counted_over_the_orders_that_stand(): void
    {
        $this->order(['coupon_code' => 'GIAM10', 'discount_total' => 50000, 'total' => 450000]);
        $this->order(['coupon_code' => 'GIAM10', 'discount_total' => 30000, 'total' => 270000, 'subtotal' => 300000]);
        $this->order(['coupon_code' => 'VIP100', 'discount_total' => 100000, 'total' => 900000, 'subtotal' => 1000000]);
        $this->order();
        // Not these: cancelled, before the period, a sample order.
        $this->order(['coupon_code' => 'GIAM10', 'discount_total' => 50000, 'status' => 'cancelled']);
        $this->order(['coupon_code' => 'GIAM10', 'discount_total' => 50000, 'created_at' => self::BEFORE]);
        $this->order(['coupon_code' => 'MAU', 'discount_total' => 10000, 'is_demo' => true]);

        $this->assertSame([
            'orders' => 3, 'of' => 4, 'discount' => 180000, 'sales' => 1620000,
            'top' => [
                ['code' => 'VIP100', 'orders' => 1, 'discount' => 100000, 'sales' => 900000],
                ['code' => 'GIAM10', 'orders' => 2, 'discount' => 80000, 'sales' => 720000],
            ],
        ], $this->insights()['coupons']);
        $this->assertSame(4, $this->insights('demo=1')['coupons']['orders']);
    }

    public function test_money_is_split_by_how_it_is_paid_and_transfers_are_followed_to_their_end(): void
    {
        $this->order();
        $this->order(['payment_method' => 'bank_transfer', 'payment_status' => 'paid', 'status' => 'confirmed', 'total' => 900000, 'paid_at' => self::INSIDE]);
        $waiting = $this->order(['payment_method' => 'bank_transfer', 'total' => 700000]);
        $waiting->payments()->create(['method' => 'bank_transfer', 'amount' => 700000, 'reference' => 'DHAAAA0001', 'expires_at' => now()->addDay()]);
        // Sent back in the period (the order itself is older).
        $returned = $this->order(['payment_method' => 'bank_transfer', 'payment_status' => 'refunded', 'status' => 'cancelled', 'total' => 400000, 'created_at' => self::BEFORE, 'cancelled_at' => self::INSIDE]);
        $returned->payments()->create(['method' => 'bank_transfer', 'amount' => 400000, 'reference' => 'DHAAAA0002', 'status' => 'refunded', 'paid_at' => self::BEFORE, 'refunded_at' => self::INSIDE]);
        // Never paid: one in the period, one long ago.
        foreach ([self::INSIDE, self::BEFORE] as $index => $cancelled) {
            $late = $this->order(['payment_method' => 'bank_transfer', 'status' => 'cancelled', 'created_at' => self::BEFORE, 'cancelled_at' => $cancelled]);
            $late->payments()->create(['method' => 'bank_transfer', 'amount' => 500000, 'reference' => 'DHAAAA001'.$index, 'status' => 'expired']);
        }

        $this->assertSame([
            'methods' => [['method' => 'cod', 'orders' => 1, 'sales' => 500000], ['method' => 'bank_transfer', 'orders' => 2, 'sales' => 1600000]],
            'awaiting' => ['orders' => 1, 'amount' => 700000],
            'refunded' => ['payments' => 1, 'amount' => 400000],
            'expired' => 1,
        ], $this->insights()['payments']);
    }

    public function test_the_stringing_counter_is_counted_by_what_came_in_and_what_was_handed_back(): void
    {
        $this->stringing();
        $this->stringing(['status' => 'ready', 'ready_at' => self::INSIDE]);
        $this->stringing(['status' => 'cancelled', 'cancelled_at' => self::INSIDE]);
        $this->stringing(['status' => 'completed', 'completed_at' => self::INSIDE, 'quantity' => 2, 'total' => 360000]);
        // Asked for long ago, handed back in the period.
        $this->stringing(['status' => 'completed', 'completed_at' => self::INSIDE, 'total' => 30000, 'created_at' => self::BEFORE]);
        // Handed back long ago.
        $this->stringing(['status' => 'completed', 'completed_at' => self::BEFORE, 'total' => 999000, 'created_at' => self::BEFORE]);

        $this->assertSame([
            'received' => 4, 'cancelled' => 1,
            'completed' => ['requests' => 2, 'rackets' => 3, 'collected' => 390000],
            'waiting' => ['pending' => 1, 'ready' => 1],
        ], $this->insights()['services']);
    }

    public function test_the_support_inbox_is_counted_by_conversations_tickets_and_what_was_solved(): void
    {
        $conversation = fn (array $attributes = []) => SupportConversation::create(array_merge([
            'session_key' => Str::random(64), 'status' => 'open', 'needs_human' => false, 'created_at' => self::INSIDE,
        ], $attributes));
        // The assistant answered: a conversation, not a ticket.
        $conversation();
        $conversation(['needs_human' => true]);
        $conversation(['needs_human' => true, 'status' => 'pending']);
        $conversation(['needs_human' => true, 'status' => 'resolved', 'resolved_at' => self::INSIDE]);
        // Closed without being marked as solved; and one solved then closed, counted once.
        $conversation(['needs_human' => true, 'status' => 'closed', 'closed_at' => self::INSIDE, 'created_at' => self::BEFORE]);
        $conversation(['needs_human' => true, 'status' => 'closed', 'resolved_at' => self::INSIDE, 'closed_at' => self::INSIDE, 'created_at' => self::BEFORE]);
        // Solved long ago.
        $conversation(['needs_human' => true, 'status' => 'closed', 'resolved_at' => self::BEFORE, 'closed_at' => self::BEFORE, 'created_at' => self::BEFORE]);

        $this->assertSame(
            ['conversations' => 4, 'tickets' => 3, 'solved' => 3, 'waiting' => ['open' => 1, 'pending' => 1]],
            $this->insights()['support'],
        );
    }

    public function test_the_dashboard_lists_the_work_waiting_beside_orders(): void
    {
        $this->stringing();
        $this->stringing();
        $this->stringing(['status' => 'ready']);
        $this->stringing(['status' => 'completed', 'completed_at' => now()->subDays(2), 'total' => 350000]);
        $this->stringing(['status' => 'completed', 'completed_at' => now()->subDays(20), 'total' => 999000]);
        SupportConversation::create(['session_key' => Str::random(64), 'status' => 'open', 'needs_human' => true]);
        SupportConversation::create(['session_key' => Str::random(64), 'status' => 'pending', 'needs_human' => true]);
        SupportConversation::create(['session_key' => Str::random(64), 'status' => 'open', 'needs_human' => false]);
        $racket = $this->product();
        ProductReview::create(['user_id' => User::factory()->create()->id, 'product_id' => $racket->id, 'rating' => 4, 'body' => 'Ổn', 'status' => 'pending']);
        ProductReview::create(['user_id' => User::factory()->create()->id, 'product_id' => $racket->id, 'rating' => 5, 'status' => 'published']);
        EmailLog::create(['type' => 'order_placed', 'recipient' => 'a@example.com', 'subject' => 'Đơn', 'status' => 'failed', 'created_at' => now()->subDay()]);
        EmailLog::create(['type' => 'order_placed', 'recipient' => 'b@example.com', 'subject' => 'Đơn', 'status' => 'failed', 'created_at' => now()->subDays(30)]);
        EmailLog::create(['type' => 'order_placed', 'recipient' => 'c@example.com', 'subject' => 'Đơn', 'status' => 'sent', 'created_at' => now()->subDay()]);

        $this->actingAs($this->admin)->get('/admin?demo=0')->assertInertia(fn (Assert $page) => $page
            ->where('todo.service_pending', 2)->where('todo.service_ready', 1)->where('todo.support_open', 1)
            ->where('todo.reviews_pending', 1)->where('todo.emails_failed', 1)
            // Paid at the counter in the last seven days.
            ->where('stats.week_service', 350000));
    }

    public function test_the_figures_are_the_shops_alone(): void
    {
        $this->get('/admin/reports')->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->get('/admin/reports')->assertForbidden();
        $this->actingAs(User::factory()->create(['is_admin' => true, 'role' => 'support']))->get('/admin/reports')->assertForbidden();
    }
}
