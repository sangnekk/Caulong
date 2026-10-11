@use('App\Support\MailText')
@use('App\Support\Money')
@use('Illuminate\Support\Carbon')
@php
    // Cash on delivery not yet collected: the customer pays the courier.
    $due = $order->payment_method === 'cod' && $order->payment_status !== 'paid';
    // A bank transfer the shop still waits for, with the account to pay into.
    $account = $transfer['account'] ?? null;
    $deadline = isset($transfer['expires_at'])
        ? Carbon::parse($transfer['expires_at'])->setTimezone(config('shop.timezone'))->format('H:i d/m/Y')
        : null;
@endphp
<x-mail::message>
@if ($stage === 'placed')
# Cảm ơn bạn đã đặt hàng

@if ($transfer !== null)
Chúng tôi đã nhận đơn **{{ $order->code }}**. Đơn được chuẩn bị và giao ngay khi cửa hàng nhận được tiền chuyển khoản.
@else
Chúng tôi đã nhận đơn **{{ $order->code }}** và sẽ gọi số {{ MailText::cell($order->phone) }} để xác nhận trước khi giao.
@endif

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
@if ($account !== null)
<p>
<strong>Chuyển khoản để hoàn tất đơn</strong><br>
Ngân hàng: {{ MailText::line($account['bank'], 60) }}<br>
Số tài khoản: {{ MailText::line($account['number'], 30) }}<br>
Chủ tài khoản: {{ MailText::line($account['name'], 80) }}<br>
Số tiền: <strong>{{ Money::vnd($transfer['amount']) }}</strong><br>
Nội dung chuyển khoản: <strong>{{ $transfer['reference'] }}</strong>
</p>

Ghi đúng nội dung để cửa hàng nhận ra đơn của bạn.
@if ($deadline)
Đơn giữ hàng tới **{{ $deadline }}**; sau thời điểm đó, đơn chưa thanh toán sẽ tự hủy.
@endif
Trang đơn hàng có mã QR để quét bằng ứng dụng ngân hàng.

@elseif ($transfer !== null && $transfer['status'] === 'pending')
Đơn này thanh toán bằng chuyển khoản. Mở trang đơn hàng để xem hướng dẫn, hoặc liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }}.

@endif
<p>
<strong>Giao tới</strong><br>
{{ MailText::line($order->name, 120) }} · {{ MailText::line($order->phone, 20) }}<br>
{{ MailText::line($order->address, 500) }}
</p>

<x-mail::button :url="$link">
{{ $account !== null ? 'Xem đơn hàng và mã QR' : 'Theo dõi đơn hàng' }}
</x-mail::button>
@elseif ($stage === 'paid')
# Đã nhận thanh toán

Cửa hàng đã nhận **{{ Money::vnd($order->total) }}** chuyển khoản cho đơn **{{ $order->code }}**. Đơn đang được chuẩn bị để giao; bạn không cần trả thêm gì khi nhận hàng.

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

@elseif ($order->payment_status === 'paid')
Đơn đã được thanh toán; bạn không cần trả thêm gì khi nhận hàng.

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

@if (($transfer['status'] ?? null) === 'expired')
Cửa hàng chưa nhận được tiền chuyển khoản trong thời hạn giữ hàng nên đơn đã tự hủy. Nếu bạn đã chuyển tiền, hãy liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }} kèm nội dung chuyển khoản **{{ $transfer['reference'] }}** để được hoàn tiền hoặc đặt lại đơn.
@elseif (($transfer['status'] ?? null) === 'refunded')
Cửa hàng đã chuyển trả **{{ Money::vnd($transfer['amount']) }}** về tài khoản bạn đã dùng để thanh toán. Nếu sau vài ngày làm việc bạn chưa nhận được, hãy liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }}.
@else
Nếu bạn không yêu cầu hủy, hãy liên hệ cửa hàng{{ $hotline ? ' qua số '.$hotline : '' }} để chúng tôi kiểm tra lại.
@endif

<x-mail::button :url="$link">
Xem đơn hàng
</x-mail::button>
@endif

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
