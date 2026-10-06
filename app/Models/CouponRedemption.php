<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One order a coupon was used on. Written and removed by App\Services\CouponService only.
 *
 * @property int $id
 * @property int $coupon_id
 * @property int|null $user_id
 * @property int $order_id
 * @property int $amount
 * @property CarbonInterface $created_at
 * @property-read Coupon $coupon
 * @property-read Order $order
 */
class CouponRedemption extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount' => 'integer'];
    }

    /** @return BelongsTo<Coupon, $this> */
    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
