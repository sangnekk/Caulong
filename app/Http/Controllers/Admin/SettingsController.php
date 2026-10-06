<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\CustomerSegmentation;
use App\Services\ShopSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(ShopSettings $settings): Response
    {
        return Inertia::render('admin/settings', ['settings' => $settings->all()]);
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
        ]);
        $settings->save([
            'shipping_fee' => (int) $data['shipping_fee'],
            'free_shipping_threshold' => (int) $data['free_shipping_threshold'],
            'hotline' => $data['hotline'] ?? null,
            'contact_email' => $data['contact_email'] ?? null,
            'contact_address' => $data['contact_address'] ?? null,
            'contact_chat_url' => $data['contact_chat_url'] ?? null,
            ...array_map('intval', array_filter($data, fn (string $key) => str_starts_with($key, 'segment_'), ARRAY_FILTER_USE_KEY)),
        ]);
        if ($settings->segments() !== $before) {
            // New thresholds move customers between groups: redone once this answer is on its way.
            defer(fn () => $segments->refreshAll());

            return back()->with('success', 'Đã lưu cài đặt. Nhóm khách hàng đang được xếp lại theo ngưỡng mới.');
        }

        return back()->with('success', 'Đã lưu cài đặt. Giỏ hàng và thanh toán dùng mức phí mới ngay.');
    }
}
