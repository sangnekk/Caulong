<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderExportTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'public_id' => (string) Str::uuid(), 'checkout_token' => (string) Str::uuid(),
            'name' => 'Nguyễn An', 'phone' => '0901234567', 'address' => '12 Nguyễn Huệ',
            'subtotal' => 500000, 'shipping_fee' => 0, 'total' => 500000,
        ], $attributes));
    }

    /**
     * Parse the exported CSV, checking and removing its UTF-8 BOM.
     *
     * @return array{0: array<string, int>, 1: list<list<string>>}
     */
    private function csvRows(string $csv): array
    {
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $lines = preg_split('/\r\n|\n/', trim(substr($csv, 3))) ?: [];
        $this->assertNotSame([], $lines);
        $header = str_getcsv($lines[0], ',', '"', '\\');
        $rows = array_map(fn (string $line) => str_getcsv($line, ',', '"', '\\'), array_slice($lines, 1));

        return [array_flip($header), $rows];
    }

    public function test_export_neutralizes_customer_cells_that_look_like_spreadsheet_formulas(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->order([
            'name' => '=HYPERLINK("https://evil.test")',
            'phone' => '-0901234567',
            'address' => '+12 Nguyễn Huệ',
            'coupon_code' => '@SUM(1+1)',
        ]);
        $this->order(['name' => 'Nguyễn An']);

        $response = $this->actingAs($admin)->get('/admin/orders/export');
        $response->assertOk();

        [$columns, $rows] = $this->csvRows($response->streamedContent());
        $this->assertCount(2, $rows);
        [$dangerous, $normal] = $rows;

        foreach ([['Khách hàng', '='], ['Điện thoại', '-'], ['Địa chỉ', '+'], ['Mã giảm giá', '@']] as [$column, $character]) {
            $cell = $dangerous[$columns[$column]];
            $this->assertStringStartsWith("'".$character, $cell);
            $this->assertStringStartsNotWith($character, $cell);
        }

        $this->assertSame('Nguyễn An', $normal[$columns['Khách hàng']]);
        $this->assertSame('0901234567', $normal[$columns['Điện thoại']]);
        $this->assertSame('12 Nguyễn Huệ', $normal[$columns['Địa chỉ']]);
        $this->assertSame('', $normal[$columns['Mã giảm giá']]);
    }

    public function test_export_neutralizes_a_formula_hidden_behind_leading_whitespace(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->order(['name' => '  =1+1']);

        $response = $this->actingAs($admin)->get('/admin/orders/export');
        $response->assertOk();

        [$columns, $rows] = $this->csvRows($response->streamedContent());
        $this->assertCount(1, $rows);
        $this->assertStringStartsWith("'  =1+1", $rows[0][$columns['Khách hàng']]);
    }

    public function test_export_is_a_utf8_csv_with_the_usual_filename_and_numeric_totals(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->order();

        $response = $this->actingAs($admin)->get('/admin/orders/export');
        $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertMatchesRegularExpression(
            '/^attachment; filename="?don-hang-\d{4}-\d{2}-\d{2}\.csv"?$/',
            (string) $response->headers->get('Content-Disposition'),
        );

        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);

        [$columns, $rows] = $this->csvRows($csv);
        $this->assertSame([
            'Mã đơn', 'Ngày đặt', 'Khách hàng', 'Điện thoại', 'Địa chỉ', 'Trạng thái', 'Thanh toán',
            'Ngày thu tiền', 'Số sản phẩm', 'Tiền hàng', 'Giảm giá', 'Mã giảm giá', 'Phí giao',
            'Tổng cộng', 'Cách thanh toán',
        ], array_keys($columns));
        $this->assertCount(1, $rows);
        $this->assertSame('500000', $rows[0][$columns['Tổng cộng']]);
    }
}
