<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One state-changing request a member of staff made in /admin, written by
 * App\Providers\AppServiceProvider after the response. No request body is kept.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $method
 * @property string $path
 * @property string|null $route
 * @property int $status
 * @property string|null $ip
 * @property string|null $user_agent
 * @property CarbonInterface $created_at
 * @property-read User|null $user
 */
class AdminActivity extends Model
{
    use MassPrunable;

    /** Audit rows older than this are removed. */
    public const RETENTION_DAYS = 365;

    protected $table = 'admin_activity_logs';

    /** Only created_at exists; the row is a moment, not something that changes. */
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'method',
        'path',
        'route',
        'status',
        'ip',
        'user_agent',
        'created_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'status' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * What `php artisan model:prune` removes. The schedule that runs it is owned
     * by routes/console.php, which this audit trail does not touch.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<=', now()->subDays(self::RETENTION_DAYS));
    }
}
