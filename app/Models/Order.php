<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property CarbonInterface|null $confirmed_at
 * @property CarbonInterface|null $shipped_at
 * @property CarbonInterface|null $delivered_at
 * @property CarbonInterface|null $cancelled_at
 * @property CarbonInterface|null $paid_at
 */
class Order extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['checkout_token'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer', 'shipping_fee' => 'integer', 'total' => 'integer', 'is_demo' => 'boolean',
            'confirmed_at' => 'datetime', 'shipped_at' => 'datetime', 'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime', 'paid_at' => 'datetime',
        ];
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
