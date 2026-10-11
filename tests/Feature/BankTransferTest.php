<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\ShopSettings;
use App\Support\VietQr;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Tests\TestCase;

/**
 * Paying by bank transfer: the customer places the order and transfers the money, the shop
 * confirms it arrived, and only then is the order confirmed. An order that is never paid
 * gives its goods back.
 */
class BankTransferTest extends TestCase
{
    use RefreshDatabase;

    /** The shop's account, as the owner would enter it. */
    private function account(array $overrides = []): void
    {
        app(ShopSettings::class)->save(array_merge([
            'bank_transfer_enabled' => 1, 'bank_bin' => '970436',
            'bank_account_number' => '0123456789', 'bank_account_name' => 'NGUYEN VAN A',
        ], $overrides));
    }

    private function variant(int $stock = 5, int $price = 790000, bool $demo = false): ProductVariant
    {
        $product = Product::create([
            'name' => 'Vợt thử nghiệm', 'slug' => 'vot-'.Str::uuid(), 'description' => 'Dữ liệu kiểm thử',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => $demo,
        ]);

        return $product->variants()->create(['sku' => 'TEST-'.Str::uuid(), 'name' => '4U', 'price' => $price, 'stock' => $stock, 'is_active' => true]);
    }

    /** Places an order for two of the racket, paid by transfer unless told otherwise. */
    private function order(ProductVariant $variant, array $overrides = []): Order
    {
        $this->withSession(['shopping_cart' => [$variant->id => 2]])->get('/checkout')->assertOk();
        $this->post('/checkout', array_merge([
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'address' => '12 Nguyễn Huệ, TP. Hồ Chí Minh', 'email' => 'an@example.com',
            'payment_method' => 'bank_transfer', 'accept_terms' => true,
        ], $overrides))->assertSessionHasNoErrors()->assertRedirect();

        return Order::latest('id')->firstOrFail();
    }

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true, 'name' => 'Chủ Shop']);
    }

    /** @return Collection<int, Email> */
    private function outbox(): Collection
    {
        return app('mailer')->getSymfonyTransport()->messages()
            ->map(fn (SentMessage $message) => MessageConverter::toEmail($message->getOriginalMessage()))->values();
    }

    public function test_the_qr_code_is_the_one_banking_apps_read(): void
    {
        // What api.vietqr.io made of the same account, amount and reference on 2026-10-11.
        $this->assertSame(
            '00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA5303704540715800005802VN62140810DH94B697306304061B',
            VietQr::payload('970436', '0123456789', 1580000, 'DH94B69730'),
        );
        // Without an amount it is a code for any payment to the account.
        $static = VietQr::payload('970436', '0123456789');
        $this->assertStringStartsWith('000201010211', $static);
        $this->assertStringNotContainsString('5802VN62', $static);
        $this->assertMatchesRegularExpression('/6304[0-9A-F]{4}$/', $static);
        $this->assertStringStartsWith('data:image/svg+xml;base64,', VietQr::image($static));
    }

    public function test_a_transfer_is_offered_only_once_the_owner_has_entered_an_account(): void
    {
        $variant = $this->variant();
        $methods = fn () => $this->withSession(['shopping_cart' => [$variant->id => 1]])->get('/checkout')->viewData('page')['props']['paymentMethods'];
        $this->assertSame(['cod'], array_column($methods(), 'id'));

        // Switched on without an account, or with a bank the QR code does not know: still not offered.
        app(ShopSettings::class)->save(['bank_transfer_enabled' => 1]);
        $this->assertSame(['cod'], array_column($methods(), 'id'));
        $this->account(['bank_bin' => '000000']);
        $this->assertSame(['cod'], array_column($methods(), 'id'));
        $token = session('checkout_token');
        $this->post('/checkout', [
            'checkout_token' => $token, 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'payment_method' => 'bank_transfer', 'accept_terms' => true,
        ])->assertSessionHasErrors('payment_method');
        $this->assertDatabaseCount('orders', 0);

        $this->account();
        $this->assertSame(['cod', 'bank_transfer'], array_column($methods(), 'id'));
        // Switched off again: the account stays saved, the checkout goes back to cash on delivery.
        app(ShopSettings::class)->save(['bank_transfer_enabled' => 0]);
        $this->assertSame(['cod'], array_column($methods(), 'id'));
    }

    public function test_no_money_is_asked_for_sample_goods(): void
    {
        $this->account();
        $sample = $this->variant(demo: true);
        $this->withSession(['shopping_cart' => [$sample->id => 1]])->get('/checkout')
            ->assertInertia(fn (Assert $page) => $page->has('paymentMethods', 1)->where('paymentMethods.0.id', 'cod'));
        $this->post('/checkout', [
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'payment_method' => 'bank_transfer', 'accept_terms' => true,
        ])->assertSessionHasErrors('payment_method');
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $sample->fresh()->stock);
    }

    public function test_an_order_paid_by_transfer_waits_for_its_money_with_the_goods_held(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-11 03:00:00'));
        $this->account();
        $variant = $this->variant();
        $order = $this->order($variant);

        $this->assertSame(['bank_transfer', 'unpaid', 'pending', 1580000], [$order->payment_method, $order->payment_status, $order->status, $order->total]);
        $this->assertSame(3, $variant->fresh()->stock);
        $payment = Payment::sole();
        $this->assertSame([$order->id, 'bank_transfer', 1580000, 'pending', 'DH'.$order->code], [
            $payment->order_id, $payment->method, $payment->amount, $payment->status, $payment->reference,
        ]);
        // Held for a day unless the owner says otherwise.
        $this->assertTrue($payment->expires_at->equalTo(now()->addHours(24)));

        // The order's page tells the customer where to pay, how much, and what to write.
        $this->get('/orders/'.$order->public_id)->assertInertia(fn (Assert $page) => $page->component('shop/order', false)
            ->where('order.payment_method', 'bank_transfer')
            ->where('payment.status', 'pending')->where('payment.amount', 1580000)->where('payment.reference', $payment->reference)
            ->where('payment.account.bank', 'Vietcombank')->where('payment.account.number', '0123456789')->where('payment.account.name', 'NGUYEN VAN A')
            ->where('payment.account.qr', VietQr::image(VietQr::payload('970436', '0123456789', 1580000, $payment->reference)))
            // Nothing of the shop's own bookkeeping goes to the customer's page.
            ->missing('payment.id')->missing('payment.payload'));

        // A token that is not text is a wrong token, not a crash.
        $this->post('/checkout', ['checkout_token' => ['x'], 'payment_method' => 'bank_transfer'])->assertSessionHasErrors('checkout_token');

        // So does the email, without the picture.
        $this->assertSame(['order_placed'], EmailLog::pluck('type')->all());
        $html = (string) $this->outbox()->sole()->getHtmlBody();
        foreach (['Vietcombank', '0123456789', 'NGUYEN VAN A', '1.580.000 ₫', $payment->reference, '10:00 12/10/2026'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }
        $this->assertStringNotContainsString('cho người giao khi nhận hàng', $html);

        // The same form sent twice is one order and one payment.
        $this->post('/checkout', [
            'checkout_token' => $order->checkout_token, 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'payment_method' => 'bank_transfer', 'accept_terms' => true,
        ])->assertRedirect('/orders/'.$order->public_id);
        $this->assertSame([1, 1], [Order::count(), Payment::count()]);
    }

    public function test_cash_on_delivery_is_as_it_was(): void
    {
        $this->account();
        $order = $this->order($this->variant(), ['payment_method' => 'cod']);
        $this->assertSame('cod', $order->payment_method);
        $this->assertDatabaseCount('payments', 0);
        $this->get('/orders/'.$order->public_id)->assertInertia(fn (Assert $page) => $page->where('payment', null));
        $this->assertStringContainsString('cho người giao khi nhận hàng', (string) $this->outbox()->sole()->getHtmlBody());
    }

    public function test_the_shop_confirms_the_money_and_the_order_is_confirmed(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-11 03:00:00'));
        $this->account();
        $order = $this->order($this->variant());
        $payment = Payment::sole();
        $admin = $this->admin();
        $this->actingAs($admin);

        // Not by a status change: a transfer is confirmed by its money.
        $this->patch(route('admin.orders.update', $order), ['status' => 'confirmed'])->assertSessionHasErrors('status');
        $this->assertSame('pending', $order->fresh()->status);

        $this->get(route('admin.orders.show', $order))->assertInertia(fn (Assert $page) => $page
            ->where('payment.id', $payment->id)->where('payment.status', 'pending')->where('payment.reference', $payment->reference)
            ->where('payment.amount', 1580000)->where('payment.confirmed_by', null));

        $this->travelTo(now()->addHour());
        $this->post(route('admin.orders.payments.confirm', [$order, $payment]))->assertSessionHasNoErrors()->assertRedirect();
        $order->refresh();
        $payment->refresh();
        $this->assertSame(['paid', 'confirmed'], [$order->payment_status, $order->status]);
        $this->assertTrue($order->paid_at->equalTo(now()) && $order->confirmed_at->equalTo(now()));
        $this->assertSame(['paid', $admin->id], [$payment->status, $payment->confirmed_by]);
        $this->assertTrue($payment->paid_at->equalTo(now()));

        // The customer is told once, however often the button is pressed.
        $this->post(route('admin.orders.payments.confirm', [$order, $payment]))->assertSessionHasNoErrors();
        $this->assertSame(['order_placed', 'order_paid'], EmailLog::orderBy('id')->pluck('type')->all());
        $paid = (string) $this->outbox()->last()->getHtmlBody();
        $this->assertStringContainsString('1.580.000 ₫', $paid);
        $this->assertStringContainsString('không cần trả thêm gì khi nhận hàng', $paid);

        // Paid: the account is no longer shown to the customer, and the money counts as collected.
        $this->get(route('admin.orders.show', $order))->assertInertia(fn (Assert $page) => $page
            ->where('payment.status', 'paid')->where('payment.confirmed_by', 'Chủ Shop'));
        $this->get('/orders/'.$order->public_id)->assertInertia(fn (Assert $page) => $page
            ->where('payment.status', 'paid')->where('payment.account', null)->where('order.payment_status', 'paid'));

        // From here it is an order like any other.
        $this->patch(route('admin.orders.update', $order), ['status' => 'shipped'])->assertSessionHasNoErrors();
        $this->assertSame('shipped', $order->fresh()->status);
        $this->assertStringContainsString('không cần trả thêm gì khi nhận hàng', (string) $this->outbox()->last()->getHtmlBody());
        // Its money is not cash on delivery to be collected again.
        $this->patch(route('admin.orders.update', $order), ['status' => 'delivered']);
        $this->post(route('admin.orders.collected', $order))->assertSessionHasErrors('payment_status');
    }

    public function test_a_payment_is_confirmed_only_through_its_own_order_and_only_by_the_shop(): void
    {
        $this->account();
        $order = $this->order($this->variant());
        $other = $this->order($this->variant());
        $payment = $order->payment;

        // Nobody but the shop's staff.
        $this->post(route('admin.orders.payments.confirm', [$order, $payment]))->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->post(route('admin.orders.payments.confirm', [$order, $payment]))->assertForbidden();
        $this->actingAs(User::factory()->create(['is_admin' => true, 'role' => 'support']))
            ->post(route('admin.orders.payments.confirm', [$order, $payment]))->assertForbidden();
        // Not through another order's address.
        $this->actingAs($this->admin())->post(route('admin.orders.payments.confirm', [$other, $payment]))->assertNotFound();
        $this->post(route('admin.orders.payments.refund', [$other, $payment]))->assertNotFound();
        $this->assertSame(['pending', 'pending'], Payment::orderBy('id')->pluck('status')->all());
    }

    public function test_an_order_never_paid_is_cancelled_and_its_goods_go_back_on_sale(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-11 03:00:00'));
        $this->account(['bank_transfer_hold_hours' => 2]);
        $variant = $this->variant();
        $coupon = Coupon::create(['code' => 'GIAM50', 'name' => 'Giảm 50k', 'type' => 'fixed', 'value' => 50000, 'usage_limit' => 1, 'is_active' => true]);
        $this->withSession(['cart_coupon' => 'GIAM50']);
        $late = $this->order($variant);
        $this->assertSame(1530000, $late->total);
        $this->assertSame(1, $coupon->redemptions()->count());

        $this->travelTo(now()->addMinutes(90));
        $paid = $this->order($this->variant(), ['email' => 'binh@example.com']);
        $waiting = $this->order($this->variant(), ['email' => 'chi@example.com']);
        app(PaymentService::class)->settle($paid->payment, $this->admin());

        // Not yet: the first order has half an hour left.
        $this->artisan('orders:cancel-unpaid')->assertSuccessful();
        $this->assertSame(['pending', 'confirmed', 'pending'], Order::orderBy('id')->pluck('status')->all());

        $this->travelTo(now()->addMinutes(31));
        $this->artisan('orders:cancel-unpaid')->assertSuccessful();
        $this->assertSame(['cancelled', 'confirmed', 'pending'], Order::orderBy('id')->pluck('status')->all());
        $this->assertSame(['expired', 'paid', 'pending'], Payment::orderBy('id')->pluck('status')->all());
        // The goods and the coupon's one use are free again.
        $this->assertSame(5, $variant->fresh()->stock);
        $this->assertSame(0, $coupon->redemptions()->count());
        $this->assertSame('unpaid', $late->fresh()->payment_status);

        // The customer is told why, and what to do if the money was sent after all.
        $cancelled = (string) $this->outbox()->last()->getHtmlBody();
        $this->assertSame('an@example.com', $this->outbox()->last()->getTo()[0]->getAddress());
        $this->assertStringContainsString('chưa nhận được tiền chuyển khoản trong thời hạn', $cancelled);
        $this->assertStringContainsString($late->payment->reference, $cancelled);
        $this->get('/orders/'.$late->public_id)->assertInertia(fn (Assert $page) => $page
            ->where('order.status', 'cancelled')->where('payment.status', 'expired')->where('payment.account', null));

        // Money that arrives for an order already cancelled is not booked onto it.
        $this->expectException(ValidationException::class);
        app(PaymentService::class)->settle($late->payment);
    }

    public function test_cancelling_an_unpaid_order_drops_its_payment(): void
    {
        $this->account();
        $variant = $this->variant();
        $order = $this->order($variant);
        $this->actingAs($this->admin())->patch(route('admin.orders.update', $order), ['status' => 'cancelled'])->assertSessionHasNoErrors();
        $this->assertSame(['cancelled', 'cancelled', 5], [$order->fresh()->status, Payment::sole()->status, $variant->fresh()->stock]);
        // Not an expiry: the email does not say the money was missed.
        $this->assertStringNotContainsString('trong thời hạn', (string) $this->outbox()->last()->getHtmlBody());
        $this->post(route('admin.orders.payments.confirm', [$order, $order->payment]))->assertSessionHasErrors('payment');
        $this->artisan('orders:cancel-unpaid')->assertSuccessful();
        $this->assertSame('cancelled', Payment::sole()->status);
    }

    public function test_a_paid_order_is_cancelled_only_by_sending_the_money_back(): void
    {
        $this->account();
        $variant = $this->variant();
        $order = $this->order($variant);
        $payment = $order->payment;
        $admin = $this->admin();
        $this->actingAs($admin);

        // Nothing to send back before anything was received.
        $this->post(route('admin.orders.payments.refund', [$order, $payment]))->assertSessionHasErrors('payment');
        $this->post(route('admin.orders.payments.confirm', [$order, $payment]));

        // Paid: not cancelled by a status change, which would leave the customer's money with the shop.
        $this->patch(route('admin.orders.update', $order), ['status' => 'cancelled'])->assertSessionHasErrors('status');
        $this->assertSame(['confirmed', 3], [$order->fresh()->status, $variant->fresh()->stock]);

        $this->post(route('admin.orders.payments.refund', [$order, $payment]))->assertSessionHasNoErrors();
        $order->refresh();
        $payment->refresh();
        $this->assertSame(['cancelled', 'refunded', null], [$order->status, $order->payment_status, $order->paid_at]);
        $this->assertSame(['refunded', $admin->id], [$payment->status, $payment->refunded_by]);
        $this->assertNotNull($payment->paid_at);
        $this->assertSame(5, $variant->fresh()->stock);
        // Said twice, done once.
        $this->post(route('admin.orders.payments.refund', [$order, $payment]))->assertSessionHasNoErrors();
        $this->assertSame(['order_placed', 'order_paid', 'order_cancelled'], EmailLog::orderBy('id')->pluck('type')->all());
        $this->assertStringContainsString('đã chuyển trả', (string) $this->outbox()->last()->getHtmlBody());

        // Money sent back is no longer money collected.
        $this->get(route('admin.reports'))->assertInertia(fn (Assert $page) => $page->where('totals.collected', 0));
        $this->get(route('admin.orders.show', $order))->assertInertia(fn (Assert $page) => $page
            ->where('payment.status', 'refunded')->where('payment.refunded_by', 'Chủ Shop'));
    }

    public function test_goods_that_have_left_are_not_refunded_here(): void
    {
        $this->account();
        $order = $this->order($this->variant());
        $this->actingAs($this->admin());
        $this->post(route('admin.orders.payments.confirm', [$order, $order->payment]));
        $this->patch(route('admin.orders.update', $order), ['status' => 'shipped']);
        $this->post(route('admin.orders.payments.refund', [$order, $order->payment]))->assertSessionHasErrors('payment');
        $this->assertSame(['shipped', 'paid'], [$order->fresh()->status, $order->fresh()->payment_status]);
    }

    public function test_a_report_from_a_bank_settles_one_payment_once(): void
    {
        $this->account();
        $payments = app(PaymentService::class);
        $first = $this->order($this->variant())->payment;
        $second = $this->order($this->variant())->payment;

        // The amount is the order's, to the dong.
        try {
            $payments->settle($first, amount: $first->amount - 1000, transaction: 'FT26284000001');
            $this->fail('A short transfer was accepted.');
        } catch (ValidationException $refused) {
            $this->assertSame('pending', $first->fresh()->status);
        }
        $payments->settle($first, amount: $first->amount, transaction: 'FT26284000001', payload: ['bank' => 'VCB']);
        $this->assertSame(['paid', 'FT26284000001', null], [$first->fresh()->status, $first->fresh()->provider_transaction_id, $first->fresh()->confirmed_by]);
        // The same report again changes nothing.
        $payments->settle($first, amount: $first->amount, transaction: 'FT26284000001');
        $this->assertSame(1, EmailLog::where('type', 'order_paid')->count());

        // One transfer cannot pay for two orders.
        try {
            $payments->settle($second, amount: $second->amount, transaction: 'FT26284000001');
            $this->fail('One transfer settled two payments.');
        } catch (QueryException) {
            $this->assertSame(['pending', 'pending'], [$second->fresh()->status, $second->order->fresh()->status]);
        }
    }

    public function test_the_owner_enters_the_account_in_the_settings(): void
    {
        $this->actingAs($this->admin());
        $base = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000];
        $this->get(route('admin.settings.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('settings.bank_transfer_enabled', false)->where('settings.bank_transfer_hold_hours', 24)
            ->where('settings.bank_account_number', '')->where('bankQr', null)
            ->where('banks', fn ($banks) => collect($banks)->contains(fn ($bank) => $bank === ['bin' => '970436', 'name' => 'Vietcombank'])));

        // Switched on, it needs somewhere to pay.
        $this->put(route('admin.settings.update'), $base + ['bank_transfer_enabled' => true, 'bank_bin' => '', 'bank_account_number' => '', 'bank_account_name' => ''])
            ->assertSessionHasErrors(['bank_bin', 'bank_account_number', 'bank_account_name']);
        $this->put(route('admin.settings.update'), $base + ['bank_transfer_enabled' => true, 'bank_bin' => '123456', 'bank_account_number' => '01 23', 'bank_account_name' => 'A <b>', 'bank_transfer_hold_hours' => 0])
            ->assertSessionHasErrors(['bank_bin', 'bank_account_number', 'bank_account_name', 'bank_transfer_hold_hours']);
        $this->assertFalse(app(ShopSettings::class)->bankTransfer()['ready']);

        $this->put(route('admin.settings.update'), $base + ['bank_transfer_enabled' => true, 'bank_bin' => '970422', 'bank_account_number' => ' 0987654321 ', 'bank_account_name' => 'Trần Thị B', 'bank_transfer_hold_hours' => 48])
            ->assertSessionHasNoErrors();
        $this->assertSame(
            ['enabled' => true, 'ready' => true, 'hold_hours' => 48, 'bin' => '970422', 'bank' => 'MB Bank', 'account_number' => '0987654321', 'account_name' => 'TRẦN THỊ B'],
            app(ShopSettings::class)->bankTransfer(),
        );
        // The saved account as a code the owner can scan to see whose it is.
        $this->get(route('admin.settings.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('bankQr', VietQr::image(VietQr::payload('970422', '0987654321'))));
        // A save that does not mention the account leaves it alone.
        $this->put(route('admin.settings.update'), $base)->assertSessionHasNoErrors();
        $this->assertTrue(app(ShopSettings::class)->bankTransfer()['ready']);
    }

    public function test_the_shop_finds_orders_by_what_the_transfer_says(): void
    {
        $this->account();
        $transfer = $this->order($this->variant());
        $cod = $this->order($this->variant(), ['payment_method' => 'cod']);
        $this->actingAs($this->admin());
        $ids = fn (string $query) => collect($this->get('/admin/orders?demo=0&'.$query)->viewData('page')['props']['orders']['data'])->pluck('id')->all();

        $this->assertSame([$transfer->id], $ids('q='.strtolower($transfer->payment->reference)));
        $this->assertSame([$transfer->id], $ids('payment=transfer'));
        $this->get(route('admin.dashboard', ['demo' => 0]))->assertInertia(fn (Assert $page) => $page
            ->where('todo.awaiting_transfer', 1)->where('todo.pending_orders', 1));
        app(PaymentService::class)->settle($transfer->payment);
        $this->assertSame([], $ids('payment=transfer'));
        $this->assertSame([$transfer->id], $ids('payment=paid'));

        $csv = $this->get('/admin/orders/export')->streamedContent();
        $this->assertStringContainsString('"Cách thanh toán"', $csv);
        $this->assertStringContainsString('"Chuyển khoản"', $csv);
        $this->assertStringContainsString('COD', $csv);
        $this->assertNull($cod->payment);
    }

    public function test_the_assistant_mentions_transfers_only_when_they_can_be_made(): void
    {
        $answer = fn () => collect($this->postJson('/support-chat/messages', ['message' => 'Shop có nhận chuyển khoản không?'])->json('messages'))->last()['body'];
        $this->assertStringContainsString('chưa được kết nối', $answer());
        $this->account();
        $this->assertStringContainsString('chuyển khoản ngân hàng', $answer());
    }

    public function test_an_order_needs_its_goods_reserved_once_however_it_is_paid(): void
    {
        // Two orders for the last rackets: the second is refused whichever way it would pay.
        $this->account();
        $variant = $this->variant(stock: 2);
        $this->order($variant);
        $this->withSession(['shopping_cart' => [$variant->id => 2]])->get('/checkout');
        $this->post('/checkout', [
            'checkout_token' => session('checkout_token'), 'name' => 'Lê Bình', 'phone' => '0907654321', 'address' => '5 Lê Lợi',
            'payment_method' => 'bank_transfer', 'accept_terms' => true,
        ])->assertSessionHasErrors('cart');
        $this->assertSame([1, 1, 0], [Order::count(), Payment::count(), $variant->fresh()->stock]);
        // Released by the first order's expiry, they can be bought again.
        $this->travelTo(now()->addHours(25));
        app(PaymentService::class)->expireOverdue();
        $this->assertSame(2, $variant->fresh()->stock);
    }
}
