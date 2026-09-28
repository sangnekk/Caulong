<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    private function order(?User $user, array $attributes = []): Order
    {
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $user?->id,
            'name' => 'Khách', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000,
        ], $attributes));
        $order->items()->create([
            'product_name' => 'Vợt thử', 'variant_name' => '4U', 'sku' => 'T-'.Str::random(5),
            'unit_price' => 500000, 'quantity' => 1, 'line_total' => 500000,
        ]);

        return $order;
    }

    public function test_guests_are_sent_to_login(): void
    {
        $this->get(route('account'))->assertRedirect(route('login'));
    }

    public function test_account_lists_only_the_customers_own_orders(): void
    {
        $customer = User::factory()->create();
        $mine = $this->order($customer, ['status' => 'shipped']);
        $this->order($customer, ['status' => 'delivered']);
        $this->order(User::factory()->create());
        $this->order(null);

        $this->actingAs($customer)->get(route('account'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/account')
            ->where('account.email', $customer->email)
            ->has('orders.data', 2)
            ->where('orders.data.1.public_id', $mine->public_id)
            ->where('orders.data.1.items.0.product_name', 'Vợt thử')
            ->where('totals', ['orders' => 2, 'open' => 1])
            ->missing('orders.data.0.phone')
            ->missing('orders.data.0.address'));
        // Their own order stays viewable from the account, without the checkout session.
        $this->get(route('orders.show', $mine->public_id))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('justPlaced', false));
    }

    public function test_customer_updates_name_and_a_new_email_needs_verifying_again(): void
    {
        Notification::fake();
        $customer = User::factory()->create(['name' => 'Tên cũ']);

        $this->actingAs($customer)->patch(route('account.update'), ['name' => 'Tên mới', 'email' => $customer->email])
            ->assertRedirect()->assertSessionHas('success', 'Đã lưu thông tin tài khoản.');
        $this->assertSame('Tên mới', $customer->fresh()->name);
        $this->assertTrue($customer->fresh()->hasVerifiedEmail());

        $this->patch(route('account.update'), ['name' => 'Tên mới', 'email' => 'moi@example.com'])
            ->assertSessionHas('success', 'Đã lưu. Mở email mới để xác minh địa chỉ.');
        $this->assertFalse($customer->fresh()->hasVerifiedEmail());
        Notification::assertSentTo($customer->fresh(), VerifyEmail::class);

        $taken = User::factory()->create();
        $this->patch(route('account.update'), ['name' => 'Tên mới', 'email' => $taken->email])
            ->assertSessionHasErrors(['email' => 'Email đã được sử dụng.']);
    }

    public function test_password_change_requires_the_current_password(): void
    {
        $customer = User::factory()->create();

        $this->actingAs($customer)->put(route('account.password'), [
            'current_password' => 'sai', 'password' => 'Mat-khau-moi-2026', 'password_confirmation' => 'Mat-khau-moi-2026',
        ])->assertSessionHasErrors('current_password');
        $this->put(route('account.password'), [
            'current_password' => 'password', 'password' => 'Mat-khau-moi-2026', 'password_confirmation' => 'Mat-khau-moi-2026',
        ])->assertSessionHas('success', 'Đã đổi mật khẩu.');
        $this->assertTrue(Hash::check('Mat-khau-moi-2026', $customer->fresh()->password));
    }

    public function test_order_page_says_placed_only_right_after_checkout(): void
    {
        $customer = User::factory()->create();
        $order = $this->order($customer);

        // As checkout leaves it: flashed for exactly the next request.
        $this->actingAs($customer)->withSession(['order_placed' => $order->public_id, '_flash' => ['old' => ['order_placed'], 'new' => []]])
            ->get(route('orders.show', $order->public_id))
            ->assertInertia(fn (Assert $page) => $page->where('justPlaced', true));
        $this->get(route('orders.show', $order->public_id))
            ->assertInertia(fn (Assert $page) => $page->where('justPlaced', false));
    }
}
