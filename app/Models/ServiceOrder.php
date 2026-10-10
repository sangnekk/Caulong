<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A request to have rackets strung. Its rules are in App\Services\StringingService.
 *
 * @property int $id
 * @property string $public_id
 * @property int|null $user_id
 * @property string $name
 * @property string $phone
 * @property string|null $email
 * @property string $service_type one of App\Services\StringingService::TYPES
 * @property string $racket
 * @property int|null $service_string_id
 * @property string|null $string_name
 * @property float $tension_kg
 * @property int $quantity
 * @property string|null $notes
 * @property CarbonInterface|null $preferred_at
 * @property string $status one of App\Services\StringingService::STATUSES
 * @property int|null $technician_id
 * @property int $string_price
 * @property int $labor_fee
 * @property int $total
 * @property CarbonInterface|null $confirmed_at
 * @property CarbonInterface|null $in_progress_at
 * @property CarbonInterface|null $ready_at
 * @property CarbonInterface|null $completed_at
 * @property CarbonInterface|null $cancelled_at
 * @property CarbonInterface $created_at
 * @property-read string $code the short code customers see (first 8 characters of public_id)
 * @property-read User|null $user
 * @property-read User|null $technician
 */
class ServiceOrder extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['booking_token'];

    protected function casts(): array
    {
        return [
            'tension_kg' => 'float', 'quantity' => 'integer',
            'string_price' => 'integer', 'labor_fee' => 'integer', 'total' => 'integer',
            'preferred_at' => 'datetime', 'confirmed_at' => 'datetime', 'in_progress_at' => 'datetime',
            'ready_at' => 'datetime', 'completed_at' => 'datetime', 'cancelled_at' => 'datetime',
        ];
    }

    /**
     * The same short code as an order's: what the customer reads out at the counter.
     *
     * @return Attribute<uppercase-string, never>
     */
    protected function code(): Attribute
    {
        return Attribute::get(fn (): string => strtoupper(substr(str_replace('-', '', (string) $this->public_id), 0, 8)));
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    /** @return BelongsTo<ServiceString, $this> */
    public function string(): BelongsTo
    {
        return $this->belongsTo(ServiceString::class, 'service_string_id');
    }
}
