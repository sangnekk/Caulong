<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The customer's say on promotional email: a switch on their account page, and the link at
 * the foot of every promotional email, which works without signing in.
 */
class MarketingConsentController extends Controller
{
    /** From the account page. */
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['opt_in' => ['required', 'boolean']]);
        /** @var User $user */
        $user = $request->user();
        $wants = (bool) $data['opt_in'];
        if ($wants !== ($user->marketing_opt_in_at !== null)) {
            $user->forceFill(['marketing_opt_in_at' => $wants ? now() : null])->save();
        }

        return back()->with('success', $wants
            ? 'Đã bật nhận email ưu đãi từ cửa hàng.'
            : 'Đã tắt email ưu đãi. Email về đơn hàng và tài khoản vẫn được gửi.');
    }

    /**
     * The page an email's "stop these emails" link opens. Opening it changes nothing (mail
     * scanners open links too): the button on it does.
     */
    public function show(Request $request, User $user): Response
    {
        $this->authorizeLink($request);

        return Inertia::render('shop/unsubscribe', [
            'subscribed' => $user->marketing_opt_in_at !== null,
            'email' => $this->masked($user->email),
            // Signature and all: the button posts to the address the email gave.
            'action' => $request->getRequestUri(),
        ]);
    }

    public function unsubscribe(Request $request, User $user): RedirectResponse
    {
        $this->authorizeLink($request);
        if ($user->marketing_opt_in_at !== null) {
            $user->forceFill(['marketing_opt_in_at' => null])->save();
        }

        return redirect()->to($request->getRequestUri());
    }

    /** Only the link the shop signed (App\Support\Frontend::unsubscribe) opens these pages. */
    private function authorizeLink(Request $request): void
    {
        abort_unless($request->hasValidRelativeSignature(), 404);
    }

    /** Enough of the address to recognise it, not enough to read it: "ng•••@gmail.com". */
    private function masked(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($name, 0, 2).'•••@'.$domain;
    }
}
