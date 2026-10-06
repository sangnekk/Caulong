<?php

namespace Tests\Feature;

use App\Http\Controllers\WishlistController;
use App\Models\Brand;
use App\Models\CustomerEvent;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WishlistAndReviewsTest extends TestCase
{
    use RefreshDatabase;

    private function product(array $attributes = []): Product
    {
        $product = Product::create(array_merge([
            'name' => 'Vợt '.Str::random(6), 'slug' => 'vot-'.Str::lower(Str::random(8)), 'description' => 'Mô tả',
            'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(['sku' => 'S-'.Str::random(8), 'name' => '4U', 'price' => 1000000, 'stock' => 5, 'is_active' => true]);

        return $product;
    }

    /** An order of one unit of the product, placed by the customer. */
    private function order(User $customer, Product $product, array $attributes = []): Order
    {
        $order = Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => $customer->id,
            'name' => $customer->name, 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 1000000, 'shipping_fee' => 0, 'total' => 1000000, 'status' => 'delivered',
        ], $attributes));
        $variant = $product->variants->first();
        $order->items()->create([
            'variant_id' => $variant->id, 'product_name' => $product->name, 'variant_name' => $variant->name, 'sku' => $variant->sku,
            'unit_price' => 1000000, 'quantity' => 1, 'line_total' => 1000000,
        ]);

        return $order;
    }

    public function test_only_a_signed_in_customer_saves_products_and_only_their_own_list_changes(): void
    {
        $product = $this->product();
        $hidden = $this->product(['is_active' => false]);
        $customer = User::factory()->create();
        $other = User::factory()->create();

        $this->post(route('wishlist.store', $product))->assertRedirect(route('login'));
        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page->where('viewer', null));

        $this->actingAs($customer)->post(route('wishlist.store', $product))->assertRedirect()->assertSessionHasNoErrors();
        $this->post(route('wishlist.store', $product))->assertRedirect();
        $this->post(route('wishlist.store', $hidden))->assertNotFound();
        $this->assertSame([$product->id], $customer->wishlist()->pluck('products.id')->all());
        $this->assertSame(1, CustomerEvent::where('name', 'wishlist_added')->where('user_id', $customer->id)->where('product_id', $product->id)->count());

        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page->where('viewer.wishlisted', true));
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page
            ->has('wishlist', 1)->where('wishlist.0.slug', $product->slug)->where('wishlist.0.on_sale', true)->where('wishlist.0.price', 1000000));

        // Someone else sees and changes nothing of it.
        $this->actingAs($other)->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page->where('viewer.wishlisted', false));
        $this->get(route('account'))->assertInertia(fn (Assert $page) => $page->has('wishlist', 0));
        $this->delete(route('wishlist.destroy', $product))->assertRedirect();
        $this->assertSame(1, $customer->wishlist()->count());

        // A product that stopped selling stays on the list, marked, and can still be removed.
        $product->update(['is_active' => false]);
        $this->actingAs($customer)->get(route('account'))->assertInertia(fn (Assert $page) => $page->where('wishlist.0.on_sale', false));
        $this->delete(route('wishlist.destroy', $product))->assertRedirect();
        $this->assertSame(0, $customer->wishlist()->count());
    }

    public function test_the_wishlist_has_a_ceiling(): void
    {
        $customer = User::factory()->create();
        $ids = collect(range(1, WishlistController::LIMIT))->map(fn () => $this->product()->id);
        $customer->wishlist()->attach($ids);

        $this->actingAs($customer)->post(route('wishlist.store', $this->product()))->assertSessionHasErrors('wishlist');
        $this->assertSame(WishlistController::LIMIT, $customer->wishlist()->count());
    }

    public function test_only_a_customer_who_received_the_product_in_a_real_order_can_review_it(): void
    {
        $product = $this->product();
        $other = $this->product();
        $customer = User::factory()->create();
        // The route allows a few reviews a minute; this test posts more than a customer would.
        $this->withoutMiddleware(ThrottleRequests::class);

        $this->post(route('products.reviews.store', $product), ['rating' => 5])->assertRedirect(route('login'));

        $this->actingAs($customer);
        $this->post(route('products.reviews.store', $product), ['rating' => 5])->assertSessionHasErrors('review');
        // Ordered but not received yet, a sample order, someone else's order, another product: none of them counts.
        $this->order($customer, $product, ['status' => 'shipped']);
        $this->order($customer, $product, ['is_demo' => true]);
        $this->order(User::factory()->create(), $product);
        $this->order($customer, $other);
        $this->post(route('products.reviews.store', $product), ['rating' => 5])->assertSessionHasErrors('review');
        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page
            ->where('viewer.review', ['eligible' => false, 'mine' => null]));
        $this->assertSame(0, ProductReview::count());

        $delivered = $this->order($customer, $product);
        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page->where('viewer.review.eligible', true));
        foreach ([0, 6, 'năm', null] as $rating) {
            $this->post(route('products.reviews.store', $product), ['rating' => $rating])->assertSessionHasErrors('rating');
        }
        $this->post(route('products.reviews.store', $product), ['rating' => 4, 'body' => str_repeat('a', 2001)])->assertSessionHasErrors('body');
        $this->post(route('products.reviews.store', $product), ['rating' => 4])
            ->assertSessionHasNoErrors()->assertSessionHas('success', 'Cảm ơn bạn đã đánh giá.');

        $review = ProductReview::sole();
        $this->assertSame([$customer->id, $product->id, $delivered->items->first()->id, 4, null, 'published'], [
            $review->user_id, $review->product_id, $review->order_item_id, $review->rating, $review->body, $review->status,
        ]);
    }

    public function test_stars_alone_appear_at_once_and_words_wait_for_the_shop(): void
    {
        $product = $this->product();
        $customer = User::factory()->create(['name' => 'Nguyễn Văn An']);
        $second = User::factory()->create(['name' => 'Trần Bình']);
        $admin = User::factory()->create(['is_admin' => true]);
        $this->order($customer, $product);
        $this->order($second, $product);

        $this->actingAs($second)->post(route('products.reviews.store', $product), ['rating' => 3]);
        $this->actingAs($customer)->post(route('products.reviews.store', $product), ['rating' => 5, 'body' => '  Vợt đánh rất đầm tay.  '])
            ->assertSessionHas('success', 'Cảm ơn bạn. Đánh giá sẽ hiện sau khi cửa hàng duyệt.');
        // Writing again replaces the review instead of adding a second one.
        $this->post(route('products.reviews.store', $product), ['rating' => 4, 'body' => 'Vợt đánh rất đầm tay.']);
        $mine = ProductReview::where('user_id', $customer->id)->sole();
        $this->assertSame('pending', $mine->status);

        // Unpublished words are shown to nobody but their author.
        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page
            ->where('reviews.count', 1)->where('reviews.average', fn ($average) => (float) $average === 3.0)
            ->has('reviews.items', 1)->where('reviews.items.0.author', 'Bình')->where('reviews.items.0.body', null)
            ->where('viewer.review.mine', ['rating' => 4, 'body' => 'Vợt đánh rất đầm tay.', 'status' => 'pending']));

        $this->patch(route('admin.reviews.update', $mine), ['status' => 'published'])->assertForbidden();
        $this->actingAs($admin)->get(route('admin.reviews.index'))->assertInertia(fn (Assert $page) => $page
            ->component('admin/reviews')->where('status', 'pending')
            ->where('counts', ['pending' => 1, 'published' => 1, 'hidden' => 0])
            ->has('reviews.data', 1)
            ->where('reviews.data.0.customer.email', $customer->email)
            ->where('reviews.data.0.product.slug', $product->slug)
            ->where('shop.pending_reviews', 1));
        $this->patch(route('admin.reviews.update', $mine), ['status' => 'deleted'])->assertSessionHasErrors('status');
        $this->patch(route('admin.reviews.update', $mine), ['status' => 'published'])
            ->assertSessionHas('success', 'Đã hiện đánh giá trên trang sản phẩm.');

        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page
            ->where('reviews.count', 2)->where('reviews.average', 3.5)
            ->where('reviews.items.0.author', 'An')->where('reviews.items.0.rating', 4)
            ->missing('reviews.items.0.user')->missing('reviews.items.0.email'));

        $this->patch(route('admin.reviews.update', $mine), ['status' => 'hidden']);
        $this->get(route('products.show', $product))->assertInertia(fn (Assert $page) => $page->where('reviews.count', 1));
        $this->get(route('admin.reviews.index', ['status' => 'hidden']))->assertInertia(fn (Assert $page) => $page->has('reviews.data', 1));
    }

    public function test_saved_products_and_account_history_shape_the_suggestions(): void
    {
        $brand = Brand::create(['name' => 'Hãng A', 'slug' => 'hang-a']);
        $other = Brand::create(['name' => 'Hãng B', 'slug' => 'hang-b']);
        $saved = $this->product(['brand_id' => $brand->id]);
        $alike = collect(range(1, 4))->map(fn () => $this->product(['brand_id' => $brand->id]));
        $viewed = $this->product(['brand_id' => $other->id, 'play_style' => 'speed']);
        $nearViewed = $this->product(['brand_id' => $other->id, 'play_style' => 'speed']);
        $customer = User::factory()->create();

        // A guest with no history and a shop with no sales: no list is made up.
        $this->getJson(route('recommendations', ['suggest' => 1]))->assertOk()->assertJson(['basis' => null, 'suggested' => []]);

        $customer->wishlist()->attach($saved->id);
        CustomerEvent::create(['user_id' => $customer->id, 'name' => 'product_view', 'product_id' => $viewed->id]);
        $suggested = collect($this->actingAs($customer)->getJson(route('recommendations', ['suggest' => 1]))
            ->assertOk()->assertJsonPath('basis', 'personal')->json('suggested'))->pluck('id');

        // What resembles the saved racket comes before what resembles one that was only looked at.
        $this->assertEqualsCanonicalizing($alike->pluck('id')->all(), $suggested->take(4)->all());
        $this->assertSame($nearViewed->id, $suggested->get(4));
        $this->assertNotContains($saved->id, $suggested->all());
        $this->assertNotContains($viewed->id, $suggested->all());
    }
}
