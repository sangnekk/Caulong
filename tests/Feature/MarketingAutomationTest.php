<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\EmailService;
use App\Services\MarketingAutomation;
use App\Services\ShopSettings;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Tests\TestCase;

class MarketingAutomationTest extends TestCase
{
    use RefreshDatabase;

    /** @return Collection<int, Email> */
    private function outbox(): Collection
    {
        return app('mailer')->getSymfonyTransport()->messages()
            ->map(fn (SentMessage $message) => MessageConverter::toEmail($message->getOriginalMessage()))->values();
    }

    /** Turns automations on, as the owner does in the settings page. */
    private function enable(string ...$automations): void
    {
        app(ShopSettings::class)->save(array_fill_keys(array_map(fn (string $name) => 'marketing_'.$name, $automations), 1));
    }

    /** A customer who agreed to promotional email. */
    private function subscriber(array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->forceFill(['marketing_opt_in_at' => now(), 'segment' => $attributes['segment'] ?? null])->save();

        return $user;
    }

    private function product(string $name, array $attributes = [], int $stock = 5): Product
    {
        $product = Product::create(array_merge([
            'name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 1200000, 'stock' => $stock, 'is_active' => true]);

        return $product;
    }

    private function order(?User $customer, array $attributes = [], ?Product $product = null): Order
    {
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $customer?->id,
            'name' => 'Khách', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 1200000, 'shipping_fee' => 0, 'total' => 1200000,
        ], $attributes));
        if ($product) {
            $variant = $product->variants->first();
            $order->items()->create([
                'variant_id' => $variant->id, 'product_name' => $product->name, 'variant_name' => '4U', 'sku' => $variant->sku,
                'unit_price' => 1200000, 'quantity' => 1, 'line_total' => 1200000,
            ]);
        }

        return $order;
    }

    private function carted(User $user, Product $product, int $hoursAgo, string $name = 'add_to_cart'): void
    {
        CustomerEvent::create(['user_id' => $user->id, 'name' => $name, 'product_id' => $product->id, 'created_at' => now()->subHours($hoursAgo)]);
    }

    public function test_nothing_sends_itself_until_the_owner_turns_it_on(): void
    {
        $racket = $this->product('Astrox 88');
        $this->carted($this->subscriber(), $racket, 30);
        $this->subscriber(['segment' => 'vip']);

        $this->artisan('marketing:run')->expectsOutputToContain('Không có automation nào đang bật')->assertSuccessful();
        $this->artisan('marketing:run newsletter')->assertFailed();
        $this->assertSame([0, 0], [EmailLog::count(), Coupon::count()]);

        $this->enable('vip');
        $this->artisan('marketing:run abandoned_cart')->expectsOutputToContain('đang tắt')->assertSuccessful();
        $this->assertSame(0, EmailLog::count());
        $this->artisan('marketing:run')->assertSuccessful();
        $this->assertSame(['vip'], EmailLog::pluck('type')->all());
    }

    public function test_a_cart_left_behind_is_recalled_once_with_what_can_still_be_bought(): void
    {
        $this->enable('abandoned_cart');
        $astrox = $this->product('Astrox 88');
        $nanoflare = $this->product('Nanoflare 700');
        $soldOut = $this->product('Arcsaber 11', [], 0);
        $sample = $this->product('Vợt mẫu', ['is_demo' => true]);

        $forgot = $this->subscriber(['name' => 'Lê Thu Hà']);
        $this->carted($forgot, $astrox, 40);
        $this->carted($forgot, $nanoflare, 39);
        $this->carted($forgot, $nanoflare, 38, 'remove_from_cart');
        $this->carted($forgot, $soldOut, 37);
        $this->carted($forgot, $sample, 36);
        // Still shopping; bought it after all; took everything out; never agreed to such email.
        $this->carted($this->subscriber(), $astrox, 2);
        $bought = $this->subscriber();
        $this->carted($bought, $astrox, 30);
        $this->order($bought, ['created_at' => now()->subHours(29)], $astrox);
        $emptied = $this->subscriber();
        $this->carted($emptied, $astrox, 30);
        $this->carted($emptied, $astrox, 29, 'remove_from_cart');
        $this->carted(User::factory()->create(), $astrox, 30);

        $this->artisan('marketing:run abandoned_cart')->assertSuccessful();

        $email = $this->outbox()->sole();
        $this->assertSame([$forgot->email, 'Bạn còn để quên vợt trong giỏ hàng'], [$email->getTo()[0]->getAddress(), $email->getSubject()]);
        $html = (string) $email->getHtmlBody();
        $this->assertStringContainsString('Chào Lê Thu Hà,', $html);
        $this->assertStringContainsString('href="'.config('app.frontend_url').'/products/'.$astrox->slug.'"', $html);
        $this->assertStringContainsString('1.200.000 ₫', $html);
        foreach ([$nanoflare, $soldOut, $sample] as $absent) {
            $this->assertStringNotContainsString($absent->slug, $html);
        }
        $log = EmailLog::sole();
        $this->assertSame(['abandoned_cart', $forgot->id, 'sent'], [$log->type, $log->user_id, $log->status]);

        // Run again, and again after they add another racket the same week: one reminder is enough.
        $this->carted($forgot, $nanoflare, 25);
        $this->artisan('marketing:run abandoned_cart');
        $this->assertSame(1, EmailLog::count());
        $this->travel(8)->days();
        $this->carted($forgot, $astrox, 30);
        $this->artisan('marketing:run abandoned_cart');
        $this->assertSame(2, EmailLog::count());
    }

