@use('App\Support\MailText')
@use('App\Support\Money')
<x-mail::message :unsubscribe="$unsubscribe">
<h1>Chào {{ MailText::line($name, 80) }},</h1>

@if ($reason === 'abandoned_cart')
Bạn đã chọn những cây vợt dưới đây nhưng chưa đặt hàng. Chúng vẫn còn hàng:

<x-mail::table>
| Sản phẩm | Giá từ |
|:---|---:|
@foreach ($products as $product)
| [{{ MailText::cell($product['name']) }}]({{ $product['url'] }}) | {{ $product['price'] === null ? '' : Money::vnd($product['price']) }} |
@endforeach
</x-mail::table>

<x-mail::button :url="$cart">
Mở giỏ hàng
</x-mail::button>

Giỏ hàng được giữ trong trình duyệt bạn đã dùng. Nếu giỏ đã trống, bạn bấm vào tên cây vợt ở trên để thêm lại.
@else
Bạn đã nhận đơn hàng{{ $order ? ' '.$order->code : '' }} được ít ngày. Hy vọng cây vợt hợp tay bạn. Vài dòng đánh giá của bạn giúp người chơi khác chọn vợt dễ hơn:

@foreach ($products as $product)
- [Đánh giá {{ MailText::cell($product['name']) }}]({{ $product['url'] }})
@endforeach

@if (count($suggested) > 0)
Người chơi mua cây vợt này cũng hay xem:

<x-mail::table>
| Sản phẩm | Giá từ |
|:---|---:|
@foreach ($suggested as $product)
| [{{ MailText::cell($product['name']) }}]({{ $product['url'] }}) | {{ $product['price'] === null ? '' : Money::vnd($product['price']) }} |
@endforeach
</x-mail::table>

@endif
<x-mail::button :url="$shop">
Xem cửa hàng
</x-mail::button>
@endif

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
