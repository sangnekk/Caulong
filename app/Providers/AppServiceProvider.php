<?php

namespace App\Providers;

use App\Mail\ResendTransport;
use App\Models\AdminActivity;
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
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Throwable;

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

        // Staff roles (User::ROLES), as two rights every /admin route but the support inbox asks
        // for one of. The daily work of the shop is for admins and staff; its settings (the
        // bank account customers pay into among them), its figures, the export of every order
        // and the list of who is staff are the owner's alone.
        Gate::define('manage-shop', fn (User $user): bool => in_array($user->staffRole(), ['admin', 'staff'], true));
        Gate::define('administer-shop', fn (User $user): bool => $user->staffRole() === 'admin');

        // Who changed what in /admin: one row per state-changing request, written after the
        // response. A failure here is reported but never allowed to change the response.
        Event::listen(fn (RequestHandled $event) => $this->recordAdminActivity($event));

        // What a visitor did before signing in during this visit joins their account's history,
        // and so does the support conversation they were in.
        Event::listen(function (Login $event): void {
            if ($event->user instanceof User) {
                $this->app->make(CustomerEvents::class)->claim(request(), $event->user);
                $this->app->make(SupportChat::class)->claim(request(), $event->user);
            }
        });
    }

    /**
     * Write what a member of staff changed in /admin. Only metadata is kept: never the
     * request body, a password or a token. Any failure in the audit trail is reported and
     * swallowed, because logging must never break the action it describes.
     */
    private function recordAdminActivity(RequestHandled $event): void
    {
        try {
            $request = $event->request;
            $path = trim($request->path(), '/');

            if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                return;
            }

            if ($path !== 'admin' && ! str_starts_with($path, 'admin/')) {
                return;
            }

            $user = $request->user();

            if (! $user instanceof User || ! $user->is_admin) {
                return;
            }

            $route = $request->route()?->getName();

            AdminActivity::create([
                'user_id' => $user->getKey(),
                'method' => $request->method(),
                'path' => mb_substr('/'.$path, 0, 2048),
                'route' => $route === null ? null : mb_substr($route, 0, 191),
                'status' => $event->response->getStatusCode(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent() === null ? null : mb_substr($request->userAgent(), 0, 512),
                'created_at' => now(),
            ]);
        } catch (Throwable $exception) {
            report($exception);
        }
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
