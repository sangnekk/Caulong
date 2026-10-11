<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StaffService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** The shop's staff and what each may do. For admins only, behind a fresh password. */
class StaffController extends Controller
{
    private const ROLE_NAMES = ['admin' => 'quản trị viên', 'staff' => 'nhân viên bán hàng', 'support' => 'nhân viên hỗ trợ'];

    public function index(Request $request, StaffService $staff): Response
    {
        return Inertia::render('admin/staff', [
            'staff' => $staff->all(),
            'me' => $request->user()?->id,
        ]);
    }

    public function store(Request $request, StaffService $staff): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', Rule::in(User::ROLES)],
        ], [
            'email.*' => 'Nhập địa chỉ email của tài khoản cần cấp quyền.',
            'role.*' => 'Chọn một vai trò.',
        ]);
        $member = $staff->grant($data['email'], $data['role']);

        return back()->with('success', 'Đã thêm '.$member->name.' làm '.self::ROLE_NAMES[$data['role']].'.');
    }

    public function update(Request $request, User $user, StaffService $staff): RedirectResponse
    {
        $data = $request->validate(['role' => ['required', Rule::in(User::ROLES)]], ['role.*' => 'Chọn một vai trò.']);
        /** @var User $actor */
        $actor = $request->user();
        $member = $staff->changeRole($actor, $user, $data['role']);

        return back()->with('success', $member->name.' nay là '.self::ROLE_NAMES[$data['role']].'.');
    }

    public function destroy(Request $request, User $user, StaffService $staff): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $staff->revoke($actor, $user);

        return back()->with('success', 'Đã gỡ quyền nhân viên của '.$user->name.'. Tài khoản đó trở lại là tài khoản khách hàng.');
    }
}
