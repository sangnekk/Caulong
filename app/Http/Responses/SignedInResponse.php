<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Fortify\Contracts\LoginResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse;

/**
 * After signing in (password or two-factor): back to the page the person was opening, unless
 * it is an admin page they cannot see, which would end on a 403 behind the login form.
 */
class SignedInResponse implements LoginResponse, TwoFactorLoginResponse
{
    /** @param  Request  $request */
    public function toResponse($request): JsonResponse|RedirectResponse
    {
        if ($request->wantsJson()) {
            return $request->routeIs('two-factor.login.store')
                ? new JsonResponse('', 204)
                : new JsonResponse(['two_factor' => false]);
        }

        return redirect()->to(self::destination($request));
    }

    public static function destination(Request $request): string
    {
        $admin = (bool) $request->user()?->is_admin;
        $intended = $request->session()->pull('url.intended');
        if (is_string($intended) && ($admin || ! self::isAdminUrl($intended))) {
            return $intended;
        }

        return self::home($request);
    }

    /** Admins work in /admin; customers land on their account (orders, details, sign-out). */
    public static function home(Request $request): string
    {
        return $request->user()?->is_admin ? route('admin.dashboard') : route('account');
    }

    private static function isAdminUrl(string $url): bool
    {
        $path = '/'.ltrim((string) parse_url($url, PHP_URL_PATH), '/');

        return $path === '/admin' || str_starts_with($path, '/admin/');
    }
}
