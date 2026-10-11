<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * One conversation in the support chat. Its rules are in App\Services\SupportChat.
 *
 * @property int $id
 * @property string $session_key the visit it was started in (App\Services\CustomerEvents::sessionKey)
 * @property int|null $user_id the customer's account, when they were signed in or signed in later
 * @property string $status one of App\Services\SupportChat::STATUSES
 * @property bool $needs_human a ticket for the staff; false while only the automatic assistant answered
 * @property int|null $assigned_to
 * @property CarbonInterface|null $last_message_at
 * @property CarbonInterface|null $resolved_at
 * @property CarbonInterface|null $closed_at
 * @property string|null $access_code_hash
 * @property CarbonInterface|null $access_code_expires_at
 * @property CarbonInterface $created_at
 * @property-read SupportMessage|null $latestHumanMessage
 * @property-read SupportMessage|null $firstMessage
 * @property-read User|null $assignedUser
 * @property-read User|null $user
 */
class SupportConversation extends Model
{
    use MassPrunable;

    /**
     * A closed conversation of someone without an account is kept this long, then removed
     * with its messages. An account's conversations go when the account does.
     */
    public const GUEST_KEEP_DAYS = 365;

    protected $guarded = ['id'];

    protected $hidden = ['access_code_hash'];

    protected function casts(): array
    {
        return [
            'needs_human' => 'boolean', 'last_message_at' => 'datetime', 'resolved_at' => 'datetime',
            'closed_at' => 'datetime', 'access_code_expires_at' => 'datetime',
        ];
    }

    /**
     * What `php artisan model:prune` removes (scheduled daily in routes/console.php); the
     * messages go with their conversation (foreign key).
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        return static::query()->whereNull('user_id')->where('status', 'closed')
            ->where('closed_at', '<', now()->subDays(self::GUEST_KEEP_DAYS));
    }

    /** @return HasMany<SupportMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'conversation_id');
    }

    /**
     * The last thing a person wrote, customer or staff: the assistant answers every message,
     * so its lines say nothing about where a conversation stands.
     *
     * @return HasOne<SupportMessage, $this>
     */
    public function latestHumanMessage(): HasOne
    {
        return $this->hasOne(SupportMessage::class, 'conversation_id')
            ->ofMany(['id' => 'max'], fn ($query) => $query->where('sender', '!=', 'bot'));
    }

    /**
     * How the conversation began: what the customer wrote first.
     *
     * @return HasOne<SupportMessage, $this>
     */
    public function firstMessage(): HasOne
    {
        return $this->hasOne(SupportMessage::class, 'conversation_id')->oldestOfMany();
    }

    /** @return BelongsTo<User, $this> */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
