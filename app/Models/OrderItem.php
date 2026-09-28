<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $order_id
 * @property int|null $variant_id
 * @property string $product_name
 * @property string $variant_name
 * @property string $sku
 * @property int $unit_price
 * @property int|null $unit_cost
 * @property int $quantity
 * @property int $line_total
 * @property-read Order $order
 * @property-read ProductVariant|null $variant
 */
class OrderItem extends Model
{
    protected $guarded = ['id'];

    /** Cost at the time of sale: for reports, never shown to the customer. */
    protected $hidden = ['unit_cost'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'unit_cost' => 'integer', 'quantity' => 'integer', 'line_total' => 'integer'];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<ProductVariant, $this> */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }
}
