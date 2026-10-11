<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Money asked for an order before it is sent: a bank transfer. Its rules are in
 * App\Services\PaymentService.
 *
 * @property int $id
 * @property int $order_id
 * @property string $method
 * @property int $amount
 * @property string $reference what the customer writes in the transfer
 * @property string $status one of App\Services\PaymentService::STATUSES
 * @property string|null $provider_transaction_id
 * @property CarbonInterface|null $expires_at
 * @property CarbonInterface|null $paid_at
 * @property int|null $confirmed_by
 * @property CarbonInterface|null $refunded_at
 * @property int|null $refunded_by
 * @property array<string, mixed>|null $payload
 * @property CarbonInterface $created_at
 */
class Payment extends Model
{
    protected $guarded = ['id'];

    // What a provider reported is for the shop's records, not for a page.
    protected $hidden = ['payload', 'provider_transaction_id'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer', 'payload' => 'array',
            'expires_at' => 'datetime', 'paid_at' => 'datetime', 'refunded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<User, $this> */
    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    /** @return BelongsTo<User, $this> */
    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }
}