    public function test_a_buyer_who_went_quiet_is_offered_a_coupon_of_their_own(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-10 02:00:00'));
        $this->enable('winback');
        app(ShopSettings::class)->save(['marketing_winback_percent' => 15, 'marketing_winback_valid_days' => 10]);
        $racket = $this->product('Astrox 88');
        $quiet = $this->subscriber(['name' => 'Trần Bình', 'segment' => 'inactive']);
        $this->order($quiet, ['status' => 'delivered', 'created_at' => now()->subDays(120)], $racket);
        // Never bought; bought but did not agree to such email; only a sample order; not verified.
        $this->subscriber(['segment' => 'inactive']);
        $silent = User::factory()->create();
        $silent->forceFill(['segment' => 'inactive'])->save();
        $this->order($silent, ['status' => 'delivered'], $racket);
        $this->order($this->subscriber(['segment' => 'inactive']), ['status' => 'delivered', 'is_demo' => true], $racket);
        $this->order($this->subscriber(['segment' => 'inactive', 'email_verified_at' => null]), ['status' => 'delivered'], $racket);

        $this->artisan('marketing:run winback')->assertSuccessful();

        $coupon = Coupon::sole();
        $this->assertSame([$quiet->id, 'percent', 15, 300000, 1, 1, 'winback', true], array_values($coupon->only([
            'user_id', 'type', 'value', 'max_discount', 'usage_limit', 'per_customer_limit', 'campaign', 'is_active',
        ])));
        // Through the last of its ten days, shop time (UTC+7).
        $this->assertSame('2026-10-20 16:59:59', $coupon->expires_at->toDateTimeString());
        $email = $this->outbox()->sole();
        $this->assertSame($quiet->email, $email->getTo()[0]->getAddress());
        $html = (string) $email->getHtmlBody();
        foreach (['Chào Trần Bình,', $coupon->code, 'Giảm 15%, tối đa 300.000 ₫', 'đến hết ngày 20/10/2026', 'Ngừng nhận email ưu đãi'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }
        $this->assertStringContainsString('/email/unsubscribe/'.$quiet->id.'?signature=', $html);
        $this->assertTrue($email->getHeaders()->has('List-Unsubscribe'));
        $this->assertSame(['winback', $quiet->id], array_values(EmailLog::sole()->only(['type', 'user_id'])));

        // Not again while they stay quiet, until half a year has gone by.
        $this->artisan('marketing:run winback');
        $this->travel(100)->days();
        $this->artisan('marketing:run winback');
        $this->assertSame(1, Coupon::count());
        $this->travel(90)->days();
        $this->artisan('marketing:run winback');
        $this->assertSame(2, Coupon::count());
    }

    public function test_a_week_after_delivery_the_customer_is_invited_to_review_what_they_received(): void
    {
        $this->enable('post_purchase');
        $racket = $this->product('Astrox 88', ['play_style' => 'attack']);
        $alike = $this->product('Axforce 80', ['play_style' => 'attack']);
        $customer = $this->subscriber(['name' => 'Nguyễn An']);
        $first = $this->order($customer, ['status' => 'delivered', 'delivered_at' => now()->subDays(8)], $racket);
        $this->order($customer, ['status' => 'delivered', 'delivered_at' => now()->subDays(9)], $alike);
        // Too soon; a sample order; a guest's order; a customer who did not agree; long ago.
        $this->order($this->subscriber(), ['status' => 'delivered', 'delivered_at' => now()->subDays(2)], $racket);
        $this->order($this->subscriber(), ['status' => 'delivered', 'delivered_at' => now()->subDays(8), 'is_demo' => true], $racket);
        $this->order(null, ['status' => 'delivered', 'delivered_at' => now()->subDays(8), 'email' => 'khach@example.com'], $racket);
        $this->order(User::factory()->create(), ['status' => 'delivered', 'delivered_at' => now()->subDays(8)], $racket);
        $this->order($this->subscriber(), ['status' => 'delivered', 'delivered_at' => now()->subDays(40)], $racket);
        $this->order($this->subscriber(), ['status' => 'shipped'], $racket);

        $this->artisan('marketing:run post_purchase')->assertSuccessful();

        // Two orders of one customer in the same days: one email, about the one delivered first.
        $email = $this->outbox()->sole();
        $this->assertSame([$customer->email, 'Cây vợt mới của bạn thế nào?'], [$email->getTo()[0]->getAddress(), $email->getSubject()]);
        $html = (string) $email->getHtmlBody();
        $this->assertStringContainsString('href="'.config('app.frontend_url').'/products/'.$alike->slug.'#danh-gia"', $html);
        $this->assertStringContainsString('Đánh giá Axforce 80', $html);
        // What plays the same way is suggested; what they bought is not.
        $this->assertStringContainsString('href="'.config('app.frontend_url').'/products/'.$racket->slug.'"', $html);
        $log = EmailLog::sole();
        $this->assertSame(['post_purchase', $customer->id], [$log->type, $log->user_id]);
        $this->assertNotSame($first->id, $log->order_id);

        // The other order waits its turn: not the same day, and never twice for one order.
        $this->artisan('marketing:run post_purchase');
        $this->assertSame(1, EmailLog::count());
        $this->travel(8)->days();
        $this->artisan('marketing:run post_purchase');
        $this->assertSame([$log->order_id, $first->id], EmailLog::where('user_id', $customer->id)->orderBy('id')->pluck('order_id')->all());
        // By then the order that was "too soon" has had its week as well.
        $this->assertSame(3, EmailLog::count());
    }

    public function test_a_new_vip_is_thanked_once(): void
    {
        $this->enable('vip');
        $vip = $this->subscriber(['segment' => 'vip']);
        $this->subscriber(['segment' => 'active']);
        User::factory()->create()->forceFill(['segment' => 'vip'])->save();

        $this->artisan('marketing:run vip')->assertSuccessful();
        $this->artisan('marketing:run');

        $coupon = Coupon::sole();
        $this->assertSame([$vip->id, 10, 'vip'], array_values($coupon->only(['user_id', 'value', 'campaign'])));
        $email = $this->outbox()->sole();
        $this->assertSame('Cảm ơn bạn đã gắn bó: ưu đãi dành cho khách thân thiết', $email->getSubject());
        $this->assertStringContainsString($coupon->code, (string) $email->getHtmlBody());
    }

    public function test_customers_decide_whether_they_get_promotional_email(): void
    {
        // Ticked at sign-up, or not: never ticked for them.
        $this->post(route('register.store'), ['name' => 'Có Nhận', 'email' => 'co@example.com', 'password' => 'mat-khau-dai', 'password_confirmation' => 'mat-khau-dai', 'marketing_opt_in' => '1']);
        $this->assertNotNull(User::where('email', 'co@example.com')->sole()->marketing_opt_in_at);
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->post(route('register.store'), ['name' => 'Không Nhận', 'email' => 'khong@example.com', 'password' => 'mat-khau-dai', 'password_confirmation' => 'mat-khau-dai']);
        $customer = User::where('email', 'khong@example.com')->sole();
        $this->assertNull($customer->marketing_opt_in_at);

        // The switch on the account page.
        $this->patch(route('account.marketing'), ['opt_in' => 'maybe'])->assertSessionHasErrors('opt_in');
        $this->patch(route('account.marketing'), ['opt_in' => true])->assertSessionHas('success', 'Đã bật nhận email ưu đãi từ cửa hàng.');
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('account.marketing', true)->missing('auth.user.marketing_opt_in_at'));
        $this->patch(route('account.marketing'), ['opt_in' => false]);
        $this->assertNull($customer->fresh()->marketing_opt_in_at);
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->patch(route('account.marketing'), ['opt_in' => true])->assertRedirect(route('login'));
    }

