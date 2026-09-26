<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:160', 'regex:/\A[a-zA-Z0-9_-]+\z/'],
            'brand' => ['nullable', 'string', 'max:160', 'regex:/\A[a-zA-Z0-9_-]+\z/'],
            'style' => ['nullable', Rule::in(['attack', 'speed', 'balanced'])],
            'sort' => ['nullable', Rule::in(['featured', 'price_asc', 'price_desc', 'newest'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ], [
            'q.string' => 'Từ khóa phải là văn bản.',
            'q.max' => 'Từ khóa không quá 100 ký tự.',
            'category.*' => 'Danh mục không hợp lệ.',
            'brand.*' => 'Thương hiệu không hợp lệ.',
            'style.*' => 'Lối chơi không hợp lệ.',
            'sort.*' => 'Cách sắp xếp không hợp lệ.',
            'page.*' => 'Số trang phải là số nguyên dương.',
        ]);
        $filters = [
            'q' => $validated['q'] ?? '',
            'category' => $validated['category'] ?? '',
            'brand' => $validated['brand'] ?? '',
            'style' => $validated['style'] ?? '',
            'sort' => $validated['sort'] ?? 'featured',
        ];

        $query = Product::query()->active()->with(['brand', 'category', 'variants' => fn ($query) => $query->active()->orderBy('id')]);
        if ($filters['q'] !== '') {
            $query->where('name', 'like', '%'.$filters['q'].'%');
        }
        foreach (['category', 'brand'] as $relation) {
            if ($filters[$relation] !== '') {
                $query->whereHas($relation, fn ($query) => $query->where('slug', $filters[$relation]));
            }
        }
        if ($filters['style'] !== '') {
            $query->where('play_style', $filters['style']);
        }

        if (in_array($filters['sort'], ['price_asc', 'price_desc'], true)) {
            $query->addSelect(['catalog_price' => ProductVariant::query()->active()
                ->selectRaw('MIN(price)')->whereColumn('product_id', 'products.id')])
                ->orderByRaw('catalog_price IS NULL')
                ->orderBy('catalog_price', $filters['sort'] === 'price_asc' ? 'asc' : 'desc');
        } elseif ($filters['sort'] === 'featured') {
            $query->orderByDesc('is_featured');
        }

        $products = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(12)
            ->appends($filters)->through(fn (Product $product) => (new ProductResource($product))->resolve($request));

        return Inertia::render('shop/products', [
            'products' => $products,
            'filters' => $filters,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'brands' => Brand::query()->orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }

    public function show(Request $request, Product $product): Response
    {
        abort_unless($product->is_active, 404);
        $product->load(['brand', 'category', 'variants' => fn ($query) => $query->active()->orderBy('id')]);

        return Inertia::render('shop/product', [
            'product' => (new ProductResource($product))->resolve($request),
        ]);
    }
}
