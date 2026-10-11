<?php

namespace App\Models;

use App\Notifications\ResetPassword;
use App\Notifications\VerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property bool $is_admin a staff account: works in /admin and is never counted as a customer
 * @property string|null $role what a staff account may do, one of self::ROLES; see staffRole()
 * @property string|null $segment one of App\Services\CustomerSegmentation::SEGMENTS, once worked out
 * @property Carbon|null $segment_updated_at
 * @property Carbon|null $marketing_opt_in_at when they agreed to promotional email; null: they have not
 */
#[Fillable(['name', 'email', 'password'])]
// The group is the shop's own reading of the customer: staff see it, the customer's browser does not.
// Their choice about promotional email reaches the pages that show it by name (account.marketing).
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'segment', 'segment_updated_at', 'marketing_opt_in_at'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * What staff may do, from most to least. "admin" owns the shop: everything, including its
     * settings, its figures and who its staff are. "staff" does the daily work: orders,
     * goods, customers, coupons, stringing and the support chat. "support" only answers
     * customers in the support chat. Checked through the gates in AppServiceProvider
     * ("administer-shop", "manage-shop"), never in pages.
     */
    public const ROLES = ['admin', 'staff', 'support'];

    /**
     * The role of a staff account, null for a customer. Staff without a role written down
     * are admins: every staff account was one before roles existed.
     *
     * @return value-of<self::ROLES>|null
     */
    public function staffRole(): ?string
    {
        if (! $this->is_admin) {
            return null;
        }

        return in_array($this->role, self::ROLES, true) ? $this->role : 'admin';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'segment_updated_at' => 'datetime',
            'marketing_opt_in_at' => 'datetime',
            /* @chisel-2fa */
            'two_factor_confirmed_at' => 'datetime',
            /* @end-chisel-2fa */
        ];
    }

    /** Queued, like every email of the shop (see App\Services\EmailService). */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmail);
    }

    /** @param  string  $token */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPassword($token));
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Products the customer saved for later, the latest first.
     *
     * @return BelongsToMany<Product, $this>
     */
    public function wishlist(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'wishlists')->withTimestamps()->orderByPivot('id', 'desc');
    }

    /** @return HasMany<ProductReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    /** @return HasMany<CustomerEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(CustomerEvent::class);
    }

    /**
     * Coupons made for this customer alone.
     *
     * @return HasMany<Coupon, $this>
     */
    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class);
    }

    /**
     * Their conversations with the shop in the support chat.
     *
     * @return HasMany<SupportConversation, $this>
     */
    public function conversations(): HasMany
    {
        return $this->hasMany(SupportConversation::class);
    }
}
