<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MakeAdmin extends Command
{
    protected $signature = 'shop:make-admin {email : Email tài khoản đã xác minh} {--force : Bỏ qua xác nhận}';

    protected $description = 'Cấp quyền quản trị cho tài khoản đã tồn tại và xác minh email';

    public function handle(): int
    {
        $email = trim((string) $this->argument('email'));
        if (Validator::make(['email' => $email], ['email' => ['required', 'email', 'max:255']])->fails()) {
            $this->error('Email không hợp lệ.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (! $user || ! $user->hasVerifiedEmail()) {
            $this->error('Cần tài khoản đã tồn tại và đã xác minh email. Không tạo tài khoản mới.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm("Cấp toàn quyền quản trị cho {$email}?", false)) {
            $this->warn('Đã hủy.');

            return self::FAILURE;
        }

        $promoted = DB::transaction(function () use ($user, $email): bool {
            $current = User::whereKey($user->id)->lockForUpdate()->first();
            if (! $current || $current->email !== $email || ! $current->hasVerifiedEmail()) {
                return false;
            }
            $current->is_admin = true;
            $current->save();

            return true;
        });
        if (! $promoted) {
            $this->error('Tài khoản đã thay đổi. Kiểm tra lại trước khi cấp quyền.');

            return self::FAILURE;
        }
        $this->info("Đã cấp quyền quản trị: {$email}");

        return self::SUCCESS;
    }
}
