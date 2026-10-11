<?php

namespace Tests\Feature;

use App\Models\SupportConversation;
use App\Models\User;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Staff roles: admins run the shop, support staff only answer customers. */
class StaffRolesTest extends TestCase
{
    use RefreshDatabase;

    private function support(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true, 'role' => 'support'])->save();

        return $user;
    }

    public function test_the_command_gives_a_verified_account_one_of_the_two_roles(): void
    {
        $user = User::factory()->create(['email' => 'nhanvien@example.test']);

        $this->artisan('shop:make-admin', ['email' => $user->email, '--role' => 'owner', '--force' => true])->assertFailed();
        $this->assertNull($user->fresh()->staffRole());

        $this->artisan('shop:make-admin', ['email' => $user->email, '--role' => 'support'])
            ->expectsConfirmation('Cấp quyền nhân viên hỗ trợ (chỉ Chat hỗ trợ) cho nhanvien@example.test?', 'yes')
            ->expectsOutputToContain('Đã cấp quyền nhân viên hỗ trợ')->assertSuccessful();
        $this->assertSame([true, 'support'], [$user->fresh()->is_admin, $user->fresh()->staffRole()]);

        // Without the option it is what it always was: the whole shop.
        $this->artisan('shop:make-admin', ['email' => $user->email, '--force' => true])->assertSuccessful();
        $this->assertSame('admin', $user->fresh()->staffRole());
    }

    public function test_support_staff_work_the_inbox_and_nothing_else_in_the_admin(): void
    {
        $conversation = SupportConversation::create(['session_key' => Str::random(64), 'needs_human' => true]);
        $conversation->messages()->create(['sender' => 'customer', 'body' => 'Cần nhân viên hỗ trợ']);
        $support = $this->support();

        // Their home in /admin is the inbox, and they can do everything a ticket needs.
        $this->actingAs($support)->get('/admin')->assertRedirect(route('admin.support-chat.index'));
        $this->followingRedirects()->get('/admin/support-chat')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('shop.staff_role', 'support')->where('shop.is_admin', true)
            // Counts for work they cannot open are not sent to them.
            ->where('shop.pending_orders', 0)->where('shop.pending_reviews', 0)
            ->where('can_manage_shop', false)->has('conversations.data', 1));
        foreach (['claim' => [], 'reply' => ['message' => 'Shop đang kiểm tra giúp bạn.'], 'resolve' => [], 'close' => []] as $action => $data) {
            $this->post('/admin/support-chat/'.$conversation->id.'/'.$action, $data)->assertSessionHasNoErrors();
        }
        $this->assertSame(['closed', $support->id], [$conversation->refresh()->status, $conversation->assigned_to]);

        // The shop itself is not theirs to see or change.
        foreach (['/admin/reports', '/admin/orders', '/admin/products', '/admin/customers', '/admin/coupons', '/admin/emails', '/admin/reviews', '/admin/imports', '/admin/settings', '/admin/taxonomies', '/admin/orders/export'] as $page) {
            $this->get($page)->assertForbidden();
        }
        $this->put('/admin/settings', ['shipping_fee' => 0, 'free_shipping_threshold' => 0])->assertForbidden();
        $this->post('/admin/coupons', [])->assertForbidden();
    }

    public function test_every_admin_route_but_the_inbox_asks_for_one_of_the_two_rights(): void
    {
        $open = ['admin.dashboard', 'admin.support-chat.index', 'admin.support-chat.claim', 'admin.support-chat.reply', 'admin.support-chat.resolve', 'admin.support-chat.close', 'admin.support-chat.release'];
        // The owner's alone: the shop's figures and settings, every order in one file, its staff.
        $owner = ['admin.reports', 'admin.settings.edit', 'admin.settings.update', 'admin.orders.export', 'admin.staff.index', 'admin.staff.store', 'admin.staff.update', 'admin.staff.destroy'];
        $admin = collect(Route::getRoutes()->getRoutes())->filter(fn (RoutingRoute $route) => str_starts_with((string) $route->getName(), 'admin.'));
        $this->assertGreaterThan(30, $admin->count());
        $this->assertSame([], array_values(array_diff($owner, $admin->map(fn (RoutingRoute $route) => $route->getName())->all())));

        foreach ($admin as $route) {
            $name = (string) $route->getName();
            $middleware = $route->gatherMiddleware();
            // A route added later carries the daily-work right unless it is named above.
            $expected = match (true) {
                in_array($name, $open, true) => [],
                in_array($name, $owner, true) => ['can:administer-shop'],
                default => ['can:manage-shop'],
            };
            $this->assertSame($expected, array_values(array_filter($middleware, fn ($entry) => is_string($entry) && str_starts_with($entry, 'can:'))), $name);
            // Changing who is staff asks for the password again.
            $this->assertSame(str_starts_with($name, 'admin.staff.'), in_array(RequirePassword::class, $middleware, true), $name);
        }
    }

    public function test_signing_in_takes_each_role_to_where_it_works(): void
    {
        $support = $this->support();
        // Opening a page of the shop first does not get them past the sign-in to a refusal.
        $this->get('/admin/products')->assertRedirect(route('login'));
        $this->post(route('login.store'), ['email' => $support->email, 'password' => 'password'])
            ->assertRedirect(route('admin.support-chat.index'));
        $this->post(route('logout'));

        // A staff account from before roles existed runs the shop, as it always did.
        $legacy = User::factory()->create(['is_admin' => true]);
        $this->assertSame([null, 'admin'], [$legacy->role, $legacy->staffRole()]);
        $this->get('/admin/products')->assertRedirect(route('login'));
        $this->post(route('login.store'), ['email' => $legacy->email, 'password' => 'password'])->assertRedirect('/admin/products');
        $this->get('/admin')->assertOk()->assertInertia(fn (Assert $page) => $page->where('shop.staff_role', 'admin'));
        $this->followingRedirects()->get('/admin/support-chat')->assertInertia(fn (Assert $page) => $page->where('can_manage_shop', true));
        // The list of accounts tells the two kinds of staff apart.
        $this->get('/admin/customers/'.$support->id)->assertInertia(fn (Assert $page) => $page
            ->where('customer.is_admin', true)->where('customer.staff_role', 'support'));
        $this->get('/admin/customers/'.$legacy->id)->assertInertia(fn (Assert $page) => $page->where('customer.staff_role', 'admin'));

        // A customer is no kind of staff.
        $this->actingAs(User::factory()->create())->get('/admin/support-chat')->assertForbidden();
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('shop.staff_role', null));
    }
}
