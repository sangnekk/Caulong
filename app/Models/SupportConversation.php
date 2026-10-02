<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $session_key
 * @property string $status
 * @property bool $needs_human
 * @property int|null $assigned_to
 * @property CarbonInterface|null $last_message_at
 * @property-read SupportMessage|null $latestMessage
 * @property-read User|null $assignedUser
 */
class SupportConversation extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['needs_human' => 'boolean', 'last_message_at' => 'datetime'];
    }

    /** @return HasMany<SupportMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'conversation_id');
    }

    /** @return HasOne<SupportMessage, $this> */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(SupportMessage::class, 'conversation_id')->latestOfMany();
    }

    /** @return BelongsTo<User, $this> */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
