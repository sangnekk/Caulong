<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductReview;
use App\Models\User;
use App\Services\CustomerProfile;
use App\Services\CustomerSegmentation;
use App\Support\DemoData;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Registered accounts and what they have ordered. Guests who check out without an account are in Orders. */
class CustomerController extends Controller
{
    private const TABS = ['overview', 'orders', 'timeline', 'products', 'coupons', 'reviews'];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(['customer', 'admin'])],
            'segment' => ['nullable', Rule::in(CustomerSegmentation::SEGMENTS)],
        ]);
        $filters = ['q' => trim($validated['q'] ?? ''), 'role' => $validated['role'] ?? '', 'segment' => $validated['segment'] ?? ''];
        $real = fn ($query) => $query->when(! DemoData::shownByDefault(), fn ($query) => $query->where('is_demo', false));

        $users = User::query()
            ->when($filters['q'] !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', '%'.$filters['q'].'%')->orWhere('email', 'like', '%'.$filters['q'].'%')))
            ->when($filters['role'], fn ($query, $role) => $query->where('is_admin', $role === 'admin'))
            ->when($filters['segment'], fn ($query, $segment) => $query->where('segment', $segment))
            ->withCount(['orders', 'orders as open_orders_count' => fn ($query) => $query->whereIn('status', ['pending', 'confirmed', 'shipped'])])
            ->withSum(['orders as collected' => fn ($query) => $real($query)->where('payment_status', 'paid')], 'total')
            ->withMax('orders as last_order_at', 'created_at')
            ->latest('id')->paginate(25)->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'verified' => $user->hasVerifiedEmail(),
                'is_admin' => $user->is_admin,
                'segment' => $user->segment,
                'joined' => $user->created_at,
                'orders' => (int) $user->getAttribute('orders_count'),
                'open_orders' => (int) $user->getAttribute('open_orders_count'),
                'collected' => (int) $user->getAttribute('collected'),
                'last_order_at' => $user->getAttribute('last_order_at'),
            ]);

        return Inertia::render('admin/customers', [
            'customers' => $users,
            'filters' => $filters,
            'counts' => ['all' => User::count(), 'admins' => User::where('is_admin', true)->count()],
            // How many customers each group holds, as last worked out (crm:segment, daily).
            'segments' => array_replace(
                array_fill_keys(CustomerSegmentation::SEGMENTS, 0),
                User::query()->whereNotNull('segment')->toBase()->selectRaw('segment, count(*) as total')->groupBy('segment')
                    ->pluck('total', 'segment')->map(fn ($total) => (int) $total)->all(),
            ),
        ]);
    }

    /** One account: its figures, then the tab asked for. Each tab loads only its own data. */
    public function show(Request $request, User $user, CustomerProfile $profile, CustomerSegmentation $segments): Response
    {
        $validated = $request->validate([
            'tab' => ['nullable', Rule::in(self::TABS)],
            'page' => ['nullable', 'integer', 'min:1'],
            // Where the timeline continues (CustomerProfile::timeline).
            'before' => ['nullable', 'date'],
            'skip' => ['nullable', 'integer', 'between:0,1000'],
        ]);
        $tab = $validated['tab'] ?? 'overview';
        $demo = DemoData::shownByDefault();
        $orders = fn () => $user->orders()->when(! $demo, fn ($query) => $query->where('is_demo', false))->withCount('items')->latest('id');

        return Inertia::render('admin/customer', [
            'customer' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'verified' => $user->hasVerifiedEmail(),
                'is_admin' => $user->is_admin,
                // Worked out now: the page explains the group with today's figures next to it.
                'segment' => $segments->refresh($user),
                'joined' => $user->created_at,
            ],
            'overview' => $profile->overview($user, $demo),
            'tab' => $tab,
            'demo' => $demo,
            'recentOrders' => $tab === 'overview' ? $orders()->limit(5)->get() : null,
            'orders' => $tab === 'orders' ? $orders()->paginate(20)->withQueryString() : null,
            'timeline' => match ($tab) {
                'overview' => $profile->timeline($user, $demo, limit: 8),
                'timeline' => $profile->timeline(
                    $user, $demo,
                    isset($validated['before']) ? Carbon::parse($validated['before']) : null,
                    (int) ($validated['skip'] ?? 0),
                ),
                default => null,
            },
            'products' => $tab === 'products' ? $profile->products($user, $demo) : null,
            'coupons' => $tab === 'coupons' ? $profile->coupons($user) : null,
            'reviews' => $tab === 'reviews'
                ? $user->reviews()->with('product:id,name,slug')->latest('id')->get()->map(fn (ProductReview $review) => [
                    ...$review->only(['id', 'rating', 'body', 'status', 'created_at']),
                    'product' => $review->product->only(['id', 'name', 'slug']),
                ])->all()
                : null,
        ]);
    }
}
