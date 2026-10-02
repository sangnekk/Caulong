<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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

    public function update(Request $request, ShopSettings $settings): RedirectResponse
    {
        $data = $request->validate([
            'shipping_fee' => ['required', 'integer', 'min:0', 'max:5000000'],
            'free_shipping_threshold' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'hotline' => ['nullable', 'string', 'max:20', 'regex:/^[0-9 +().-]+$/'],
            'contact_email' => ['nullable', 'email', 'max:190'],
            'contact_address' => ['nullable', 'string', 'max:255'],
            'contact_chat_url' => ['nullable', 'url:https', 'max:500'],
        ], [
            'shipping_fee.*' => 'Phí giao hàng phải là số tiền từ 0 đến 5.000.000 ₫.',
            'free_shipping_threshold.*' => 'Mức miễn phí giao hàng phải là số tiền hợp lệ.',
            'hotline.*' => 'Số điện thoại chỉ gồm chữ số và dấu + ( ) - . khoảng trắng.',
            'contact_email.*' => 'Email liên hệ không hợp lệ.',
            'contact_address.*' => 'Địa chỉ không được dài quá 255 ký tự.',
            'contact_chat_url.*' => 'Liên kết chat phải là một URL HTTPS hợp lệ.',
        ]);
        $settings->save([
            'shipping_fee' => (int) $data['shipping_fee'],
            'free_shipping_threshold' => (int) $data['free_shipping_threshold'],
            'hotline' => $data['hotline'] ?? null,
            'contact_email' => $data['contact_email'] ?? null,
            'contact_address' => $data['contact_address'] ?? null,
            'contact_chat_url' => $data['contact_chat_url'] ?? null,
        ]);

        return back()->with('success', 'Đã lưu cài đặt. Giỏ hàng và thanh toán dùng mức phí mới ngay.');
    }
}
