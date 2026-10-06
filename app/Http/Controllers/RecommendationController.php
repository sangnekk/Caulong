<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductCardResource;
use App\Models\Product;
use App\Services\RecommendationService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The lists a store page fetches once it is on screen: what this visitor looked at lately (ids
 * their browser keeps) and, on request, suggestions for them. Product cards only, all public.
 */
class RecommendationController extends Controller
{
    /** How many recently viewed products a browser may send. */
    public const VIEWED = 12;

    public function __invoke(Request $request, RecommendationService $recommendations): JsonResponse
    {
        $data = $request->validate([
            'viewed' => ['nullable', 'string', 'regex:/\A\d{1,9}(?:,\d{1,9}){0,'.(self::VIEWED - 1).'}\z/'],
            'product' => ['nullable', 'integer', 'min:1'],
            'suggest' => ['nullable', 'boolean'],
        ]);
        $viewed = array_values(array_unique(array_map('intval', array_filter(explode(',', $data['viewed'] ?? ''), fn (string $id) => $id !== ''))));
        // The product on screen is neither "recently viewed" nor a suggestion.
        $current = isset($data['product']) ? [(int) $data['product']] : [];
        $suggested = ($data['suggest'] ?? false)
            ? $recommendations->personalized($request->user(), $viewed, except: $current)
            : ['basis' => null, 'products' => (new Product)->newCollection()];
        $cards = fn (Collection $products): array => ProductCardResource::collection($products)->resolve($request);

        return response()->json([
            'viewed' => $cards($recommendations->products(array_values(array_diff($viewed, $current)))),
            'basis' => $suggested['basis'],
            'suggested' => $cards($suggested['products']),
        ]);
    }
}
