<?php

namespace App\Mail;

use App\Models\Coupon;
use App\Models\User;
use App\Support\Frontend;
use App\Support\Money;

/**
 * A coupon made for one customer: a gift from the shop's staff, a "come back" offer after a
 * long silence, or a thank-you for becoming a VIP. The last two are promotional.
 */
class CouponMail extends ShopMail
{
    public const REASONS = ['gift', 'winback', 'vip'];

    /** @param  value-of<self::REASONS>  $reason */
    public function __construct(public Coupon $coupon, public string $reason = 'gift') {}

    public function title(): string
    {
        return match ($this->reason) {
            'winback' => 'Lâu rồi chưa gặp: '.config('app.name').' gửi bạn một mã giảm giá',
            'vip' => 'Cảm ơn bạn đã gắn bó: ưu đãi dành cho khách thân thiết',
            default => config('app.name').' gửi bạn một mã giảm giá',
        };
    }

    protected function subscriber(): ?User
    {
        return $this->reason === 'gift' ? null : $this->coupon->user;
    }

    protected function body(): array
    {
        $coupon = $this->coupon;

        return ['emails.coupon', [
            'name' => $coupon->user?->name,
            'reason' => $this->reason,
            'coupon' => $coupon,
            'worth' => $coupon->type === 'percent'
                ? 'Giảm '.$coupon->value.'%'.($coupon->max_discount ? ', tối đa '.Money::vnd($coupon->max_discount) : '')
                : 'Giảm '.Money::vnd($coupon->value),
            'shop' => Frontend::url('/products'),
        ]];
    }
}
