<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\ShopSettings;
use App\Services\SupportChat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SupportChatTest extends TestCase
{
    use RefreshDatabase;

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

        $this->followingRedirects()->get('/admin/support-chat')
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

    public function test_a_ticket_goes_back_and_forth_between_the_shop_and_the_customer_until_it_is_closed(): void
    {
        $conversation = $this->ticket();
        $admin = User::factory()->create(['is_admin' => true]);
        $other = User::factory()->create(['is_admin' => true]);
        $status = fn (): string => $conversation->refresh()->status;
        $staff = fn (User $who, string $action, array $data = []) => $this->actingAs($who)->post('/admin/support-chat/'.$conversation->id.'/'.$action, $data);

        // Read, taken and answered: now the customer's turn.
        // The list shows what a person said last, not the assistant's answer to it.
        $this->actingAs($admin)->get('/admin/support-chat?conversation='.$conversation->id)->assertInertia(fn (Assert $page) => $page
            ->where('conversations.data.0.last_message', 'Nhân viên xem giúp yêu cầu riêng này')
            ->where('conversations.data.0.last_from_staff', false));
        $staff($admin, 'claim');
        $staff($admin, 'reply', ['message' => 'Bạn gửi giúp mình mã đơn nhé.'])->assertSessionHasNoErrors();
        $this->assertSame('pending', $status());
        $this->followingRedirects()->get('/admin/support-chat')->assertInertia(fn (Assert $page) => $page
            ->where('conversations.data.0.last_message', 'Bạn gửi giúp mình mã đơn nhé.')
            ->where('conversations.data.0.last_from_staff', true));
        $this->getJson('/support-chat/messages')->assertJsonPath('status', 'pending')->assertJsonPath('can_request_code', false);

        // The customer answers, even with a question the assistant knows: the shop's turn, and unread.
        $this->postJson('/support-chat/messages', ['message' => 'Phí giao hàng'])->assertJsonPath('status', 'open');
        $this->assertSame(1, $conversation->messages()->where('sender', 'customer')->whereNull('read_at')->count());

        // Only whoever took the ticket marks it solved or closes it.
        $staff($other, 'resolve')->assertSessionHasErrors('claim');
        $staff($other, 'close')->assertSessionHasErrors('claim');
        $staff($admin, 'resolve')->assertSessionHasNoErrors();
        $this->assertSame('resolved', $status());
        $this->assertNotNull($conversation->resolved_at);
        $staff($admin, 'resolve')->assertSessionHasErrors('claim');

        // Not solved after all: the customer writes again, in the same conversation.
        $this->postJson('/support-chat/messages', ['message' => 'Mình vẫn chưa nhận được hàng'])->assertJsonPath('status', 'open');
        $this->assertSame([1, null], [SupportConversation::count(), $conversation->refresh()->resolved_at]);

        // Solved and left at that: it closes itself after three days, not before.
        $staff($admin, 'resolve');
        $this->travel(2)->days();
        $this->artisan('support:close-resolved')->assertSuccessful();
        $this->assertSame('resolved', $status());
        $this->travel(2)->days();
        $this->artisan('support:close-resolved')->expectsOutputToContain('Đã đóng 1 cuộc trò chuyện.')->assertSuccessful();
        $this->assertSame('closed', $status());
        $this->assertNotNull($conversation->closed_at);
        $staff($admin, 'reply', ['message' => 'Còn đó không?'])->assertSessionHasErrors('message');

        $this->postJson('/support-chat/messages', ['message' => 'Mình cần hỏi việc khác'])->assertJsonPath('status', 'open');
        $this->assertSame(2, SupportConversation::count());
    }

    public function test_the_inbox_lists_tickets_by_where_they_stand(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        foreach (SupportChat::STATUSES as $status) {
            SupportConversation::create(['session_key' => Str::random(64), 'needs_human' => true, 'status' => $status, 'assigned_to' => $admin->id])
                ->messages()->create(['sender' => 'customer', 'body' => 'Tin '.$status, 'read_at' => now()]);
        }
        $listed = fn (string $query) => fn (Assert $page) => $page->where('conversations.data', fn ($rows) => collect($rows)->pluck('status')->sort()->values()->all() === explode(',', $query));

        $this->actingAs($admin)->followingRedirects()->get('/admin/support-chat')->assertInertia(fn (Assert $page) => $page
            ->where('filters.status', 'active')
            ->where('counts', ['open' => 1, 'pending' => 1, 'resolved' => 1, 'closed' => 1])
            ->where('conversations.data', fn ($rows) => collect($rows)->pluck('status')->sort()->values()->all() === ['open', 'pending']));
        $this->followingRedirects()->get('/admin/support-chat?status=resolved')->assertInertia($listed('resolved'));
        $this->followingRedirects()->get('/admin/support-chat?status=closed')->assertInertia($listed('closed'));
        $this->followingRedirects()->get('/admin/support-chat?status=all')->assertInertia(fn (Assert $page) => $page->has('conversations.data', 4));
        $this->get('/admin/support-chat?status=lost')->assertSessionHasErrors('status');
    }

    public function test_the_inbox_keeps_the_conversation_on_screen_while_the_list_changes(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $first = $this->ticketOf(User::factory()->create(), 'Ticket thứ nhất');
        $first->forceFill(['assigned_to' => $admin->id])->save();

        // Opened without a conversation: sent on to the first ticket of the list, by its number.
        $url = '/admin/support-chat?status=active&conversation='.$first->id;
        $this->actingAs($admin)->get('/admin/support-chat')->assertRedirect($url);

        // Another customer writes while a reply is being written. The new ticket tops the list;
        // the conversation on screen stays, and the reply comes back to it.
        $this->travel(1)->minutes();
        $second = $this->ticketOf(User::factory()->create(), 'Ticket thứ hai');
        $this->get($url)->assertInertia(fn (Assert $page) => $page
            ->where('conversations.data.0.id', $second->id)->where('selected.id', $first->id));
        $this->from($url)->post('/admin/support-chat/'.$first->id.'/reply', ['message' => 'Shop trả lời ticket thứ nhất'])->assertRedirect($url);
        $this->assertSame(0, $second->messages()->where('sender', 'admin')->count());

        // An empty list has no ticket to open.
        $this->get('/admin/support-chat?status=closed')->assertOk()->assertInertia(fn (Assert $page) => $page->where('selected', null));
    }

    public function test_a_signed_in_customers_conversation_is_on_their_account_and_nobody_elses(): void
    {
        $customer = User::factory()->create();
        $this->actingAs($customer)->postJson('/support-chat/messages', ['message' => 'Vợt của mình bị nứt khung'])->assertOk();
        $conversation = SupportConversation::sole();
        $this->assertSame($customer->id, $conversation->user_id);

        // Another device: a new session, the same account.
        $this->flushSession();
        $this->actingAs($customer)->getJson('/support-chat/messages')
            ->assertJsonPath('status', 'open')->assertJsonFragment(['body' => 'Vợt của mình bị nứt khung']);
        $this->postJson('/support-chat/messages', ['message' => 'Mình gửi thêm ảnh sau'])->assertOk();
        $this->assertSame(1, SupportConversation::count());

        // Nobody else reads it: not another customer, not a visitor holding its number.
        $this->flushSession();
        $this->actingAs(User::factory()->create())->withSession(['support_conversation_id' => $conversation->id])
            ->getJson('/support-chat/messages')->assertExactJson(['status' => null, 'messages' => [], 'can_request_code' => false, 'code_expires_at' => null]);
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->withSession(['support_conversation_id' => $conversation->id])->getJson('/support-chat/messages')->assertJsonPath('messages', []);
    }

    public function test_a_guest_who_signs_in_keeps_the_conversation_they_started(): void
    {
        $conversation = $this->ticket();
        $customer = User::factory()->create();
        $this->post(route('login.store'), ['email' => $customer->email, 'password' => 'password'])->assertRedirect();

        $this->assertSame($customer->id, $conversation->refresh()->user_id);
        $this->getJson('/support-chat/messages')->assertJsonCount(2, 'messages');

        // Staff answer customers; a conversation they tried the widget with is not put on their name.
        $this->post(route('logout'));
        $tried = $this->ticket();
        $this->post(route('login.store'), ['email' => User::factory()->create(['is_admin' => true])->email, 'password' => 'password']);
        $this->assertNull($tried->refresh()->user_id);
    }

    public function test_a_finished_conversation_is_read_again_with_a_code_that_is_never_stored(): void
    {
        $conversation = $this->ticket();
        $admin = User::factory()->create(['is_admin' => true]);

        // Not while it is still going on.
        $this->postJson('/support-chat/code')->assertUnprocessable();
        $this->actingAs($admin)->post('/admin/support-chat/'.$conversation->id.'/claim');
        $this->post('/admin/support-chat/'.$conversation->id.'/reply', ['message' => 'Shop đã gửi lại hàng cho bạn.']);
        $this->post('/admin/support-chat/'.$conversation->id.'/close')->assertSessionHasNoErrors();

        $this->getJson('/support-chat/messages')->assertJsonPath('status', 'closed')
            ->assertJsonPath('can_request_code', true)->assertJsonPath('code_expires_at', null);
        $code = $this->postJson('/support-chat/code')->assertOk()->json('code');
        $this->assertMatchesRegularExpression('/\A[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}\z/', $code);
        $conversation->refresh();
        $this->assertSame(64, strlen((string) $conversation->access_code_hash));
        $this->assertStringNotContainsString(str_replace('-', '', $code), json_encode($conversation->getAttributes()));
        $this->assertSame(now()->addDays(30)->toDateString(), $conversation->access_code_expires_at->toDateString());
        $this->getJson('/support-chat/messages')->assertJsonPath('code_expires_at', $conversation->access_code_expires_at->toIso8601String());

        // Another device, no account: the code alone, however it is typed.
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->postJson('/support-chat/lookup', ['code' => ' '.strtolower(str_replace('-', ' ', $code)).' '])->assertOk()
            ->assertJsonPath('status', 'closed')->assertJsonCount(3, 'messages')
            ->assertJsonFragment(['sender' => 'admin', 'body' => 'Shop đã gửi lại hàng cho bạn.']);
        $this->postJson('/support-chat/lookup', ['code' => 'AAAAA-BBBBB'])->assertNotFound()->assertJsonPath('message', 'Mã không đúng hoặc đã hết hạn.');
        $this->postJson('/support-chat/lookup', ['code' => ''])->assertUnprocessable();

        // A new code replaces the old one; a code runs out after thirty days.
        $second = app(SupportChat::class)->issueCode($conversation)['code'];
        $this->postJson('/support-chat/lookup', ['code' => $code])->assertNotFound();
        $this->postJson('/support-chat/lookup', ['code' => $second])->assertOk();
        $this->travel(31)->days();
        $this->postJson('/support-chat/lookup', ['code' => $second])->assertNotFound();
    }

    public function test_wrong_codes_are_counted_and_the_lookup_stops_answering_for_a_while(): void
    {
        $conversation = $this->ticket();
        app(SupportChat::class)->close($conversation);
        $code = $this->postJson('/support-chat/code')->assertOk()->json('code');

        // A right code does not use up attempts.
        $this->postJson('/support-chat/lookup', ['code' => $code])->assertOk();
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/support-chat/lookup', ['code' => 'WRONG-CODE'.$attempt])->assertNotFound();
        }
        $this->postJson('/support-chat/lookup', ['code' => $code])->assertTooManyRequests()
            ->assertJsonPath('message', 'Bạn đã nhập sai mã nhiều lần. Vui lòng thử lại sau 10 phút.');

        $this->travel(11)->minutes();
        $this->postJson('/support-chat/lookup', ['code' => $code])->assertOk();
    }

    public function test_a_customer_reads_their_past_conversations_from_their_account(): void
    {
        $customer = User::factory()->create();
        $this->actingAs($customer)->postJson('/support-chat/messages', ['message' => 'Nhân viên xem giúp đơn của mình với, mình đặt hôm qua mà chưa thấy ai gọi xác nhận, mình cần gấp cho giải cuối tuần'])->assertOk();
        $conversation = SupportConversation::sole();
        $strangers = $this->ticketOf(User::factory()->create());

        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->has('conversations', 1)
            ->where('conversations.0.id', $conversation->id)
            ->where('conversations.0.status', 'open')
            ->where('conversations.0.messages', 2)
            ->where('conversations.0.excerpt', fn (string $excerpt) => str_starts_with($excerpt, 'Nhân viên xem giúp đơn của mình') && str_ends_with($excerpt, '...'))
            // What the shop keeps to itself stays there.
            ->missing('conversations.0.assigned_name')->missing('conversations.0.needs_human'));

        $this->getJson('/support-chat/conversations/'.$conversation->id)->assertOk()
            ->assertJsonPath('status', 'open')->assertJsonCount(2, 'messages');
        $this->getJson('/support-chat/conversations/'.$strangers->id)->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->getJson('/support-chat/conversations/'.$conversation->id)->assertUnauthorized();
    }

    public function test_staff_see_who_they_are_answering_and_what_came_before(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $customer = User::factory()->create(['name' => 'Lê Thu Hà', 'email' => 'ha@example.com']);
        $customer->forceFill(['segment' => 'active'])->save();
        $order = $this->orderWithProduct($customer, 'Vợt Astrox 88', ['status' => 'delivered', 'payment_status' => 'paid']);
        $this->orderWithProduct(User::factory()->create(), 'Vợt Của Người Khác');
        $earlier = $this->ticketOf($customer, 'Shop còn màu xanh không?', 'closed');
        $conversation = $this->ticketOf($customer, 'Vợt mình mua bị lỏng cán');

        $this->actingAs($admin)->get('/admin/support-chat?conversation='.$conversation->id)->assertInertia(fn (Assert $page) => $page
            ->where('selected.customer_name', 'Lê Thu Hà')->where('selected.is_ticket', true)
            ->where('can_manage_shop', true)
            ->where('context.customer.email', 'ha@example.com')->where('context.customer.segment', 'active')
            ->where('context.overview.orders', 1)->where('context.overview.spent', 500000)
            ->has('context.orders', 1)->where('context.orders.0.code', $order->code)->where('context.orders.0.status', 'delivered')
            ->where('context.purchased', [['name' => 'Vợt Astrox 88', 'units' => 1]])
            // The conversation on screen is not listed among the earlier ones.
            ->has('context.conversations', 1)->where('context.conversations.0.id', $earlier->id)
            ->where('context.conversations.0.status', 'closed')->where('context.conversations.0.excerpt', 'Shop còn màu xanh không?'));

        // A visitor without an account: nothing is known but the visit itself.
        $guest = $this->ticket();
        $this->get('/admin/support-chat?conversation='.$guest->id)->assertInertia(fn (Assert $page) => $page
            ->where('selected.customer_name', null)
            ->where('context.customer', null)->where('context.overview', null)
            ->where('context.orders', [])->where('context.purchased', [])->where('context.conversations', []));

        // The customer's page lists every conversation of theirs.
        $this->get('/admin/customers/'.$customer->id.'?tab=conversations')->assertInertia(fn (Assert $page) => $page
            ->where('tab', 'conversations')->has('conversations', 2)
            ->where('conversations.0.id', $conversation->id)->where('conversations.1.status', 'closed'));
    }

    public function test_support_staff_get_a_not_found_for_a_conversation_the_assistant_handled_alone(): void
    {
        $botOnly = $this->automatedConversation();
        $support = $this->member('support');
        $this->actingAs($support);

        // Neither its messages nor whether that number is real are disclosed.
        $this->get('/admin/support-chat?conversation='.$botOnly->id)
            ->assertNotFound()
            ->assertDontSee('Phí giao hàng là 30.000 ₫.');
        $this->get('/admin/support-chat?conversation=999999')->assertNotFound();

        // Claim, reply, resolve, close and release stay ticket-only.
        $this->post('/admin/support-chat/'.$botOnly->id.'/claim')->assertSessionHasErrors('claim');
        $this->post('/admin/support-chat/'.$botOnly->id.'/reply', ['message' => 'Xin chào'])->assertSessionHasErrors('message');
        $this->post('/admin/support-chat/'.$botOnly->id.'/resolve')->assertSessionHasErrors('claim');
        $this->post('/admin/support-chat/'.$botOnly->id.'/close')->assertSessionHasErrors('claim');
        $this->post('/admin/support-chat/'.$botOnly->id.'/release')->assertSessionHasErrors('claim');
        $this->assertSame(['open', false, null], [
            $botOnly->fresh()->status,
            $botOnly->fresh()->needs_human,
            $botOnly->fresh()->assigned_to,
        ]);
    }

    public function test_support_staff_can_read_a_real_ticket(): void
    {
        $ticket = $this->ticketOf(User::factory()->create(), 'Vợt của mình bị nứt khung');
        $support = $this->member('support');

        $this->actingAs($support)->get('/admin/support-chat?conversation='.$ticket->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/support-chat')
                ->where('selected.id', $ticket->id)
                ->where('selected.is_ticket', true)
                ->where('messages', fn ($messages) => collect($messages)->pluck('body')->contains('Vợt của mình bị nứt khung')));
    }

    public function test_managers_can_read_a_conversation_the_assistant_handled_alone(): void
    {
        $botOnly = $this->automatedConversation(User::factory()->create(['name' => 'Lê Thu Hà']));

        foreach ([User::factory()->create(['is_admin' => true]), $this->member('staff')] as $manager) {
            $this->actingAs($manager)->get('/admin/support-chat?conversation='.$botOnly->id)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('admin/support-chat')
                    ->where('selected.id', $botOnly->id)
                    ->where('selected.is_ticket', false)
                    ->where('selected.customer_name', 'Lê Thu Hà')
                    ->where('messages.0.body', 'Phí giao hàng')
                    ->where('messages.1.body', 'Phí giao hàng là 30.000 ₫.'));
        }
    }

    public function test_staff_can_open_a_finished_conversation_with_the_code_the_customer_reads_again(): void
    {
        $customer = User::factory()->create();
        $ticket = $this->ticketOf($customer, 'Đơn của tôi bị lỗi', 'closed');
        $botOnly = $this->automatedConversation($customer);
        app(SupportChat::class)->close($botOnly);
        $ticketCode = app(SupportChat::class)->issueCode($ticket)['code'];
        $botCode = app(SupportChat::class)->issueCode($botOnly)['code'];
        $ticketUrl = route('admin.support-chat.index', ['status' => 'all', 'conversation' => $ticket->id]);
        $botUrl = route('admin.support-chat.index', ['status' => 'all', 'conversation' => $botOnly->id]);

        // Those who manage the shop may read either; support staff only the ticket.
        $owner = User::factory()->create(['is_admin' => true]);
        $this->actingAs($owner)->post('/admin/support-chat/lookup', ['code' => $ticketCode])
            ->assertRedirect($ticketUrl);
        $this->post('/admin/support-chat/lookup', ['code' => $botCode])->assertRedirect($botUrl);

        $support = $this->member('support');
        $this->actingAs($support)->post('/admin/support-chat/lookup', ['code' => $ticketCode])
            ->assertRedirect($ticketUrl);
        $this->from('/admin/support-chat')->post('/admin/support-chat/lookup', ['code' => $botCode])
            ->assertRedirect('/admin/support-chat')->assertSessionHasErrors('code');
        $this->post('/admin/support-chat/lookup', ['code' => 'AAAAA-BBBBB'])
            ->assertSessionHasErrors('code');
    }

    public function test_support_staff_do_not_receive_automated_conversations_in_the_customer_context(): void
    {
        $customer = User::factory()->create();
        $botOnly = $this->automatedConversation($customer);
        $earlier = $this->ticketOf($customer, 'Ticket cũ', 'closed');
        $ticket = $this->ticketOf($customer, 'Ticket đang mở');

        // Only tickets are listed next to the conversation they are working on.
        $this->actingAs($this->member('support'))->get('/admin/support-chat?conversation='.$ticket->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('context.conversations', 1)
                ->where('context.conversations.0.id', $earlier->id)
                ->where('context.conversations.0.needs_human', true)
                ->where('context.conversations', fn ($rows) => collect($rows)->pluck('excerpt')->doesntContain('Phí giao hàng')));

        // Those who manage the shop still get every conversation, as the customer's page links to them.
        $this->actingAs(User::factory()->create(['is_admin' => true]))->get('/admin/support-chat?conversation='.$ticket->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('context.conversations', 2)
                ->where('context.conversations', fn ($rows) => collect($rows)->pluck('id')->sort()->values()->all() === collect([$botOnly->id, $earlier->id])->sort()->values()->all()));
    }

    public function test_the_open_widget_asking_for_new_messages_does_not_use_up_what_else_the_visitor_may_do(): void
    {
        // The widget asks every few seconds: a minute of it is more requests than a visitor may
        // send messages, enter coupons or place orders in that minute. Each has its own count.
        foreach (range(1, 20) as $poll) {
            $this->getJson('/support-chat/messages')->assertOk();
        }

        $this->postJson('/support-chat/messages', ['message' => 'Nhân viên xem giúp yêu cầu riêng này'])->assertOk();
        $this->post(route('cart.coupon.store'), ['code' => 'KHONG-CO'])->assertSessionHasErrors('coupon');
        $this->post(route('checkout.store'), [])->assertSessionHasErrors('checkout_token');
        app(SupportChat::class)->close(SupportConversation::sole());
        $this->postJson('/support-chat/code')->assertOk();

        // No route of the shop is left on the counter every unnamed limit shares.
        foreach (Route::getRoutes() as $route) {
            if (str_starts_with((string) $route->getActionName(), 'App\\')) {
                $this->assertSame([], preg_grep('/^throttle:\d+,\d+$/', $route->gatherMiddleware()), $route->uri());
            }
        }
    }

    public function test_a_long_conversation_shows_its_latest_messages(): void
    {
        $conversation = $this->ticket();
        foreach (range(1, 110) as $number) {
            $conversation->messages()->create(['sender' => 'admin', 'body' => 'Tin '.$number]);
        }

        $this->getJson('/support-chat/messages')->assertJsonCount(100, 'messages')
            ->assertJsonPath('messages.99.body', 'Tin 110')->assertJsonPath('messages.0.body', 'Tin 11');
    }

    /** A staff account with one of the roles in App\Models\User::ROLES. */
    private function member(string $role): User
    {
        return User::factory()->create(['is_admin' => true, 'role' => $role]);
    }

    /** A conversation the automatic assistant answered without handing it to the staff. */
    private function automatedConversation(?User $customer = null): SupportConversation
    {
        $conversation = SupportConversation::create([
            'session_key' => Str::random(64),
            'user_id' => $customer?->id,
            'needs_human' => false,
            'status' => 'open',
            'last_message_at' => now(),
        ]);
        $conversation->messages()->create(['sender' => 'customer', 'body' => 'Phí giao hàng']);
        $conversation->messages()->create(['sender' => 'bot', 'body' => 'Phí giao hàng là 30.000 ₫.']);

        return $conversation;
    }

    /** A visitor's message the assistant could not answer: a ticket for the staff. */
    private function ticket(): SupportConversation
    {
        $this->postJson('/support-chat/messages', ['message' => 'Nhân viên xem giúp yêu cầu riêng này'])->assertOk();

        return SupportConversation::query()->latest('id')->firstOrFail();
    }

    private function ticketOf(User $customer, string $message = 'Cần nhân viên hỗ trợ', string $status = 'open'): SupportConversation
    {
        $conversation = SupportConversation::create([
            'session_key' => Str::random(64), 'user_id' => $customer->id, 'needs_human' => true, 'status' => $status, 'last_message_at' => now(),
        ]);
        $conversation->messages()->create(['sender' => 'customer', 'body' => $message]);

        return $conversation;
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
