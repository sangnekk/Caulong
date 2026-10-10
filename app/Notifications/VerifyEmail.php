<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail as Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/** Laravel's "verify your address" email, sent by the queue worker like every other email. */
class VerifyEmail extends Notification implements ShouldQueue
{
    use Queueable;

    /** Tried as often and as far apart as App\Jobs\SendEmail. */
    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 600];
}
