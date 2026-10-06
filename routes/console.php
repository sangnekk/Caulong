<?php

use App\Models\CustomerEvent;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Browsing history is kept for CustomerEvent::KEEP_DAYS. Needs "php artisan schedule:work"
// (or the server's cron) to run.
Schedule::command('model:prune', ['--model' => [CustomerEvent::class]])->daily();

// Time alone moves customers between groups (new, inactive, lost): every account is looked at once a day.
Schedule::command('crm:segment')->dailyAt('03:00');
