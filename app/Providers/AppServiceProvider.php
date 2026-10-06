<?php

namespace App\Providers;

use App\Models\User;
use App\Services\CustomerEvents;
use App\Services\ShopSettings;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Login;
use Illuminate\Foundation\DevCommands;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Read once per request; saving in the admin clears it.
        $this->app->scoped(ShopSettings::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // "php artisan dev" runs the Next.js app in frontend/ (the root "npm run dev") by name.
        DevCommands::except('vite');
        DevCommands::node('dev', 'next');

        // What a visitor did before signing in during this visit joins their account's history.
        Event::listen(function (Login $event): void {
            if ($event->user instanceof User) {
                $this->app->make(CustomerEvents::class)->claim(request(), $event->user);
            }
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
