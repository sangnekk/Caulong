<?php

namespace Tests\Feature;

use App\Models\EmailLog;
use App\Models\ServiceOrder;
use App\Models\ServiceString;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\ShopSettings;
use App\Services\StringingService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Tests\TestCase;

/** The racket stringing service: asking for it, and the shop working the request. */
class StringingServiceTest extends TestCase
{
    use RefreshDatabase;

    /** @return Collection<int, Email> */
    private function outbox(): Collection
    {
        return app('mailer')->getSymfonyTransport()->messages()
            ->map(fn (SentMessage $message) => MessageConverter::toEmail($message->getOriginalMessage()))->values();
    }

    private function string(string $name = 'BG65', int $price = 150000, array $attributes = []): ServiceString
    {
        return ServiceString::create(array_merge(['name' => $name, 'brand' => 'Yonex', 'gauge' => '0.70 mm', 'price' => $price], $attributes));
    }

    /** Sends the form of the service page, with the token the page would have given it. */
    private function book(array $data = []): TestResponse
    {
        return $this->post(route('service-orders.store'), array_merge([
            'booking_token' => (string) Str::uuid(), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'email' => 'an@example.com', 'service_type' => 'own_string', 'racket' => 'Astrox 88D Pro',
            'tension_kg' => 11, 'quantity' => 1,
        ], $data));
    }

    public function test_the_service_page_offers_the_shops_own_strings_and_fee(): void
    {
        app(ShopSettings::class)->save(['stringing_fee' => 30000]);
        $dear = $this->string('Aerobite', 220000, ['gauge' => null]);
        $cheap = $this->string('BG65', 150000);
        $this->string('BG80', 180000, ['is_active' => false]);

        $this->get(route('services.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/services')
            ->where('shop.stringing', true)
            ->where('service.enabled', true)->where('service.fee', 30000)
            ->where('service.tension', ['min' => 8, 'max' => 15])->where('service.max_rackets', 10)
            // Only what the shop strings with now, the cheapest first.
            ->where('service.strings', [
                ['id' => $cheap->id, 'label' => 'Yonex BG65 (0.70 mm)', 'price' => 150000],
                ['id' => $dear->id, 'label' => 'Yonex Aerobite', 'price' => 220000],
            ])
            ->where('bookingToken', fn (string $token) => Str::isUuid($token)));
    }

