<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Laravel's "reset your password" email, sent by the queue worker. The job carries the reset
 * token, so it waits in the queue encrypted.
 */
class ResetPassword extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    /** Tried as often and as far apart as App\Jobs\SendEmail. */
    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 600];
}
