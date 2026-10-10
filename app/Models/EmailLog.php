<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One email the shop sent, or tried to. Written by App\Services\EmailService and the job
 * that does the sending.
 *
 * @property int $id
 * @property string $type
 * @property string $recipient
 * @property string $subject
 * @property string $status
 * @property string|null $provider_message_id
 * @property string|null $error
 * @property int|null $user_id
 * @property int|null $order_id
 * @property CarbonInterface|null $sent_at
 * @property CarbonInterface $created_at
 * @property-read User|null $user
 */
class EmailLog extends Model
{
    use MassPrunable;

    public const STATUSES = ['queued', 'sent', 'failed'];

    /** Email history older than this is no longer kept. */
    public const KEEP_DAYS = 365;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
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
