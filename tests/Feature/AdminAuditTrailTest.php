<?php

namespace Tests\Feature;

use App\Models\AdminActivity;
use App\Models\SupportConversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The audit trail of state-changing staff actions in /admin. */
class AdminAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private function staff(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true, 'role' => $role])->save();

        return $user;
    }

    private function ticket(): SupportConversation
    {
        $conversation = SupportConversation::create([
            'session_key' => Str::random(64),
            'needs_human' => true,
        ]);
        $conversation->messages()->create(['sender' => 'customer', 'body' => 'Cần nhân viên hỗ trợ']);

        return $conversation;
    }

    public function test_an_admin_action_writes_exactly_one_audit_row(): void
    {
        $admin = $this->staff();
        $ticket = $this->ticket();

        $this->actingAs($admin)
            ->post('/admin/support-chat/'.$ticket->id.'/claim')
            ->assertRedirect();

        $this->assertDatabaseCount('admin_activity_logs', 1);
        $this->assertDatabaseHas('admin_activity_logs', [
            'user_id' => $admin->id,
            'method' => 'POST',
            'path' => '/admin/support-chat/'.$ticket->id.'/claim',
            'route' => 'admin.support-chat.claim',
            'status' => 302,
        ]);
        $this->assertSame($admin->id, $ticket->refresh()->assigned_to);
    }

    public function test_reading_an_admin_page_does_not_write_a_row(): void
    {
        $admin = $this->staff();

        $this->actingAs($admin)->get('/admin/support-chat')->assertOk();

        $this->assertDatabaseCount('admin_activity_logs', 0);
    }

    public function test_a_customer_writing_in_the_support_chat_does_not_write_a_row(): void
    {
        $customer = User::factory()->create();

        $this->actingAs($customer)
            ->postJson('/support-chat/messages', ['message' => 'Shop ơi, đơn của tôi đâu?'])
            ->assertSuccessful();

        $this->assertDatabaseCount('admin_activity_logs', 0);
    }

    public function test_support_staff_actions_in_their_inbox_are_audited_too(): void
    {
        $support = $this->staff('support');
        $ticket = $this->ticket();

        $this->actingAs($support)
            ->post('/admin/support-chat/'.$ticket->id.'/claim')
            ->assertRedirect();

        $this->assertDatabaseCount('admin_activity_logs', 1);
        $this->assertDatabaseHas('admin_activity_logs', [
            'user_id' => $support->id,
            'method' => 'POST',
            'path' => '/admin/support-chat/'.$ticket->id.'/claim',
            'route' => 'admin.support-chat.claim',
            'status' => 302,
        ]);
    }

    public function test_request_bodies_query_strings_and_secrets_are_not_stored(): void
    {
        $admin = $this->staff();
        $ticket = $this->ticket();
        $secrets = [
            'password' => 'correct-horse-battery-staple',
            'password_confirmation' => 'correct-horse-battery-staple',
            'token' => 'tok_live_do_not_store',
            'card_number' => '4111111111111111',
        ];

        $this->actingAs($admin)
            ->post('/admin/support-chat/'.$ticket->id.'/claim?access_token=query-secret', $secrets)
            ->assertRedirect();

        $this->assertDatabaseCount('admin_activity_logs', 1);

        $row = AdminActivity::query()->sole();
        $stored = json_encode($row->getAttributes(), JSON_THROW_ON_ERROR);

        foreach ($secrets as $secret) {
            $this->assertStringNotContainsString($secret, $stored);
        }
        $this->assertStringNotContainsString('query-secret', $stored);
        $this->assertSame('/admin/support-chat/'.$ticket->id.'/claim', $row->path);
        $this->assertSame('admin.support-chat.claim', $row->route);
    }

    public function test_the_tail_command_lists_the_latest_entries(): void
    {
        $admin = $this->staff();
        $ticket = $this->ticket();

        $this->actingAs($admin)->post('/admin/support-chat/'.$ticket->id.'/claim')->assertRedirect();

        $this->artisan('audit:tail', ['--limit' => 5])
            ->expectsOutputToContain($admin->name)
            ->assertSuccessful();
    }
}
