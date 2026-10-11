<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\PaymentService;
use App\Services\ShopSettings;
use App\Support\Frontend;

/**
 * What happened to an order, to the person who placed it: placed, paid (a bank transfer the
 * shop received), shipped, delivered or cancelled. The link opens the order by its signature,
 * with or without an account.
 */
class OrderMail extends ShopMail
{
    public const STAGES = ['placed', 'paid', 'shipped', 'delivered', 'cancelled'];

    /** @param  value-of<self::STAGES>  $stage */
    public function __construct(public Order $order, public string $stage) {}

    public function title(): string
    {
        return match ($this->stage) {
            'placed' => 'Đã nhận đơn hàng '.$this->order->code,
            'paid' => 'Đã nhận thanh toán cho đơn hàng '.$this->order->code,
            'shipped' => 'Đơn hàng '.$this->order->code.' đang được giao',
            'delivered' => 'Đơn hàng '.$this->order->code.' đã giao',
            default => 'Đơn hàng '.$this->order->code.' đã hủy',
        };
    }

    protected function body(): array
    {
        return ['emails.order', [
            'order' => $this->order->loadMissing('items'),
            'stage' => $this->stage,
            'link' => Frontend::order($this->order),
            // Only a customer with an account can review what they received.
            'review' => $this->order->user_id !== null,
            'hotline' => app(ShopSettings::class)->all()['hotline'],
            // The order's bank transfer as it stands when the email is written; the QR code
            // is on the order's page, not in the email.
            'transfer' => app(PaymentService::class)->summary($this->order, withCode: false),
        ]];
    }
}
