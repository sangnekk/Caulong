<?php

namespace App\Services;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Product reviews. Only a customer who received the product in a real order can write one,
 * one per product; the shop shows the published ones. Nothing here invents a rating.
 */
class ReviewService
{
    public const BODY_LIMIT = 2000;

    /** The delivered line of a real order that entitles the customer to review the product. */
    public function purchase(User $user, Product $product): ?OrderItem
    {
        return OrderItem::query()->select('order_items.*')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->where('orders.user_id', $user->id)->where('orders.is_demo', false)->where('orders.status', 'delivered')
            ->where('product_variants.product_id', $product->id)
            ->orderByDesc('order_items.id')->first();
    }

    /**
     * Writing again replaces the customer's review. Stars alone appear at once; words wait for
     * the shop to read them first.
     */
    public function submit(User $user, Product $product, int $rating, ?string $body): ProductReview
    {
        $purchase = $this->purchase($user, $product);
        if ($purchase === null) {
            throw ValidationException::withMessages(['review' => 'Chỉ khách đã nhận sản phẩm này mới viết được đánh giá.']);
        }

        return ProductReview::updateOrCreate(
            ['user_id' => $user->id, 'product_id' => $product->id],
            ['order_item_id' => $purchase->id, 'rating' => $rating, 'body' => $body, 'status' => $body === null ? 'published' : 'pending'],
        );
    }

    /** @return array{count: int, average: float|null} */
    public function summary(Product $product): array
    {
        $row = ProductReview::query()->published()->where('product_id', $product->id)
            ->toBase()->selectRaw('count(*) as total, avg(rating) as average')->first();
        $count = (int) ($row->total ?? 0);

        return ['count' => $count, 'average' => $count > 0 ? round((float) $row->average, 1) : null];
    }

    /**
     * The latest published reviews, signed with the customer's given name only.
     *
     * @return list<array{id: int, author: string, rating: int, body: string|null, created_at: string|null}>
     */
    public function published(Product $product, int $limit = 20): array
    {
        return array_values(ProductReview::query()->published()->where('product_id', $product->id)
            ->with('user:id,name')->latest('id')->limit($limit)->get()
            ->map(fn (ProductReview $review) => [
                'id' => $review->id,
                'author' => (string) Str::of($review->user->name)->trim()->explode(' ')->last(),
                'rating' => $review->rating,
                'body' => $review->body,
                'created_at' => $review->created_at->toIso8601String(),
            ])->all());
    }

    /**
     * What the signed-in customer may do on the product page.
     *
     * @return array{eligible: bool, mine: array{rating: int, body: string|null, status: string}|null}
     */
    public function viewer(User $user, Product $product): array
    {
        $mine = ProductReview::query()->where('user_id', $user->id)->where('product_id', $product->id)->first();

        return [
            'eligible' => $mine !== null || $this->purchase($user, $product) !== null,
            'mine' => $mine?->only(['rating', 'body', 'status']),
        ];
    }
}
