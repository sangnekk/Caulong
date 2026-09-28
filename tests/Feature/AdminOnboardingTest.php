<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOnboardingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_command_requires_an_existing_verified_account(): void
    {
        $this->artisan('shop:make-admin', ['email' => 'missing@example.test', '--force' => true])->assertFailed();

        $user = User::factory()->unverified()->create(['email' => 'owner@example.test']);
        $this->artisan('shop:make-admin', ['email' => $user->email, '--force' => true])->assertFailed();
        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_verified_account_can_be_promoted_and_access_admin(): void
    {
        $user = User::factory()->create(['email' => 'owner@example.test']);
        $this->assertFalse($user->fresh()->is_admin);
        $this->actingAs($user)->get('/admin')->assertForbidden();

        $this->artisan('shop:make-admin', ['email' => $user->email, '--force' => true])->assertSuccessful();

        $this->assertTrue($user->fresh()->is_admin);
        $this->actingAs($user->fresh())->get('/admin')->assertOk();
        $this->artisan('shop:make-admin', ['email' => $user->email, '--force' => true])->assertSuccessful();
    }

    public function test_cancelled_promotion_leaves_account_without_admin_access(): void
    {
        $user = User::factory()->create(['email' => 'owner@example.test']);
        $this->artisan('shop:make-admin', ['email' => $user->email])
            ->expectsConfirmation('Cấp toàn quyền quản trị cho owner@example.test?', 'no')
            ->assertFailed();

        $this->assertFalse($user->fresh()->is_admin);
        $this->actingAs($user)->get('/admin')->assertForbidden();
    }
}
