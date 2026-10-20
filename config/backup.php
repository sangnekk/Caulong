<?php

return [

    // Where "php artisan shop:backup" writes its files.
    'path' => env('BACKUP_PATH', storage_path('backups')),

    // A successful run deletes backup files older than this many days.
    'keep_days' => (int) env('BACKUP_KEEP_DAYS', 14),

    // mysqldump executable; on Windows set the full path if it is not on PATH.
    'mysqldump' => env('MYSQLDUMP_PATH', 'mysqldump'),

];
