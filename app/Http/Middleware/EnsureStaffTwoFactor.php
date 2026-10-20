<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffTwoFactor
{
    /**
     * Staff accounts must have confirmed a second factor before they may enter /admin.
     * Customers are not ours to judge: EnsureAdmin refuses them before this runs.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('shop.security.require_staff_two_factor')) {
            return $next($request);
        }

        $user = $request->user();

        if ($user?->is_admin !== true || $user->two_factor_confirmed_at !== null) {
            return $next($request);
        }

        return redirect()->route('security.edit')->with(
            'error',
            'Bạn cần bật xác thực hai lớp (2FA) trước khi vào khu vực quản trị. Hãy thiết lập tại trang Bảo mật.',
        );
    }
}
