@use('App\Support\MailText')
@use('App\Support\Money')
@php
    $tension = rtrim(rtrim(number_format($order->tension_kg, 1, ',', ''), '0'), ',').' kg';
    $string = $order->string_name ?: ($order->service_type === 'own_string' ? 'Dây bạn mang tới' : null);
@endphp
<x-mail::message>
@if ($stage === 'placed')
# Đã nhận yêu cầu đan dây

Chúng tôi đã nhận yêu cầu **{{ $order->code }}** và sẽ gọi số {{ MailText::cell($order->phone) }} để hẹn lúc bạn mang vợt tới.

<p>
<strong>Vợt:</strong> {{ MailText::line($order->racket, 160) }}{{ $order->quantity > 1 ? ' × '.$order->quantity : '' }}<br>
@if ($string)
<strong>Dây:</strong> {{ MailText::line($string, 160) }}<br>
@endif
<strong>Mức căng:</strong> {{ $tension }}<br>
@if ($order->total > 0)
<strong>Tạm tính:</strong> {{ Money::vnd($order->total) }}, thanh toán khi nhận vợt
@else
<strong>Chi phí:</strong> cửa hàng báo khi nhận vợt
@endif
</p>

<x-mail::button :url="$link">
Theo dõi yêu cầu
</x-mail::button>
@elseif ($stage === 'ready')
# Vợt của bạn đã đan xong

Yêu cầu **{{ $order->code }}** đã xong. Bạn ghé cửa hàng nhận vợt{{ $address ? ' tại '.MailText::cell($address) : '' }} và đọc mã này cho nhân viên.

@if ($order->total > 0)
Số tiền thanh toán khi nhận vợt: **{{ Money::vnd($order->total) }}**.

@endif
<x-mail::button :url="$link">
Xem yêu cầu
</x-mail::button>
@else
# Yêu cầu đan dây đã hủy

Yêu cầu **{{ $order->code }}** đã được hủy.

Nếu bạn không yêu cầu hủy, hãy liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }} để chúng tôi kiểm tra lại.

<x-mail::button :url="$link">
Xem yêu cầu
</x-mail::button>
@endif

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
