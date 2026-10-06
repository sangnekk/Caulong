<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductReview;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Reviews customers wrote: the shop reads the ones with words before they appear in the store. */
class ReviewController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(ProductReview::STATUSES)],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $status = $validated['status'] ?? 'pending';

        return Inertia::render('admin/reviews', [
            'reviews' => ProductReview::query()->where('status', $status)
                ->with(['product:id,name,slug', 'user:id,name,email'])
                ->latest('id')->paginate(20)->withQueryString()
                ->through(fn (ProductReview $review) => [
                    ...$review->only(['id', 'rating', 'body', 'status', 'created_at']),
                    'product' => $review->product->only(['id', 'name', 'slug']),
                    'customer' => $review->user->only(['id', 'name', 'email']),
                ]),
            'status' => $status,
            'counts' => array_replace(
                array_fill_keys(ProductReview::STATUSES, 0),
                ProductReview::query()->selectRaw('status, count(*) as total')->groupBy('status')
                    ->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            ),
        ]);
    }

    public function update(Request $request, ProductReview $review): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['published', 'hidden'])]]);
        $review->update(['status' => $data['status']]);

        return back()->with('success', $data['status'] === 'published'
            ? 'Đã hiện đánh giá trên trang sản phẩm.'
            : 'Đã ẩn đánh giá khỏi trang sản phẩm.');
    }
}