    public function test_a_visitor_asks_for_stringing_and_the_shop_works_out_the_price(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-10 02:00:00'));
        app(ShopSettings::class)->save(['stringing_fee' => 30000]);
        $string = $this->string();

        $response = $this->book([
            'service_type' => 'shop_string', 'service_string_id' => $string->id, 'tension_kg' => '11.5', 'quantity' => 2,
            'preferred_at' => '2026-10-12T15:30', 'notes' => 'Đan 4 nút',
            // Nothing the browser says about money is listened to.
            'total' => 1, 'string_price' => 1, 'labor_fee' => 1, 'status' => 'completed',
        ]);

        $order = ServiceOrder::sole();
        $response->assertRedirect(route('service-orders.show', ['serviceOrder' => $order->public_id]));
        $this->assertSame(
            ['Nguyễn An', '0901234567', 'shop_string', 'Astrox 88D Pro', $string->id, 'Yonex BG65 (0.70 mm)', 11.5, 2, 150000, 30000, 360000, 'pending', null],
            array_values($order->only(['name', 'phone', 'service_type', 'racket', 'service_string_id', 'string_name', 'tension_kg', 'quantity', 'string_price', 'labor_fee', 'total', 'status', 'user_id'])),
        );
        // Half past three in the shop (UTC+7).
        $this->assertSame('2026-10-12 08:30:00', $order->preferred_at->toDateTimeString());

        // Their own page: for the session that asked, and nobody passing by.
        $this->get(route('service-orders.show', ['serviceOrder' => $order->public_id]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/service-order')->where('justPlaced', true)
            ->where('order.code', $order->code)->where('order.status', 'pending')->where('order.total', 360000)
            ->where('order.tension_kg', 11.5)->where('order.notes', 'Đan 4 nút')
            ->missing('order.booking_token'));

        $email = $this->outbox()->sole();
        $this->assertSame(['an@example.com', 'Đã nhận yêu cầu đan dây '.$order->code], [$email->getTo()[0]->getAddress(), $email->getSubject()]);
        $html = (string) $email->getHtmlBody();
        foreach (['Astrox 88D Pro × 2', 'Yonex BG65 (0.70 mm)', '11,5 kg', '360.000 ₫', 'Theo dõi yêu cầu'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }
        $this->assertSame(['service_placed', 'sent'], array_values(EmailLog::sole()->only(['type', 'status'])));

        // The link in the email opens it on another device; a link to another request does not.
        preg_match('~href="'.preg_quote(config('app.frontend_url'), '~').'(/service-orders/[^"]+)"~', $html, $found);
        $link = html_entity_decode($found[1]);
        $this->flushSession();
        $this->get('/service-orders/'.$order->public_id)->assertNotFound();
        $this->get($link)->assertOk();
        $this->get(str_replace($order->public_id, (string) Str::uuid(), $link))->assertNotFound();
    }

    public function test_the_same_form_sent_twice_makes_one_request(): void
    {
        // A visitor's first request: nothing was kept for them when the page was built (their
        // browser had no session yet), and nothing needs to have been.
        $token = (string) Str::uuid();
        $first = $this->book(['booking_token' => $token]);
        $first->assertSessionHasNoErrors();

        // A double click, or the browser trying again: the request already made.
        $this->book(['booking_token' => $token])->assertRedirect($first->headers->get('Location'));
        $this->assertSame([1, 1], [ServiceOrder::count(), EmailLog::count()]);

        // The token is no way to somebody else's request: another browser sending it is refused.
        $this->flushSession();
        $this->book(['booking_token' => $token, 'name' => 'Người khác'])->assertSessionHasErrors('booking_token');
        $this->book(['booking_token' => 'khong-phai-ma'])->assertSessionHasErrors('booking_token');
        $this->assertSame(1, ServiceOrder::count());
    }

    public function test_what_the_form_takes_and_what_it_refuses(): void
    {
        // More tries than a visitor gets in a minute: the limit is not what is looked at here.
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->travelTo(CarbonImmutable::parse('2026-10-10 02:00:00'));
        $retired = $this->string('BG80', 180000, ['is_active' => false]);

        foreach ([
            ['phone' => '12345'], ['name' => ''], ['racket' => ''], ['email' => 'khong-phai-email'], ['service_type' => 'new_grip'],
            ['tension_kg' => 7.5], ['tension_kg' => 15.5], ['tension_kg' => 10.3], ['quantity' => 0], ['quantity' => 11],
            // The shop's string has to be one it still strings with.
            ['service_type' => 'shop_string'], ['service_type' => 'shop_string', 'service_string_id' => $retired->id],
            ['service_type' => 'shop_string', 'service_string_id' => 9999],
            // A visit in the past (it is nine in the morning in the shop), or months away.
            ['preferred_at' => '2026-10-10T08:00'], ['preferred_at' => '2026-12-25T10:00'], ['preferred_at' => 'mai'],
        ] as $wrong) {
            $this->book($wrong)->assertSessionHasErrors(array_key_last($wrong) === 'service_type' && count($wrong) === 1 && $wrong['service_type'] === 'shop_string' ? 'service_string_id' : array_key_last($wrong));
        }
        $this->assertSame(0, ServiceOrder::count());

        // Their own string: only the stringing is charged, and with no fee set the shop says the price in person.
        $this->book(['string_name' => 'Dây Kizuna Z58', 'quantity' => 3, 'email' => ''])->assertSessionHasNoErrors();
        $order = ServiceOrder::sole();
        $this->assertSame(['own_string', null, 'Dây Kizuna Z58', 0, 0, 0, null], array_values($order->only(['service_type', 'service_string_id', 'string_name', 'string_price', 'labor_fee', 'total', 'email'])));
        // No address to write to: no email, and the request stands all the same.
        $this->assertSame(0, EmailLog::count());

        app(ShopSettings::class)->save(['stringing_fee' => 40000]);
        $this->app->forgetScopedInstances();
        $this->book(['quantity' => 3, 'preferred_at' => '2026-10-10T09:30'])->assertSessionHasNoErrors();
        $this->assertSame(120000, ServiceOrder::latest('id')->first()->total);
    }

    public function test_a_signed_in_customers_requests_are_on_their_account(): void
    {
        $customer = User::factory()->create(['email' => 'khach@example.com']);
        $this->actingAs($customer)->book(['email' => ''])->assertSessionHasNoErrors();
        $order = ServiceOrder::sole();
        $this->assertSame($customer->id, $order->user_id);
        // Without an address on the form, the account's is written to.
        $this->assertSame('khach@example.com', EmailLog::sole()->recipient);

        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->has('serviceOrders', 1)->where('serviceOrders.0.code', $order->code)->where('serviceOrders.0.racket', 'Astrox 88D Pro')
            ->where('serviceOrders.0.status', 'pending'));

        // On another device it is theirs still; another customer cannot open it.
        $this->flushSession();
        $this->actingAs($customer)->get('/service-orders/'.$order->public_id)->assertOk();
        $this->flushSession();
        $this->actingAs(User::factory()->create())->get('/service-orders/'.$order->public_id)->assertNotFound();

        // Staff taking a request at the counter do not become its customer.
        $this->flushSession();
        $this->actingAs(User::factory()->create(['is_admin' => true]))->book(['name' => 'Khách tại quầy'])->assertSessionHasNoErrors();
        $this->assertNull(ServiceOrder::latest('id')->first()->user_id);
    }

    public function test_the_shop_works_a_request_and_tells_the_customer_when_the_racket_is_ready(): void
    {
        $this->book();
        $order = ServiceOrder::sole();
        $admin = User::factory()->create(['is_admin' => true]);
        $move = fn (string $status) => $this->actingAs($admin)->patch('/admin/service-orders/'.$order->id, ['status' => $status]);

        // One step at a time.
        $move('ready')->assertSessionHasErrors('status');
        $move('completed')->assertSessionHasErrors('status');
        $move('confirmed')->assertSessionHasNoErrors();
        $move('in_progress')->assertSessionHasNoErrors();
        $this->assertSame(1, $this->outbox()->count());
        $move('ready')->assertSessionHasNoErrors();
        // Pressed again from a page that was still open: one email, not two.
        $move('ready')->assertSessionHasNoErrors();
        app(StringingService::class)->transition($order, 'ready');

        $ready = $this->outbox()->last();
        $this->assertSame('Vợt của bạn đã đan xong ('.$order->code.')', $ready->getSubject());
        $this->assertSame(['service_placed', 'service_ready'], EmailLog::orderBy('id')->pluck('type')->all());

        // Ready to collect: it can be handed back, no longer cancelled.
        $move('cancelled')->assertSessionHasErrors('status');
        $move('completed')->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame('completed', $order->status);
        foreach (['confirmed_at', 'in_progress_at', 'ready_at', 'completed_at'] as $step) {
            $this->assertNotNull($order->{$step}, $step);
        }
        $this->assertNull($order->cancelled_at);
        $move('cancelled')->assertSessionHasErrors('status');

        // A request cancelled while the racket is in: the customer is told.
        $this->book(['name' => 'Trần Bình']);
        $second = ServiceOrder::latest('id')->first();
        $this->actingAs($admin)->patch('/admin/service-orders/'.$second->id, ['status' => 'confirmed']);
        $this->patch('/admin/service-orders/'.$second->id, ['status' => 'cancelled'])->assertSessionHasNoErrors();
        $this->assertSame('Yêu cầu đan dây '.$second->code.' đã hủy', $this->outbox()->last()->getSubject());
        $this->assertNotNull($second->refresh()->cancelled_at);
    }

    public function test_the_shop_lists_requests_and_settles_who_strings_and_what_is_paid(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'name' => 'Chủ Shop']);
        $technician = User::factory()->create(['is_admin' => true, 'name' => 'Anh Thợ']);
        $technician->forceFill(['role' => 'support'])->save();
        $customer = User::factory()->create();
        $this->book(['name' => 'Lê Thu Hà', 'phone' => '0912345678']);
        $this->book(['name' => 'Trần Bình', 'phone' => '0987654321']);
        $this->book(['name' => 'Lê Thu Hà', 'phone' => '0912345678', 'racket' => 'Nanoflare 700']);
        [$first, $second, $third] = ServiceOrder::orderBy('id')->get()->all();
        app(StringingService::class)->transition($second, 'confirmed');

