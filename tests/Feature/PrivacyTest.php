<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ServiceOrder;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Models\User;
use App\Services\ShopSettings;
use App\Support\Frontend;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The privacy policy page and the promises it makes: it is the owner's to publish, it states
 * what the code does, and what it says is removed really is.
 */
class PrivacyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['shop.seo.index' => true, 'app.frontend_url' => 'https://shop.example', 'app.name' => 'Shop Cầu Lông']);
    }

    private function member(string $role): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true, 'role' => $role])->save();

        return $user;
    }

    /** @param  array<string, mixed>  $attributes */
    private function conversation(array $attributes): SupportConversation
    {
        $conversation = SupportConversation::create(['session_key' => hash('sha256', (string) Str::uuid()), ...$attributes]);
        SupportMessage::create(['conversation_id' => $conversation->id, 'sender' => 'customer', 'body' => 'Shop còn cây này không?']);

        return $conversation;
    }

    public function test_the_policy_is_a_draft_only_admins_can_read_until_the_owner_publishes_it(): void
    {
        $this->get('/privacy')->assertNotFound();
        $this->actingAs(User::factory()->create())->get('/privacy')->assertNotFound();
        // Staff who do not own the shop do not see what it has not said yet.
        $this->actingAs($this->member('staff'))->get('/privacy')->assertNotFound();
        $this->actingAs($this->member('support'))->get('/privacy')->assertNotFound();

        $this->actingAs($this->member('admin'))->get('/privacy')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/privacy')->where('published', false)->where('shop.privacy', false)
            // A draft is nobody's search result.
            ->where('seo.index', false)->where('seo.canonical', 'https://shop.example/privacy'));
        $this->assertStringNotContainsString('/privacy', (string) $this->get('/sitemap.xml')->getContent());
    }

    public function test_the_owner_publishes_it_once_customers_have_somewhere_to_ask(): void
    {
        $admin = $this->member('admin');
        $settings = ['shipping_fee' => 30000, 'free_shipping_threshold' => 1000000];

        // The page sends customers to the shop with their questions: there must be a way to reach it.
        $this->actingAs($admin)->from('/admin/settings')->put('/admin/settings', [...$settings, 'privacy_published' => true])
            ->assertRedirect('/admin/settings')->assertSessionHasErrors('privacy_published');
        $this->assertFalse(app(ShopSettings::class)->privacyPublished());

        $this->put('/admin/settings', [...$settings, 'contact_email' => 'chao@shop.example', 'privacy_published' => true])->assertSessionHasNoErrors();
        $this->get('/admin/settings')->assertInertia(fn (Assert $page) => $page->where('settings.privacy_published', true));

        // Now anyone reads it, the shop's pages link to it, and search engines may list it.
        auth()->logout();
        $this->get('/privacy')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('published', true)->where('shop.privacy', true)->where('policy.contact.email', 'chao@shop.example')
            ->where('seo.index', true)->where('seo.title', 'Chính sách quyền riêng tư - Shop Cầu Lông'));
        $this->get('/')->assertInertia(fn (Assert $page) => $page->where('shop.privacy', true));
        $this->assertStringContainsString(
            '<url><loc>https://shop.example/privacy</loc><lastmod>'.config('shop.privacy.updated').'</lastmod></url>',
            (string) preg_replace('/\s+/', '', (string) $this->get('/sitemap.xml')->getContent()),
        );

        // Taken back: a draft again.
        $this->actingAs($admin)->put('/admin/settings', [...$settings, 'contact_email' => 'chao@shop.example', 'privacy_published' => false])->assertSessionHasNoErrors();
        auth()->logout();
        $this->get('/privacy')->assertNotFound();
    }

    public function test_the_policy_states_what_the_shop_does_and_nothing_it_does_not(): void
    {
        $admin = $this->member('admin');
        config(['mail.default' => 'array', 'session.driver' => 'array', 'shop.stringing.enabled' => false]);

        // The periods are the ones the clean-up jobs go by.
        $this->actingAs($admin)->get('/privacy')->assertInertia(fn (Assert $page) => $page
            ->where('policy.shop', 'Shop Cầu Lông')->where('policy.updated', config('shop.privacy.updated'))
            ->where('policy.keep.events', CustomerEvent::KEEP_DAYS)->where('policy.keep.emails', EmailLog::KEEP_DAYS)
            ->where('policy.keep.guest_chats', SupportConversation::GUEST_KEEP_DAYS)
            ->where('policy.keep.order_link', Frontend::ORDER_LINK_DAYS)->where('policy.keep.chat_code', config('shop.support.code_days'))
            // Nothing about a bank transfer, a stringing request, an email provider or stored
            // addresses while the shop has none of them.
            ->where('policy.bank_transfer', false)->where('policy.stringing', false)
            ->where('policy.email_provider', null)->where('policy.session_ip', false));

        config(['mail.default' => 'resend', 'session.driver' => 'database', 'shop.stringing.enabled' => true]);
        app(ShopSettings::class)->save([
            'bank_transfer_enabled' => 1, 'bank_bin' => '970436', 'bank_account_number' => '0123456789', 'bank_account_name' => 'NGUYEN VAN A',
        ]);
        $this->get('/privacy')->assertInertia(fn (Assert $page) => $page
            ->where('policy.bank_transfer', true)->where('policy.stringing', true)
            ->where('policy.email_provider', 'Resend')->where('policy.session_ip', true));
    }

    public function test_finished_conversations_of_visitors_without_an_account_are_removed_after_a_year(): void
    {
        $long = SupportConversation::GUEST_KEEP_DAYS + 1;
        $old = $this->conversation(['status' => 'closed', 'closed_at' => now()->subDays($long)]);
        $recent = $this->conversation(['status' => 'closed', 'closed_at' => now()->subDays($long - 2)]);
        // Never closed: still somebody's open question, however old.
        $open = $this->conversation(['status' => 'open', 'created_at' => now()->subDays($long)]);
        // A customer's own history stays with their account.
        $theirs = $this->conversation(['user_id' => User::factory()->create()->id, 'status' => 'closed', 'closed_at' => now()->subDays($long)]);

        $this->artisan('model:prune', ['--model' => [SupportConversation::class]])->assertSuccessful();

        $this->assertSame([$recent->id, $open->id, $theirs->id], SupportConversation::query()->orderBy('id')->pluck('id')->all());
        // Its messages go with it.
        $this->assertSame(0, SupportMessage::where('conversation_id', $old->id)->count());
        $this->assertSame(3, SupportMessage::count());

        // And it runs by itself, every day.
        $scheduled = collect(app(Schedule::class)->events())->first(fn ($event) => str_contains((string) $event->command, 'model:prune'));
        $this->assertNotNull($scheduled);
        $this->assertStringContainsString(SupportConversation::class, (string) $scheduled->command);
        $this->assertSame('0 0 * * *', $scheduled->expression);
    }

    public function test_deleting_an_account_removes_what_the_policy_says_and_keeps_the_orders(): void
    {
        $user = User::factory()->create();
        $product = Product::create([
            'name' => 'Vợt Thử', 'slug' => 'vot-thu', 'description' => 'Cây vợt cân bằng.', 'play_style' => 'balanced', 'skill_level' => 'beginner',
            'is_active' => true, 'is_demo' => false,
        ]);
        $order = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $user->id, 'name' => 'Nguyễn An',
            'phone' => '0901234567', 'address' => '12 Nguyễn Huệ', 'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000,
        ]);
        $service = ServiceOrder::create([
            'public_id' => (string) Str::uuid(), 'booking_token' => (string) Str::uuid(), 'user_id' => $user->id, 'name' => 'Nguyễn An',
            'phone' => '0901234567', 'service_type' => 'own_string', 'racket' => 'Vợt Thử', 'tension_kg' => 11,
        ]);
        CustomerEvent::create(['user_id' => $user->id, 'name' => 'product_view', 'product_id' => $product->id]);
        $user->wishlist()->attach($product->id);
        ProductReview::create(['user_id' => $user->id, 'product_id' => $product->id, 'rating' => 5, 'body' => 'Đánh rất đầm tay.', 'status' => 'approved']);
        EmailLog::create(['type' => 'welcome', 'recipient' => $user->email, 'subject' => 'Chào mừng', 'status' => 'sent', 'user_id' => $user->id]);
        Coupon::create(['code' => 'RIENG10', 'name' => 'Mã riêng', 'type' => 'percent', 'value' => 10, 'user_id' => $user->id]);
        $this->conversation(['user_id' => $user->id, 'status' => 'closed', 'closed_at' => now()]);

        // Only the customer themselves, with their password given again.
        $this->delete(route('account.destroy'), ['password' => 'password'])->assertRedirect(route('login'));
        $this->actingAs($user)->from('/account')->delete(route('account.destroy'), ['password' => 'khong-phai'])
            ->assertRedirect('/account')->assertSessionHasErrors('password');
        $this->assertNotNull($user->fresh());

        $this->delete(route('account.destroy'), ['password' => 'password'])
            ->assertSessionHasNoErrors()->assertRedirect(route('products.index'))->assertSessionHas('success');

        $this->assertGuest();
        $this->assertNull($user->fresh());
        foreach (['customer_events', 'wishlists', 'product_reviews', 'email_logs', 'coupons', 'support_conversations', 'support_messages'] as $table) {
            $this->assertSame(0, DB::table($table)->count(), $table);
        }
        // The shop's sales records stay, no longer tied to an account.
        $this->assertNull($order->fresh()?->user_id);
        $this->assertSame('Nguyễn An', $order->fresh()?->name);
        $this->assertNull($service->fresh()?->user_id);
    }

    public function test_a_staff_account_is_not_deleted_by_its_owner(): void
    {
        // Else the only admin could leave the shop with nobody to run it. An admin takes the
        // staff rights away first (/admin/staff); then it is a customer's account like any other.
        foreach (['admin', 'staff', 'support'] as $role) {
            $member = $this->member($role);
            foreach (['account.destroy', 'profile.destroy'] as $route) {
                $this->actingAs($member)->from('/account')->delete(route($route), ['password' => 'password'])
                    ->assertRedirect('/account')->assertSessionHasErrors('password');
            }
            $this->assertNotNull($member->fresh());
        }
    }
}
