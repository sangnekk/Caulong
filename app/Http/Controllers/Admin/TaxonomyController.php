<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TaxonomyController extends Controller
{
    public function index(): Response
    {
        $list = fn (string $model) => $model::query()->orderBy('name')
            ->withCount(['products', 'products as active_products_count' => fn ($query) => $query->where('is_active', true)])
            ->get(['id', 'name', 'slug'])
            ->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'slug' => $item->slug,
                'products' => (int) $item->getAttribute('products_count'),
                'active' => (int) $item->getAttribute('active_products_count'),
            ]);

        return Inertia::render('admin/taxonomies', [
            'brands' => $list(Brand::class),
            'categories' => $list(Category::class),
        ]);
    }

    public function brand(Request $request): RedirectResponse
    {
        return $this->store($request, Brand::class, 'brands');
    }

    public function category(Request $request): RedirectResponse
    {
        return $this->store($request, Category::class, 'categories');
    }

    private function store(Request $request, string $model, string $table): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', "unique:{$table},name"],
            'slug' => ['required', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', "unique:{$table},slug"],
        ], ['unique' => 'Tên hoặc đường dẫn đã tồn tại.', 'slug.regex' => 'Dùng chữ thường không dấu, số và dấu gạch nối.']);
        try {
            $model::create($data);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['slug' => 'Đường dẫn đã tồn tại.']);
        }

        return back()->with('success', 'Đã thêm phân loại.');
    }
}
