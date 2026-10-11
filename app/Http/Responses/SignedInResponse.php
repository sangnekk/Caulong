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
        // Only those who run the shop are sent back into /admin: anyone else would meet a 403
        // there, or (support staff) be sent on to their inbox anyway.
        $manages = (bool) $request->user()?->can('manage-shop');
        $intended = $request->session()->pull('url.intended');
        if (is_string($intended) && ($manages || ! self::isAdminUrl($intended))) {
            return $intended;
        }

        return self::home($request);
    }

    /** Staff work in /admin (support staff in its inbox); customers land on their account. */
    public static function home(Request $request): string
    {
        return match ($request->user()?->staffRole()) {
            'admin', 'staff' => route('admin.dashboard'),
            'support' => route('admin.support-chat.index'),
            default => route('account'),
        };
    }

    private static function isAdminUrl(string $url): bool
    {
        $path = '/'.ltrim((string) parse_url($url, PHP_URL_PATH), '/');

        return $path === '/admin' || str_starts_with($path, '/admin/');
    }
}
