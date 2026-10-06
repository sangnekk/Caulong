<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Moves the shop's data from the SQLite file it started on to the database now configured
 * (MySQL), after `migrate` has built the tables there. Rows keep their ids.
 */
class ImportSqlite extends Command
{
    /** Rebuilt by the framework as it runs; `migrations` is written by migrate itself. */
    private const SKIPPED = ['migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs'];

    protected $signature = 'shop:import-sqlite
        {file=database/database.sqlite : File SQLite chứa dữ liệu hiện có}
        {--force : Bỏ qua xác nhận}';

    protected $description = 'Chép toàn bộ dữ liệu của shop từ file SQLite sang database đang cấu hình (sau khi đã chạy migrate)';

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        $path = is_file($file) ? $file : base_path($file);
        if (! is_file($path)) {
            $this->error('Không thấy file SQLite: '.$file);

            return self::FAILURE;
        }
        config(['database.connections.import_source' => ['driver' => 'sqlite', 'database' => $path, 'prefix' => '', 'foreign_key_constraints' => false]]);
        $source = DB::connection('import_source');
        $target = DB::connection();
        if ($target->getDriverName() === 'sqlite' && realpath((string) $target->getDatabaseName()) === realpath($path)) {
            $this->error('Database đang cấu hình chính là file này. Đổi DB_CONNECTION trong .env sang database mới trước.');

            return self::FAILURE;
        }

        $tables = array_values(array_diff(Schema::connection('import_source')->getTableListing(schemaQualified: false), self::SKIPPED));
        $missing = array_filter($tables, fn (string $table) => ! Schema::hasTable($table));
        if ($missing) {
            $this->error('Database mới chưa có bảng: '.implode(', ', $missing).'. Chạy "php artisan migrate" trước.');

            return self::FAILURE;
        }
        // Copying into tables that already hold rows would clash on ids or double the data.
        $filled = array_filter($tables, fn (string $table) => $target->table($table)->exists());
        if ($filled) {
            $this->error('Database mới đã có dữ liệu ở: '.implode(', ', $filled).'. Lệnh này chỉ chép vào database trống.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm('Chép '.count($tables).' bảng từ '.$file.' sang database "'.$target->getDatabaseName().'"?', true)) {
            $this->warn('Đã hủy.');

            return self::FAILURE;
        }

        $counts = [];
        $target->transaction(function () use ($source, $target, $tables, &$counts): void {
            foreach ($this->parentsFirst($tables) as $table) {
                $counts[$table] = $this->copy($source, $target, $table);
            }
        });

        $this->table(['Bảng', 'Số dòng'], collect($counts)->map(fn (int $count, string $table) => [$table, $count])->values()->all());
        $this->info('Đã chép xong. Phiên đăng nhập không được chép: mọi người đăng nhập lại.');

        return self::SUCCESS;
    }

    /**
     * Tables in an order foreign keys allow: a table comes after the ones its rows point to.
     *
     * @param  list<string>  $tables
     * @return list<string>
     */
    private function parentsFirst(array $tables): array
    {
        $ordered = [];
        $place = function (string $table) use (&$place, &$ordered, $tables): void {
            if (in_array($table, $ordered, true)) {
                return;
            }
            // Listed before its parents are placed, so a table that points to itself ends the walk.
            $ordered[] = $table;
            foreach (Schema::getForeignKeys($table) as $key) {
                if (in_array($key['foreign_table'], $tables, true)) {
                    $place($key['foreign_table']);
                }
            }
            $ordered = [...array_values(array_diff($ordered, [$table])), $table];
        };
        array_map($place, $tables);

        return $ordered;
    }

    private function copy(Connection $source, Connection $target, string $table): int
    {
        $copied = 0;
        $batch = [];
        foreach ($source->table($table)->cursor() as $row) {
            $batch[] = (array) $row;
            if (count($batch) === 200) {
                $target->table($table)->insert($batch);
                $copied += count($batch);
                $batch = [];
            }
        }
        if ($batch) {
            $target->table($table)->insert($batch);
            $copied += count($batch);
        }
        if ($copied !== $source->table($table)->count()) {
            throw new RuntimeException('Bảng '.$table.' chép thiếu dòng.');
        }

        return $copied;
    }
}
