<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\StringingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Stringing requests as the shop works them: confirm, string, hand back. */
class ServiceOrderController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(StringingService::STATUSES)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $filters = ['status' => $validated['status'] ?? '', 'q' => trim($validated['q'] ?? '')];
        $base = fn (): Builder => ServiceOrder::query()->when($filters['q'] !== '', function (Builder $query) use ($filters) {
            // The request's number ("12" or "#12"), its short code, the customer's name or phone.
            $q = $filters['q'];
            $query->where(function (Builder $query) use ($q) {
                $number = ltrim($q, '#');
                if (ctype_digit($number)) {
                    $query->orWhere('id', (int) $number);
                }
                $query->orWhere('name', 'like', '%'.$q.'%')
                    ->orWhere('phone', 'like', '%'.preg_replace('/\s+/', '', $q).'%')
                    ->orWhere('public_id', 'like', mb_strtolower($q).'%');
            });
        });

        return Inertia::render('admin/service-orders', [
            'orders' => $base()->when($filters['status'], fn (Builder $query, string $status) => $query->where('status', $status))
                ->with('technician:id,name')->latest('id')->paginate(20)->withQueryString()
                ->through(fn (ServiceOrder $order) => $this->row($order)),
            'filters' => $filters,
            'counts' => ['all' => $base()->count()] + array_replace(
                array_fill_keys(StringingService::STATUSES, 0),
                $base()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            ),
        ]);
    }

    public function show(ServiceOrder $serviceOrder): Response
    {
        $serviceOrder->load(['technician:id,name', 'user:id,name,email']);

        return Inertia::render('admin/service-order', [
            'order' => [
                ...$this->row($serviceOrder),
                ...$serviceOrder->only(['email', 'notes', 'string_price', 'labor_fee', 'technician_id']),
                'customer' => $serviceOrder->user?->only(['id', 'name', 'email']),
                'steps' => [
                    'confirmed' => $serviceOrder->confirmed_at?->toIso8601String(),
                    'in_progress' => $serviceOrder->in_progress_at?->toIso8601String(),
                    'ready' => $serviceOrder->ready_at?->toIso8601String(),
                    'completed' => $serviceOrder->completed_at?->toIso8601String(),
                    'cancelled' => $serviceOrder->cancelled_at?->toIso8601String(),
                ],
            ],
            // Anyone on the staff can be the one who strings it.
            'staff' => User::query()->where('is_admin', true)->orderBy('name')->get(['id', 'name']),
            // Earlier requests from the same phone: a returning customer, or the same request sent twice.
            'related' => ServiceOrder::query()->where('phone', $serviceOrder->phone)->whereKeyNot($serviceOrder->id)->latest('id')->limit(5)
                ->get()->map(fn (ServiceOrder $order) => $order->only(['id', 'status', 'racket', 'created_at']))->all(),
        ]);
    }

    /**
     * One change at a time: the next step, who strings it, or what the customer pays (the
     * fee for a string they bring is often settled when the racket is handed in).
     */
    public function update(Request $request, ServiceOrder $serviceOrder, StringingService $stringing): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'required', Rule::in(['confirmed', 'in_progress', 'ready', 'completed', 'cancelled'])],
            'technician_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->where('is_admin', true)],
            'total' => ['sometimes', 'required', 'integer', 'min:0', 'max:100000000'],
        ], [
            'technician_id.*' => 'Chọn một nhân viên của cửa hàng.',
            'total.*' => 'Số tiền phải từ 0 đến 100.000.000 ₫.',
        ]);
        if (array_key_exists('status', $data)) {
            $stringing->transition($serviceOrder, $data['status']);

            return back()->with('success', 'Đã cập nhật trạng thái yêu cầu.');
        }
        if (in_array($serviceOrder->status, ['completed', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'Yêu cầu đã kết thúc nên không sửa được nữa.']);
        }
        $serviceOrder->update(array_intersect_key($data, array_flip(['technician_id', 'total'])));

        return back()->with('success', array_key_exists('total', $data) ? 'Đã lưu số tiền khách thanh toán.' : 'Đã lưu người đan.');
    }

    /** @return array<string, mixed> */
    private function row(ServiceOrder $order): array
    {
        return [
            ...$order->only(['id', 'public_id', 'code', 'name', 'phone', 'service_type', 'racket', 'string_name', 'tension_kg', 'quantity', 'total', 'status']),
            'preferred_at' => $order->preferred_at?->toIso8601String(),
            'created_at' => $order->created_at->toIso8601String(),
            'technician_name' => $order->technician?->name,
        ];
    }
}
