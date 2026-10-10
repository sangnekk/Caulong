<?php

namespace App\Mail;

use App\Models\ServiceOrder;
use App\Services\ShopSettings;
use App\Support\Frontend;

/**
 * What happened to a stringing request, to whoever made it: received, ready to collect, or
 * cancelled. The link opens the request by its signature, with or without an account.
 */
class ServiceOrderMail extends ShopMail
{
    public const STAGES = ['placed', 'ready', 'cancelled'];

    /** @param  value-of<self::STAGES>  $stage */
    public function __construct(public ServiceOrder $order, public string $stage) {}

    public function title(): string
    {
        return match ($this->stage) {
            'placed' => 'Đã nhận yêu cầu đan dây '.$this->order->code,
            'ready' => 'Vợt của bạn đã đan xong ('.$this->order->code.')',
            default => 'Yêu cầu đan dây '.$this->order->code.' đã hủy',
        };
    }

    protected function body(): array
    {
        $contact = app(ShopSettings::class)->all();

        return ['emails.service-order', [
            'order' => $this->order,
            'stage' => $this->stage,
            'link' => Frontend::serviceOrder($this->order),
            'hotline' => $contact['hotline'],
            'address' => $contact['contact_address'],
        ]];
    }
}
