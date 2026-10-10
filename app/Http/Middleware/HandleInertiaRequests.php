<?php

namespace App\Http\Middleware;

use App\Models\Order;
use App\Models\ProductReview;
use App\Models\ServiceOrder;
use App\Models\SupportConversation;
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
        // The Next.js front end builds its own assets; this server has none to keep in step with.
        return null;
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
                'shipping_fee' => app(ShopSettings::class)->shippingFee(),
                // Set by the owner in /admin/settings; empty values are simply not shown.
                'contact' => [
                    'hotline' => app(ShopSettings::class)->all()['hotline'],
                    'email' => app(ShopSettings::class)->all()['contact_email'],
                    'address' => app(ShopSettings::class)->all()['contact_address'],
                    'chat_url' => app(ShopSettings::class)->all()['contact_chat_url'],
                ],
                'free_shipping_from' => app(ShopSettings::class)->freeShippingThreshold(),
                // Whether the shop takes stringing requests online: the header links to it then.
                'stringing' => app(ShopSettings::class)->stringing()['enabled'],
                'is_admin' => (bool) $request->user()?->is_admin,
                // What a staff account may open: "admin" the whole of /admin, "support" its inbox only.
                'staff_role' => $request->user()?->staffRole(),
                // Admin navigation badge: real orders waiting for a call (demo orders are labelled, not work).
                'pending_orders' => $request->user()?->can('manage-shop')
                    ? Order::where('is_demo', false)->where('status', 'pending')->count()
                    : 0,
                'pending_support_chats' => $request->user()?->is_admin
                    ? SupportConversation::where('status', 'open')->where('needs_human', true)->whereHas('messages', fn ($query) => $query
                        ->where('sender', 'customer')->whereNull('read_at'))->count()
                    : 0,
                // Stringing requests the shop has not answered yet.
                'pending_service_orders' => $request->user()?->can('manage-shop') ? ServiceOrder::where('status', 'pending')->count() : 0,
                // Reviews with words wait for the shop to read them.
                'pending_reviews' => $request->user()?->can('manage-shop') ? ProductReview::where('status', 'pending')->count() : 0,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
