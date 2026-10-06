<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A customer's rating of a product they received. Shown in the shop once the shop publishes it.
 *
 * @property int $id
 * @property int $user_id
 * @property int $product_id
 * @property int|null $order_item_id
 * @property int $rating
 * @property string|null $body
 * @property string $status
 * @property CarbonInterface $created_at
 * @property CarbonInterface $updated_at
 * @property-read User $user
 * @property-read Product $product
 */
class ProductReview extends Model
{
    public const STATUSES = ['pending', 'published', 'hidden'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['rating' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @param  Builder<ProductReview>  $query
     * @return Builder<ProductReview>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }
}
