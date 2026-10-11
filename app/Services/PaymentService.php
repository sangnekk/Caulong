<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Support\VietQr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Paying for an order by bank transfer. The customer places the order, transfers the amount
 * to the shop's account with the order's reference, and the shop confirms that the money
 * arrived; only then is the order confirmed and sent. Until then the order holds its goods,
 * for a limited time.
 *
 * pending (the transfer is awaited) → paid → refunded (the money went back and the order was
 * cancelled). A payment that is never made ends expired (time ran out) or cancelled (the
 * order was cancelled first).
 *
 * No bank or provider reports to the shop yet: settle() is called by a member of staff. It
 * is also where such a report would arrive, which is why it takes the amount and the
 * provider's own id of the transfer.
 */
class PaymentService
{
    public const METHOD = 'bank_transfer';

    public const STATUSES = ['pending', 'paid', 'expired', 'cancelled', 'refunded'];

    public function __construct(private ShopSettings $settings, private OrderService $orders, private EmailService $emails) {}

    /**
     * The ways this cart can be paid for. A transfer is offered once the owner has entered an
     * account, and never for sample goods: those are not sold, so no money is asked for them.
     *
     * @param  array{items: list<array<string, mixed>>, total: int, ...}  $cart  CartService::summary()
     * @return list<array{id: string, label: string, hint: string}>
     */
    public function methods(array $cart): array
    {
        $methods = [['id' => 'cod', 'label' => 'Thanh toán khi nhận hàng', 'hint' => 'Không cần chuyển khoản trước.']];
        $sample = collect($cart['items'])->contains(fn (array $item) => (bool) ($item['is_demo'] ?? false));
        if ($this->settings->bankTransfer()['ready'] && ! $sample && $cart['total'] > 0) {
            $methods[] = [
                'id' => self::METHOD,
                'label' => 'Chuyển khoản ngân hàng',
                'hint' => 'Chuyển khoản sau khi đặt. Cửa hàng giao hàng khi đã nhận được tiền.',
            ];
        }

        return $methods;
    }

    /**
     * What an order's pages and emails say about its transfer; null for cash on delivery.
     * The account is given only while the money is awaited.
     *
     * @return array{status: string, reference: string, amount: int, expires_at: string|null, paid_at: string|null, account: array{bank: string, number: string, name: string, qr: string|null}|null}|null
     */
    public function summary(Order $order, bool $withCode = true): ?array
    {
        $payment = $order->payment()->first();
        if ($payment === null) {
            return null;
        }
        // The account as it is now: an order still unpaid is paid into the shop's current account.
        $bank = $this->settings->bankTransfer();
        $payable = $payment->status === 'pending' && $bank['bank'] !== '' && $bank['account_number'] !== '';

        return [
            'status' => $payment->status,
            'reference' => $payment->reference,
            'amount' => $payment->amount,
            'expires_at' => $payment->expires_at?->toIso8601String(),
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'account' => $payable ? [
                'bank' => $bank['bank'],
                'number' => $bank['account_number'],
                'name' => $bank['account_name'],
                'qr' => $withCode
                    ? VietQr::image(VietQr::payload($bank['bin'], $bank['account_number'], $payment->amount, $payment->reference))
                    : null,
            ] : null,
        ];
    }

