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
    /** Price bands (VND) for the lowest price among a racket's versions on sale. */
    private const PRICES = [
        'under-1m' => [0, 999999],
        '1m-2m' => [1000000, 1999999],
        '2m-3m' => [2000000, 2999999],
        '3m-4m' => [3000000, 3999999],
        'over-4m' => [4000000, PHP_INT_MAX],
    ];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:160', 'regex:/\A[a-zA-Z0-9_-]+\z/'],
            'brand' => ['nullable', 'string', 'max:160', 'regex:/\A[a-zA-Z0-9_-]+\z/'],
            'style' => ['nullable', Rule::in(['attack', 'speed', 'balanced'])],
            'sort' => ['nullable', Rule::in(['featured', 'price_asc', 'price_desc', 'newest'])],
            'price' => ['nullable', Rule::in(array_keys(self::PRICES))],
            'stock' => ['nullable', Rule::in(['in'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ], [
            'q.string' => 'Từ khóa phải là văn bản.',
            'q.max' => 'Từ khóa không quá 100 ký tự.',
            'category.*' => 'Danh mục không hợp lệ.',
            'brand.*' => 'Thương hiệu không hợp lệ.',
            'style.*' => 'Lối chơi không hợp lệ.',
            'sort.*' => 'Cách sắp xếp không hợp lệ.',
            'price.*' => 'Mức giá không hợp lệ.',
            'stock.*' => 'Bộ lọc tồn kho không hợp lệ.',
            'page.*' => 'Số trang phải là số nguyên dương.',
        ]);
        $filters = [
            'q' => $validated['q'] ?? '',
            'category' => $validated['category'] ?? '',
            'brand' => $validated['brand'] ?? '',
            'style' => $validated['style'] ?? '',
            'sort' => $validated['sort'] ?? 'featured',
            'price' => $validated['price'] ?? '',
            'stock' => $validated['stock'] ?? '',
        ];
        $sellable = fn ($query) => $query->active()->where('stock', '>', 0);

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
        if ($filters['price'] !== '') {
            // The lowest price among the versions on sale falls in the band.
            $query->whereRaw('(select min(price) from product_variants where product_variants.product_id = products.id and product_variants.is_active = ?) between ? and ?', [true, ...self::PRICES[$filters['price']]]);
        }
        if ($filters['stock'] === 'in') {
            $query->whereHas('variants', $sellable);
        }
        // Whatever the order asked for, what can be bought right now comes first.
        $query->orderByDesc(ProductVariant::query()->selectRaw('COUNT(*) > 0')->whereColumn('product_id', 'products.id')
            ->where('is_active', true)->where('stock', '>', 0));

        if (in_array($filters['sort'], ['price_asc', 'price_desc'], true)) {
            $query->addSelect(['catalog_price' => ProductVariant::query()->active()
                ->selectRaw('MIN(price)')->whereColumn('product_id', 'products.id')])
                ->orderByRaw('catalog_price IS NULL')
                ->orderBy('catalog_price', $filters['sort'] === 'price_asc' ? 'asc' : 'desc');
        } elseif ($filters['sort'] === 'featured') {
            $query->orderByDesc('is_featured');
        }

        $products = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(24)
            ->appends($filters)->through(fn (Product $product) => (new ProductResource($product))->resolve($request));

        // Only taxonomy with something on sale (plus the one being filtered): hidden imports
        // and retired demo items would otherwise fill the selects with dead ends.
        $offered = fn (string $selected) => fn ($query) => $query
            ->whereHas('products', fn ($query) => $query->active())
            ->orWhere('slug', $selected);

        return Inertia::render('shop/products', [
            'products' => $products,
            'filters' => $filters,
            'inStock' => Product::query()->active()->whereHas('variants', $sellable)->count(),
            'categories' => Category::query()->where($offered($filters['category']))->orderBy('name')->get(['id', 'name', 'slug']),
            'brands' => Brand::query()->where($offered($filters['brand']))->orderBy('name')->get(['id', 'name', 'slug']),
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
