<?php

namespace App\Http\Controllers;

use App\Models\ServiceOrder;
use App\Services\ShopSettings;
use App\Services\StringingService;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** The stringing service as customers use it: the page with its form, and a request's own page. */
class ServiceOrderController extends Controller
{
    public function index(StringingService $stringing): Response
    {
        return Inertia::render('shop/services', [
            'service' => $stringing->offer(),
            // Sent back with the form, so that sending it twice makes one request. Nothing is
            // kept here: a first-time visitor's browser has no session yet when this page is built.
            'bookingToken' => (string) Str::uuid(),
        ]);
    }

    public function store(Request $request, StringingService $stringing): RedirectResponse
    {
        $tension = config('shop.stringing');
        $data = $request->validate([
            'booking_token' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'regex:/^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/'],
            'email' => ['nullable', 'email', 'max:190'],
            'service_type' => ['required', Rule::in(StringingService::TYPES)],
            'racket' => ['required', 'string', 'max:160'],
            'service_string_id' => ['exclude_unless:service_type,shop_string', 'required', 'integer', 'min:1'],
            // The customer's own string, named for the technician.
            'string_name' => ['exclude_unless:service_type,own_string', 'nullable', 'string', 'max:120'],
            'tension_kg' => ['required', 'numeric', 'between:'.$tension['tension_min'].','.$tension['tension_max'], 'multiple_of:0.5'],
            'quantity' => ['required', 'integer', 'between:1,'.$tension['max_rackets']],
            // A day and an hour in the shop's own time, as a datetime-local field sends it.
            'preferred_at' => ['bail', 'nullable', 'date_format:Y-m-d\TH:i', function (string $attribute, mixed $value, Closure $fail) use ($tension): void {
                $visit = CarbonImmutable::createFromFormat('Y-m-d\TH:i', (string) $value, (string) config('shop.timezone'));
                if ($visit === null || $visit->isPast() || $visit->isAfter(now()->addDays((int) $tension['book_ahead_days']))) {
                    $fail('Chọn một thời điểm trong '.$tension['book_ahead_days'].' ngày tới.');
                }
            }],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'booking_token.*' => 'Phiên đặt lịch đã hết hạn. Vui lòng tải lại trang rồi gửi lại.',
            'name.*' => 'Vui lòng nhập họ tên, tối đa 120 ký tự.',
            'phone.required' => 'Vui lòng nhập số điện thoại để cửa hàng hẹn lịch.',
            'phone.*' => 'Vui lòng nhập số điện thoại Việt Nam hợp lệ, bắt đầu bằng 0 hoặc +84, không có dấu cách.',
            'email.*' => 'Địa chỉ email không hợp lệ.',
            'service_type.*' => 'Chọn dùng dây của cửa hàng hoặc dây bạn mang tới.',
            'racket.*' => 'Vui lòng ghi tên cây vợt cần đan, tối đa 160 ký tự.',
            'service_string_id.*' => 'Vui lòng chọn một loại dây của cửa hàng.',
            'string_name.*' => 'Tên dây tối đa 120 ký tự.',
            'tension_kg.*' => 'Mức căng phải từ '.$tension['tension_min'].' đến '.$tension['tension_max'].' kg, cách nhau nửa kg.',
            'quantity.*' => 'Số vợt phải từ 1 đến '.$tension['max_rackets'].'.',
            'preferred_at.*' => 'Chọn một thời điểm trong '.$tension['book_ahead_days'].' ngày tới.',
            'notes.*' => 'Ghi chú không được vượt quá 1000 ký tự.',
        ]);
        $order = $stringing->book($request, $data);

        return redirect()->route('service-orders.show', ['serviceOrder' => $order->public_id])
            ->with('service_placed', $order->public_id);
    }

    public function show(Request $request, ServiceOrder $serviceOrder, StringingService $stringing, ShopSettings $settings): Response
    {
        $owns = $request->user() && $serviceOrder->user_id !== null && (int) $request->user()->id === (int) $serviceOrder->user_id;
        // The session that made the request, its owner's account, or the signed link in its emails.
        abort_unless($owns || in_array($serviceOrder->public_id, $request->session()->get('service_order_access', []), true)
            || $request->hasValidRelativeSignature(), 404);

        return Inertia::render('shop/service-order', [
            'order' => [
                ...$stringing->summary($serviceOrder),
                ...$serviceOrder->only(['name', 'phone', 'email', 'notes', 'string_price', 'labor_fee']),
                'preferred_at' => $serviceOrder->preferred_at?->toIso8601String(),
            ],
            'justPlaced' => $request->session()->get('service_placed') === $serviceOrder->public_id,
            'address' => $settings->all()['contact_address'],
        ]);
    }
}