        $this->actingAs($admin)->get('/admin/service-orders')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/service-orders')->has('orders.data', 3)
            ->where('orders.data.0.id', $third->id)->where('orders.data.0.code', $third->code)
            ->where('counts', ['all' => 3, 'pending' => 2, 'confirmed' => 1, 'in_progress' => 0, 'ready' => 0, 'completed' => 0, 'cancelled' => 0])
            // The menu counts what the shop has not answered yet.
            ->where('shop.pending_service_orders', 2));
        $ids = fn (array $expected) => fn (Assert $page) => $page->where('orders.data', fn ($rows) => collect($rows)->pluck('id')->sort()->values()->all() === $expected);
        $this->get('/admin/service-orders?status=confirmed')->assertInertia($ids([$second->id]));
        $this->get('/admin/service-orders?q=0912345678')->assertInertia($ids([$first->id, $third->id]));
        $this->get('/admin/service-orders?q=Bình')->assertInertia($ids([$second->id]));
        $this->get('/admin/service-orders?q=%23'.$first->id)->assertInertia($ids([$first->id]));
        $this->get('/admin/service-orders?q='.strtolower($third->code))->assertInertia($ids([$third->id]));
        $this->get('/admin/service-orders?status=lost')->assertSessionHasErrors('status');

        $this->get('/admin/service-orders/'.$third->id)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/service-order')->where('order.racket', 'Nanoflare 700')->where('order.customer', null)
            ->where('staff', [['id' => $technician->id, 'name' => 'Anh Thợ'], ['id' => $admin->id, 'name' => 'Chủ Shop']])
            // The same phone asked before.
            ->has('related', 1)->where('related.0.id', $first->id));

        // Who strings it: someone on the staff, nobody else.
        $this->patch('/admin/service-orders/'.$third->id, ['technician_id' => $customer->id])->assertSessionHasErrors('technician_id');
        $this->patch('/admin/service-orders/'.$third->id, ['technician_id' => $technician->id])->assertSessionHasNoErrors();
        // What is paid, settled when the racket is handed in.
        $this->patch('/admin/service-orders/'.$third->id, ['total' => -1])->assertSessionHasErrors('total');
        $this->patch('/admin/service-orders/'.$third->id, ['total' => 50000])->assertSessionHasNoErrors();
        $this->assertSame([$technician->id, 50000, 'pending'], array_values($third->refresh()->only(['technician_id', 'total', 'status'])));
        $this->get('/admin/service-orders')->assertInertia(fn (Assert $page) => $page->where('orders.data.0.technician_name', 'Anh Thợ'));

        // A finished request is a record: nothing about it changes any more.
        foreach (['confirmed', 'in_progress', 'ready', 'completed'] as $status) {
            app(StringingService::class)->transition($third->refresh(), $status);
        }
        $this->patch('/admin/service-orders/'.$third->id, ['total' => 1])->assertSessionHasErrors('status');
        $this->assertSame(50000, $third->refresh()->total);
    }

    public function test_the_shop_keeps_its_own_list_of_strings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($admin)->post('/admin/service-strings', ['name' => ' BG65 ', 'brand' => 'Yonex', 'gauge' => '0.70 mm', 'price' => 150000, 'is_active' => true])
            ->assertSessionHas('success', 'Đã thêm dây Yonex BG65 (0.70 mm).');
        $string = ServiceString::sole();
        $this->post('/admin/service-strings', ['name' => 'BG65', 'price' => 1, 'is_active' => true])->assertSessionHasErrors('name');
        $this->post('/admin/service-strings', ['name' => 'BG80', 'price' => -5, 'is_active' => true])->assertSessionHasErrors('price');
        $this->post('/admin/service-strings', ['name' => '', 'price' => 5, 'is_active' => true])->assertSessionHasErrors('name');

        // A request keeps the string's name and price as they were when it was made.
        $this->book(['service_type' => 'shop_string', 'service_string_id' => $string->id])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/admin/service-strings/'.$string->id, ['name' => 'BG65 Titanium', 'brand' => 'Yonex', 'gauge' => '', 'price' => 170000, 'is_active' => false])
            ->assertSessionHasNoErrors();
        $this->assertSame(['Yonex BG65 (0.70 mm)', 150000], array_values(ServiceOrder::sole()->only(['string_name', 'string_price'])));

        $this->get('/admin/service-strings')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/service-strings')->has('strings', 1)
            ->where('strings.0.label', 'Yonex BG65 Titanium')->where('strings.0.price', 170000)
            ->where('strings.0.is_active', false)->where('strings.0.requests', 1));
        // Switched off: no longer offered, and no longer bookable.
        $this->get(route('services.index'))->assertInertia(fn (Assert $page) => $page->where('service.strings', []));
        $this->book(['service_type' => 'shop_string', 'service_string_id' => $string->id])->assertSessionHasErrors('service_string_id');
    }

    public function test_the_owner_sets_the_fee_and_can_stop_taking_requests(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $base = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000];
        $this->actingAs($admin)->get('/admin/settings')->assertInertia(fn (Assert $page) => $page
            ->where('settings.stringing_enabled', true)->where('settings.stringing_fee', 0));
        $this->put('/admin/settings', $base + ['stringing_fee' => -1])->assertSessionHasErrors('stringing_fee');
        $this->put('/admin/settings', $base + ['stringing_enabled' => false, 'stringing_fee' => 35000])->assertSessionHasNoErrors();
        $this->app->forgetScopedInstances();

        $this->get(route('services.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('service.enabled', false)->where('service.fee', 35000)->where('shop.stringing', false));
        $this->book()->assertSessionHasErrors('booking_token');
        $this->assertSame(0, ServiceOrder::count());
    }

    public function test_staff_see_a_customers_requests_where_they_look_the_customer_up(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $customer = User::factory()->create();
        $this->actingAs($customer)->book();
        $order = ServiceOrder::sole();
        $conversation = SupportConversation::create(['session_key' => Str::random(64), 'user_id' => $customer->id, 'needs_human' => true]);
        $conversation->messages()->create(['sender' => 'customer', 'body' => 'Vợt mình đan xong chưa shop?']);

        $this->actingAs($admin)->get('/admin/customers/'.$customer->id.'?tab=services')->assertInertia(fn (Assert $page) => $page
            ->where('tab', 'services')->has('services', 1)->where('services.0.id', $order->id)->where('services.0.code', $order->code));
        // Next to the conversation, where the question about the racket is asked.
        $this->get('/admin/support-chat?conversation='.$conversation->id)->assertInertia(fn (Assert $page) => $page
            ->has('context.services', 1)->where('context.services.0.code', $order->code)->where('context.services.0.status', 'pending'));
        $this->get('/admin/service-orders/'.$order->id)->assertInertia(fn (Assert $page) => $page
            ->where('order.customer.id', $customer->id));
    }
}
