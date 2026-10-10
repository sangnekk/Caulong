<?php

namespace App\Services;

use App\Models\ServiceOrder;
use App\Models\ServiceString;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The racket stringing service: a customer asks for rackets to be strung, brings them in,
 * and collects and pays for them when they are ready. Nothing is delivered and nothing is
 * paid online, so a request is not an order of the shop's goods.
 *
 * pending (the shop has not answered yet) → confirmed (the shop expects the racket) →
 * in_progress (the racket is in, being strung) → ready (to collect) → completed (collected
 * and paid). A request can be cancelled until it is ready.
 */
class StringingService
{
    public const STATUSES = ['pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'];

    /** The shop's string, or one the customer brings (then only the stringing is charged). */
    public const TYPES = ['shop_string', 'own_string'];

    private const TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['in_progress', 'cancelled'],
        'in_progress' => ['ready', 'cancelled'],
        'ready' => ['completed'],
        'completed' => [],
        'cancelled' => [],
    ];

    public function __construct(private ShopSettings $settings, private EmailService $emails) {}

    /**
     * What the service page shows: whether requests are taken, the prices, the strings.
     *
     * @return array{enabled: bool, fee: int, tension: array{min: int, max: int}, max_rackets: int, strings: list<array{id: int, label: string, price: int}>}
     */
    public function offer(): array
    {
        $rules = $this->settings->stringing();

        return [
            'enabled' => $rules['enabled'],
            'fee' => $rules['fee'],
            'tension' => ['min' => (int) config('shop.stringing.tension_min'), 'max' => (int) config('shop.stringing.tension_max')],
            'max_rackets' => (int) config('shop.stringing.max_rackets'),
            'strings' => array_values(ServiceString::query()->active()->orderBy('price')->orderBy('name')->get()
                ->map(fn (ServiceString $string) => ['id' => $string->id, 'label' => $string->label(), 'price' => $string->price])->all()),
        ];
    }

    /**
     * Takes a request from the service page. The figures are worked out here: the browser
     * sends the choices, never a price.
     *
     * @param  array<string, mixed>  $data  validated by ServiceOrderController::store
     */
    public function book(Request $request, array $data): ServiceOrder
    {
        // The form's token makes one request of a form sent twice (a double click, a retry). It
        // is the page's, not the session's: someone on their first visit has no session in
        // their browser yet when the page is built, so nothing could be kept for them there.
        $token = $data['booking_token'];
        $existing = ServiceOrder::query()->where('booking_token', $token)->first();
        if ($existing !== null) {
            // Only for the browser that made it: a token is no way to somebody else's request.
            if (in_array($existing->public_id, $request->session()->get('service_order_access', []), true)) {
                return $existing;
            }
            throw ValidationException::withMessages(['booking_token' => 'Phiên đặt lịch đã hết hạn. Vui lòng tải lại trang rồi gửi lại.']);
        }
        if (! $this->settings->stringing()['enabled']) {
            throw ValidationException::withMessages(['booking_token' => 'Cửa hàng đang tạm ngưng nhận đặt lịch đan dây.']);
        }

        $string = $data['service_type'] === 'shop_string'
            ? ServiceString::query()->active()->whereKey((int) $data['service_string_id'])->first()
            : null;
        if ($data['service_type'] === 'shop_string' && $string === null) {
            throw ValidationException::withMessages(['service_string_id' => 'Loại dây này không còn trong danh sách của cửa hàng. Vui lòng chọn loại khác.']);
        }
        $quantity = (int) $data['quantity'];
        $price = $this->price($string, $quantity);
        $user = $request->user();

        $order = ServiceOrder::create([
            'public_id' => (string) Str::uuid(),
            'booking_token' => $token,
            // A request made by staff at the counter is not put on the staff account.
            'user_id' => $user instanceof User && ! $user->is_admin ? $user->id : null,
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'service_type' => $data['service_type'],
            'racket' => $data['racket'],
            'service_string_id' => $string?->id,
            'string_name' => $string?->label() ?? ($data['string_name'] ?? null),
            'tension_kg' => (float) $data['tension_kg'],
            'quantity' => $quantity,
            'notes' => $data['notes'] ?? null,
            'preferred_at' => isset($data['preferred_at'])
                ? CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['preferred_at'], (string) config('shop.timezone'))?->utc()
                : null,
            ...$price,
        ]);

        $access = $request->session()->get('service_order_access', []);
        $access[] = $order->public_id;
        $request->session()->put('service_order_access', array_slice(array_values(array_unique($access)), -25));
        $this->emails->service($order, 'placed');

        return $order;
    }

    /**
     * What a request costs: for each racket the string (the shop's, else nothing) and the fee.
     *
     * @return array{string_price: int, labor_fee: int, total: int}
     */
    public function price(?ServiceString $string, int $quantity): array
    {
        $fee = $this->settings->stringing()['fee'];
        $stringPrice = $string !== null ? $string->price : 0;

        return ['string_price' => $stringPrice, 'labor_fee' => $fee, 'total' => $quantity * ($stringPrice + $fee)];
    }

    /** Moves a request one step on. The customer hears when it is ready, and when it is cancelled. */
    public function transition(ServiceOrder $order, string $status): ServiceOrder
    {
        // Whether this call is the one that moved it: the caller's copy may be out of date.
        $moved = false;
        $order = DB::transaction(function () use ($order, $status, &$moved) {
            // A transaction that is tried again starts over.
            $moved = false;
            $locked = ServiceOrder::whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === $status) {
                return $locked;
            }
            if (! in_array($status, self::TRANSITIONS[$locked->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => 'Không thể chuyển yêu cầu sang trạng thái này.']);
            }
            $locked->update(['status' => $status, $status.'_at' => now()]);
            $moved = true;

            return $locked;
        }, 3);
        if ($moved && in_array($status, ['ready', 'cancelled'], true)) {
            $this->emails->service($order, $status);
        }

        return $order;
    }

    /**
     * A customer's requests as their pages list them, the latest first.
     *
     * @return list<array{id: int, public_id: string, code: string, status: string, racket: string, string_name: string|null, service_type: string, tension_kg: float, quantity: int, total: int, created_at: string}>
     */
    public function history(User $customer, int $limit = 20): array
    {
        return array_values(ServiceOrder::query()->where('user_id', $customer->id)->latest('id')->limit($limit)->get()
            ->map(fn (ServiceOrder $order) => $this->summary($order))->all());
    }

    /** @return array{id: int, public_id: string, code: string, status: string, racket: string, string_name: string|null, service_type: string, tension_kg: float, quantity: int, total: int, created_at: string} */
    public function summary(ServiceOrder $order): array
    {
        return [
            'id' => $order->id,
            'public_id' => $order->public_id,
            'code' => $order->code,
            'status' => $order->status,
            'racket' => $order->racket,
            'string_name' => $order->string_name,
            'service_type' => $order->service_type,
            'tension_kg' => $order->tension_kg,
            'quantity' => $order->quantity,
            'total' => $order->total,
            'created_at' => $order->created_at->toIso8601String(),
        ];
    }
}
