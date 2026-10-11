<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProfileDeleteRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'password' => $this->currentPasswordRules(),
        ];
    }

    /**
     * A staff account is not removed by its owner: an admin takes its rights away first
     * (/admin/staff), so the shop is never left without the one who runs it.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->user()?->is_admin) {
                $validator->errors()->add('password', 'Tài khoản nhân viên không tự xóa được. Nhờ quản trị viên gỡ quyền nhân viên của tài khoản này trước.');
            }
        }];
    }
}
