<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CartService;
use App\Services\CouponService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // The routes allow a few tries a minute; these tests make more than a customer would.
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function variant(int $price = 1000000, array $product = [], int $stock = 10): ProductVariant
    {
        $product = Product::create(array_merge([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'balanced', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $product));

        return $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => $price, 'stock' => $stock, 'is_active' => true]);
    }

    private function coupon(array $attributes = []): Coupon
    {
        return Coupon::create(array_merge(['code' => 'GIAM10', 'name' => 'Giảm 10%', 'type' => 'percent', 'value' => 10], $attributes));
    }

    /** A different person at a different browser: nobody signed in, an empty session. */
    private function visitor(?User $user = null): static
    {
        $this->app['auth']->forgetGuards();
        $this->flushSession();

        return $user ? $this->actingAs($user) : $this;
    }

    /** @param  array<int, int>  $cart  quantity by variant id */
    private function cart(array $cart, ?string $code = null): static
    {
        return $this->withSession(['shopping_cart' => $cart] + ($code === null ? [] : [CartService::COUPON => $code]));
    }

    /** Opens the checkout page (as the customer would) and submits it. */
    private function order(string $phone = '0901234567'): TestResponse
    {
        $this->get(route('checkout.index'))->assertOk();

        return $this->post(route('checkout.store'), [
            'checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => $phone,
            'address' => '12 Nguyễn Huệ, Quận 1', 'payment_method' => 'cod', 'accept_terms' => true,
        ]);
    }

    public function test_a_code_takes_its_share_off_the_cart_and_can_be_taken_back(): void
    {
        $variant = $this->variant(1200000);
        $this->coupon(['max_discount' => 100000]);

        $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => '  giam10 '])
            ->assertSessionHasNoErrors()->assertSessionHas('success', 'Đã áp dụng mã GIAM10.');
        $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
            ->where('cart.subtotal', 1200000)->where('cart.discount', 100000)->where('cart.shipping_fee', 0)->where('cart.total', 1100000)
            ->where('cart.coupon', ['code' => 'GIAM10', 'name' => 'Giảm 10%', 'error' => null]));
        $this->assertSame(['code' => 'GIAM10'], CustomerEvent::where('name', 'coupon_applied')->sole()->metadata);

        // A wrong code says nothing about what exists, and the cart keeps the one it had.
        $this->post(route('cart.coupon.store'), ['code' => 'KHONG-CO'])->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $this->post(route('cart.coupon.store'), ['code' => ''])->assertSessionHasErrors('code');
        $this->assertSame('GIAM10', session(CartService::COUPON));

        $this->delete(route('cart.coupon.destroy'))->assertSessionHas('success', 'Đã bỏ mã giảm giá.');
        $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
            ->where('cart.discount', 0)->where('cart.coupon', null)->where('cart.total', 1200000));

        $this->withSession(['shopping_cart' => []])->post(route('cart.coupon.store'), ['code' => 'GIAM10'])->assertSessionHasErrors('coupon');
    }

    public function test_expired_scheduled_switched_off_and_used_up_coupons_are_refused(): void
    {
        $variant = $this->variant();
        $this->coupon(['code' => 'HETHAN', 'expires_at' => now()->subMinute()]);
        $this->coupon(['code' => 'CHUATOI', 'starts_at' => now()->addDay()]);
        $this->coupon(['code' => 'DATAT', 'is_active' => false]);
        $usedUp = $this->coupon(['code' => 'HETLUOT', 'usage_limit' => 1]);
        $other = Order::create([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'name' => 'Khách khác', 'phone' => '0909999999',
            'address' => 'Địa chỉ', 'subtotal' => 1000000, 'shipping_fee' => 0, 'discount_total' => 100000, 'total' => 900000,
        ]);
        app(CouponService::class)->redeem($usedUp, $other, 100000);
        $this->coupon(['code' => 'CONHAN', 'starts_at' => now()->subDay(), 'expires_at' => now()->addDay(), 'usage_limit' => 5]);

        $try = fn (string $code) => $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => $code]);
        $try('HETHAN')->assertSessionHasErrors(['coupon' => 'Mã giảm giá đã hết hạn.']);
        $try('CHUATOI')->assertSessionHasErrors(['coupon' => 'Mã giảm giá chưa đến ngày áp dụng.']);
        $try('DATAT')->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $try('HETLUOT')->assertSessionHasErrors(['coupon' => 'Mã giảm giá đã hết lượt sử dụng.']);
        $this->assertNull(session(CartService::COUPON));
        $try('CONHAN')->assertSessionHasNoErrors();

        // A code that stops applying while it sits in the cart takes nothing off and says why.
        Coupon::where('code', 'CONHAN')->update(['expires_at' => now()->subSecond()]);
        $this->get(route('cart.index'))->assertInertia(fn (Assert $page) => $page
            ->where('cart.discount', 0)->where('cart.total', 1000000)
            ->where('cart.coupon', ['code' => 'CONHAN', 'name' => null, 'error' => 'Mã giảm giá đã hết hạn.']));
    }

    public function test_minimum_order_ceiling_and_the_products_a_coupon_counts(): void
    {
        $rackets = Category::create(['name' => 'Vợt', 'slug' => 'vot']);
        $bags = Category::create(['name' => 'Túi', 'slug' => 'tui']);
        $racket = $this->variant(2000000, ['category_id' => $rackets->id]);
        $bag = $this->variant(500000, ['category_id' => $bags->id]);
        $other = $this->variant(300000);
        $sample = $this->variant(400000, ['is_demo' => true]);
        $quote = fn (string $code, array $cart) => $this->cart($cart, $code)->get(route('cart.index'))->viewData('page')['props']['cart'];

        $this->coupon(['code' => 'TU3TR', 'min_order' => 3000000]);
        $this->assertSame('Mã này áp dụng cho đơn có tiền hàng từ 3.000.000 ₫.', $quote('TU3TR', [$racket->id => 1, $bag->id => 1])['coupon']['error']);
        $this->assertSame(300000, $quote('TU3TR', [$racket->id => 1, $bag->id => 2])['discount']);

        // A percentage stops at its ceiling; a fixed amount never exceeds the goods it applies to.
        $this->coupon(['code' => 'TRAN', 'value' => 50, 'max_discount' => 150000]);
        $this->assertSame(150000, $quote('TRAN', [$racket->id => 1])['discount']);
        $this->coupon(['code' => 'GIAM1TR', 'type' => 'fixed', 'value' => 1000000]);
        $this->assertSame(300000, $quote('GIAM1TR', [$other->id => 1])['discount']);
        $this->assertSame(30000, $quote('GIAM1TR', [$other->id => 1])['total']);

        // Listed products and categories: only their lines count.
        $listed = $this->coupon(['code' => 'CHITUI', 'value' => 20]);
        $listed->categories()->attach($bags->id);
        $listed->products()->attach($other->product_id);
        $this->assertSame(160000, $quote('CHITUI', [$racket->id => 1, $bag->id => 1, $other->id => 1])['discount']);
        $this->assertSame('Mã này không áp dụng cho sản phẩm trong giỏ.', $quote('CHITUI', [$racket->id => 1])['coupon']['error']);

        // Sample products never earn a discount, alone or next to real ones.
        $this->coupon();
        $this->assertSame('Mã giảm giá không áp dụng cho sản phẩm mẫu.', $quote('GIAM10', [$sample->id => 1])['coupon']['error']);
        $this->assertSame(30000, $quote('GIAM10', [$sample->id => 1, $other->id => 1])['discount']);
    }

    public function test_a_personal_coupon_is_its_owners_alone(): void
    {
        $variant = $this->variant();
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $mine = app(CouponService::class)->issue($owner, ['name' => 'Quà của bạn', 'type' => 'fixed', 'value' => 50000, 'expires_at' => now()->addDays(14)]);
        $this->assertSame([10, 1, 1, $owner->id], [strlen($mine->code), $mine->usage_limit, $mine->per_customer_limit, $mine->user_id]);
        $this->coupon(['code' => 'CHUNG']);

        // To anyone else the code does not exist: the same words as for a code never made.
        $this->visitor()->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => $mine->code])
            ->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $this->visitor($stranger)->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => $mine->code])
            ->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('coupons', []));

        $this->visitor($owner)->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->has('coupons', 1)
            ->where('coupons.0.code', $mine->code)->where('coupons.0.personal', true)->where('coupons.0.state', 'usable')
            ->where('coupons.0.value', 50000)->missing('coupons.0.id')->missing('coupons.0.user_id'));
        $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => strtolower($mine->code)])->assertSessionHasNoErrors();
        $this->order()->assertSessionHasNoErrors();
        $this->assertSame([50000, $mine->code, 950000], array_values(Order::sole()->only(['discount_total', 'coupon_code', 'total'])));

        // Used once, it is spent: for its owner too.
        $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => $mine->code])
            ->assertSessionHasErrors(['coupon' => 'Mã giảm giá đã hết lượt sử dụng.']);
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('coupons.0.state', 'used'));
    }

    public function test_a_group_coupon_follows_the_customers_group_as_it_is_now(): void
    {
        $variant = $this->variant();
        $newcomer = User::factory()->create();
        $this->coupon(['code' => 'CHAOBAN', 'segment' => 'new']);

        $this->visitor()->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => 'CHAOBAN'])
            ->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $this->visitor($newcomer)->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => 'CHAOBAN'])->assertSessionHasNoErrors();
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->where('coupons.0.code', 'CHAOBAN')->where('coupons.0.personal', false));

        // Their first order makes them a buyer: the welcome coupon is no longer theirs.
        $this->order()->assertSessionHasNoErrors();
        $this->assertSame('active', $newcomer->fresh()->segment);
        $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => 'CHAOBAN'])
            ->assertSessionHasErrors(['coupon' => CouponService::UNUSABLE]);
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('coupons', []));
    }

    public function test_checkout_saves_the_discount_and_counts_one_use(): void
    {
        $variant = $this->variant(1500000, [], 3);
        $customer = User::factory()->create();
        $coupon = $this->coupon();

        $this->actingAs($customer)->cart([$variant->id => 2], 'GIAM10')->get(route('checkout.index'))
            ->assertInertia(fn (Assert $page) => $page->where('cart.discount', 300000)->where('cart.total', 2700000));
        $data = ['checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ, Quận 1', 'payment_method' => 'cod', 'accept_terms' => true];
        // A total sent by the browser is ignored.
        $this->post(route('checkout.store'), $data + ['total' => 1, 'discount_total' => 2999999])->assertSessionHasNoErrors();

        $order = Order::sole();
        $this->assertSame([3000000, 300000, 'GIAM10', 0, 2700000], array_values($order->only(['subtotal', 'discount_total', 'coupon_code', 'shipping_fee', 'total'])));
        $redemption = CouponRedemption::sole();
        $this->assertSame([$coupon->id, $customer->id, $order->id, 300000], array_values($redemption->only(['coupon_id', 'user_id', 'order_id', 'amount'])));
        $this->assertSame(1, $variant->fresh()->stock);
        $this->assertNull(session(CartService::COUPON));
        $this->assertSame(['items' => 2, 'total' => 2700000], CustomerEvent::where('name', 'order_placed')->sole()->metadata);

        // Sent twice: the same order, one use.
        $this->post(route('checkout.store'), $data)->assertRedirect(route('orders.show', $order->public_id));
        $this->assertSame([1, 1], [Order::count(), CouponRedemption::count()]);
        $this->get(route('orders.show', $order->public_id))->assertInertia(fn (Assert $page) => $page
            ->where('order.discount_total', 300000)->where('order.coupon_code', 'GIAM10')->where('order.total', 2700000));
    }

    public function test_the_last_use_goes_to_one_order_and_a_cancelled_order_gives_it_back(): void
    {
        $variant = $this->variant(1000000, [], 5);
        $this->coupon(['usage_limit' => 1]);

        // Two customers both see the discount on their checkout page.
        $this->visitor()->cart([$variant->id => 1], 'GIAM10')->get(route('checkout.index'))->assertOk();
        $late = ['token' => session('checkout_token'), 'discount' => session('checkout_discount')];
        $this->assertSame(100000, $late['discount']);
        $this->visitor()->cart([$variant->id => 1], 'GIAM10')->order('0911111111')->assertSessionHasNoErrors();
        $first = Order::sole();

        // The one who comes second is told, and nothing of theirs is taken.
        $this->visitor()->withSession([
            'shopping_cart' => [$variant->id => 1], CartService::COUPON => 'GIAM10', 'checkout_token' => $late['token'],
            'checkout_discount' => $late['discount'], 'checkout_prices' => [$variant->id => 1000000],
        ])->post(route('checkout.store'), [
            'checkout_token' => $late['token'], 'name' => 'Trần Bình', 'phone' => '0922222222', 'address' => '34 Lê Lợi', 'payment_method' => 'cod', 'accept_terms' => true,
        ])->assertSessionHasErrors(['coupon' => 'Mã giảm giá đã hết lượt sử dụng. Bỏ mã ở giỏ hàng hoặc tải lại trang thanh toán rồi đặt lại.']);
        $this->assertSame([1, 1, 4], [Order::count(), CouponRedemption::count(), $variant->fresh()->stock]);

        // After a reload the page shows no discount, and the order goes through at full price.
        $this->order('0922222222')->assertSessionHasNoErrors();
        $second = Order::latest('id')->first();
        $this->assertSame([0, null, 1000000], array_values($second->only(['discount_total', 'coupon_code', 'total'])));

        app(OrderService::class)->transition($first, 'cancelled');
        $this->assertSame(0, CouponRedemption::count());
        $this->assertSame('GIAM10', $first->fresh()->coupon_code);
        $this->visitor()->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => 'GIAM10'])->assertSessionHasNoErrors();
    }

    public function test_one_use_per_customer_counts_the_account_and_the_phone_number(): void
    {
        $variant = $this->variant();
        $customer = User::factory()->create();
        $this->coupon(['per_customer_limit' => 1]);

        $this->visitor($customer)->cart([$variant->id => 1], 'GIAM10')->order('0901234567')->assertSessionHasNoErrors();
        $this->cart([$variant->id => 1])->post(route('cart.coupon.store'), ['code' => 'GIAM10'])
            ->assertSessionHasErrors(['coupon' => 'Bạn đã dùng hết lượt của mã giảm giá này.']);

        // Signed out, the same phone number is still the same customer; another number is not.
        $this->visitor()->cart([$variant->id => 1], 'GIAM10')->order('0901234567')
            ->assertSessionHasErrors(['coupon' => 'Bạn đã dùng hết lượt của mã giảm giá này. Bỏ mã ở giỏ hàng hoặc tải lại trang thanh toán rồi đặt lại.']);
        $this->visitor()->cart([$variant->id => 1], 'GIAM10')->order('0933333333')->assertSessionHasNoErrors();
        $this->assertSame([2, 2], [Order::count(), CouponRedemption::count()]);
    }

    public function test_an_order_is_refused_when_the_discount_is_no_longer_the_one_shown(): void
    {
        $variant = $this->variant(1000000, [], 5);
        $coupon = $this->coupon();

        $this->cart([$variant->id => 1], 'GIAM10')->get(route('checkout.index'))->assertOk();
        $data = ['checkout_token' => session('checkout_token'), 'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ, Quận 1', 'payment_method' => 'cod', 'accept_terms' => true];
        $coupon->update(['value' => 30]);
        $this->post(route('checkout.store'), $data)->assertSessionHasErrors(['cart' => 'Mức giảm giá đã thay đổi. Vui lòng tải lại trang thanh toán, xem lại tổng tiền rồi đặt hàng lại.']);
        $this->assertSame([0, 5], [Order::count(), $variant->fresh()->stock]);

        // Seen again at the new figure, it goes through at that figure.
        $this->order()->assertSessionHasNoErrors();
        $this->assertSame([300000, 700000], array_values(Order::sole()->only(['discount_total', 'total'])));
    }

    public function test_coupon_use_shows_on_the_customer_page_and_in_the_figures(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $customer = User::factory()->create();
        $variant = $this->variant(2000000);
        $variant->update(['cost_price' => 1200000]);
        $personal = app(CouponService::class)->issue($customer, ['name' => 'Quà riêng', 'type' => 'fixed', 'value' => 200000]);
        $this->visitor($customer)->cart([$variant->id => 1], $personal->code)->order()->assertSessionHasNoErrors();
        $order = Order::sole();

        $this->visitor($admin)->get(route('admin.customers.show', ['user' => $customer, 'tab' => 'coupons']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('coupons.personal', 1)
                ->where('coupons.personal.0.code', $personal->code)->where('coupons.personal.0.state', 'used_up')
                ->has('coupons.used', 1)
                ->where('coupons.used.0.amount', 200000)->where('coupons.used.0.order.id', $order->id));
        $this->get(route('admin.customers.show', ['user' => $customer, 'tab' => 'timeline']))
            ->assertInertia(fn (Assert $page) => $page->where('timeline.entries', fn ($entries) => collect($entries)
                ->contains(fn ($entry) => $entry['type'] === 'coupon_used' && $entry['data'] == ['code' => $personal->code, 'amount' => 200000] && $entry['order']['id'] === $order->id)));

        // Sales are what the customer pays; the discount comes off the profit of the goods.
        $this->get('/admin/reports?period=7d')->assertInertia(fn (Assert $page) => $page
            ->where('totals.sales', 1800000)->where('totals.goods', 2000000)->where('totals.discounts', 200000)
            ->where('totals.costed', 2000000)->where('totals.profit', 600000)
            ->where('series.6.profit', 600000));
        $csv = $this->get('/admin/orders/export')->streamedContent();
        $this->assertStringContainsString('Giảm giá', $csv);
        $this->assertStringContainsString('2000000,200000,'.$personal->code.',0,1800000', $csv);
    }
}
