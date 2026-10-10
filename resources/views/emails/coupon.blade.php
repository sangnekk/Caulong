@use('App\Support\MailText')
@use('App\Support\Money')
<x-mail::message :unsubscribe="$unsubscribe">
<h1>Chào {{ MailText::line($name, 80) }},</h1>

@if ($reason === 'winback')
Đã lâu bạn chưa ghé {{ config('app.name') }}. Nếu bạn đang tính đổi vợt, đây là một mã giảm giá dành riêng cho bạn.
@elseif ($reason === 'vip')
Cảm ơn bạn đã mua hàng nhiều lần ở {{ config('app.name') }}. Chúng tôi gửi bạn một mã giảm giá dành cho khách thân thiết.
@else
{{ config('app.name') }} gửi bạn một mã giảm giá dành riêng cho tài khoản của bạn.
@endif

<x-mail::panel>
**{{ $coupon->code }}**

{{ $worth }}{{ $coupon->min_order > 0 ? ' cho đơn có tiền hàng từ '.Money::vnd($coupon->min_order) : '' }}.
@if ($coupon->expires_at)
Dùng được đến hết ngày {{ $coupon->expires_at->setTimezone(config('shop.timezone'))->format('d/m/Y') }}.
@endif
</x-mail::panel>

Bạn nhập mã ở giỏ hàng khi đã đăng nhập bằng tài khoản này. Mã dùng được một lần và chỉ tài khoản của bạn dùng được.

<x-mail::button :url="$shop">
Xem vợt cầu lông
</x-mail::button>

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
