<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderController extends Controller
{
    private const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'payment' => ['nullable', Rule::in(['paid', 'unpaid'])],
            'q' => ['nullable', 'string', 'max:100'],
            'demo' => ['nullable', 'boolean'],
        ]);
        $filters = [
            'status' => $validated['status'] ?? '',
            'payment' => $validated['payment'] ?? '',
            'q' => trim($validated['q'] ?? ''),
            'demo' => (bool) ($validated['demo'] ?? false),
        ];
        // Demo orders are test data, not work: hidden unless asked for.
        $base = Order::query()->when(! $filters['demo'], fn ($query) => $query->where('is_demo', false))
            ->when($filters['q'] !== '', fn ($query) => $this->search($query, $filters['q']))
            ->when($filters['payment'], fn ($query, $payment) => $payment === 'paid'
                ? $query->where('payment_status', 'paid')
                : $query->where('payment_status', '!=', 'paid'));

        return Inertia::render('admin/orders', [
            'orders' => (clone $base)->withCount('items')
                ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
                ->latest('id')->paginate(20)->withQueryString(),
            'filters' => $filters,
            'demoCount' => Order::where('is_demo', true)->count(),
            // Tabs show how many orders each status holds within the current search.
            'counts' => ['all' => (clone $base)->count()] + array_replace(
                array_fill_keys(self::STATUSES, 0),
                (clone $base)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            ),
        ]);
    }

    /** The orders in the current filter as a CSV for the accounts (opens in Excel, UTF-8 with BOM). */
    public function export(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'payment' => ['nullable', Rule::in(['paid', 'unpaid'])],
            'q' => ['nullable', 'string', 'max:100'],
            // Days in the shop's time zone, both included (the reports page sends its period).
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $zone = (string) config('shop.timezone');
        $day = fn (string $value) => CarbonImmutable::createFromFormat('Y-m-d', $value, $zone);
        $query = Order::withCount('items')->where('is_demo', false)
            ->when(trim($validated['q'] ?? '') !== '', fn ($query) => $this->search($query, trim($validated['q'])))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['payment'] ?? null, fn ($query, $payment) => $payment === 'paid'
                ? $query->where('payment_status', 'paid')
                : $query->where('payment_status', '!=', 'paid'))
            ->when($validated['from'] ?? null, fn ($query, $from) => $query->where('created_at', '>=', $day($from)?->startOfDay()->utc()))
            ->when($validated['to'] ?? null, fn ($query, $to) => $query->where('created_at', '<=', $day($to)?->endOfDay()->utc()))
            ->orderBy('id');
        $time = fn ($value) => $value ? $value->setTimezone($zone)->format('d/m/Y H:i') : '';

        return response()->streamDownload(function () use ($query, $time) {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Mã đơn', 'Ngày đặt', 'Khách hàng', 'Điện thoại', 'Địa chỉ', 'Trạng thái', 'Thanh toán', 'Ngày thu tiền', 'Số sản phẩm', 'Tiền hàng', 'Phí giao', 'Tổng cộng']);
            $labels = ['pending' => 'Chờ xác nhận', 'confirmed' => 'Đã xác nhận', 'shipped' => 'Đang giao', 'delivered' => 'Đã giao', 'cancelled' => 'Đã hủy'];
            foreach ($query->lazy(200) as $order) {
                fputcsv($out, [
                    $order->id, $time($order->created_at), $order->name, $order->phone, $order->address,
                    $labels[$order->status] ?? $order->status, $order->payment_status === 'paid' ? 'Đã thu' : 'Chưa thu',
                    $time($order->paid_at), $order->getAttribute('items_count'), $order->subtotal, $order->shipping_fee, $order->total,
                ]);
            }
            fclose($out);
        }, 'don-hang-'.now($zone)->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Order number ("12" or "#12"), customer name, phone, or the public tracking id.
     *
     * @param  Builder<Order>  $query
     */
    private function search(Builder $query, string $q): void
    {
        $query->where(function ($query) use ($q) {
            $number = ltrim($q, '#');
            if (ctype_digit($number)) {
                $query->orWhere('id', (int) $number);
            }
            $query->orWhere('name', 'like', '%'.$q.'%')
                ->orWhere('phone', 'like', '%'.preg_replace('/\s+/', '', $q).'%')
                ->orWhere('public_id', 'like', $q.'%');
        });
    }

    public function show(Order $order): Response
    {
        $order->load(['items', 'user:id,name,email']);

        return Inertia::render('admin/order', [
            'order' => $order,
            // Earlier orders from the same phone help spot repeat customers and duplicate orders.
            'related' => Order::where('phone', $order->phone)->whereKeyNot($order->id)->latest('id')->limit(5)
                ->get(['id', 'status', 'total', 'created_at', 'is_demo']),
        ]);
    }

    public function update(Request $request, Order $order, OrderService $service): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['confirmed', 'shipped', 'delivered', 'cancelled'])]]);
        $service->transition($order, $data['status']);

        return back()->with('success', 'Đã cập nhật trạng thái đơn hàng.');
    }

    public function collected(Order $order, OrderService $service): RedirectResponse
    {
        $service->markCodPaid($order);

        return back()->with('success', 'Đã xác nhận thu tiền COD.');
    }
}
