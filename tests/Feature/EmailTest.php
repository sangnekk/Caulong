<?php

namespace Tests\Feature;

use App\Mail\ResendTransport;
use App\Mail\WelcomeMail;
use App\Models\Coupon;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\EmailService;
use App\Services\OrderService;
use App\Services\ShopSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use InvalidArgumentException;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Tests\TestCase;

/** The emails themselves are rendered for real (the "array" mailer keeps them in memory). */
class EmailTest extends TestCase
{
    use RefreshDatabase;

    /** @return Collection<int, Email> everything sent so far, oldest first */
    private function outbox(): Collection
    {
        return app('mailer')->getSymfonyTransport()->messages()
            ->map(fn (SentMessage $message) => MessageConverter::toEmail($message->getOriginalMessage()))->values();
    }

    private function variant(int $price = 1000000, array $product = []): ProductVariant
    {
        $product = Product::create(array_merge([
            'name' => 'Vợt Astrox 88', 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $product));

        return $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => $price, 'stock' => 10, 'is_active' => true]);
    }

    /** Places an order through the checkout page, as a customer would. */
    private function checkout(ProductVariant $variant, array $data = []): Order
    {
        $this->withSession(['shopping_cart' => [$variant->id => 1]])->get(route('checkout.index'))->assertOk();
        $this->post(route('checkout.store'), array_merge([
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'address' => '12 Nguyễn Huệ, Quận 1', 'email' => 'an@example.com', 'payment_method' => 'cod', 'accept_terms' => true,
        ], $data))->assertSessionHasNoErrors();

        return Order::latest('id')->firstOrFail();
    }

    /** From here on the mail server refuses every email, until mail.default is set back. */
    private function breakMail(): void
    {
        Mail::extend('broken', fn () => new class extends AbstractTransport
        {
            protected function doSend(SentMessage $message): void
            {
                throw new TransportException('Máy chủ thư không trả lời.');
            }

            public function __toString(): string
            {
                return 'broken';
            }
        });
        config(['mail.default' => 'broken', 'mail.mailers.broken' => ['transport' => 'broken']]);
    }

    /** The queue worker passing by: it sends what is due and stops. */
    private function work(): void
    {
        $this->artisan('queue:work', ['--stop-when-empty' => true, '--sleep' => 0])->assertSuccessful();
    }

    public function test_a_new_account_gets_a_welcome_and_a_verification_email_and_both_are_logged(): void
    {
        $this->post(route('register.store'), [
            'name' => 'Lê Thu Hà', 'email' => 'Ha@Example.com', 'password' => 'mat-khau-dai', 'password_confirmation' => 'mat-khau-dai',
        ])->assertRedirect();
        // Addresses are kept in lower case.
        $user = User::where('email', 'ha@example.com')->sole();

        $subjects = $this->outbox()->map(fn (Email $email) => $email->getSubject())->all();
        $this->assertEqualsCanonicalizing(['Chào mừng bạn đến với '.config('app.name'), 'Xác minh địa chỉ email'], $subjects);
        $welcome = $this->outbox()->first(fn (Email $email) => str_starts_with((string) $email->getSubject(), 'Chào mừng'));
        $this->assertSame('ha@example.com', $welcome->getTo()[0]->getAddress());
        $this->assertStringContainsString('Chào Lê Thu Hà,', (string) $welcome->getHtmlBody());
        $this->assertStringContainsString(config('app.frontend_url').'/products', (string) $welcome->getHtmlBody());
        // Transactional: no "stop these emails" link, in the page or in the headers.
        $this->assertStringNotContainsString('/email/unsubscribe/', (string) $welcome->getHtmlBody());
        $this->assertFalse($welcome->getHeaders()->has('List-Unsubscribe'));
        $this->assertNotSame('', trim((string) $welcome->getTextBody()));

        $logs = EmailLog::orderBy('type')->get();
        $this->assertSame(['verify_email', 'welcome'], $logs->pluck('type')->all());
        foreach ($logs as $log) {
            $this->assertSame(['ha@example.com', 'sent', $user->id], [$log->recipient, $log->status, $log->user_id]);
            $this->assertNotNull($log->sent_at);
        }
    }

    public function test_the_links_in_account_emails_lead_to_the_storefront_and_work_there(): void
    {
        $this->post(route('register.store'), [
            'name' => 'Lê Thu Hà', 'email' => 'ha@example.com', 'password' => 'mat-khau-dai', 'password_confirmation' => 'mat-khau-dai',
        ]);
        $user = User::where('email', 'ha@example.com')->sole();
        $this->assertFalse($user->hasVerifiedEmail());
        $front = config('app.frontend_url');
        $link = fn (string $subject, string $path): string => html_entity_decode((string) preg_match(
            '~href="('.preg_quote($front.$path, '~').'[^"]+)"~',
            (string) $this->outbox()->first(fn (Email $email) => $email->getSubject() === $subject)->getHtmlBody(),
            $found,
        ) ? $found[1] : '');

        // Signed for the storefront's address: opened there, it verifies the account.
        $verify = $link('Xác minh địa chỉ email', '/email/verify/'.$user->id.'/');
        $this->assertStringContainsString('signature=', $verify);
        $this->get($verify)->assertRedirect();
        $this->assertTrue($user->fresh()->hasVerifiedEmail());

        $this->post(route('logout'));
        $this->post(route('password.email'), ['email' => 'ha@example.com'])->assertSessionHasNoErrors();
        $reset = $link('Đặt lại mật khẩu', '/reset-password/');
        $this->assertStringContainsString('email=ha%40example.com', $reset);
        $this->get($reset)->assertOk();
    }

    public function test_the_password_reset_email_is_logged_too(): void
    {
        $user = User::factory()->create();

        $this->post(route('password.email'), ['email' => $user->email])->assertSessionHasNoErrors();

        $log = EmailLog::sole();
        $this->assertSame(['reset_password', $user->email, 'sent', $user->id], [$log->type, $log->recipient, $log->status, $log->user_id]);
        // The log says an email went out, not what was in it.
        $this->assertStringNotContainsString(Password::broker()->createToken($user), json_encode($log->toArray()));
    }

    public function test_order_emails_follow_the_order_from_placed_to_delivered(): void
    {
        $coupon = Coupon::create(['code' => 'GIAM10', 'name' => 'Giảm 10%', 'type' => 'percent', 'value' => 10]);
        $variant = $this->variant(900000);
        $this->withSession(['cart_coupon' => $coupon->code]);
        $order = $this->checkout($variant);
        $service = $this->app->make(OrderService::class);

        $placed = $this->outbox()->sole();
        $this->assertSame('Đã nhận đơn hàng '.$order->code, $placed->getSubject());
        $this->assertSame('an@example.com', $placed->getTo()[0]->getAddress());
        $html = (string) $placed->getHtmlBody();
        foreach (['Vợt Astrox 88 (4U)', '900.000 ₫', 'Giảm giá (mã GIAM10): −90.000 ₫', 'Phí giao hàng: 30.000 ₫', 'Tổng cộng: 840.000 ₫', 'Nguyễn An', '12 Nguyễn Huệ, Quận 1', 'Theo dõi đơn hàng'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }
        $this->assertStringContainsString('840.000 ₫', (string) $placed->getTextBody());

        // Confirming is the shop's own step: the customer is not written to. Each later step once.
        $order = $service->transition($order, 'confirmed');
        $order = $service->transition($order, 'shipped');
        $service->transition($order, 'shipped');
        $order = $service->transition($order, 'delivered');
        $this->assertSame([
            'Đã nhận đơn hàng '.$order->code, 'Đơn hàng '.$order->code.' đang được giao', 'Đơn hàng '.$order->code.' đã giao',
        ], $this->outbox()->map(fn (Email $email) => $email->getSubject())->all());
        $this->assertStringContainsString('chuẩn bị **840.000 ₫** để thanh toán khi nhận hàng', (string) $this->outbox()[1]->getTextBody());

        $cancelled = $service->transition($this->checkout($this->variant()), 'cancelled');
        app(ShopSettings::class)->save(['hotline' => '0901 234 567']);
        $this->assertSame('Đơn hàng '.$cancelled->code.' đã hủy', $this->outbox()->last()->getSubject());

        $this->assertSame(
            ['order_placed', 'order_shipped', 'order_delivered', 'order_placed', 'order_cancelled'],
            EmailLog::orderBy('id')->pluck('type')->all(),
        );
        $this->assertSame([$order->id, 'sent', null], array_values(EmailLog::first()->only(['order_id', 'status', 'user_id'])));
    }

    public function test_who_an_order_email_goes_to_and_when_none_is_sent(): void
    {
        $customer = User::factory()->create(['email' => 'khach@example.com']);

        // A guest who left no address cannot be written to.
        $this->checkout($this->variant(), ['email' => '']);
        // A sample order is not a transaction.
        $this->checkout($this->variant(1000000, ['is_demo' => true]));
        $this->assertSame(0, EmailLog::count());

        // Signed in without an address at checkout: the account's address.
        $order = $this->actingAs($customer)->checkout($this->variant(), ['email' => '']);
        $log = EmailLog::sole();
        $this->assertSame(['khach@example.com', $customer->id, $order->id], [$log->recipient, $log->user_id, $log->order_id]);
        // The address given at checkout wins over the account's.
        $this->checkout($this->variant(), ['email' => 'noi-khac@example.com']);
        $this->assertSame('noi-khac@example.com', EmailLog::latest('id')->first()->recipient);

        $this->expectException(InvalidArgumentException::class);
        app(EmailService::class)->send('newsletter', 'a@example.com', new WelcomeMail($customer));
    }

    public function test_the_link_in_an_order_email_opens_that_order_and_no_other(): void
    {
        $order = $this->checkout($this->variant());
        $other = $this->checkout($this->variant());
        preg_match('~href="'.preg_quote(config('app.frontend_url'), '~').'(/orders/[^"]+)"~', (string) $this->outbox()->first()->getHtmlBody(), $found);
        $link = html_entity_decode($found[1]);
        $this->assertStringContainsString('/orders/'.$order->public_id.'?', $link);

        // Another device: no session, nobody signed in.
        $this->flushSession();
        $this->get('/orders/'.$order->public_id)->assertNotFound();
        $this->get($link)->assertOk()->assertInertia(fn (Assert $page) => $page->where('order.public_id', $order->public_id));
        // The signature is this order's: it opens no other, and not once altered.
        $this->get(str_replace($order->public_id, $other->public_id, $link))->assertNotFound();
        $this->get($link.'0')->assertNotFound();

        $this->travel(61)->days();
        $this->get($link)->assertNotFound();
    }

    public function test_what_a_customer_typed_never_becomes_a_link_or_a_heading_in_the_shops_email(): void
    {
        $this->checkout($this->variant(), [
            'name' => '[Nhận quà](http://evil.example)', 'address' => "# TRÚNG THƯỞNG\n\n![x](http://evil.example/a.png) <b>12 Lê Lợi</b>",
        ]);

        $html = (string) $this->outbox()->sole()->getHtmlBody();
        $this->assertStringNotContainsString('href="http://evil.example', $html);
        $this->assertStringNotContainsString('src="http://evil.example', $html);
        $this->assertStringNotContainsString('<h1>TRÚNG THƯỞNG', $html);
        $this->assertStringNotContainsString('<b>12 Lê Lợi</b>', $html);
        // Shown as the text it is.
        $this->assertStringContainsString('[Nhận quà](http://evil.example)', $html);
        $this->assertStringContainsString('&lt;b&gt;12 Lê Lợi&lt;/b&gt;', $html);
    }

    public function test_a_failed_email_is_recorded_and_never_fails_the_order(): void
    {
        $this->breakMail();

        $order = $this->checkout($this->variant());

        $this->assertSame('pending', $order->status);
        $log = EmailLog::sole();
        $this->assertSame(['order_placed', 'failed', null], [$log->type, $log->status, $log->sent_at]);
        $this->assertStringContainsString('Máy chủ thư không trả lời.', (string) $log->error);
    }

    public function test_the_worker_comes_back_to_an_email_that_could_not_leave(): void
    {
        // As on the server: emails wait in the database queue for the worker.
        config(['queue.default' => 'database']);
        $this->breakMail();
        $this->post(route('register.store'), [
            'name' => 'Lê Thu Hà', 'email' => 'ha@example.com', 'password' => 'mat-khau-dai', 'password_confirmation' => 'mat-khau-dai',
        ])->assertRedirect();
        $this->assertSame(['queued'], EmailLog::pluck('status')->all());

        // The first try fails. Welcome and verification both wait their minute: not lost, not tried again at once.
        $this->work();
        $this->work();
        $this->assertSame([2, 0], [DB::table('jobs')->count(), DB::table('failed_jobs')->count()]);
        $this->assertSame(['queued'], EmailLog::pluck('status')->all());

        config(['mail.default' => 'array']);
        $this->travel(61)->seconds();
        $this->work();
        $this->assertEqualsCanonicalizing(
            ['Chào mừng bạn đến với '.config('app.name'), 'Xác minh địa chỉ email'],
            $this->outbox()->map(fn (Email $email) => $email->getSubject())->all(),
        );
        $this->assertSame(['verify_email' => 'sent', 'welcome' => 'sent'], EmailLog::orderBy('type')->pluck('status', 'type')->all());
        $this->assertSame(0, DB::table('jobs')->count());
    }

    public function test_after_three_tries_the_worker_gives_up_and_says_why(): void
    {
        config(['queue.default' => 'database']);
        $this->breakMail();
        $this->checkout($this->variant());

        foreach ([0 => 'queued', 61 => 'queued', 601 => 'failed'] as $seconds => $status) {
            $this->travel($seconds)->seconds();
            $this->work();
            $this->assertSame($status, EmailLog::sole()->status);
        }
        $this->assertStringContainsString('Máy chủ thư không trả lời.', (string) EmailLog::sole()->error);
        $this->assertSame([0, 1], [DB::table('jobs')->count(), DB::table('failed_jobs')->count()]);
    }

    public function test_two_staff_marking_an_order_shipped_at_once_send_one_email(): void
    {
        $service = $this->app->make(OrderService::class);
        $order = $service->transition($this->checkout($this->variant()), 'confirmed');

        // Both had the order open while it was still "confirmed".
        $service->transition(Order::findOrFail($order->id), 'shipped');
        $service->transition($order, 'shipped');

        $this->assertSame(['order_placed', 'order_shipped'], EmailLog::orderBy('id')->pluck('type')->all());
    }

    public function test_resend_gets_the_email_over_its_api_and_its_id_is_kept(): void
    {
        config(['mail.default' => 'resend', 'services.resend.key' => 're_test_key_123', 'mail.from' => ['address' => 'shop@example.com', 'name' => 'Shop Cầu Lông']]);
        Http::fake([ResendTransport::ENDPOINT => Http::response(['id' => '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'])]);
        $user = User::factory()->create(['email' => 'khach@example.com', 'name' => 'Trần Bình']);

        app(EmailService::class)->welcome($user);

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.resend.com/emails'
            && $request->hasHeader('Authorization', 'Bearer re_test_key_123')
            && $request['to'] === ['khach@example.com']
            && str_contains($request['from'], 'shop@example.com')
            && $request['subject'] === 'Chào mừng bạn đến với '.config('app.name')
            && str_contains($request['html'], 'Chào Trần Bình,')
            && trim($request['text']) !== '');
        $log = EmailLog::sole();
        $this->assertSame(['sent', '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'], [$log->status, $log->provider_message_id]);
    }

    public function test_a_refusal_from_resend_is_recorded_without_the_key(): void
    {
        config(['mail.default' => 'resend', 'services.resend.key' => 're_test_key_123']);
        Http::fake([ResendTransport::ENDPOINT => Http::response(['name' => 'validation_error', 'message' => 'The domain is not verified.'], 403)]);

        app(EmailService::class)->welcome(User::factory()->create());

        $log = EmailLog::sole();
        $this->assertSame('failed', $log->status);
        $this->assertStringContainsString('The domain is not verified.', (string) $log->error);
        $this->assertStringNotContainsString('re_test_key_123', (string) $log->error);
    }
}
