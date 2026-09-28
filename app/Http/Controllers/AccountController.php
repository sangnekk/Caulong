<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The customer's own account: orders, details, password, sign-out. */
class AccountController extends Controller
{
    public function show(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $orders = $user->orders()->with('items:id,order_id,product_name,variant_name,quantity')
            ->latest('id')->paginate(10)
            ->through(fn (Order $order) => [
                'public_id' => $order->public_id,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'total' => $order->total,
                'is_demo' => $order->is_demo,
                'created_at' => $order->created_at,
                'items' => $order->items->map(fn ($item) => $item->only(['product_name', 'variant_name', 'quantity']))->all(),
            ]);

        return Inertia::render('shop/account', [
            'account' => [
                'name' => $user->name,
                'email' => $user->email,
                'verified' => $user->hasVerifiedEmail(),
                'is_admin' => $user->is_admin,
                'joined' => $user->created_at,
            ],
            'orders' => $orders,
            'totals' => [
                'orders' => $user->orders()->count(),
                'open' => $user->orders()->whereIn('status', ['pending', 'confirmed', 'shipped'])->count(),
            ],
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->fill($request->validated());
        $emailChanged = $user->isDirty('email');
        if ($emailChanged) {
            $user->email_verified_at = null;
        }
        $user->save();
        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return back()->with('success', $emailChanged
            ? 'Đã lưu. Mở email mới để xác minh địa chỉ.'
            : 'Đã lưu thông tin tài khoản.');
    }

    public function password(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()?->update(['password' => $request->string('password')->toString()]);

        return back()->with('success', 'Đã đổi mật khẩu.');
    }
}
