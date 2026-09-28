<?php

namespace App\Http\Middleware;

use App\Models\Order;
use App\Services\CartService;
use App\Services\ShopSettings;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'shop' => fn (): array => [
                'cart_count' => app(CartService::class)->count($request),
                // Set by the owner in /admin/settings; empty values are simply not shown.
                'contact' => [
                    'hotline' => app(ShopSettings::class)->all()['hotline'],
                    'email' => app(ShopSettings::class)->all()['contact_email'],
                ],
                'free_shipping_from' => app(ShopSettings::class)->freeShippingThreshold(),
                'is_admin' => (bool) $request->user()?->is_admin,
                // Admin navigation badge: real orders waiting for a call (demo orders are labelled, not work).
                'pending_orders' => $request->user()?->is_admin
                    ? Order::where('is_demo', false)->where('status', 'pending')->count()
                    : 0,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
