<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\User;
use App\Services\CustomerEvents;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Products a signed-in customer saves for later. The button itself shows the result. */
class WishlistController extends Controller
{
    /** More than anyone saves by hand; keeps a script from filling the table. */
    public const LIMIT = 100;

    public function store(Request $request, Product $product, CustomerEvents $events): RedirectResponse
    {
        abort_unless($product->is_active, 404);
        /** @var User $user */
        $user = $request->user();
        if (! $user->wishlist()->whereKey($product->id)->exists()) {
            if ($user->wishlist()->count() >= self::LIMIT) {
                throw ValidationException::withMessages(['wishlist' => 'Danh sách yêu thích đã đủ '.self::LIMIT.' sản phẩm. Bỏ bớt trước khi lưu thêm.']);
            }
            $user->wishlist()->attach($product->id);
            $events->record($request, 'wishlist_added', $product->id);
        }

        return back();
    }

    /** Also for a product no longer on sale: it can always be taken off the list. */
    public function destroy(Request $request, Product $product): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->wishlist()->detach($product->id);

        return back();
    }
}