    /**
     * The money arrived. Said twice, it is counted once. A provider's report gives the amount
     * it saw and its own id of the transfer; a member of staff gives themselves.
     *
     * @param  array<string, mixed>|null  $payload
     */
    public function settle(Payment $payment, ?User $by = null, ?int $amount = null, ?string $transaction = null, ?array $payload = null): Payment
    {
        // Whether this call is the one that settled it: only that one writes to the customer.
        $settled = false;
        $payment = DB::transaction(function () use ($payment, $by, $amount, $transaction, $payload, &$settled) {
            $settled = false;
            // The order first, then its payment: the same order everywhere, so two calls wait for each other.
            $order = Order::whereKey($payment->order_id)->lockForUpdate()->firstOrFail();
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'paid') {
                return $locked;
            }
            if ($locked->status !== 'pending' || $order->status !== 'pending') {
                throw ValidationException::withMessages(['payment' => 'Đơn này không còn chờ chuyển khoản (đã hủy hoặc hết hạn). Nếu tiền đã về, hãy hoàn lại cho khách hoặc mời khách đặt đơn mới.']);
            }
            if ($amount !== null && $amount !== $locked->amount) {
                throw ValidationException::withMessages(['payment' => 'Số tiền nhận được không khớp với số tiền của đơn.']);
            }
            $locked->update([
                'status' => 'paid', 'paid_at' => now(), 'confirmed_by' => $by?->id,
                'provider_transaction_id' => $transaction, 'payload' => $payload,
            ]);
            $order->update(['payment_status' => 'paid', 'paid_at' => now()]);
            // Paid for: there is nothing left to confirm with the customer.
            $this->orders->transition($order, 'confirmed');
            $settled = true;

            return $locked;
        }, 3);
        if ($settled) {
            $this->emails->order($payment->order()->firstOrFail(), 'paid');
        }

        return $payment;
    }

    /**
     * The shop sent the money back, and the order is off: its goods return to the shelf. Only
     * before the goods have left; a return after delivery is not handled here.
     */
    public function refund(Payment $payment, User $by): Payment
    {
        return DB::transaction(function () use ($payment, $by) {
            $order = Order::whereKey($payment->order_id)->lockForUpdate()->firstOrFail();
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'refunded') {
                return $locked;
            }
            if ($locked->status !== 'paid') {
                throw ValidationException::withMessages(['payment' => 'Chỉ ghi nhận hoàn tiền cho khoản chuyển khoản đã nhận.']);
            }
            if (! in_array($order->status, ['pending', 'confirmed'], true)) {
                throw ValidationException::withMessages(['payment' => 'Đơn đã giao đi nên không hủy và hoàn tiền ở đây được.']);
            }
            $locked->update(['status' => 'refunded', 'refunded_at' => now(), 'refunded_by' => $by->id]);
            // No longer money the shop holds: out of what was collected.
            $order->update(['payment_status' => 'refunded', 'paid_at' => null]);
            $this->orders->transition($order, 'cancelled');

            return $locked;
        }, 3);
    }

    /**
     * Cancels the orders whose transfer did not come in time, so their goods can be sold
     * again. Returns how many.
     */
    public function expireOverdue(): int
    {
        $expired = 0;
        $overdue = Payment::query()->where('status', 'pending')->whereNotNull('expires_at')->where('expires_at', '<=', now())->orderBy('id')->pluck('order_id', 'id');
        foreach ($overdue as $id => $orderId) {
            // One order that cannot be cancelled does not keep the others waiting.
            $expired += (int) rescue(fn () => DB::transaction(function () use ($id, $orderId): bool {
                $order = Order::whereKey($orderId)->lockForUpdate()->firstOrFail();
                $locked = Payment::whereKey($id)->lockForUpdate()->firstOrFail();
                // Paid, or cancelled, in the meantime.
                if ($locked->status !== 'pending' || $locked->expires_at === null || $locked->expires_at->isFuture()) {
                    return false;
                }
                // Before the order is cancelled: its email says why by this.
                $locked->update(['status' => 'expired']);
                if ($order->status === 'pending' && $order->payment_status !== 'paid') {
                    $this->orders->transition($order, 'cancelled');
                }

                return true;
            }, 3), false);
        }

        return $expired;
    }

    /** What the customer writes in the transfer: "DH" and the order's short code. */
    public static function reference(Order $order): string
    {
        $reference = 'DH'.$order->code;
        // Two orders whose ids start alike: told apart by two more characters.
        while (Payment::where('reference', $reference)->exists()) {
            $reference = 'DH'.$order->code.strtoupper(bin2hex(random_bytes(1)));
        }

        return $reference;
    }
}
