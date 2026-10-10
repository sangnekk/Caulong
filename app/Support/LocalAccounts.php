<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Fixed sign-in accounts for trying the shop on a local machine (APP_ENV=local only).
 * The login page creates them on demand and lists them, so there is nothing to set up.
 * Never available in production: both methods do nothing outside the local environment.
 */
class LocalAccounts
{
    public const PASSWORD = 'Test-Cau-Long-2026!';

    /**
     * `staff` is the account's users.role (null: a customer); `role` is how the login page names it.
     *
     * @var list<array{email: string, name: string, staff: value-of<User::ROLES>|null, role: string}>
     */
    public const ACCOUNTS = [
        ['email' => 'admin@test.local', 'name' => 'Quản trị Thử nghiệm', 'staff' => 'admin', 'role' => 'Quản trị'],
        ['email' => 'hotro@test.local', 'name' => 'Hỗ trợ Thử nghiệm', 'staff' => 'support', 'role' => 'Nhân viên hỗ trợ'],
        ['email' => 'khach@test.local', 'name' => 'Khách Thử nghiệm', 'staff' => null, 'role' => 'Khách hàng'],
    ];

    public static function enabled(): bool
    {
        return app()->environment('local');
    }

    /**
     * Make sure each account exists, is verified, has its role and still uses the listed
     * password (so the login page never shows credentials that do not work).
     *
     * @return list<array{email: string, password: string, name: string, role: string}>
     */
    public static function forLoginPage(): array
    {
        if (! self::enabled()) {
            return [];
        }

        return array_map(function (array $account): array {
            $user = User::firstOrNew(['email' => $account['email']]);
            if (! $user->exists) {
                $user->name = $account['name'];
            }
            if (! $user->exists || ! Hash::check(self::PASSWORD, (string) $user->password)) {
                $user->password = Hash::make(self::PASSWORD);
            }
            $user->forceFill([
                'is_admin' => $account['staff'] !== null,
                'role' => $account['staff'],
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);
            if ($user->isDirty()) {
                $user->save();
            }

            return ['email' => $account['email'], 'password' => self::PASSWORD, 'name' => $user->name, 'role' => $account['role']];
        }, self::ACCOUNTS);
    }
}
