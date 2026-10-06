<?php

namespace Tests\Feature;

use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\CustomerEvents;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Tests\TestCase;

class CustomerEventsTest extends TestCase
{
    use RefreshDatabase;

    private function product(array $attributes = [], array $variant = []): Product
    {
        $product = Product::create(array_merge([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(array_merge([
            'sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 500000, 'stock' => 10, 'is_active' => true,
        ], $variant));

        return $product;
    }

    public function test_the_browser_reports_a_product_view_once_per_visit(): void
    {
        $product = $this->product();
        $hidden = $this->product(['is_active' => false]);

        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => $product->id])->assertNoContent();
        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => $product->id])->assertNoContent();
        // A product that is not on sale, or does not exist, is nobody's view.
        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => $hidden->id])->assertNoContent();
        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => 999999])->assertNoContent();

        $event = CustomerEvent::sole();
        $this->assertSame('product_view', $event->name);
        $this->assertSame($product->id, $event->product_id);
        $this->assertNull($event->user_id);
        $this->assertSame(64, strlen((string) $event->session_key));
        $this->assertNull($event->metadata);

        // The same page half an hour later is a new visit.
        $event->forceFill(['created_at' => now()->subMinutes(31)])->save();
        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => $product->id])->assertNoContent();
        $this->assertSame(2, CustomerEvent::count());
    }

    public function test_only_listed_events_are_accepted_from_the_browser(): void
    {
        $product = $this->product();

        // Recorded by the server when it happens; a browser cannot claim it.
        $this->postJson(route('events.store'), ['name' => 'order_placed'])->assertJsonValidationErrors('name');
        $this->postJson(route('events.store'), ['name' => 'add_to_cart', 'product' => $product->id])->assertJsonValidationErrors('name');
        $this->postJson(route('events.store'), ['name' => 'product_view'])->assertJsonValidationErrors('product');
        $this->postJson(route('events.store'), ['name' => 'search', 'q' => str_repeat('a', 101)])->assertJsonValidationErrors('q');
        $this->assertSame(0, CustomerEvent::count());
    }

    public function test_search_and_checkout_events_take_their_figures_from_the_server(): void
    {
        $product = $this->product([], ['price' => 700000]);

        $this->postJson(route('events.store'), ['name' => 'search', 'q' => '  Astrox 88  ', 'results' => 5, 'product' => $product->id])->assertNoContent();
        $this->postJson(route('events.store'), ['name' => 'search', 'q' => 'ASTROX 88', 'results' => 5])->assertNoContent();
        $search = CustomerEvent::sole();
        $this->assertSame(['q' => 'astrox 88', 'results' => 5], $search->metadata);
        $this->assertNull($search->product_id);

        // An empty cart is not a checkout.
        $this->postJson(route('events.store'), ['name' => 'checkout_started'])->assertNoContent();
        $this->assertSame(1, CustomerEvent::count());

        $this->withSession(['shopping_cart' => [$product->variants->first()->id => 2]])
            ->postJson(route('events.store'), ['name' => 'checkout_started', 'subtotal' => 1, 'items' => 99])->assertNoContent();
        $this->assertSame(['items' => 2, 'subtotal' => 1400000], CustomerEvent::where('name', 'checkout_started')->sole()->metadata);
    }

    public function test_cart_order_and_chat_actions_are_recorded_where_they_happen(): void
    {
        $customer = User::factory()->create();
        $product = $this->product([], ['price' => 600000]);
        $variant = $product->variants->first();
        $other = $this->product();

        $this->actingAs($customer)->post(route('cart.store'), ['variant_id' => $variant->id, 'quantity' => 2])->assertSessionHasNoErrors();
        $this->post(route('cart.store'), ['variant_id' => $other->variants->first()->id, 'quantity' => 1]);
        $this->delete(route('cart.destroy', $other->variants->first()->id));
        // Not in the cart: nothing was removed.
        $this->delete(route('cart.destroy', 999999));

        $added = CustomerEvent::where('name', 'add_to_cart')->orderBy('id')->first();
        $this->assertSame($customer->id, $added->user_id);
        $this->assertSame($product->id, $added->product_id);
        $this->assertSame(['variant_id' => $variant->id, 'quantity' => 2, 'price' => 600000], $added->metadata);
        $removed = CustomerEvent::where('name', 'remove_from_cart')->sole();
        $this->assertSame($other->id, $removed->product_id);

        $this->get(route('checkout.index'))->assertOk();
        $this->post(route('checkout.store'), [
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ, Quận 1',
            'payment_method' => 'cod', 'accept_terms' => true,
        ])->assertSessionHasNoErrors();
        $order = Order::sole();
        $placed = CustomerEvent::where('name', 'order_placed')->sole();
        $this->assertSame($order->id, $placed->order_id);
        $this->assertSame(['items' => 2, 'total' => $order->total], $placed->metadata);
        $this->assertSame($added->session_key, $placed->session_key);
        // Nothing of what the customer typed at checkout is in any event.
        $this->assertStringNotContainsString('0901234567', (string) CustomerEvent::query()->toBase()->pluck('metadata')->implode(' '));

        $this->postJson(route('support-chat.messages.store'), ['message' => 'Shop còn vợt 4U không?'])->assertOk();
        $this->postJson(route('support-chat.messages.store'), ['message' => 'Cảm ơn shop'])->assertOk();
        $this->assertSame(1, CustomerEvent::where('name', 'chat_started')->count());
    }

    public function test_metadata_keeps_only_what_the_event_is_allowed_to_carry(): void
    {
        $request = Request::create('/');
        $request->setLaravelSession($this->app['session.store']);
        $events = $this->app->make(CustomerEvents::class);

        $event = $events->record($request, 'search', metadata: [
            'q' => str_repeat('á', 300), 'results' => 3,
            'password' => 'bi-mat', 'token' => 'abc', 'otp' => '123456', 'card' => ['number' => '4111'], 'address' => '12 Nguyễn Huệ',
        ]);
        $this->assertNotNull($event);
        $this->assertSame(['q', 'results'], array_keys($event->metadata));
        $this->assertSame(100, mb_strlen($event->metadata['q']));

        // Nothing but whole numbers, booleans and short text: anything else is dropped.
        $odd = $events->record($request, 'add_to_cart', metadata: ['variant_id' => ['x' => 1], 'quantity' => 2, 'price' => 1.5]);
        $this->assertSame(['quantity' => 2], $odd?->metadata);

        $this->expectException(InvalidArgumentException::class);
        $events->record($request, 'password_typed');
    }

    public function test_what_a_guest_did_joins_the_account_when_they_sign_in(): void
    {
        $product = $this->product();
        $customer = User::factory()->create();
        $stranger = CustomerEvent::create(['session_key' => str_repeat('a', 64), 'name' => 'product_view', 'product_id' => $product->id]);

        $this->postJson(route('events.store'), ['name' => 'product_view', 'product' => $product->id])->assertNoContent();
        $mine = CustomerEvent::where('id', '!=', $stranger->id)->sole();
        $this->assertNull($mine->user_id);

        $this->post(route('login.store'), ['email' => $customer->email, 'password' => 'password'])->assertRedirect();
        $this->assertAuthenticatedAs($customer);
        $this->assertSame($customer->id, $mine->fresh()->user_id);
        // Another visitor's history stays anonymous.
        $this->assertNull($stranger->fresh()->user_id);
    }

    public function test_staff_are_not_customers_and_old_history_is_pruned(): void
    {
        $product = $this->product();
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->postJson(route('events.store'), ['name' => 'product_view', 'product' => $product->id])->assertNoContent();
        $this->post(route('cart.store'), ['variant_id' => $product->variants->first()->id, 'quantity' => 1])->assertSessionHasNoErrors();
        $this->assertSame(0, CustomerEvent::count());

        $customer = User::factory()->create();
        CustomerEvent::create(['user_id' => $customer->id, 'name' => 'product_view', 'product_id' => $product->id, 'created_at' => now()->subDays(CustomerEvent::KEEP_DAYS + 1)]);
        $recent = CustomerEvent::create(['user_id' => $customer->id, 'name' => 'product_view', 'product_id' => $product->id, 'created_at' => now()->subDays(10)]);
        $this->artisan('model:prune', ['--model' => [CustomerEvent::class]])->assertSuccessful();
        $this->assertSame([$recent->id], CustomerEvent::pluck('id')->all());

        // An account that is deleted takes its history with it.
        $customer->delete();
        $this->assertSame(0, CustomerEvent::count());
    }
}
