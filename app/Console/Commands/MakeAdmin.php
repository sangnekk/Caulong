<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MakeAdmin extends Command
{
    protected $signature = 'shop:make-admin {email : Email tài khoản đã xác minh}
        {--role=admin : admin (toàn quyền) hoặc support (chỉ trả lời khách ở Chat hỗ trợ)}
        {--force : Bỏ qua xác nhận}';

    protected $description = 'Cấp quyền quản trị, hoặc quyền nhân viên hỗ trợ, cho tài khoản đã tồn tại và xác minh email';

    public function handle(): int
    {
        $email = trim((string) $this->argument('email'));
        if (Validator::make(['email' => $email], ['email' => ['required', 'email', 'max:255']])->fails()) {
            $this->error('Email không hợp lệ.');

            return self::FAILURE;
        }

        $role = (string) $this->option('role');
        if (! in_array($role, User::ROLES, true)) {
            $this->error('Vai trò không hợp lệ. Chọn một trong: '.implode(', ', User::ROLES).'.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (! $user || ! $user->hasVerifiedEmail()) {
            $this->error('Cần tài khoản đã tồn tại và đã xác minh email. Không tạo tài khoản mới.');

            return self::FAILURE;
        }
        $question = $role === 'admin'
            ? "Cấp toàn quyền quản trị cho {$email}?"
            : "Cấp quyền nhân viên hỗ trợ (chỉ Chat hỗ trợ) cho {$email}?";
        if (! $this->option('force') && ! $this->confirm($question, false)) {
            $this->warn('Đã hủy.');

            return self::FAILURE;
        }

        $promoted = DB::transaction(function () use ($user, $email, $role): bool {
            $current = User::whereKey($user->id)->lockForUpdate()->first();
            if (! $current || $current->email !== $email || ! $current->hasVerifiedEmail()) {
                return false;
            }
            // A staff account either way; the role says how much of /admin it may use.
            $current->is_admin = true;
            $current->role = $role;
            $current->save();

            return true;
        });
        if (! $promoted) {
            $this->error('Tài khoản đã thay đổi. Kiểm tra lại trước khi cấp quyền.');

            return self::FAILURE;
        }
        $this->info($role === 'admin' ? "Đã cấp quyền quản trị: {$email}" : "Đã cấp quyền nhân viên hỗ trợ: {$email}");

        return self::SUCCESS;
    }
}
