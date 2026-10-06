<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ImportSqliteTest extends TestCase
{
    use RefreshDatabase;

    private string $file;

    protected function setUp(): void
    {
        parent::setUp();
        // The database the shop is moving away from: a SQLite file with the same tables.
        $this->file = sys_get_temp_dir().'/shop-old-'.uniqid().'.sqlite';
        touch($this->file);
        config(['database.connections.old' => ['driver' => 'sqlite', 'database' => $this->file, 'prefix' => '', 'foreign_key_constraints' => true]]);
        $this->artisan('migrate', ['--database' => 'old', '--force' => true])->assertSuccessful();
    }

    protected function tearDown(): void
    {
        DB::purge('old');
        DB::purge('import_source');
        @unlink($this->file);
        parent::tearDown();
    }

    public function test_it_copies_the_shops_data_with_its_ids_and_leaves_sessions_behind(): void
    {
        $old = DB::connection('old');
        $old->table('users')->insert(['id' => 7, 'name' => 'Chủ shop', 'email' => 'chu@example.test', 'password' => 'hash', 'is_admin' => true]);
        $old->table('brands')->insert(['id' => 3, 'name' => 'Hãng Thử', 'slug' => 'hang-thu']);
        $old->table('products')->insert(['id' => 40, 'brand_id' => 3, 'name' => 'Vợt Tia Chớp', 'slug' => 'vot-tia-chop', 'description' => 'Mô tả.', 'specs' => '{"weight":"4U"}', 'play_style' => 'attack', 'skill_level' => 'all', 'is_active' => true]);
        // A retired upper-case SKU beside its lower-case successor, as the demo catalog has.
        $old->table('product_variants')->insert([
            ['id' => 1, 'product_id' => 40, 'sku' => 'TC-4U', 'name' => '4U', 'price' => 1290000, 'cost_price' => null, 'stock' => 0, 'is_active' => false],
            ['id' => 90, 'product_id' => 40, 'sku' => 'tc-4u', 'name' => '4U', 'price' => 1290000, 'cost_price' => 900000, 'stock' => 5, 'is_active' => true],
        ]);
        $old->table('orders')->insert(['id' => 12, 'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(), 'user_id' => 7, 'name' => 'Khách', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ', 'subtotal' => 1290000, 'shipping_fee' => 0, 'total' => 1290000]);
        $old->table('order_items')->insert(['id' => 5, 'order_id' => 12, 'variant_id' => 1, 'product_name' => 'Vợt Tia Chớp', 'variant_name' => '4U', 'sku' => 'TC-4U', 'unit_price' => 1290000, 'quantity' => 1, 'line_total' => 1290000]);
        $old->table('settings')->insert(['key' => 'hotline', 'value' => '0900 000 000']);
        $old->table('sessions')->insert(['id' => 'abc', 'payload' => 'x', 'last_activity' => 1]);

        $this->artisan('shop:import-sqlite', ['file' => $this->file, '--force' => true])->assertSuccessful();

        $this->assertTrue(User::findOrFail(7)->is_admin);
        $this->assertSame(['TC-4U', 'tc-4u'], ProductVariant::orderBy('id')->pluck('sku')->all());
        $this->assertSame([1, 90], ProductVariant::orderBy('id')->pluck('id')->all());
        $this->assertSame(['weight' => '4U'], ProductVariant::findOrFail(90)->product->specs);
        $order = Order::with('items', 'user')->findOrFail(12);
        $this->assertSame([7, 1, 1290000], [$order->user->id, $order->items[0]->variant_id, $order->total]);
        $this->assertDatabaseHas('settings', ['key' => 'hotline', 'value' => '0900 000 000']);
        $this->assertDatabaseCount('sessions', 0);
        // New rows continue after the copied ids.
        $this->assertGreaterThan(7, User::factory()->create()->id);
    }

    public function test_it_only_fills_an_empty_database(): void
    {
        User::factory()->create();
        DB::connection('old')->table('users')->insert(['name' => 'Chủ shop', 'email' => 'chu@example.test', 'password' => 'hash']);

        $this->artisan('shop:import-sqlite', ['file' => $this->file, '--force' => true])
            ->expectsOutputToContain('đã có dữ liệu ở: users')->assertFailed();
        $this->assertSame(1, User::count());
    }

    public function test_it_explains_a_missing_file(): void
    {
        $this->artisan('shop:import-sqlite', ['file' => 'khong-co.sqlite', '--force' => true])
            ->expectsOutputToContain('Không thấy file SQLite')->assertFailed();
    }
}
