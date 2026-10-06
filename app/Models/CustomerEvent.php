<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One thing a visitor did in the shop. Written by App\Services\CustomerEvents only.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string|null $session_key
 * @property string $name
 * @property int|null $product_id
 * @property int|null $order_id
 * @property array<string, int|string|bool>|null $metadata
 * @property CarbonInterface $created_at
 * @property-read Product|null $product
 */
class CustomerEvent extends Model
{
    use MassPrunable;

    public const UPDATED_AT = null;

    /** Browsing history older than this is no longer kept. */
    public const KEEP_DAYS = 365;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * What `php artisan model:prune` removes (scheduled daily in routes/console.php).
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::KEEP_DAYS));
    }
}
