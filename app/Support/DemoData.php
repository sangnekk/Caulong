<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Demo orders, products and customers stay out of every figure unless asked for. On a local machine
 * (APP_ENV=local) the admin includes them by default, with a notice and a switch to turn them off,
 * so the pages can be tried before the shop has real sales. Production never changes.
 */
class DemoData
{
    /** Demo customer accounts (shop:demo-sales, local only) use this reserved, undeliverable domain. */
    public const EMAIL_DOMAIN = 'khach-mau.invalid';

    public static function shownByDefault(): bool
    {
        return app()->environment('local');
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public static function withoutDemoCustomers(Builder $query): Builder
    {
        return $query->where('email', 'not like', '%@'.self::EMAIL_DOMAIN);
    }
}
