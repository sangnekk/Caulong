@use('App\Support\MailText')
<x-mail::message>
<h1>Chào {{ MailText::line($name, 80) }},</h1>

Tài khoản của bạn ở {{ config('app.name') }} đã sẵn sàng. Đơn bạn đặt khi đã đăng nhập được lưu trong tài khoản để theo dõi, và bạn có thể lưu lại những cây vợt muốn xem sau.

@unless ($verified)
Chúng tôi đã gửi riêng một email để xác minh địa chỉ này. Bạn bấm liên kết trong email đó để hoàn tất.

@endunless
<x-mail::button :url="$shop">
Xem vợt cầu lông
</x-mail::button>

Chưa biết chọn cây nào? [Gợi ý chọn vợt]({{ $advisor }}) hỏi về ngân sách, lối chơi và trình độ rồi đề xuất cho bạn. Thông tin và đơn hàng của bạn ở [trang tài khoản]({{ $account }}).

Trân trọng,<br>
{{ config('app.name') }}
</x-mail::message>
