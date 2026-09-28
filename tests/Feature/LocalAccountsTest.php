<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\LocalAccounts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LocalAccountsTest extends TestCase
{
    use RefreshDatabase;

    public function test_local_login_page_lists_ready_accounts_that_actually_sign_in(): void
    {
        $this->withoutVite();
        $this->app['env'] = 'local';

        $this->get(route('login'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->has('localAccounts', 2)
            ->where('localAccounts.0.email', 'admin@test.local')
            ->where('localAccounts.0.password', LocalAccounts::PASSWORD));

        $admin = User::where('email', 'admin@test.local')->firstOrFail();
        $this->assertTrue($admin->is_admin);
        $this->assertTrue($admin->hasVerifiedEmail());
        $this->assertFalse(User::where('email', 'khach@test.local')->firstOrFail()->is_admin);

        // A changed password is put back, so the listed one keeps working.
        $admin->forceFill(['password' => 'something-else'])->save();
        $this->get(route('login'));
        $this->app['env'] = 'testing'; // CSRF is only skipped in the testing environment.
        $this->post(route('login.store'), ['email' => 'admin@test.local', 'password' => LocalAccounts::PASSWORD])
            ->assertRedirect(route('admin.dashboard'));
        $this->post(route('logout'));
        $this->post(route('login.store'), ['email' => 'khach@test.local', 'password' => LocalAccounts::PASSWORD])
            ->assertRedirect(route('account'));
    }

    public function test_outside_local_nothing_is_created_or_shown(): void
    {
        $this->withoutVite();
        foreach (['production', 'testing'] as $environment) {
            $this->app['env'] = $environment;
            $this->get(route('login'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('localAccounts', []));
        }
        $this->assertDatabaseCount('users', 0);
    }
}
