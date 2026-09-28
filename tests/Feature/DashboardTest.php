<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_dashboard_sends_customers_to_their_account_and_admins_to_admin()
    {
        $this->actingAs(User::factory()->create())->get(route('dashboard'))->assertRedirect(route('account'));
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin)->get(route('dashboard'))->assertRedirect(route('admin.dashboard'));
    }

    public function test_login_returns_to_the_intended_page_but_never_to_admin_for_customers()
    {
        $customer = User::factory()->create();
        $this->withSession(['url.intended' => url('/checkout')])
            ->post(route('login.store'), ['email' => $customer->email, 'password' => 'password'])
            ->assertRedirect(url('/checkout'));
        $this->post(route('logout'));

        // A customer who opened /admin first would otherwise land on a 403 behind the login form.
        $this->withSession(['url.intended' => url('/admin/products')])
            ->post(route('login.store'), ['email' => $customer->email, 'password' => 'password'])
            ->assertRedirect(route('account'));
        $this->post(route('logout'));

        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->withSession(['url.intended' => url('/admin/orders')])
            ->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])
            ->assertRedirect(url('/admin/orders'));
    }
}
