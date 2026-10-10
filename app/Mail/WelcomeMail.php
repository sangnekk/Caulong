<?php

namespace App\Mail;

use App\Models\User;
use App\Support\Frontend;

/** To a customer who just made an account. */
class WelcomeMail extends ShopMail
{
    public function __construct(public User $user) {}

    public function title(): string
    {
        return 'Chào mừng bạn đến với '.config('app.name');
    }

    protected function body(): array
    {
        return ['emails.welcome', [
            'name' => $this->user->name,
            'verified' => $this->user->hasVerifiedEmail(),
            'shop' => Frontend::url('/products'),
            'advisor' => Frontend::url('/advisor'),
            'account' => Frontend::url('/account'),
        ]];
    }
}
