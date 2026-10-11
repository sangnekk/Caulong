<?php

namespace App\Services;

use App\Models\SupportConversation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Who the shop's staff are. An account becomes staff only by an admin's hand (here, or the
 * shop:make-admin command), never by signing up; staff are not counted as customers.
 *
 * Two things cannot be done, so that the shop is never left without an owner by a slip:
 * nobody changes or removes their own access, and the last admin stays an admin.
 */
class StaffService
{
    /**
     * Staff accounts, admins first.
     *
     * @return list<array{id: int, name: string, email: string, role: string, verified: bool, two_factor: bool, joined: string|null}>
     */
    public function all(): array
    {
        return array_values(User::query()->where('is_admin', true)->orderBy('name')->orderBy('id')->get()
            ->sortBy(fn (User $user) => array_search($user->staffRole(), User::ROLES, true))
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => (string) $user->staffRole(),
                'verified' => $user->hasVerifiedEmail(),
                // Whether signing in asks for a second step: worth knowing of anyone with access.
                'two_factor' => $user->two_factor_confirmed_at !== null,
                'joined' => $user->created_at?->toIso8601String(),
            ])->all());
    }

    /**
     * Makes an existing customer account a member of staff. The person signs up and verifies
     * their address themselves first: no account, and no password, is made up for them.
     *
     * @param  value-of<User::ROLES>  $role
     */
    public function grant(string $email, string $role): User
    {
        return DB::transaction(function () use ($email, $role): User {
            $user = User::query()->where('email', mb_strtolower(trim($email)))->lockForUpdate()->first();
            if ($user === null || ! $user->hasVerifiedEmail()) {
                throw ValidationException::withMessages(['email' => 'Chưa có tài khoản đã xác minh email với địa chỉ này. Người đó cần đăng ký và xác minh email trước.']);
            }
            if ($user->is_admin) {
                throw ValidationException::withMessages(['email' => 'Tài khoản này đã là nhân viên. Đổi vai trò ở danh sách bên dưới.']);
            }
            // Staff are not customers: no customer group, as for every other staff account.
            $user->forceFill(['is_admin' => true, 'role' => $role, 'segment' => null, 'segment_updated_at' => null])->save();

            return $user;
        }, 3);
    }

    /** @param  value-of<User::ROLES>  $role */
    public function changeRole(User $actor, User $member, string $role): User
    {
        return DB::transaction(function () use ($actor, $member, $role): User {
            $locked = $this->member($actor, $member, 'đổi vai trò của');
            if ($locked->staffRole() === 'admin' && $role !== 'admin') {
                $this->keepAnAdmin($locked);
            }
            $locked->forceFill(['role' => $role])->save();

            return $locked;
        }, 3);
    }

    /**
     * Takes staff access away: the account is a customer's again. Tickets they had taken go
     * back to the inbox for someone else.
     */
    public function revoke(User $actor, User $member): void
    {
        DB::transaction(function () use ($actor, $member): void {
            $locked = $this->member($actor, $member, 'gỡ quyền của');
            if ($locked->staffRole() === 'admin') {
                $this->keepAnAdmin($locked);
            }
            $locked->forceFill(['is_admin' => false, 'role' => null])->save();
            SupportConversation::query()->where('assigned_to', $locked->id)->where('status', '!=', 'closed')->update(['assigned_to' => null]);
        }, 3);
    }

    /** The staff account to change, held for the change; never the one making it. */
    private function member(User $actor, User $member, string $action): User
    {
        $locked = User::query()->whereKey($member->id)->lockForUpdate()->firstOrFail();
        if (! $locked->is_admin) {
            throw ValidationException::withMessages(['staff' => 'Tài khoản này không còn là nhân viên.']);
        }
        if ($locked->is($actor)) {
            throw ValidationException::withMessages(['staff' => 'Bạn không thể tự '.$action.' chính mình. Nhờ một quản trị viên khác làm việc này.']);
        }

        return $locked;
    }

    private function keepAnAdmin(User $leaving): void
    {
        // Every other admin, held too: two admins demoting each other cannot both go through.
        $others = User::query()->where('is_admin', true)->whereKeyNot($leaving->id)->lockForUpdate()->get()
            ->filter(fn (User $user) => $user->staffRole() === 'admin');
        if ($others->isEmpty()) {
            throw ValidationException::withMessages(['staff' => 'Cửa hàng phải còn ít nhất một quản trị viên.']);
        }
    }
}
