<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\EmailLog;
use App\Models\User;
use App\Services\CouponService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminEmailTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_admin' => true]);
    }

    private function log(array $attributes = []): EmailLog
    {
        return EmailLog::create(array_merge([
            'type' => 'order_placed', 'recipient' => 'khach@example.com', 'subject' => 'Đã nhận đơn hàng ABC12345', 'status' => 'sent', 'sent_at' => now(),
        ], $attributes));
    }

    public function test_the_email_log_is_for_staff_only(): void
    {
        $coupon = app(CouponService::class)->issue(User::factory()->create(), ['name' => 'Quà', 'type' => 'fixed', 'value' => 50000]);

        $this->get(route('admin.emails.index'))->assertRedirect(route('login'));
        $this->post(route('admin.coupons.email', $coupon))->assertRedirect(route('login'));
        $this->actingAs(User::factory()->create());
        $this->get(route('admin.emails.index'))->assertForbidden();
        $this->post(route('admin.coupons.email', $coupon))->assertForbidden();
        $this->assertSame(0, EmailLog::count());
    }

    public function test_the_log_lists_every_email_with_how_it_went(): void
    {
        $customer = User::factory()->create(['email' => 'an@example.com']);
        $this->log(['recipient' => 'an@example.com', 'user_id' => $customer->id, 'provider_message_id' => 'resend-id-1']);
        $this->log(['type' => 'winback', 'recipient' => 'binh@example.com', 'status' => 'failed', 'sent_at' => null, 'error' => 'The domain is not verified.']);
        $this->log(['type' => 'welcome', 'recipient' => 'chi@example.com', 'status' => 'queued', 'sent_at' => null, 'created_at' => now()->subMinutes(2)]);
        // Waiting much longer than a worker takes: the queue is not being worked.
        $this->log(['type' => 'welcome', 'recipient' => 'dung@example.com', 'status' => 'queued', 'sent_at' => null, 'created_at' => now()->subMinutes(30)]);

        $this->actingAs($this->admin)->get(route('admin.emails.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/emails')
            ->has('emails.data', 4)
            ->where('counts', ['all' => 4, 'queued' => 2, 'sent' => 1, 'failed' => 1])
            ->where('stalled', 1)
            // Tests send with the "array" mailer; the page says when mail is not really leaving.
            ->where('mailer', 'array')
            ->where('emails.data.3.recipient', 'an@example.com')->where('emails.data.3.provider_message_id', 'resend-id-1')
            ->where('emails.data.3.user_id', $customer->id)
            ->where('emails.data.2.error', 'The domain is not verified.'));

        $recipients = fn (array $query) => fn (Assert $page) => $page->where('emails.data', fn ($rows) => collect($rows)->pluck('recipient')->sort()->values()->all() === $query);
        $this->get(route('admin.emails.index', ['status' => 'failed']))->assertInertia($recipients(['binh@example.com']));
        $this->get(route('admin.emails.index', ['type' => 'welcome']))->assertInertia($recipients(['chi@example.com', 'dung@example.com']));
        $this->get(route('admin.emails.index', ['q' => 'AN@example']))->assertInertia($recipients(['an@example.com']));
        $this->get(route('admin.emails.index', ['type' => 'welcome', 'status' => 'sent']))->assertInertia($recipients([]));
        $this->get(route('admin.emails.index', ['status' => 'lost']))->assertSessionHasErrors('status');
        $this->get(route('admin.emails.index', ['type' => 'newsletter']))->assertSessionHasErrors('type');
    }

    public function test_staff_email_a_customer_the_coupon_made_for_them(): void
    {
        // Not signed up for promotional email: a coupon the shop made for them is the shop writing to them.
        $customer = User::factory()->create(['email' => 'khach@example.com']);
        $personal = app(CouponService::class)->issue($customer, ['name' => 'Quà xin lỗi vì giao trễ', 'type' => 'fixed', 'value' => 50000]);
        $general = Coupon::create(['code' => 'CHUNG', 'name' => 'Cho mọi khách', 'type' => 'percent', 'value' => 5]);

        $this->actingAs($this->admin)->post(route('admin.coupons.email', $personal))
            ->assertSessionHas('success', 'Đã xếp email gửi mã '.$personal->code.' tới khach@example.com.');
        $log = EmailLog::sole();
        $this->assertSame(['coupon', 'khach@example.com', $customer->id, 'sent'], [$log->type, $log->recipient, $log->user_id, $log->status]);
        $html = (string) app('mailer')->getSymfonyTransport()->messages()->first()->getOriginalMessage()->getHtmlBody();
        $this->assertStringContainsString($personal->code, $html);
        $this->assertStringContainsString('Giảm 50.000 ₫', $html);
        // A message from the shop to one customer, not a mailing: no unsubscribe footer.
        $this->assertStringNotContainsString('/email/unsubscribe/', $html);

        $this->post(route('admin.coupons.email', $general))->assertSessionHasErrors('coupon');
        $personal->update(['is_active' => false]);
        $this->post(route('admin.coupons.email', $personal))->assertSessionHasErrors('coupon');
        $this->assertSame(1, EmailLog::count());
    }

    public function test_a_coupon_an_automation_made_stays_promotional_when_staff_send_it_again(): void
    {
        // The customer has not agreed to promotional email (or has stopped it since the offer went out).
        $customer = User::factory()->create(['email' => 'khach@example.com']);
        $offer = app(CouponService::class)->issue($customer, ['name' => 'Ưu đãi khách thân thiết', 'type' => 'percent', 'value' => 10, 'campaign' => 'vip']);

        $this->actingAs($this->admin)->post(route('admin.coupons.email', $offer))
            ->assertSessionHasErrors(['coupon' => 'Đây là mã của email ưu đãi tự động, mà khách này chưa đồng ý nhận email ưu đãi hoặc đã tắt.']);
        $this->assertSame(0, EmailLog::count());

        $customer->forceFill(['marketing_opt_in_at' => now()])->save();
        $this->post(route('admin.coupons.email', $offer))->assertSessionHasNoErrors();
        $this->assertSame('vip', EmailLog::sole()->type);
        // Sent as what it is: with the customer's way to stop such email.
        $email = app('mailer')->getSymfonyTransport()->messages()->first()->getOriginalMessage();
        $this->assertStringContainsString('/email/unsubscribe/'.$customer->id.'?signature=', (string) $email->getHtmlBody());
        $this->assertTrue($email->getHeaders()->has('List-Unsubscribe'));
    }

    public function test_a_coupon_deleted_while_its_email_waits_is_not_sent(): void
    {
        // As on the server: the email waits in the queue for the worker.
        config(['queue.default' => 'database']);
        $coupon = app(CouponService::class)->issue(User::factory()->create(), ['name' => 'Quà', 'type' => 'fixed', 'value' => 50000]);
        $this->actingAs($this->admin)->post(route('admin.coupons.email', $coupon))->assertSessionHasNoErrors();
        $this->delete(route('admin.coupons.destroy', $coupon))->assertSessionHasNoErrors();

        $this->artisan('queue:work', ['--stop-when-empty' => true, '--sleep' => 0])->assertSuccessful();

        $this->assertCount(0, app('mailer')->getSymfonyTransport()->messages());
        $log = EmailLog::sole();
        $this->assertSame('failed', $log->status);
        $this->assertStringContainsString('đã bị xóa', (string) $log->error);
        $this->assertSame([0, 0], [DB::table('jobs')->count(), DB::table('failed_jobs')->count()]);
    }
}