    public function test_the_link_in_a_promotional_email_stops_them_without_signing_in(): void
    {
        $this->enable('vip');
        $vip = $this->subscriber(['segment' => 'vip', 'email' => 'nguyenan@example.com']);
        $other = $this->subscriber();
        $this->artisan('marketing:run vip');
        preg_match('~href="'.preg_quote(config('app.frontend_url'), '~').'(/email/unsubscribe/[^"]+)"~', (string) $this->outbox()->sole()->getHtmlBody(), $found);
        $link = html_entity_decode($found[1]);

        // Opening the link changes nothing; the button on the page does.
        $this->get($link)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/unsubscribe')->where('subscribed', true)->where('email', 'ng•••@example.com')->where('action', $link));
        $this->assertNotNull($vip->fresh()->marketing_opt_in_at);
        $this->post($link)->assertRedirect($link);
        $this->assertNull($vip->fresh()->marketing_opt_in_at);
        $this->get($link)->assertInertia(fn (Assert $page) => $page->where('subscribed', false));

        // The link is one customer's: it does not work for another, or once altered.
        $forged = str_replace('/unsubscribe/'.$vip->id, '/unsubscribe/'.$other->id, $link);
        $this->get($forged)->assertNotFound();
        $this->post($forged)->assertNotFound();
        $this->post('/email/unsubscribe/'.$other->id)->assertNotFound();
        $this->assertNotNull($other->fresh()->marketing_opt_in_at);

        // From then on the automations pass them by.
        $vip->forceFill(['segment' => 'inactive'])->save();
        $this->order($vip, ['status' => 'delivered'], $this->product('Astrox 88'));
        $this->enable('winback');
        $this->artisan('marketing:run');
        $this->assertSame(['vip'], EmailLog::orderBy('id')->pluck('type')->all());
    }

