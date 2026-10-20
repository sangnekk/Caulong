<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\DemoData;
use App\Support\Money;
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

    /** How the lists can be narrowed by money: collected, not collected, or a transfer still awaited. */
    private const PAYMENTS = ['paid', 'unpaid', 'transfer'];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'payment' => ['nullable', Rule::in(self::PAYMENTS)],
            'q' => ['nullable', 'string', 'max:100'],
            'demo' => ['nullable', 'boolean'],
        ]);
        $filters = [
            'status' => $validated['status'] ?? '',
            'payment' => $validated['payment'] ?? '',
            'q' => trim($validated['q'] ?? ''),
            'demo' => (bool) ($validated['demo'] ?? DemoData::shownByDefault()),
        ];
        // Demo orders are test data, not work: hidden unless asked for (shown by default on a local machine).
        $base = Order::query()->when(! $filters['demo'], fn ($query) => $query->where('is_demo', false))
            ->when($filters['q'] !== '', fn ($query) => $this->search($query, $filters['q']))
            ->when($filters['payment'], fn ($query, $payment) => $this->payment($query, $payment));

        return Inertia::render('admin/orders', [
            'orders' => (clone $base)->withCount('items')
                ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
                ->latest('id')->paginate(20)->withQueryString(),
            'filters' => $filters,
            'demoDefault' => DemoData::shownByDefault(),
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
            'payment' => ['nullable', Rule::in(self::PAYMENTS)],
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
            ->when($validated['payment'] ?? null, fn ($query, $payment) => $this->payment($query, $payment))
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
            // New columns go at the end: sheets built on this file keep their columns.
            fputcsv($out, ['Mã đơn', 'Ngày đặt', 'Khách hàng', 'Điện thoại', 'Địa chỉ', 'Trạng thái', 'Thanh toán', 'Ngày thu tiền', 'Số sản phẩm', 'Tiền hàng', 'Giảm giá', 'Mã giảm giá', 'Phí giao', 'Tổng cộng', 'Cách thanh toán']);
            $labels = ['pending' => 'Chờ xác nhận', 'confirmed' => 'Đã xác nhận', 'shipped' => 'Đang giao', 'delivered' => 'Đã giao', 'cancelled' => 'Đã hủy'];
            $money = ['paid' => 'Đã thu', 'refunded' => 'Đã hoàn tiền'];
            foreach ($query->lazy(200) as $order) {
                $cells = [
                    $order->id, $time($order->created_at), $order->name, $order->phone, $order->address,
                    $labels[$order->status] ?? $order->status, $money[$order->payment_status] ?? 'Chưa thu',
                    $time($order->paid_at), $order->getAttribute('items_count'), $order->subtotal, $order->discount_total, (string) $order->getAttribute('coupon_code'), $order->shipping_fee, $order->total,
                    $order->payment_method === PaymentService::METHOD ? 'Chuyển khoản' : 'COD',
                ];
                // The customer types their own name, phone, address and coupon code: no text cell may start a formula.
                fputcsv($out, array_map(fn ($cell) => $this->csvCell($cell), $cells));
            }
            fclose($out);
        }, 'don-hang-'.now($zone)->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Spreadsheets run a cell that starts with =, +, -, @, a tab or a carriage return as a
     * formula, so a customer's text is prefixed with an apostrophe to keep it text. Leading
     * whitespace is ignored because some spreadsheets trim it before deciding. Numeric cells
     * are left untouched so the spreadsheet still adds them up.
     */
    private function csvCell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        $first = ltrim($value)[0] ?? '';

        return in_array($first, ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$value : $value;
    }

    /**
     * Order number ("12" or "#12"), customer name, phone, the public tracking id, or what a
     * bank transfer says ("DH94B69730", as it reads on the shop's bank statement).
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
                ->orWhere('public_id', 'like', $q.'%')
                ->orWhereHas('payments', fn ($query) => $query->where('reference', mb_strtoupper(preg_replace('/\s+/', '', $q) ?? '')));
        });
    }

    /**
     * @param  Builder<Order>  $query
     * @param  value-of<self::PAYMENTS>  $payment
     */
    private function payment(Builder $query, string $payment): void
    {
        match ($payment) {
            'paid' => $query->where('payment_status', 'paid'),
            // Placed, to be paid by transfer, and the money has not been confirmed yet.
            'transfer' => $query->where('payment_method', PaymentService::METHOD)->where('payment_status', 'unpaid')->where('status', 'pending'),
            default => $query->where('payment_status', '!=', 'paid'),
        };
    }

    public function show(Order $order): Response
    {
        $order->load(['items', 'user:id,name,email']);
        $payment = $order->payment()->with(['confirmer:id,name', 'refunder:id,name'])->first();

        return Inertia::render('admin/order', [
            'order' => $order,
            // The transfer asked for this order, and who saw it arrive or sent it back.
            'payment' => $payment === null ? null : [
                ...$payment->only(['id', 'status', 'reference', 'amount']),
                'expires_at' => $payment->expires_at?->toIso8601String(),
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'refunded_at' => $payment->refunded_at?->toIso8601String(),
                'confirmed_by' => $payment->confirmer?->name,
                'refunded_by' => $payment->refunder?->name,
            ],
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

    /** A member of staff saw the transfer in the shop's account. */
    public function paymentReceived(Request $request, Order $order, Payment $payment, PaymentService $payments): RedirectResponse
    {
        $payments->settle($payment, $request->user());

        return back()->with('success', 'Đã ghi nhận '.Money::vnd($payment->amount).' chuyển khoản. Đơn chuyển sang “Đã xác nhận”.');
    }

    /** The shop sent the money back; the order is cancelled and its goods return to stock. */
    public function paymentRefunded(Request $request, Order $order, Payment $payment, PaymentService $payments): RedirectResponse
    {
        $payments->refund($payment, $request->user());

        return back()->with('success', 'Đã ghi nhận hoàn '.Money::vnd($payment->amount).' cho khách. Đơn đã hủy, tồn kho đã hoàn lại.');
    }
}
