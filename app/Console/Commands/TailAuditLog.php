<?php

namespace App\Console\Commands;

use App\Models\AdminActivity;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class TailAuditLog extends Command
{
    protected $signature = 'audit:tail {--limit=20}';

    protected $description = 'Xem các thao tác gần đây của nhân viên trong khu vực quản trị';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));

        /** @var Collection<int, AdminActivity> $entries */
        $entries = AdminActivity::query()
            ->leftJoin('users', 'users.id', '=', 'admin_activity_logs.user_id')
            ->orderByDesc('admin_activity_logs.created_at')
            ->orderByDesc('admin_activity_logs.id')
            ->limit($limit)
            ->get([
                'admin_activity_logs.created_at',
                'admin_activity_logs.user_id',
                'users.name as user_name',
                'admin_activity_logs.method',
                'admin_activity_logs.path',
                'admin_activity_logs.status',
                'admin_activity_logs.ip',
            ]);

        if ($entries->isEmpty()) {
            $this->info('Chưa có thao tác nào trong khu vực quản trị.');

            return self::SUCCESS;
        }

        $this->table(
            ['Thời gian', 'Nhân viên', 'Phương thức', 'Đường dẫn', 'Trạng thái', 'IP'],
            $entries->map(fn (AdminActivity $entry): array => [
                $entry->created_at->format('Y-m-d H:i:s'),
                $entry->user_id === null ? '—' : $entry->user_id.' · '.($entry->user_name ?? '—'),
                $entry->method,
                $entry->path,
                $entry->status,
                $entry->ip ?? '—',
            ])->all(),
        );

        return self::SUCCESS;
    }
}
