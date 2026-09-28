<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ProductController extends Controller
{
    private const FILTER_RULES = [
        'q' => ['nullable', 'string', 'max:100'],
        'status' => ['nullable', 'in:active,hidden,demo'],
        'stock' => ['nullable', 'in:in,low,out'],
        'brand' => ['nullable', 'integer', 'exists:brands,id'],
        'style' => ['nullable', 'in:attack,speed,balanced'],
    ];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            ...self::FILTER_RULES,
            'sort' => ['nullable', Rule::in(['newest', 'name', 'price_asc', 'price_desc'])],
        ]);
        $filters = [...$this->filters($validated), 'sort' => $validated['sort'] ?? 'newest'];

        $query = $this->filtered($filters)->with(['brand:id,name', 'category:id,name', 'variants' => fn ($query) => $query->orderBy('id')]);
        if (in_array($filters['sort'], ['price_asc', 'price_desc'], true)) {
            $query->orderBy(ProductVariant::query()->selectRaw('MIN(price)')->whereColumn('product_id', 'products.id'), $filters['sort'] === 'price_asc' ? 'asc' : 'desc');
        } elseif ($filters['sort'] === 'name') {
            $query->orderBy('name');
        }

        return Inertia::render('admin/products', [
            'products' => $query->latest('id')->paginate(25)->withQueryString()
                ->through(fn (Product $product) => [
                    ...$product->only(['id', 'name', 'slug', 'play_style', 'is_active', 'is_featured', 'is_demo']),
                    'image_url' => $product->image_url,
                    'brand' => $product->brand?->name,
                    'category' => $product->category?->name,
                    'variants' => $product->variants->map->only(['id', 'sku', 'name', 'price', 'cost_price', 'stock', 'is_active'])->all(),
                ]),
            'filters' => $filters,
            'counts' => [
                'all' => Product::count(),
                'active' => Product::where('is_active', true)->where('is_demo', false)->count(),
                'hidden' => Product::where('is_active', false)->where('is_demo', false)->count(),
                'demo' => Product::where('is_demo', true)->count(),
            ],
            'brands' => Brand::orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{q: string, status: string, stock: string, brand: string, style: string}
     */
    private function filters(array $validated): array
    {
        return [
            'q' => trim((string) ($validated['q'] ?? '')),
            'status' => (string) ($validated['status'] ?? ''),
            'stock' => (string) ($validated['stock'] ?? ''),
            'brand' => isset($validated['brand']) ? (string) $validated['brand'] : '',
            'style' => (string) ($validated['style'] ?? ''),
        ];
    }

    /**
     * Products matching the list filters; the bulk bar can act on all of them at once.
     *
     * @param  array{q: string, status: string, stock: string, brand: string, style: string}  $filters
     * @return Builder<Product>
     */
    private function filtered(array $filters): Builder
    {
        $query = Product::query();
        if ($filters['q'] !== '') {
            $like = '%'.$filters['q'].'%';
            $query->where(fn ($query) => $query->where('name', 'like', $like)
                ->orWhereHas('variants', fn ($query) => $query->where('sku', 'like', $like)));
        }
        match ($filters['status']) {
            'active' => $query->where('is_active', true)->where('is_demo', false),
            'hidden' => $query->where('is_active', false)->where('is_demo', false),
            'demo' => $query->where('is_demo', true),
            default => null,
        };
        // Stock is judged on sellable variants: "low" means some are nearly gone, "out" means none left.
        $sellable = fn ($query) => $query->where('is_active', true)->where('stock', '>', 0);
        match ($filters['stock']) {
            'in' => $query->whereHas('variants', $sellable),
            'low' => $query->whereHas('variants', fn ($query) => $query->where('is_active', true)->whereBetween('stock', [1, 5])),
            'out' => $query->whereDoesntHave('variants', $sellable),
            default => null,
        };
        $query->when($filters['brand'], fn ($query, $brand) => $query->where('brand_id', $brand))
            ->when($filters['style'], fn ($query, $style) => $query->where('play_style', $style));

        return $query;
    }

    /**
     * Publish, hide or (un)feature products from the list: the ticked rows, or with `all` every
     * product matching the list's current filters.
     */
    public function bulk(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'all' => ['nullable', 'boolean'],
            'ids' => ['required_unless:all,1', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct', 'exists:products,id'],
            'action' => ['required', Rule::in(['publish', 'hide', 'feature', 'unfeature'])],
            ...self::FILTER_RULES,
        ], [
            'ids.required_unless' => 'Chọn ít nhất một sản phẩm.',
            'ids.min' => 'Chọn ít nhất một sản phẩm.',
            'ids.max' => 'Mỗi lần chọn tay tối đa 200 sản phẩm; dùng “Chọn tất cả sản phẩm khớp bộ lọc” cho nhiều hơn.',
            'action.*' => 'Thao tác không hợp lệ.',
        ]);
        $actions = [
            'publish' => ['is_active', true, 'Đã mở bán'],
            'hide' => ['is_active', false, 'Đã ẩn'],
            'feature' => ['is_featured', true, 'Đã đánh dấu nổi bật'],
            'unfeature' => ['is_featured', false, 'Đã bỏ nổi bật'],
        ];
        [$column, $value, $message] = $actions[(string) $data['action']];
        $scope = ($data['all'] ?? false) ? $this->filtered($this->filters($data)) : Product::whereIn('id', $data['ids']);
        $changed = $scope->where($column, '!=', $value)->update([$column => $value, 'updated_at' => now()]);

        return back()->with('success', $message.' '.$changed.' sản phẩm.');
    }

    /** Quick edit from the list: price, cost and stock of a product's versions, nothing else. */
    public function quick(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'variants' => ['required', 'array', 'min:1', 'max:100'],
            'variants.*' => ['required', 'array:id,price,cost_price,stock,expected_stock'],
            'variants.*.id' => ['required', 'integer', 'distinct'],
            'variants.*.price' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'variants.*.cost_price' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'variants.*.stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'variants.*.expected_stock' => ['required', 'integer', 'min:0'],
        ], [
            'variants.*.price.*' => 'Giá bán phải là số đồng từ 0.',
            'variants.*.cost_price.*' => 'Giá nhập phải là số đồng từ 0, hoặc để trống.',
            'variants.*.stock.*' => 'Tồn kho phải là số nguyên từ 0.',
        ]);
        DB::transaction(function () use ($product, $data) {
            // Same lock order as checkout (variants by id), so a sale and an edit never deadlock.
            $rows = $product->variants()->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            foreach ($data['variants'] as $index => $variant) {
                $row = $rows->get($variant['id']);
                if (! $row) {
                    throw ValidationException::withMessages(["variants.{$index}.id" => 'Phiên bản không thuộc sản phẩm này.']);
                }
                if ($row->stock !== (int) $variant['expected_stock']) {
                    throw ValidationException::withMessages(["variants.{$index}.stock" => 'Tồn kho “'.$row->name.'” vừa đổi thành '.$row->stock.' (có đơn mới). Tải lại rồi sửa lại.']);
                }
                $row->update(Arr::only($variant, ['price', 'cost_price', 'stock']));
            }
        });

        return back()->with('success', 'Đã lưu giá và tồn kho “'.$product->name.'”.');
    }

    public function create(): Response
    {
        return Inertia::render('admin/product-form', ['product' => null, ...$this->taxonomies()]);
    }

    public function edit(Product $product): Response
    {
        $product->load('variants')->variants->each->makeVisible('cost_price');
        $payload = $product->toArray();
        $payload['image_url'] = $product->image_url;

        return Inertia::render('admin/product-form', ['product' => $payload, ...$this->taxonomies()]);
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->save($request, new Product);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        return $this->save($request, $product);
    }

    /**
     * @return array{brands: Collection<int, Brand>, categories: Collection<int, Category>}
     */
    private function taxonomies(): array
    {
        return ['brands' => Brand::orderBy('name')->get(), 'categories' => Category::orderBy('name')->get()];
    }

    private function save(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['required', 'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('products', 'slug')->ignore($product->id)],
            'description' => ['required', 'string', 'max:20000'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'play_style' => ['required', Rule::in(['attack', 'speed', 'balanced'])],
            'skill_level' => ['required', Rule::in(['beginner', 'intermediate', 'advanced', 'all'])],
            'is_active' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'is_demo' => ['required', 'boolean'],
            'specs' => ['nullable', 'array:weight,balance,stiffness,material,max_tension'],
            'specs.*' => ['nullable', 'string', 'max:200'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
            'variants' => ['required', 'array', 'min:1', 'max:100'],
            'variants.*' => ['required', 'array:id,sku,name,price,cost_price,stock,is_active,expected_stock'],
            'variants.*.id' => ['nullable', 'integer', 'min:1', 'distinct'],
            'variants.*.sku' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]*$/', 'distinct:ignore_case'],
            'variants.*.name' => ['required', 'string', 'max:120'],
            'variants.*.price' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'variants.*.cost_price' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'variants.*.stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'variants.*.expected_stock' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'variants.*.is_active' => ['required', 'boolean'],
        ], [
            'required' => 'Vui lòng điền trường này.',
            'unique' => 'Giá trị này đã tồn tại.',
            'distinct' => 'Không được lặp mã hoặc biến thể.',
            'image' => 'Chọn ảnh JPEG, PNG hoặc WebP.',
            'image.max' => 'Ảnh tối đa 5 MB.',
            'slug.regex' => 'Dùng chữ thường không dấu, số và dấu gạch nối.',
            'variants.*.sku.regex' => 'SKU chỉ dùng chữ, số, dấu chấm, gạch nối và gạch dưới.',
        ]);
        $uploaded = null;
        try {
            $saved = DB::transaction(function () use ($request, $product, $data, &$uploaded): Product {
                $current = $product->exists ? Product::whereKey($product->id)->lockForUpdate()->firstOrFail() : $product;
                // Checkout locks variants in this same order. Omitted rows remain untouched.
                $existing = $current->exists
                    ? $current->variants()->orderBy('id')->lockForUpdate()->get()->keyBy('id')
                    : collect();
                foreach ($data['variants'] as $index => $variant) {
                    $id = $variant['id'] ?? null;
                    if ($id !== null && ! $existing->has($id)) {
                        throw ValidationException::withMessages(["variants.{$index}.id" => 'Biến thể không thuộc sản phẩm này.']);
                    }
                    if ($id !== null && (! isset($variant['expected_stock']) || (int) $variant['expected_stock'] !== (int) $existing->get($id)->stock)) {
                        throw ValidationException::withMessages(["variants.{$index}.stock" => 'Tồn kho đã thay đổi. Tải lại trang trước khi lưu để tránh ghi đè đơn mới.']);
                    }
                    $clash = ProductVariant::whereRaw('LOWER(sku) = ?', [strtolower($variant['sku'])])
                        ->when($id, fn ($query) => $query->where('id', '!=', $id))->exists();
                    if ($clash) {
                        throw ValidationException::withMessages(["variants.{$index}.sku" => 'SKU đã được sử dụng.']);
                    }
                }
                $attributes = Arr::except($data, ['image', 'variants']);
                if ($request->hasFile('image')) {
                    $uploaded = $request->file('image')->store('products', 'public');
                    if (! $uploaded) {
                        throw ValidationException::withMessages(['image' => 'Không lưu được ảnh. Vui lòng thử lại.']);
                    }
                    $attributes['image_path'] = $uploaded;
                }
                $current->fill($attributes)->save();
                foreach ($data['variants'] as $variant) {
                    $row = isset($variant['id']) ? $existing->get($variant['id']) : new ProductVariant;
                    $row->fill(Arr::except($variant, ['id', 'expected_stock']));
                    $row->product_id = $current->id;
                    $row->save();
                }

                // ponytail: old images retained; add reference-aware cleanup when storage warrants it.
                return $current;
            });
        } catch (Throwable $exception) {
            if ($uploaded) {
                Storage::disk('public')->delete($uploaded);
            }
            if ($exception instanceof UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['variants' => 'SKU hoặc đường dẫn vừa được sử dụng. Kiểm tra và thử lại.']);
            }
            throw $exception;
        }

        return redirect()->route('admin.products.edit', $saved)->with('success', 'Đã lưu sản phẩm.');
    }
}
