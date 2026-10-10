<?php

namespace App\Providers;

use App\Mail\ResendTransport;
use App\Models\User;
use App\Services\CustomerEvents;
use App\Services\EmailService;
use App\Services\ShopSettings;
use App\Services\SupportChat;
use App\Support\Frontend;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\DevCommands;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
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

        $this->configureMail();

        // Staff roles (User::ROLES). Admins run the shop; support staff only answer customers,
        // so everything in /admin but the support inbox asks for this.
        Gate::define('manage-shop', fn (User $user): bool => $user->staffRole() === 'admin');

        // What a visitor did before signing in during this visit joins their account's history,
        // and so does the support conversation they were in.
        Event::listen(function (Login $event): void {
            if ($event->user instanceof User) {
                $this->app->make(CustomerEvents::class)->claim(request(), $event->user);
                $this->app->make(SupportChat::class)->claim(request(), $event->user);
            }
        });
    }

    /** How email leaves the shop, and what is written down about it. */
    private function configureMail(): void
    {
        // MAIL_MAILER=resend: Resend's HTTP API through Laravel's own HTTP client, so no package
        // is needed. The key comes from RESEND_API_KEY alone.
        Mail::extend('resend', fn (): ResendTransport => new ResendTransport((string) config('services.resend.key')));

        // Laravel's two account emails are built by the queue worker, where no request says
        // which address the shop answers on: their links are made for the storefront. Only
        // these links: the address is never forced for the whole process, which would also
        // end up in the route helpers "npm run routes" writes for the front end.
        ResetPassword::createUrlUsing(fn (object $user, string $token): string => Frontend::url(route('password.reset', [
            'token' => $token,
            'email' => $user instanceof User ? $user->getEmailForPasswordReset() : null,
        ], false)));
        VerifyEmail::createUrlUsing(function (object $user): string {
            // Signed with the storefront's host, which is the one the link is opened on.
            URL::useOrigin(rtrim((string) config('app.frontend_url'), '/'));
            try {
                return URL::temporarySignedRoute('verification.verify', now()->addMinutes((int) config('auth.verification.expire', 60)), [
                    'id' => $user instanceof User ? $user->getKey() : null,
                    'hash' => $user instanceof User ? sha1($user->getEmailForVerification()) : null,
                ]);
            } finally {
                URL::useOrigin(null);
            }
        });

        Event::listen(function (Registered $event): void {
            if ($event->user instanceof User) {
                $this->app->make(EmailService::class)->welcome($event->user);
            }
        });
        // Laravel's own account emails (verify address, reset password) join the email log.
        Event::listen(fn (MessageSent $event) => rescue(fn () => $this->app->make(EmailService::class)->record($event)));
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
