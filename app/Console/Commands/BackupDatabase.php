<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use RuntimeException;
use Throwable;

/**
 * Writes a copy of the shop's database to storage/backups and removes copies older than
 * BACKUP_KEEP_DAYS. The copy sits on the same machine, so it still has to be copied off it.
 */
class BackupDatabase extends Command
{
    protected $signature = 'shop:backup
        {--keep-days= : Số ngày giữ bản sao lưu (mặc định theo config/backup.php)}';

    protected $description = 'Sao lưu database của shop vào storage/backups, xóa các bản cũ (chạy mỗi ngày theo lịch)';

    public function handle(): int
    {
        try {
            $keepDays = $this->keepDays();
            $directory = rtrim((string) config('backup.path'), '\\/');
            if ($directory === '') {
                throw new RuntimeException('Chưa cấu hình thư mục sao lưu (backup.path).');
            }
            $this->ensureDirectory($directory);

            $connection = DB::connection();
            $stamp = now()->format('Ymd-His');
            $target = match ($connection->getDriverName()) {
                'sqlite' => $this->backupSqlite($connection, $directory, $stamp),
                'mysql', 'mariadb' => $this->backupMysql($connection, $directory, $stamp),
                default => throw new RuntimeException(
                    'Chưa hỗ trợ sao lưu database kiểu "'.$connection->getDriverName().'". Chỉ hỗ trợ SQLite và MySQL/MariaDB.'
                ),
            };
        } catch (Throwable $e) {
            $this->error('Sao lưu thất bại: '.$e->getMessage());

            return self::FAILURE;
        }

        $removed = $this->removeOld($directory, $keepDays);

        clearstatcache(true, $target);
        $this->info('Đã sao lưu database vào '.$target.' ('.$this->humanSize((int) filesize($target)).').');
        if ($removed > 0) {
            $this->line('Đã xóa '.$removed.' bản sao lưu cũ hơn '.$keepDays.' ngày.');
        }

        return self::SUCCESS;
    }

    /**
     * A consistent single-file copy: VACUUM INTO asks SQLite itself to write the snapshot,
     * falling back to folding the WAL into the main file and copying it.
     */
    private function backupSqlite(Connection $connection, string $directory, string $stamp): string
    {
        $source = (string) $connection->getDatabaseName();
        if ($source === ':memory:' || ! is_file($source)) {
            throw new RuntimeException('Không tìm thấy file SQLite của database: '.$source);
        }

        $target = $directory.DIRECTORY_SEPARATOR.'shop-'.$stamp.'.sqlite';
        $pdo = $connection->getPdo();

        try {
            $pdo->exec('VACUUM INTO '.$this->sqliteString($target));

            return $target;
        } catch (Throwable) {
            // Older SQLite builds, or a leftover file from a run in the same second: copy instead.
        }

        $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        if (! @copy($source, $target)) {
            throw new RuntimeException('Không chép được file SQLite từ '.$source.' sang '.$target.'.');
        }

        return $target;
    }

    /**
     * A logical dump through mysqldump. The password travels in MYSQL_PWD, never in the
     * argument list, so it does not show up in the process list or in the shell's history.
     */
    private function backupMysql(Connection $connection, string $directory, string $stamp): string
    {
        $config = $connection->getConfig();
        $binary = (string) config('backup.mysqldump', 'mysqldump');
        $target = $directory.DIRECTORY_SEPARATOR.'shop-'.$stamp.'.sql';

        if (! Process::run([$binary, '--version'])->successful()) {
            throw new RuntimeException(
                'Không tìm thấy mysqldump ('.$binary.'). Cài MySQL client hoặc đặt MYSQLDUMP_PATH trong .env trỏ tới mysqldump.exe.'
            );
        }

        $command = [
            $binary,
            '--single-transaction',
            '--quick',
            '--routines',
            '--triggers',
            '--default-character-set=utf8mb4',
            '--result-file='.$target,
        ];
        if (! empty($config['unix_socket'])) {
            $command[] = '--socket='.$config['unix_socket'];
        } else {
            $command[] = '--host='.($config['host'] ?? '127.0.0.1');
            $command[] = '--port='.(string) ($config['port'] ?? '3306');
        }
        if (! empty($config['username'])) {
            $command[] = '--user='.$config['username'];
        }
        $command[] = (string) $config['database'];

        $result = Process::env(['MYSQL_PWD' => (string) ($config['password'] ?? '')])
            ->timeout(3600)
            ->run($command);

        if (! $result->successful()) {
            @unlink($target);
            $reason = trim($result->errorOutput() !== '' ? $result->errorOutput() : $result->output());
            throw new RuntimeException('mysqldump lỗi'.($reason !== '' ? ': '.$reason : '.').'');
        }

        return $target;
    }

    /** Delete shop-*.sqlite and shop-*.sql files whose modification time is older than N days. */
    private function removeOld(string $directory, int $days): int
    {
        $cutoff = time() - ($days * 86400);
        $removed = 0;

        foreach (glob($directory.'/shop-*') ?: [] as $file) {
            $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (! is_file($file) || ! in_array($extension, ['sqlite', 'sql'], true)) {
                continue;
            }
            $modified = @filemtime($file);
            if ($modified !== false && $modified < $cutoff && @unlink($file)) {
                $removed++;
            }
        }

        return $removed;
    }

    private function keepDays(): int
    {
        $value = $this->option('keep-days');
        if ($value === null || $value === '') {
            $value = config('backup.keep_days', 14);
        }

        if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < 0) {
            throw new RuntimeException('--keep-days phải là số ngày không âm.');
        }

        return (int) $value;
    }

    private function ensureDirectory(string $directory): void
    {
        if (is_dir($directory)) {
            return;
        }
        if (! @mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException('Không tạo được thư mục sao lưu: '.$directory);
        }
    }

    /** Single-quote a path for SQLite; backslashes are literal there, quotes are doubled. */
    private function sqliteString(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 1, ',', '.').' MB';
        }
        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 1, ',', '.').' KB';
        }

        return $bytes.' B';
    }
}
