<?php

namespace App\Services;

use Illuminate\Support\Str;

class SupportChatResponder
{
    /** @return array{body: string, action_url: string|null, action_label: string|null, needs_human: bool} */
    public function reply(string $question, bool $guest = false): array
    {
        if ($guest && preg_match('/(?<![A-Z0-9])[A-F0-9]{8}(?![A-Z0-9])/i', $question, $matches) === 1) {
            $code = strtoupper($matches[0]);
            $contact = app(ShopSettings::class)->all();
            if ($contact['contact_chat_url'] !== '') {
                return [
                    'body' => 'Mình nhận được mã đơn '.$code.'. Vì bạn chưa đăng nhập, hãy mở Zalo và gửi mã này cho nhân viên để họ kiểm tra đơn giúp bạn.',
                    'action_url' => $contact['contact_chat_url'],
                    'action_label' => 'Mở Zalo hỗ trợ · mã '.$code,
                    'needs_human' => false,
                ];
            }

            $phone = preg_replace('/[^0-9+]/', '', $contact['hotline']);

            return [
                'body' => 'Mình nhận được mã đơn '.$code.'. Vui lòng gọi tổng đài và cung cấp mã này để nhân viên kiểm tra đơn giúp bạn.',
                'action_url' => $phone !== '' ? 'tel:'.$phone : null,
                'action_label' => $phone !== '' ? 'Gọi tổng đài · mã '.$code : null,
                'needs_human' => false,
            ];
        }

        $normalized = Str::ascii(mb_strtolower($question));
        $includes = fn (string ...$terms): bool => collect($terms)->contains(fn (string $term) => str_contains($normalized, $term));
        $action = fn (string $url, string $label): array => ['action_url' => $url, 'action_label' => $label];

        if ($includes('phi giao', 'giao hang', 'van chuyen', 'phi ship', 'mien phi ship')) {
            $settings = app(ShopSettings::class);
            $fee = $settings->shippingFee();
            $threshold = $settings->freeShippingThreshold();
            $body = $fee === 0
                ? 'Shop đang miễn phí giao hàng. Bạn vẫn có thể kiểm tra phí cuối cùng trong giỏ hàng trước khi đặt.'
                : ($threshold > 0
                    ? 'Phí giao hàng hiện là '.number_format($fee, 0, ',', '.').' ₫; đơn từ '.number_format($threshold, 0, ',', '.').' ₫ được miễn phí giao. Phí chính xác sẽ hiện trong giỏ hàng.'
                    : 'Phí giao hàng hiện là '.number_format($fee, 0, ',', '.').' ₫. Phí sẽ hiện trong giỏ hàng trước khi bạn xác nhận đơn.');

            return ['body' => $body, ...$action('/cart', 'Mở giỏ hàng'), 'needs_human' => false];
        }

        if ($includes('thanh toan', 'cod', 'tra tien', 'chuyen khoan')) {
            return ['body' => 'Hiện shop hỗ trợ thanh toán khi nhận hàng (COD); thanh toán online chưa được kết nối.', ...$action('/cart', 'Xem giỏ hàng'), 'needs_human' => false];
        }

        if ($includes('don hang', 'theo doi', 'ma don', 'kiem tra don')) {
            return ['body' => 'Bạn có thể xem đơn đã đặt trong mục đơn hàng của tài khoản. Nếu cần kiểm tra đơn khách hoặc cần hỗ trợ cụ thể, hãy gửi tin nhắn tại đây; nhân viên sẽ phản hồi.', ...$action('/account#don-hang', 'Xem đơn hàng'), 'needs_human' => false];
        }

        if ($includes('doi tra', 'bao hanh', 'hoan tien', 'doi hang', 'san pham loi')) {
            return ['body' => 'Nhân viên cần kiểm tra sản phẩm và tình trạng đơn để tư vấn chính xác. Hãy gửi mã đơn hoặc nội dung cần hỗ trợ tại đây; shop sẽ phản hồi trong cuộc trò chuyện này.', 'action_url' => null, 'action_label' => null, 'needs_human' => true];
        }

        if ($includes('dia chi', 'o dau', 'duong di', 'chi nhanh')) {
            $address = app(ShopSettings::class)->all()['contact_address'];
            $map = $address !== '' ? 'https://www.google.com/maps/search/?api=1&query='.urlencode($address) : null;

            return [
                'body' => $address !== '' ? 'Địa chỉ shop: '.$address.'.' : 'Shop chưa cập nhật địa chỉ trong phần liên hệ.',
                'action_url' => $map,
                'action_label' => $map ? 'Mở địa chỉ trên bản đồ' : null,
                'needs_human' => false,
            ];
        }

        if ($includes('ho tro san pham da mua', 'ho tro san pham')) {
            return [
                'body' => 'Đã nhận yêu cầu hỗ trợ sản phẩm đã mua. Nhân viên sẽ kiểm tra đơn hàng của bạn; hãy gửi thêm tình trạng hoặc câu hỏi cụ thể để được hỗ trợ nhanh hơn.',
                'action_url' => null,
                'action_label' => null,
                'needs_human' => true,
            ];
        }

        if ($includes('chon vot', 'tu van vot', 'ngan sach', 'loi choi', 'trinh do', 'muc gia')) {
            return ['body' => 'Bạn có thể nhập ngân sách rồi chọn lối chơi và trình độ. Shop sẽ ưu tiên vợt còn hàng; nếu chưa có mẫu phù hợp, các lựa chọn hết hàng sẽ được ghi rõ.', ...$action('/advisor', 'Mở tư vấn chọn vợt'), 'needs_human' => false];
        }

        return ['body' => 'Mình đã chuyển tin nhắn tới nhân viên hỗ trợ. Bạn có thể gửi thêm mã đơn hoặc thông tin cần kiểm tra; nhân viên sẽ phản hồi tại đây.', 'action_url' => null, 'action_label' => null, 'needs_human' => true];
    }
}
