<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Staff must confirm a second factor before they may work in /admin when the shop asks for it. */
class StaffTwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function support(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true, 'role' => 'support'])->save();

        return $user;
    }

    public function test_with_the_rule_off_a_staff_account_with_one_password_reaches_the_admin(): void
    {
        config(['shop.security.require_staff_two_factor' => false]);

        $this->actingAs($this->admin())->get('/admin')->assertOk();
    }

    public function test_a_staff_account_without_two_factor_is_sent_to_the_security_page(): void
    {
        config(['shop.security.require_staff_two_factor' => true]);
        $admin = $this->admin();

        $this->actingAs($admin)->get('/admin')
            ->assertRedirect(route('security.edit'))
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'xác thực hai lớp'));

        // No admin data is served either: every page of the shop is behind the same door.
        $this->get('/admin/orders')->assertRedirect(route('security.edit'));
    }

    public function test_a_staff_account_with_a_confirmed_second_factor_reaches_the_admin(): void
    {
        config(['shop.security.require_staff_two_factor' => true]);

        $this->actingAs(User::factory()->withTwoFactor()->create(['is_admin' => true]))
            ->get('/admin')->assertOk();
    }

    public function test_support_staff_without_two_factor_are_sent_to_the_security_page_as_well(): void
    {
        config(['shop.security.require_staff_two_factor' => true]);

        $this->actingAs($this->support())->get('/admin/support-chat')
            ->assertRedirect(route('security.edit'));
    }

    public function test_a_customer_is_refused_by_the_admin_gate_not_sent_to_security(): void
    {
        config(['shop.security.require_staff_two_factor' => true]);

        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden();
    }

    public function test_the_security_page_itself_stays_reachable_so_staff_can_enroll(): void
    {
        config(['shop.security.require_staff_two_factor' => true]);

        $this->actingAs($this->admin())
            // The page asks for the password again first; confirm it for this request.
            ->withSession(['auth.password_confirmed_at' => time()])
            ->get(route('security.edit'))
            ->assertOk();
    }
}
