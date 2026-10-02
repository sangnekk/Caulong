<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DemoData;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Registered accounts and what they have ordered. Guests who check out without an account are in Orders. */
class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(['customer', 'admin'])],
        ]);
        $filters = ['q' => trim($validated['q'] ?? ''), 'role' => $validated['role'] ?? ''];
        $real = fn ($query) => $query->when(! DemoData::shownByDefault(), fn ($query) => $query->where('is_demo', false));

        $users = User::query()
            ->when($filters['q'] !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', '%'.$filters['q'].'%')->orWhere('email', 'like', '%'.$filters['q'].'%')))
            ->when($filters['role'], fn ($query, $role) => $query->where('is_admin', $role === 'admin'))
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
        ]);
    }
}
