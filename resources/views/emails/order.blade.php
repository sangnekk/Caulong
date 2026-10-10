@use('App\Support\MailText')
@use('App\Support\Money')
@php
    // Cash on delivery not yet collected: the customer pays the courier.
    $due = $order->payment_method === 'cod' && $order->payment_status !== 'paid';
@endphp
<x-mail::message>
@if ($stage === 'placed')
# Cảm ơn bạn đã đặt hàng

Chúng tôi đã nhận đơn **{{ $order->code }}** và sẽ gọi số {{ MailText::cell($order->phone) }} để xác nhận trước khi giao.

<x-mail::table>
| Sản phẩm | Số lượng | Thành tiền |
|:---|:---:|---:|
@foreach ($order->items as $item)
| {{ MailText::cell($item->product_name) }} ({{ MailText::cell($item->variant_name) }}) | {{ $item->quantity }} | {{ Money::vnd($item->line_total) }} |
@endforeach
</x-mail::table>

<p>
Tiền hàng: {{ Money::vnd($order->subtotal) }}<br>
@if ($order->discount_total > 0)
Giảm giá{{ $order->coupon_code ? ' (mã '.$order->coupon_code.')' : '' }}: −{{ Money::vnd($order->discount_total) }}<br>
@endif
Phí giao hàng: {{ $order->shipping_fee > 0 ? Money::vnd($order->shipping_fee) : 'Miễn phí' }}<br>
<strong>Tổng cộng: {{ Money::vnd($order->total) }}</strong>
</p>

@if ($due)
Bạn thanh toán **{{ Money::vnd($order->total) }}** cho người giao khi nhận hàng.

@endif
<p>
<strong>Giao tới</strong><br>
{{ MailText::line($order->name, 120) }} · {{ MailText::line($order->phone, 20) }}<br>
{{ MailText::line($order->address, 500) }}
</p>

<x-mail::button :url="$link">
Theo dõi đơn hàng
</x-mail::button>
@elseif ($stage === 'shipped')
# Đơn hàng đang trên đường tới bạn

Đơn **{{ $order->code }}** đã được giao cho đơn vị vận chuyển.

@if ($due)
Bạn chuẩn bị **{{ Money::vnd($order->total) }}** để thanh toán khi nhận hàng.

@endif
<p>
<strong>Giao tới</strong><br>
{{ MailText::line($order->name, 120) }} · {{ MailText::line($order->phone, 20) }}<br>
{{ MailText::line($order->address, 500) }}
</p>

<x-mail::button :url="$link">
Theo dõi đơn hàng
</x-mail::button>
@elseif ($stage === 'delivered')
# Đơn hàng đã giao

Đơn **{{ $order->code }}** đã được giao. Cảm ơn bạn đã mua hàng ở {{ config('app.name') }}.

@if ($review)
Khi đã đánh thử, bạn có thể đăng nhập và viết đánh giá ở trang của cây vợt: nó giúp người chơi khác chọn vợt dễ hơn.

@endif
<x-mail::button :url="$link">
Xem đơn hàng
</x-mail::button>
@else
# Đơn hàng đã hủy

Đơn **{{ $order->code }}** đã được hủy và sẽ không được giao.

Nếu bạn không yêu cầu hủy, hãy liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }} để chúng tôi kiểm tra lại.

<x-mail::button :url="$link">
Xem đơn hàng
</x-mail::button>
@endif

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
