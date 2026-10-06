<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A discount code. Who may use it: one account (user_id), one customer group (segment), or
 * anyone. Rules and money are worked out in App\Services\CouponService.
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $type
 * @property int $value
 * @property int $min_order
 * @property int|null $max_discount
 * @property CarbonInterface|null $starts_at
 * @property CarbonInterface|null $expires_at
 * @property int|null $usage_limit
 * @property int|null $per_customer_limit
 * @property int|null $user_id
 * @property string|null $segment
 * @property string|null $campaign
 * @property bool $is_active
 * @property CarbonInterface $created_at
 * @property-read User|null $user
 * @property-read Collection<int, Product> $products
 * @property-read Collection<int, Category> $categories
 */
class Coupon extends Model
{
    public const TYPES = ['percent', 'fixed'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'value' => 'integer', 'min_order' => 'integer', 'max_discount' => 'integer',
            'usage_limit' => 'integer', 'per_customer_limit' => 'integer', 'is_active' => 'boolean',
            'starts_at' => 'datetime', 'expires_at' => 'datetime',
        ];
    }

    /** One spelling of a code, however it was typed. */
    public static function normalize(string $code): string
    {
        return mb_strtoupper(trim($code));
    }

    /** @return Attribute<string, string> */
    protected function code(): Attribute
    {
        return Attribute::set(fn (string $value): string => self::normalize($value));
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'coupon_product');
    }

    /** @return BelongsToMany<Category, $this> */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'coupon_category');
    }

    /** @return HasMany<CouponRedemption, $this> */
    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    /**
     * Where the coupon stands right now, given how many orders have used it.
     *
     * @return 'off'|'scheduled'|'expired'|'used_up'|'active'
     */
    public function state(int $used): string
    {
        return match (true) {
            ! $this->is_active => 'off',
            $this->expires_at !== null && $this->expires_at->isPast() => 'expired',
            $this->usage_limit !== null && $used >= $this->usage_limit => 'used_up',
            $this->starts_at !== null && $this->starts_at->isFuture() => 'scheduled',
            default => 'active',
        };
    }
}
