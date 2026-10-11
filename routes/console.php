<?php

use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\SupportConversation;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Browsing history, the email log and the finished support conversations of visitors without
// an account are kept for a year (KEEP_DAYS on each model). Needs "php artisan schedule:work"
// (or the server's cron) to run.
Schedule::command('model:prune', ['--model' => [CustomerEvent::class, EmailLog::class, SupportConversation::class]])->daily();

// Time alone moves customers between groups (new, inactive, lost): every account is looked at
// once a day, in the shop's night, so the morning's emails go by the day's groups.
Schedule::command('crm:segment')->dailyAt('03:00')->timezone((string) config('shop.timezone'));

// A support conversation marked as solved closes itself when the customer leaves it at that.
Schedule::command('support:close-resolved')->daily();

// An order paid by bank transfer holds its goods while it waits for the money; when the time
// set in /admin/settings runs out it is cancelled and the goods go back on sale.
Schedule::command('orders:cancel-unpaid')->everyFifteenMinutes();

// The automatic emails that are switched on in /admin/settings, at hours people read email
// (shop time): cart reminders through the day, the rest once in the morning after the groups
// were worked out. Each email is queued; "php artisan queue:work" sends it.
Schedule::command('marketing:run abandoned_cart')->hourly()->between('8:00', '21:00')->timezone((string) config('shop.timezone'));
Schedule::command('marketing:run')->dailyAt('09:30')->timezone((string) config('shop.timezone'));
