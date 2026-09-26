<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Demo catalog is opt-in: php artisan db:seed --class=DemoCatalogSeeder.
        // Accounts are registered explicitly; never create a default password.
    }
}
