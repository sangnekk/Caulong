<?php

namespace App\Providers;

use App\Services\ShopSettings;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\DevCommands;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
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
