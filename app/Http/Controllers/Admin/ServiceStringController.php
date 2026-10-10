<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceString;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The strings the shop strings with, and what each costs for one racket. A string no longer
 * offered is switched off, not deleted: earlier requests keep its name.
 */
class ServiceStringController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/service-strings', [
            'strings' => ServiceString::query()->withCount(['orders'])->orderByDesc('is_active')->orderBy('name')->get()
                ->map(fn (ServiceString $string) => [
                    ...$string->only(['id', 'name', 'brand', 'gauge', 'price', 'is_active']),
                    'label' => $string->label(),
                    'requests' => (int) $string->getAttribute('orders_count'),
                ])->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $string = ServiceString::create($this->validated($request, null));

        return back()->with('success', 'Đã thêm dây '.$string->label().'.');
    }

    public function update(Request $request, ServiceString $serviceString): RedirectResponse
    {
        $serviceString->update($this->validated($request, $serviceString));

        return back()->with('success', 'Đã lưu dây '.$serviceString->label().'.');
    }

    /** @return array{name: string, brand: string|null, gauge: string|null, price: int, is_active: bool} */
    private function validated(Request $request, ?ServiceString $string): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('service_strings', 'name')->ignore($string?->id)],
            'brand' => ['nullable', 'string', 'max:80'],
            'gauge' => ['nullable', 'string', 'max:20'],
            'price' => ['required', 'integer', 'min:0', 'max:100000000'],
            'is_active' => ['required', 'boolean'],
        ], [
            'name.required' => 'Nhập tên dây.',
            'name.unique' => 'Đã có dây tên này. Sửa dây đó hoặc đặt tên khác.',
            'name.*' => 'Tên dây tối đa 120 ký tự.',
            'brand.*' => 'Tên hãng tối đa 80 ký tự.',
            'gauge.*' => 'Cỡ dây tối đa 20 ký tự, ví dụ “0.68 mm”.',
            'price.*' => 'Giá dây phải là số tiền từ 0 ₫.',
            'is_active.*' => 'Chọn đang dùng hoặc tạm ngưng.',
        ]);

        return [
            'name' => trim($data['name']),
            'brand' => isset($data['brand']) ? trim($data['brand']) : null,
            'gauge' => isset($data['gauge']) ? trim($data['gauge']) : null,
            'price' => (int) $data['price'],
            'is_active' => (bool) $data['is_active'],
        ];
    }
}
