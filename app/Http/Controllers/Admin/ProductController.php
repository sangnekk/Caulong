<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
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
    public function index(Request $request): Response
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        return Inertia::render('admin/products', [
            'products' => Product::with(['brand', 'category', 'variants'])
                ->when($filters['q'] ?? null, fn ($query, $q) => $query->where('name', 'like', '%'.$q.'%'))
                ->latest('id')->paginate(20)->withQueryString(),
            'filters' => ['q' => $filters['q'] ?? ''],
            ...$this->taxonomies(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/product-form', ['product' => null, ...$this->taxonomies()]);
    }

    public function edit(Product $product): Response
    {
        $payload = $product->load('variants')->toArray();
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
            'variants.*' => ['required', 'array:id,sku,name,price,stock,is_active,expected_stock'],
            'variants.*.id' => ['nullable', 'integer', 'min:1', 'distinct'],
            'variants.*.sku' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]*$/', 'distinct:ignore_case'],
            'variants.*.name' => ['required', 'string', 'max:120'],
            'variants.*.price' => ['required', 'integer', 'min:0', 'max:1000000000'],
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
