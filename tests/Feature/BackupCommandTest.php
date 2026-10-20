<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use PDO;
use Tests\TestCase;

class BackupCommandTest extends TestCase
{
    private string $directory;

    private string $database;

    private string $backups;

    protected function setUp(): void
    {
        parent::setUp();

        $this->directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'shop-backup-'.uniqid();
        $this->database = $this->directory.DIRECTORY_SEPARATOR.'shop.sqlite';
        $this->backups = $this->directory.DIRECTORY_SEPARATOR.'backups';
        mkdir($this->directory, 0775, true);
        touch($this->database);

        // Never touch the developer's database: the command works on this throwaway file.
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => $this->database,
            'backup.path' => $this->backups,
            'backup.keep_days' => 14,
        ]);
        DB::purge('sqlite');
        DB::connection('sqlite')->statement('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
        DB::connection('sqlite')->table('widgets')->insert(['id' => 1, 'name' => 'Vợt thử']);
    }

    protected function tearDown(): void
    {
        DB::purge('sqlite');
        File::deleteDirectory($this->directory);

        parent::tearDown();
    }

    public function test_it_writes_a_sqlite_snapshot_that_can_be_opened_again(): void
    {
        $this->artisan('shop:backup')->assertExitCode(0);

        $files = glob($this->backups.'/shop-*.sqlite') ?: [];
        $this->assertCount(1, $files);

        $snapshot = new PDO('sqlite:'.$files[0]);
        $this->assertSame('Vợt thử', $snapshot->query('SELECT name FROM widgets WHERE id = 1')->fetchColumn());
        $snapshot = null;
    }

    public function test_it_deletes_backups_older_than_keep_days(): void
    {
        mkdir($this->backups, 0775, true);
        $old = $this->backups.'/shop-20200101-000000.sqlite';
        file_put_contents($old, 'bản cũ');
        touch($old, time() - (3 * 86400));
        $this->assertFileExists($old);

        $this->artisan('shop:backup', ['--keep-days' => 1])->assertExitCode(0);

        $this->assertFileDoesNotExist($old);
        $this->assertCount(1, glob($this->backups.'/shop-*.sqlite') ?: []);
    }
}
