<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\CustomerSegmentation;
use App\Services\MarketingAutomation;
use App\Services\ShopSettings;
use App\Support\VietQr;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(ShopSettings $settings): Response
    {
        $bank = $settings->bankTransfer();

        return Inertia::render('admin/settings', [
            'settings' => $settings->page(),
            // The banks a transfer by QR code can go to (config/shop.php).
            'banks' => $settings->banks(),
            // The saved account as a QR code without an amount: scanned with a banking app, it
            // shows the owner whose account customers would pay into.
            'bankQr' => $bank['bank'] !== '' && $bank['account_number'] !== ''
                ? VietQr::image(VietQr::payload($bank['bin'], $bank['account_number']))
                : null,
        ]);
    }

    public function update(Request $request, ShopSettings $settings, CustomerSegmentation $segments): RedirectResponse
    {
        $before = $settings->segments();
        $data = $request->validate([
            'shipping_fee' => ['required', 'integer', 'min:0', 'max:5000000'],
            'free_shipping_threshold' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'hotline' => ['nullable', 'string', 'max:20', 'regex:/^[0-9 +().-]+$/'],
            'contact_email' => ['nullable', 'email', 'max:190'],
            'contact_address' => ['nullable', 'string', 'max:255'],
            'contact_chat_url' => ['nullable', 'url:https', 'max:500'],
            // The customer groups' thresholds: a request without them leaves them as they are.
            'segment_vip_spend' => ['sometimes', 'required', 'integer', 'min:100000', 'max:10000000000'],
            'segment_inactive_days' => ['sometimes', 'required', 'integer', 'between:7,720'],
            // A customer goes quiet before they are lost.
            'segment_lost_days' => ['sometimes', 'required', 'integer', 'between:14,3650', 'gt:segment_inactive_days'],
            'segment_new_days' => ['sometimes', 'required', 'integer', 'between:1,365'],
            'segment_potential_events' => ['sometimes', 'required', 'integer', 'between:1,1000'],
            // The automatic emails: switches and their numbers; left as they are when not sent.
            'marketing_abandoned_cart' => ['sometimes', 'required', 'boolean'],
            'marketing_abandoned_cart_hours' => ['sometimes', 'required', 'integer', 'between:1,'.MarketingAutomation::CART_MAX_HOURS],
            'marketing_winback' => ['sometimes', 'required', 'boolean'],
            'marketing_winback_percent' => ['sometimes', 'required', 'integer', 'between:1,50'],
            'marketing_winback_valid_days' => ['sometimes', 'required', 'integer', 'between:1,90'],
            'marketing_post_purchase' => ['sometimes', 'required', 'boolean'],
            'marketing_post_purchase_days' => ['sometimes', 'required', 'integer', 'between:1,60'],
            'marketing_vip' => ['sometimes', 'required', 'boolean'],
            'marketing_vip_percent' => ['sometimes', 'required', 'integer', 'between:1,50'],
            'marketing_vip_valid_days' => ['sometimes', 'required', 'integer', 'between:1,90'],
            // The stringing service: taken online or not, and the fee for one racket.
            'stringing_enabled' => ['sometimes', 'required', 'boolean'],
            'stringing_fee' => ['sometimes', 'required', 'integer', 'min:0', 'max:5000000'],
            // Paying by bank transfer: offered only with an account to pay into.
            'bank_transfer_enabled' => ['sometimes', 'required', 'boolean'],
            'bank_transfer_hold_hours' => ['sometimes', 'required', 'integer', 'between:1,168'],
            'bank_bin' => ['sometimes', 'nullable', 'required_if_accepted:bank_transfer_enabled', Rule::in(array_column($settings->banks(), 'bin'))],
            // As the bank prints it: digits, or the letters and digits of an account alias.
            'bank_account_number' => ['sometimes', 'nullable', 'required_if_accepted:bank_transfer_enabled', 'string', 'regex:/^[0-9A-Za-z]{4,19}$/'],
            'bank_account_name' => ['sometimes', 'nullable', 'required_if_accepted:bank_transfer_enabled', 'string', 'max:60', 'regex:/^[\pL\pN .,&\-]+$/u'],
            // The privacy policy page: a draft for admins until the owner puts it on the site.
            // It sends customers to the shop with questions about their data: it needs a way to reach it.
            'privacy_published' => ['sometimes', 'required', 'boolean', function (string $attribute, mixed $value, Closure $fail) use ($request): void {
                if (filter_var($value, FILTER_VALIDATE_BOOL) && blank($request->input('hotline')) && blank($request->input('contact_email'))) {
                    $fail('Nhập hotline hoặc email liên hệ trước khi công bố chính sách quyền riêng tư: trang đó hướng khách tới đây khi họ hỏi về dữ liệu của mình.');
                }
            }],
        ], [
            'shipping_fee.*' => 'Phí giao hàng phải là số tiền từ 0 đến 5.000.000 ₫.',
            'free_shipping_threshold.*' => 'Mức miễn phí giao hàng phải là số tiền hợp lệ.',
            'hotline.*' => 'Số điện thoại chỉ gồm chữ số và dấu + ( ) - . khoảng trắng.',
            'contact_email.*' => 'Email liên hệ không hợp lệ.',
            'contact_address.*' => 'Địa chỉ không được dài quá 255 ký tự.',
            'contact_chat_url.*' => 'Liên kết chat phải là một URL HTTPS hợp lệ.',
            'segment_vip_spend.*' => 'Mức chi tiêu của khách VIP phải từ 100.000 ₫.',
            'segment_inactive_days.*' => 'Số ngày không mua để tính là “không hoạt động” phải từ 7 đến 720.',
            'segment_lost_days.*' => 'Số ngày để tính là “đã mất” phải lớn hơn số ngày “không hoạt động”.',
            'segment_new_days.*' => 'Số ngày tính là khách mới phải từ 1 đến 365.',
            'segment_potential_events.*' => 'Số lượt quan tâm của khách tiềm năng phải từ 1 đến 1.000.',
            'marketing_abandoned_cart_hours.*' => 'Số giờ chờ trước khi nhắc giỏ hàng phải từ 1 đến '.MarketingAutomation::CART_MAX_HOURS.'.',
            'marketing_winback_percent.*' => 'Mức giảm cho khách quay lại phải từ 1% đến 50%.',
            'marketing_winback_valid_days.*' => 'Số ngày hiệu lực của mã cho khách quay lại phải từ 1 đến 90.',
            'marketing_post_purchase_days.*' => 'Số ngày sau khi giao để mời đánh giá phải từ 1 đến 60.',
            'marketing_vip_percent.*' => 'Mức giảm cho khách VIP phải từ 1% đến 50%.',
            'marketing_vip_valid_days.*' => 'Số ngày hiệu lực của mã cho khách VIP phải từ 1 đến 90.',
            'marketing_*' => 'Lựa chọn email tự động không hợp lệ.',
            'stringing_fee.*' => 'Phí công đan phải là số tiền từ 0 đến 5.000.000 ₫.',
            'stringing_enabled.*' => 'Lựa chọn nhận đặt lịch đan dây không hợp lệ.',
            'bank_transfer_enabled.*' => 'Lựa chọn nhận chuyển khoản không hợp lệ.',
            'bank_transfer_hold_hours.*' => 'Thời gian giữ hàng chờ chuyển khoản phải từ 1 đến 168 giờ.',
            'bank_bin.required_if_accepted' => 'Chọn ngân hàng nhận tiền trước khi bật chuyển khoản.',
            'bank_bin.*' => 'Chọn một ngân hàng trong danh sách.',
            'bank_account_number.required_if_accepted' => 'Nhập số tài khoản nhận tiền trước khi bật chuyển khoản.',
            'bank_account_number.*' => 'Số tài khoản gồm 4 đến 19 chữ số hoặc chữ cái, không có dấu cách.',
            'bank_account_name.required_if_accepted' => 'Nhập tên chủ tài khoản trước khi bật chuyển khoản.',
            'bank_account_name.*' => 'Tên chủ tài khoản tối đa 60 ký tự, chỉ gồm chữ, số và dấu . , & -',
        ]);
        $settings->save([
            'shipping_fee' => (int) $data['shipping_fee'],
            'free_shipping_threshold' => (int) $data['free_shipping_threshold'],
            'hotline' => $data['hotline'] ?? null,
            'contact_email' => $data['contact_email'] ?? null,
            'contact_address' => $data['contact_address'] ?? null,
            'contact_chat_url' => $data['contact_chat_url'] ?? null,
            ...array_map('intval', array_filter(
                $data,
                fn (string $key) => str_starts_with($key, 'segment_') || str_starts_with($key, 'marketing_') || str_starts_with($key, 'stringing_')
                    || str_starts_with($key, 'bank_transfer_') || $key === 'privacy_published',
                ARRAY_FILTER_USE_KEY,
            )),
            ...array_map(
                fn (?string $value) => trim((string) $value),
                array_intersect_key($data, array_flip(['bank_bin', 'bank_account_number'])),
            ),
            // The holder's name in capitals, as banking apps show it.
            ...(array_key_exists('bank_account_name', $data) ? ['bank_account_name' => mb_strtoupper(trim((string) $data['bank_account_name']))] : []),
        ]);
        if ($settings->segments() !== $before) {
            // New thresholds move customers between groups: redone once this answer is on its way.
            defer(fn () => $segments->refreshAll());

            return back()->with('success', 'Đã lưu cài đặt. Nhóm khách hàng đang được xếp lại theo ngưỡng mới.');
        }

        return back()->with('success', 'Đã lưu cài đặt. Giỏ hàng và thanh toán dùng mức phí mới ngay.');
    }
}
