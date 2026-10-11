<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\SupportConversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The three kinds of staff and the screen where an admin says who is which: admins own the
 * shop, staff do its daily work, support staff answer customers.
 */
class StaffManagementTest extends TestCase
{
    use RefreshDatabase;

    private function member(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->forceFill(['is_admin' => true, 'role' => $role])->save();

        return $user;
    }

    /** Signed in, with the password given a moment ago (the staff screen asks for that). */
    private function asConfirmed(User $user): static
    {
        return $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()]);
    }

    public function test_staff_do_the_daily_work_but_not_what_is_the_owners(): void
    {
        $staff = $this->member('staff');
        Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Nguyễn An', 'phone' => '0901234567',
            'address' => '12 Nguyễn Huệ', 'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000, 'payment_status' => 'paid', 'paid_at' => now(),
        ]);

        // Signing in takes them to the dashboard: the work, without the shop's money.
        $this->post(route('login.store'), ['email' => $staff->email, 'password' => 'password'])->assertRedirect(route('admin.dashboard'));
        $this->get('/admin?demo=0')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('shop.staff_role', 'staff')->where('figures', false)->where('todo.pending_orders', 1)
            ->where('stats.today_sales', 0)->where('stats.week_sales', 0)->where('stats.week_collected', 0)->where('stats.week_profit', 0)
            ->where('stats.orders_open', 1));
        foreach (['/admin/orders', '/admin/products', '/admin/customers', '/admin/coupons', '/admin/reviews', '/admin/emails', '/admin/imports', '/admin/taxonomies', '/admin/service-orders', '/admin/service-strings'] as $page) {
            $this->get($page)->assertOk();
        }
        $this->followingRedirects()->get('/admin/support-chat')->assertOk();

        // The figures, the settings (the bank account among them), every order in a file, the staff.
        foreach (['/admin/reports', '/admin/settings', '/admin/orders/export', '/admin/staff'] as $page) {
            $this->get($page)->assertForbidden();
        }
        $this->put('/admin/settings', ['shipping_fee' => 0, 'free_shipping_threshold' => 0, 'bank_account_number' => '999'])->assertForbidden();
        $this->withSession(['auth.password_confirmed_at' => time()])->post('/admin/staff', ['email' => 'ai-do@example.com', 'role' => 'admin'])->assertForbidden();

        // An admin sees the same dashboard with the money.
        $this->actingAs($this->member('admin'))->get('/admin?demo=0')->assertInertia(fn (Assert $page) => $page
            ->where('figures', true)->where('stats.today_sales', 500000)->where('stats.week_collected', 500000));
    }

    public function test_the_staff_screen_asks_for_the_password_again(): void
    {
        $admin = $this->member('admin');
        $this->actingAs($admin)->get('/admin/staff')->assertRedirect(route('password.confirm'));
        $this->post('/admin/staff', ['email' => 'x@example.com', 'role' => 'admin'])->assertRedirect(route('password.confirm'));
        $this->assertSame(1, User::where('is_admin', true)->count());

        $this->asConfirmed($admin)->get('/admin/staff')->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/staff', false)
            ->where('me', $admin->id)->has('staff', 1)
            ->where('staff.0', fn ($row) => $row['email'] === $admin->email && $row['role'] === 'admin' && $row['verified'] === true && $row['two_factor'] === false));
        // Nobody else gets as far as being asked.
        $this->actingAs(User::factory()->create())->get('/admin/staff')->assertForbidden();
        $this->actingAs($this->member('support'))->get('/admin/staff')->assertForbidden();
        auth()->logout();
        $this->get('/admin/staff')->assertRedirect(route('login'));
    }

    public function test_an_admin_makes_a_verified_customer_a_member_of_staff(): void
    {
        $admin = $this->member('admin', ['name' => 'Chủ Shop']);
        $person = User::factory()->create(['name' => 'Trần Bình', 'email' => 'binh@example.com', 'segment' => 'active']);
        User::factory()->unverified()->create(['email' => 'chua-xac-minh@example.com']);
        $this->asConfirmed($admin);

        // Only an account that exists and has proved its address; no account is made for anyone.
        $this->post('/admin/staff', ['email' => 'khong-co@example.com', 'role' => 'staff'])->assertSessionHasErrors('email');
        $this->post('/admin/staff', ['email' => 'chua-xac-minh@example.com', 'role' => 'staff'])->assertSessionHasErrors('email');
        $this->post('/admin/staff', ['email' => 'binh@example.com', 'role' => 'owner'])->assertSessionHasErrors('role');
        $this->assertSame(1, User::where('is_admin', true)->count());

        $this->post('/admin/staff', ['email' => ' Binh@Example.com ', 'role' => 'staff'])->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã thêm Trần Bình làm nhân viên bán hàng.');
        $person->refresh();
        // Staff from now on, and no longer one of the customers the shop groups.
        $this->assertSame([true, 'staff', null], [$person->is_admin, $person->staffRole(), $person->segment]);
        $this->post('/admin/staff', ['email' => 'binh@example.com', 'role' => 'support'])->assertSessionHasErrors('email');

        $this->get('/admin/staff')->assertInertia(fn (Assert $page) => $page
            ->where('staff', fn ($rows) => collect($rows)->map(fn ($row) => [$row['name'], $row['role']])->all() === [['Chủ Shop', 'admin'], ['Trần Bình', 'staff']]));

        $this->patch('/admin/staff/'.$person->id, ['role' => 'support'])->assertSessionHasNoErrors();
        $this->assertSame('support', $person->fresh()->staffRole());
        // With the new role comes what it may open, at once.
        $this->actingAs($person->fresh())->get('/admin/orders')->assertForbidden();
    }

    public function test_the_shop_is_never_left_without_an_admin(): void
    {
        $owner = $this->member('admin');
        $this->asConfirmed($owner);

        // Not by their own hand, whether another admin exists or not.
        $this->patch('/admin/staff/'.$owner->id, ['role' => 'staff'])->assertSessionHasErrors('staff');
        $this->delete('/admin/staff/'.$owner->id)->assertSessionHasErrors('staff');
        $second = $this->member('admin');
        $this->patch('/admin/staff/'.$owner->id, ['role' => 'staff'])->assertSessionHasErrors('staff');
        $this->assertSame('admin', $owner->fresh()->staffRole());

        // One admin may demote the other; the one left cannot then be removed by anybody.
        $this->patch('/admin/staff/'.$second->id, ['role' => 'staff'])->assertSessionHasNoErrors();
        $this->assertSame(['admin', 'staff'], [$owner->fresh()->staffRole(), $second->fresh()->staffRole()]);
        // A staff account from before roles existed is an admin, and counts as one.
        $legacy = User::factory()->create(['is_admin' => true]);
        $this->delete('/admin/staff/'.$legacy->id)->assertSessionHasNoErrors();
        $this->assertFalse($legacy->fresh()->is_admin);
        $this->asConfirmed($this->member('admin'))->delete('/admin/staff/'.$owner->id)->assertSessionHasNoErrors();
        $this->assertSame(1, User::where('is_admin', true)->get()->filter(fn (User $user) => $user->staffRole() === 'admin')->count());

        // A customer is not staff to change.
        $customer = User::factory()->create();
        $this->patch('/admin/staff/'.$customer->id, ['role' => 'admin'])->assertSessionHasErrors('staff');
        $this->assertFalse($customer->fresh()->is_admin);
    }

    public function test_taking_staff_access_away_gives_their_tickets_back(): void
    {
        $admin = $this->member('admin');
        $leaving = $this->member('support', ['name' => 'Lê Chi']);
        $open = SupportConversation::create(['session_key' => Str::random(64), 'needs_human' => true, 'status' => 'pending', 'assigned_to' => $leaving->id]);
        $closed = SupportConversation::create(['session_key' => Str::random(64), 'needs_human' => true, 'status' => 'closed', 'assigned_to' => $leaving->id, 'closed_at' => now()]);

        $this->asConfirmed($admin)->delete('/admin/staff/'.$leaving->id)
            ->assertSessionHas('success', 'Đã gỡ quyền nhân viên của Lê Chi. Tài khoản đó trở lại là tài khoản khách hàng.');
        $leaving->refresh();
        $this->assertSame([false, null, null], [$leaving->is_admin, $leaving->role, $leaving->staffRole()]);
        // Work in hand goes back to the inbox; what is finished keeps who finished it.
        $this->assertSame([null, $leaving->id], [$open->fresh()->assigned_to, $closed->fresh()->assigned_to]);
        // The account is a customer's: its own pages still open, /admin does not.
        $this->actingAs($leaving)->get('/account')->assertOk();
        $this->get('/admin/support-chat')->assertForbidden();
    }

    public function test_a_ticket_is_handed_back_by_its_holder_or_by_an_admin(): void
    {
        $holder = $this->member('support');
        $other = $this->member('support');
        $admin = $this->member('admin');
        $ticket = SupportConversation::create(['session_key' => Str::random(64), 'needs_human' => true, 'assigned_to' => $holder->id]);
        $can = fn (User $user) => $this->actingAs($user)->followingRedirects()->get('/admin/support-chat?conversation='.$ticket->id)
            ->viewData('page')['props']['selected']['can_release'];

        // Not by a colleague who does not hold it.
        $this->assertFalse($can($other));
        $this->post('/admin/support-chat/'.$ticket->id.'/release')->assertSessionHasErrors('claim');
        $this->assertSame($holder->id, $ticket->fresh()->assigned_to);

        // By its holder: the next member of staff can take it.
        $this->assertTrue($can($holder));
        $this->post('/admin/support-chat/'.$ticket->id.'/release')->assertSessionHasNoErrors();
        $this->assertNull($ticket->fresh()->assigned_to);
        $this->post('/admin/support-chat/'.$ticket->id.'/release')->assertSessionHasErrors('claim');
        $this->actingAs($other)->post('/admin/support-chat/'.$ticket->id.'/claim')->assertSessionHasNoErrors();
        $this->assertSame($other->id, $ticket->fresh()->assigned_to);

        // By an admin, for someone who is away.
        $this->assertTrue($can($admin));
        $this->post('/admin/support-chat/'.$ticket->id.'/release')->assertSessionHasNoErrors();
        $this->assertNull($ticket->fresh()->assigned_to);
        // A closed ticket is nobody's to hand on.
        $ticket->update(['status' => 'closed', 'assigned_to' => $holder->id]);
        $this->actingAs($holder)->post('/admin/support-chat/'.$ticket->id.'/release')->assertSessionHasErrors('claim');
    }

    public function test_the_command_grants_the_middle_role_too(): void
    {
        $user = User::factory()->create(['email' => 'ban-hang@example.test']);
        $this->artisan('shop:make-admin', ['email' => $user->email, '--role' => 'staff'])
            ->expectsConfirmation('Cấp quyền nhân viên bán hàng (đơn, sản phẩm, khách hàng; không gồm cài đặt và báo cáo) cho ban-hang@example.test?', 'yes')
            ->expectsOutputToContain('Đã cấp quyền nhân viên bán hàng')->assertSuccessful();
        $this->assertSame('staff', $user->fresh()->staffRole());
    }
}
