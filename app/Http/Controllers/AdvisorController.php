<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdvisorController extends Controller
{
    public function index(Request $request): Response
    {
        $submitted = $request->hasAny(['budget', 'style', 'level']);
        $validated = $request->validate([
            'budget' => [Rule::requiredIf($submitted), 'integer', 'min:0', 'max:1000000000'],
            'style' => ['nullable', Rule::in(['attack', 'speed', 'balanced'])],
            'level' => ['nullable', Rule::in(['beginner', 'intermediate', 'advanced'])],
        ], [
            'budget.required' => 'Nhập ngân sách tối đa cho một cây vợt.',
            'budget.integer' => 'Ngân sách phải là số nguyên, tính bằng đồng.',
            'budget.min' => 'Ngân sách không được nhỏ hơn 0 đồng.',
            'budget.max' => 'Ngân sách không được vượt quá 1.000.000.000 đồng.',
            'style.in' => 'Chọn lối chơi trong danh sách.',
            'level.in' => 'Chọn trình độ trong danh sách.',
        ]);
        $filters = [
            'budget' => $submitted ? (int) $validated['budget'] : null,
            'style' => $validated['style'] ?? null,
            'level' => $validated['level'] ?? null,
        ];
        $recommendations = [];

        if ($submitted) {
            $matchingVariants = fn ($query) => $query->where('is_active', true)
                ->where('stock', '>', 0)->where('price', '<=', $filters['budget']);

            $recommendations = Product::query()
                ->where('is_active', true)
                ->when($filters['style'], fn ($query, $style) => $query->where('play_style', $style))
                ->when($filters['level'], fn ($query, $level) => $query->whereIn('skill_level', [$level, 'all']))
                ->whereHas('variants', $matchingVariants)
                ->with(['brand', 'category', 'variants' => $matchingVariants])
                ->withMin(['variants as matching_price' => $matchingVariants], 'price')
                ->orderBy('matching_price')->orderBy('id')
                ->limit(3)->get()
                ->map(fn (Product $product) => (new ProductResource($product))->resolve($request))
                ->all();
        }

        return Inertia::render('shop/advisor', compact('recommendations', 'filters'));
    }
}