    public function test_a_customer_who_says_stop_gets_no_promotional_email_that_was_still_waiting(): void
    {
        // As on the server: an email waits in the queue until the worker gets to it.
        config(['queue.default' => 'database']);
        $this->enable('vip');
        $leaving = $this->subscriber(['segment' => 'vip']);
        $staying = $this->subscriber(['segment' => 'vip']);
        $this->artisan('marketing:run vip')->assertSuccessful();
        $this->assertSame(['queued', 'queued'], EmailLog::pluck('status')->all());

        $leaving->forceFill(['marketing_opt_in_at' => null])->save();
        // What is not promotional still reaches them.
        app(EmailService::class)->welcome($leaving);
        $this->artisan('queue:work', ['--stop-when-empty' => true, '--sleep' => 0])->assertSuccessful();

        $this->assertEqualsCanonicalizing([
            [$staying->email, 'Cảm ơn bạn đã gắn bó: ưu đãi dành cho khách thân thiết'],
            [$leaving->email, 'Chào mừng bạn đến với '.config('app.name')],
        ], $this->outbox()->map(fn (Email $email) => [$email->getTo()[0]->getAddress(), $email->getSubject()])->all());
        $dropped = EmailLog::where('user_id', $leaving->id)->where('type', 'vip')->sole();
        $this->assertSame(['failed', null], [$dropped->status, $dropped->sent_at]);
        $this->assertStringContainsString('tắt email ưu đãi', (string) $dropped->error);
        // Dropped, not put back for another try.
        $this->assertSame([0, 0], [DB::table('jobs')->count(), DB::table('failed_jobs')->count()]);
    }

