<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\ShopSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SupportChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_guest_message_and_auto_reply_are_persisted_in_the_guest_session(): void
    {
        $this->postJson('/support-chat/messages', ['message' => 'Phí giao hàng'])
            ->assertOk()
            ->assertJsonPath('status', 'open')
            ->assertJsonFragment(['sender' => 'customer', 'body' => 'Phí giao hàng'])
            ->assertJsonFragment([
                'sender' => 'bot',
                'body' => 'Phí giao hàng hiện là 30.000 ₫; đơn từ 1.000.000 ₫ được miễn phí giao. Phí chính xác sẽ hiện trong giỏ hàng.',
                'action_url' => '/cart',
                'action_label' => 'Mở giỏ hàng',
            ]);

        $this->assertDatabaseHas('support_conversations', ['status' => 'open']);
        $this->assertDatabaseHas('support_conversations', ['needs_human' => false]);
        $this->assertDatabaseHas('support_messages', ['sender' => 'customer', 'body' => 'Phí giao hàng']);
        $this->assertDatabaseHas('support_messages', ['sender' => 'bot', 'action_url' => '/cart']);

        $this->getJson('/support-chat/messages')
            ->assertOk()
            ->assertJsonCount(2, 'messages');

        $this->withSession(['support_conversation_id' => null])
            ->getJson('/support-chat/messages')
            ->assertJsonPath('messages', []);

        $admin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($admin)->get('/admin/support-chat')
            ->assertInertia(fn (Assert $page) => $page
                ->has('conversations.data', 0)
                ->where('unread_count', 0));
    }

    public function test_only_admin_can_open_inbox_and_admin_reply_reaches_the_customer(): void
    {
        $this->postJson('/support-chat/messages', ['message' => 'Nhân viên xem giúp yêu cầu riêng này'])
            ->assertOk();
        $conversation = SupportConversation::query()->firstOrFail();
        $this->assertTrue($conversation->needs_human);

        $this->get('/admin/support-chat')->assertRedirect('/login');

        $admin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($admin)->get('/admin')
            ->assertInertia(fn (Assert $page) => $page->where('shop.pending_support_chats', 1));

        $this->get('/admin/support-chat')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/support-chat')
                ->where('unread_count', 0)
                ->has('conversations.data', 1)
                ->where('selected.assigned_to', null));

        $this->from('/admin/support-chat?conversation='.$conversation->id)
            ->post('/admin/support-chat/'.$conversation->id.'/claim')
            ->assertRedirect('/admin/support-chat?conversation='.$conversation->id);
        $this->assertDatabaseHas('support_conversations', [
            'id' => $conversation->id,
            'assigned_to' => $admin->id,
        ]);

        $otherAdmin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($otherAdmin)
            ->post('/admin/support-chat/'.$conversation->id.'/claim')
            ->assertSessionHas('error');
        $this->assertDatabaseHas('support_conversations', [
            'id' => $conversation->id,
            'assigned_to' => $admin->id,
        ]);
        $this->post('/admin/support-chat/'.$conversation->id.'/reply', [
            'message' => 'Phản hồi trùng',
        ])->assertSessionHasErrors('message');

        $this->actingAs($admin);

        $this->from('/admin/support-chat?conversation='.$conversation->id)
            ->post('/admin/support-chat/'.$conversation->id.'/reply', [
                'message' => 'Nhân viên đã nhận yêu cầu của bạn.',
            ])
            ->assertRedirect('/admin/support-chat?conversation='.$conversation->id);

        $this->getJson('/support-chat/messages')
            ->assertOk()
            ->assertJsonFragment([
                'sender' => 'admin',
                'body' => 'Nhân viên đã nhận yêu cầu của bạn.',
            ]);

        $this->from('/admin/support-chat?conversation='.$conversation->id)
            ->post('/admin/support-chat/'.$conversation->id.'/close')
            ->assertRedirect('/admin/support-chat?conversation='.$conversation->id);
        $this->assertDatabaseHas('support_conversations', [
            'id' => $conversation->id,
            'status' => 'closed',
        ]);

        $this->postJson('/support-chat/messages', ['message' => 'Tin nhắn mới'])
            ->assertOk()
            ->assertJsonPath('status', 'open');
        $this->assertDatabaseCount('support_conversations', 2);
    }

    public function test_guest_message_is_validated_and_limited(): void
    {
        $this->postJson('/support-chat/messages', ['message' => str_repeat('a', 1001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');

        $this->postJson('/support-chat/messages', ['message' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');
    }

    public function test_faq_message_does_not_page_admin_and_session_limit_blocks_spam(): void
    {
        $this->postJson('/support-chat/messages', ['message' => 'Phí giao hàng'])->assertOk();
        $this->assertDatabaseHas('support_conversations', ['needs_human' => false]);

        for ($attempt = 1; $attempt < 8; $attempt++) {
            $this->postJson('/support-chat/messages', ['message' => 'Yêu cầu riêng '.$attempt])->assertOk();
        }

        $this->postJson('/support-chat/messages', ['message' => 'Tin vượt giới hạn'])
            ->assertTooManyRequests();
    }

    public function test_chat_context_only_lists_real_products_from_the_signed_in_users_orders(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->orderWithProduct($owner, 'Vợt Của Tôi');
        $this->orderWithProduct($owner, 'Vợt Đã Hủy', ['status' => 'cancelled']);
        $this->orderWithProduct($owner, 'Vợt Demo', ['is_demo' => true]);
        $this->orderWithProduct($other, 'Vợt Của Người Khác');

        $this->getJson('/support-chat/context')
            ->assertOk()
            ->assertExactJson(['purchased_products' => []]);

        $this->actingAs($owner)->getJson('/support-chat/context')
            ->assertOk()
            ->assertExactJson(['purchased_products' => ['Vợt Của Tôi']]);
    }

    public function test_purchased_product_support_prompt_escalates_to_a_human_ticket(): void
    {
        $this->postJson('/support-chat/messages', [
            'message' => 'Hỗ trợ sản phẩm đã mua: Vợt Của Tôi',
        ])->assertOk()->assertJsonFragment([
            'sender' => 'bot',
            'body' => 'Đã nhận yêu cầu hỗ trợ sản phẩm đã mua. Nhân viên sẽ kiểm tra đơn hàng của bạn; hãy gửi thêm tình trạng hoặc câu hỏi cụ thể để được hỗ trợ nhanh hơn.',
        ]);

        $this->assertDatabaseHas('support_conversations', [
            'needs_human' => true,
            'status' => 'open',
        ]);
    }

    public function test_guest_order_code_links_to_zalo_and_does_not_create_admin_ticket(): void
    {
        app(ShopSettings::class)->save([
            'shipping_fee' => 30000,
            'free_shipping_threshold' => 1000000,
            'hotline' => '0866815722',
            'contact_email' => 'sangnekk2007@gmail.com',
            'contact_address' => '36 Thạch Lam, Tân Phú',
            'contact_chat_url' => 'https://zalo.me/0866815722',
        ]);

        $this->postJson('/support-chat/messages', ['message' => 'ED673093'])
            ->assertOk()
            ->assertJsonPath('messages.1.body', 'Mình nhận được mã đơn ED673093. Vì bạn chưa đăng nhập, hãy mở Zalo và gửi mã này cho nhân viên để họ kiểm tra đơn giúp bạn.')
            ->assertJsonPath('messages.1.action_url', 'https://zalo.me/0866815722')
            ->assertJsonPath('messages.1.action_label', 'Mở Zalo hỗ trợ · mã ED673093');

        $this->assertDatabaseHas('support_conversations', [
            'needs_human' => false,
            'status' => 'open',
        ]);
    }

    private function orderWithProduct(User $user, string $productName, array $attributes = []): Order
    {
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(),
            'checkout_token' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => $user->name,
            'phone' => '0901234567',
            'address' => '36 Thạch Lam, Tân Phú',
            'subtotal' => 500000,
            'shipping_fee' => 0,
            'total' => 500000,
            'is_demo' => false,
        ], $attributes));
        $order->items()->create([
            'product_name' => $productName,
            'variant_name' => '4U',
            'sku' => 'T-'.Str::random(5),
            'unit_price' => 500000,
            'quantity' => 1,
            'line_total' => 500000,
        ]);

        return $order;
    }
}
