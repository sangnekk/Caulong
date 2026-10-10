<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Http\Resources\ProductCardResource;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\CouponService;
use App\Services\StringingService;
use App\Services\SupportChat;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The customer's own account: orders, saved products, details, password, sign-out. */
class AccountController extends Controller
{
    public function show(Request $request, CouponService $coupons, SupportChat $chat, StringingService $stringing): Response
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
                // Whether they agreed to promotional email (they switch it here).
                'marketing' => $user->marketing_opt_in_at !== null,
            ],
            'orders' => $orders,
            // Saved products, the latest first. One no longer sold stays listed so it can be removed.
            'wishlist' => $user->wishlist()->with(['brand:id,name,slug', 'variants' => fn ($query) => $query->active()->orderBy('id')])->get()
                ->map(fn (Product $product) => [
                    ...(new ProductCardResource($product))->resolve($request),
                    'on_sale' => $product->is_active && $product->variants->isNotEmpty(),
                ])->all(),
            // Coupons made for this customer or for their group; nobody else's.
            'coupons' => $coupons->givenTo($user),
            // The rackets they asked the shop to string.
            'serviceOrders' => $stringing->history($user, 10),
            // Their conversations with the shop; each is read in full from /support-chat/conversations/{id}.
            'conversations' => array_map(
                fn (array $conversation) => array_diff_key($conversation, ['needs_human' => true, 'assigned_name' => true]),
                $chat->history($user),
            ),
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
