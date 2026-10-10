<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\ShopSettings;
use App\Support\Frontend;

/**
 * What happened to an order, to the person who placed it: placed, shipped, delivered or
 * cancelled. The link opens the order by its signature, with or without an account.
 */
class OrderMail extends ShopMail
{
    public const STAGES = ['placed', 'shipped', 'delivered', 'cancelled'];

    /** @param  value-of<self::STAGES>  $stage */
    public function __construct(public Order $order, public string $stage) {}

    public function title(): string
    {
        return match ($this->stage) {
            'placed' => 'Đã nhận đơn hàng '.$this->order->code,
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
        ]];
    }
}