    public function test_an_offer_is_made_once_whatever_became_of_its_email(): void
    {
        $this->enable('winback', 'vip');
        $this->subscriber(['segment' => 'vip']);
        $quiet = $this->subscriber(['segment' => 'inactive']);
        $this->order($quiet, ['status' => 'delivered', 'created_at' => now()->subDays(120)], $this->product('Astrox 88'));
        $this->artisan('marketing:run')->assertSuccessful();
        $this->assertEqualsCanonicalizing(['vip', 'winback'], Coupon::pluck('campaign')->all());

        // The emails never arrived. The coupons are in the customers' accounts all the same: no second ones.
        EmailLog::query()->update(['status' => 'failed']);
        $this->artisan('marketing:run');
        $this->assertSame([2, 2], [Coupon::count(), EmailLog::count()]);

        // A year on the email log has forgotten the thank-you; the coupon has not.
        $this->travel(EmailLog::KEEP_DAYS + 1)->days();
        $this->artisan('model:prune', ['--model' => [EmailLog::class]]);
        $this->assertSame(0, EmailLog::count());
        $this->artisan('marketing:run vip');
        $this->assertSame(1, Coupon::where('campaign', 'vip')->count());
    }

    public function test_the_longest_wait_the_settings_take_still_leaves_days_to_send_the_reminder(): void
    {
        $base = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000, 'marketing_abandoned_cart' => true];
        $this->actingAs(User::factory()->create(['is_admin' => true]))
            ->put('/admin/settings', $base + ['marketing_abandoned_cart_hours' => MarketingAutomation::CART_MAX_HOURS + 1])
            ->assertSessionHasErrors('marketing_abandoned_cart_hours');
        $this->put('/admin/settings', $base + ['marketing_abandoned_cart_hours' => MarketingAutomation::CART_MAX_HOURS])->assertSessionHasNoErrors();
        $this->app->forgetScopedInstances();

        // Two days past the wait, as after a weekend without the scheduler: still reminded.
        $forgot = $this->subscriber();
        $this->carted($forgot, $this->product('Astrox 88'), MarketingAutomation::CART_MAX_HOURS + 48);
        $this->artisan('marketing:run abandoned_cart')->assertSuccessful();
        $this->assertSame($forgot->id, EmailLog::sole()->user_id);
    }

    public function test_the_groups_are_worked_out_before_the_morning_emails_go(): void
    {
        // Midnight in the shop (UTC+7).
        $this->travelTo(CarbonImmutable::parse('2026-10-09 17:00:00'));
        $next = fn (string $command): CarbonInterface => collect(app(Schedule::class)->events())
            ->sole(fn (Event $event) => str_ends_with((string) $event->command, $command))->nextRunDate();

        $this->assertTrue($next('crm:segment')->lt($next('marketing:run')));
    }

    public function test_the_owner_switches_the_automatic_emails_in_settings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $base = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000];

        $this->actingAs($admin)->get('/admin/settings')->assertInertia(fn (Assert $page) => $page
            ->where('settings.marketing_abandoned_cart', false)->where('settings.marketing_abandoned_cart_hours', 24)
            ->where('settings.marketing_winback', false)->where('settings.marketing_winback_percent', 10)
            ->where('settings.marketing_post_purchase_days', 7)->where('settings.marketing_vip_valid_days', 30));

        $this->put('/admin/settings', $base + [
            'marketing_abandoned_cart' => true, 'marketing_abandoned_cart_hours' => 6, 'marketing_winback' => false, 'marketing_winback_percent' => 20,
            'marketing_winback_valid_days' => 7, 'marketing_post_purchase' => true, 'marketing_post_purchase_days' => 5,
            'marketing_vip' => false, 'marketing_vip_percent' => 12, 'marketing_vip_valid_days' => 45,
        ])->assertSessionHasNoErrors();
        $this->app->forgetScopedInstances();
        $this->assertSame([
            'abandoned_cart' => true, 'abandoned_cart_hours' => 6, 'winback' => false, 'winback_percent' => 20, 'winback_valid_days' => 7,
            'post_purchase' => true, 'post_purchase_days' => 5, 'vip' => false, 'vip_percent' => 12, 'vip_valid_days' => 45,
        ], app(ShopSettings::class)->marketing());

        $this->put('/admin/settings', $base + [
            'marketing_abandoned_cart' => 'yes', 'marketing_abandoned_cart_hours' => 0, 'marketing_winback_percent' => 80,
            'marketing_winback_valid_days' => 0, 'marketing_post_purchase_days' => 99, 'marketing_vip_percent' => 0, 'marketing_vip_valid_days' => 500,
        ])->assertSessionHasErrors([
            'marketing_abandoned_cart', 'marketing_abandoned_cart_hours', 'marketing_winback_percent', 'marketing_winback_valid_days',
            'marketing_post_purchase_days', 'marketing_vip_percent', 'marketing_vip_valid_days',
        ]);
    }
}
