<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\User;
use App\Services\ReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function store(Request $request, Product $product, ReviewService $reviews): RedirectResponse
    {
        abort_unless($product->is_active, 404);
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'body' => ['nullable', 'string', 'max:'.ReviewService::BODY_LIMIT],
        ], [
            'rating.*' => 'Chọn số sao từ 1 đến 5.',
            'body.string' => 'Nội dung đánh giá không hợp lệ.',
            'body.max' => 'Nội dung đánh giá không quá '.ReviewService::BODY_LIMIT.' ký tự.',
        ]);
        $body = trim((string) ($data['body'] ?? ''));
        /** @var User $user */
        $user = $request->user();
        $review = $reviews->submit($user, $product, (int) $data['rating'], $body === '' ? null : $body);

        return back()->with('success', $review->status === 'published'
            ? 'Cảm ơn bạn đã đánh giá.'
            : 'Cảm ơn bạn. Đánh giá sẽ hiện sau khi cửa hàng duyệt.');
    }
}
