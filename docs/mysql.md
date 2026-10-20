# MySQL 8.4 cho kiểm thử và production

SQLite (`database/database.sqlite`) chỉ đủ cho local/demo. Máy chủ thật dùng **MySQL 8.4** với `utf8mb4` / `utf8mb4_unicode_ci`. `compose.yaml` ở thư mục gốc dựng một MySQL 8.4 để chạy thử trên máy dev; Laravel vẫn chạy trên host, không có container app.

Bộ test PHPUnit vẫn chạy SQLite `:memory:` (xem `phpunit.xml`). **Test xanh không chứng minh app chạy đúng trên MySQL** — phải làm mục [Kiểm tra trước khi coi MySQL là đã nghiệm thu](#8-kiểm-tra-trước-khi-coi-mysql-là-đã-nghiệm-thu).

## 1. Khởi động / dừng MySQL

Cần Docker Desktop (Windows) hoặc Docker Engine + Compose v2, và PHP trên host bật `pdo_mysql`. Kiểm tra:

```powershell
docker compose version
php -m | Select-String pdo_mysql
```

Chạy trong thư mục gốc repo:

```powershell
docker compose up -d
docker compose ps
docker compose logs -f mysql
```

`docker compose ps` phải hiện `healthy`. Lần đầu MySQL khởi tạo volume, tạo database/user theo biến môi trường; có thể mất 20–60 giây. Dừng xem log bằng `Ctrl+C` (không dừng container).

Các biến trong `compose.yaml` (chỉ là mặc định cho máy dev):

| Biến                  | Mặc định  | Dùng cho                  |
| --------------------- | --------- | ------------------------- |
| `MYSQL_DATABASE`      | `caulong` | database tạo lúc khởi tạo |
| `MYSQL_USER`          | `caulong` | user app                  |
| `MYSQL_PASSWORD`      | `caulong` | mật khẩu user app         |
| `MYSQL_ROOT_PASSWORD` | `root`    | mật khẩu root             |

Đặt biến môi trường trước khi `up`, hoặc thêm vào file `.env` mà Docker Compose đọc, nếu muốn giá trị khác. **Không dùng các mật khẩu mặc định này trên máy chủ thật.**

MySQL chỉ đọc các biến `MYSQL_*` khi volume còn trống. Đổi biến sau lần chạy đầu **không** đổi user/database đã tạo; phải `docker compose down -v` (xóa sạch dữ liệu) hoặc `ALTER USER` / `CREATE DATABASE` thủ công.

Dừng / chạy lại / xóa:

```powershell
docker compose stop          # dừng, giữ container và dữ liệu
docker compose start         # chạy lại
docker compose down          # xóa container, GIỮ named volume mysql-data
docker compose down -v       # xóa cả dữ liệu trong volume (không khôi phục được)
```

Nếu cổng 3306 đang bận, dừng MySQL local hoặc đổi `"3306:3306"` trong `compose.yaml` và đặt `DB_PORT` tương ứng.

## 2. Cấu hình `.env`

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=caulong
DB_USERNAME=caulong
DB_PASSWORD=caulong
```

- Giá trị phải khớp `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` ở mục 1.
- `DB_URL` phải để trống hoặc xóa hẳn: nếu có, nó **ghi đè** toàn bộ host/port/database/username/password ở trên.
- Không đổi `DB_CHARSET` / `DB_COLLATION`; `config/database.php` đã đặt `utf8mb4` / `utf8mb4_unicode_ci`, khớp server trong compose.
- `.env` không được commit. `.env.example` vẫn mặc định SQLite cho người mới; đừng dán mật khẩu thật vào đó.

Sau mỗi lần sửa `.env`, đặc biệt sau khi chạy `php artisan optimize` (lệnh này cache config):

```powershell
php artisan config:clear
```

## 3. Chạy migration

```powershell
php artisan config:clear
php artisan migrate --force
```

`--force` bỏ bước hỏi xác nhận khi `APP_ENV=production`; ở local cũng chạy được. Chỉ chạy `migrate:fresh` khi chắc chắn được xóa dữ liệu.

Nếu đang chuyển dữ liệu từ SQLite, xem mục “Chuyển sang MySQL” trong `README.md`: migrate database trống trước, rồi `php artisan shop:import-sqlite`. Lệnh nhập chỉ chạy khi các bảng nghiệp vụ còn trống, giữ nguyên id, và **chưa từng được kiểm thử trên MySQL thật** — phải đối chiếu số dòng, giá và tồn kho sau khi nhập.

## 4. Kiểm tra

```powershell
php artisan migrate:status
php artisan db:show
php artisan db:table orders
```

Kỳ vọng:

- `migrate:status`: mọi migration là `Ran`, không còn `Pending`.
- `db:show`: driver `mysql`, server version `8.4.x`, database `caulong`, danh sách bảng gồm `orders`, `order_items`, `product_variants`, `sessions`, `cache`, `jobs`…
- `db:table orders`: xem cấu trúc/cột và vài dòng dữ liệu mẫu.

Chạy bộ test:

```powershell
php artisan test --compact
```

`php artisan test` chạy trên SQLite `:memory:` theo `phpunit.xml`, nên dùng để bắt lỗi logic, không dùng để nghiệm thu MySQL. **Luôn `php artisan config:clear` trước khi test** nếu vừa cấu hình MySQL: khi config đã cache, biến `DB_CONNECTION=sqlite` trong `phpunit.xml` có thể bị bỏ qua và `RefreshDatabase` sẽ xóa dữ liệu MySQL dev.

### Smoke test đăng nhập / đặt hàng

Chạy app (một cửa sổ, hoặc `php artisan serve` + `npm run dev`):

```powershell
php artisan dev
```

Mở http://localhost:3000 rồi kiểm tra:

1. Đăng nhập. Ở `APP_ENV=local`, trang đăng nhập tự tạo tài khoản thử `admin@test.local` / `Test-Cau-Long-2026!` (cùng các tài khoản khác). Chỉ dùng cho máy dev; xóa trước khi dùng database cho hàng thật. Tài khoản thật: đăng ký, xác minh email, rồi `php artisan shop:make-admin email`.
2. Nếu catalog trống: `php artisan db:seed --class=DemoCatalogSeeder` (chỉ local).
3. Thêm sản phẩm vào giỏ, đặt hàng COD, xem trang xác nhận.
4. Vào `/admin/orders`, mở đơn vừa tạo, đổi trạng thái; thử xác nhận thanh toán nếu chọn chuyển khoản.
5. Mở `/admin/reports` — báo cáo dùng `GROUP BY`, nơi strict mode của MySQL dễ làm lộ lỗi.
6. Chạy queue để chắc email/queue dùng bảng MySQL:

```powershell
php artisan queue:work --stop-when-empty
```

Kiểm tra lại trong database:

```powershell
php artisan tinker --execute="echo App\Models\Order::query()->count();"
php artisan db:table orders
```

Đăng xuất rồi đăng nhập lại để chắc session ghi vào bảng `sessions` của MySQL.

## 5. Sao lưu và phục hồi

### Bằng lệnh của shop

`php artisan shop:backup` (mã ở `app/Console/Commands/BackupDatabase.php`) chạy `mysqldump --single-transaction --quick --routines --triggers --default-character-set=utf8mb4` và ghi file `storage/backups/shop-YYYYmmdd-HHMMSS.sql`; các bản cũ hơn `BACKUP_KEEP_DAYS` (mặc định 14) bị xóa.

```powershell
php artisan shop:backup
php artisan shop:backup --keep-days=30
```

- Lệnh chạy trên **host**, nên cần `mysqldump` trong `PATH` (Windows: đặt `MYSQLDUMP_PATH` trong `.env` trỏ tới `mysqldump.exe`). Dùng client cùng dòng 8.x với server. Nếu chỉ có MySQL trong Docker, dùng cách bên dưới.
- File nằm cùng máy với app: phải chép ra nơi khác (ổ ngoài, object storage) và **không commit** `storage/backups` (kiểm tra `.gitignore` trước khi commit).
- Lệnh chỉ tạo bản sao lưu; không có chế độ phục hồi. Phục hồi bằng `mysql` như dưới.

### Bằng mysqldump trong container (không cần MySQL client trên host)

```powershell
New-Item -ItemType Directory -Force storage\backups | Out-Null
docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 caulong --result-file=/tmp/shop.sql'
docker compose cp mysql:/tmp/shop.sql "storage/backups/shop-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
docker compose exec mysql rm -f /tmp/shop.sql
```

Dùng `--result-file` (ghi trong container) thay vì `>` của PowerShell 5.1 để tránh file UTF-16/BOM làm hỏng dump tiếng Việt.

### Phục hồi

Dừng ghi dữ liệu trước (dừng `queue:work` / `schedule:work`, chạy `php artisan down`), và thử phục hồi vào database tạm trước khi ghi đè database thật:

```powershell
php artisan down
docker compose cp storage/backups/shop-20261020-120000.sql mysql:/tmp/restore.sql
# tạo database tạm để thử (bỏ qua nếu phục hồi thẳng vào caulong)
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE caulong_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"'
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" caulong_restore < /tmp/restore.sql'
# kiểm tra số dòng/đơn hàng trên caulong_restore, rồi phục hồi thật:
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" caulong < /tmp/restore.sql'
docker compose exec mysql rm -f /tmp/restore.sql
php artisan up
```

Sau khi phục hồi: `php artisan migrate:status`, `php artisan db:show`, rồi smoke test lại đăng nhập/đặt hàng. Nếu volume bị xóa, `docker compose up -d` tạo lại database trống trước khi import.

## 6. SQLite cho local: cấu hình an toàn hơn

`config/database.php` đọc thêm ba biến cho connection SQLite:

```dotenv
DB_BUSY_TIMEOUT=5000     # ms chờ khóa trước khi báo "database is locked"
DB_JOURNAL_MODE=WAL      # chỉ đặt cho database SQLite dạng file
DB_SYNCHRONOUS=NORMAL    # tùy chọn; WAL thường đi với NORMAL
```

Mặc định `DB_JOURNAL_MODE` và `DB_SYNCHRONOUS` để trống (`null`) nên test `:memory:` và database mới không bị đổi hành vi; `DB_BUSY_TIMEOUT` mặc định 5000 ms. Chỉ đặt `WAL` cho file SQLite thật (không đặt cho `:memory:`), và chỉ dùng các giá trị pragma hợp lệ của SQLite (`WAL`, `DELETE`, `TRUNCATE`, `PERSIST`, `MEMORY`, `OFF`; synchronous `OFF`/`NORMAL`/`FULL`/`EXTRA`). Đổi xong chạy `php artisan config:clear`.

WAL + busy timeout giúp giảm lỗi khóa khi queue worker và web cùng ghi, nhưng SQLite vẫn chỉ cho **một writer**: không phù hợp production nhiều người dùng. Quay lại SQLite sau khi thử MySQL: đặt `DB_CONNECTION=sqlite`, bỏ/xóa `DB_DATABASE` của MySQL (hoặc trỏ đúng file), `php artisan config:clear`, khởi động lại queue worker.

## 7. Khác biệt cần chú ý khi chuyển SQLite → MySQL

- **Độ dài index.** InnoDB/MySQL 8.4 giới hạn khóa index 3072 byte; `utf8mb4` tốn tới 4 byte/ký tự, nên `varchar(768)` là mức trần cho một cột unique. Các khóa hiện tại đều dưới ngưỡng (`slug` 180, `sku` 80, `email` 255 → 1020 byte, `cache.key` 255 → 1020 byte), nhưng index tổng hợp nhiều cột `varchar(255)` hoặc index trên `text` có thể vượt. Migration mới phải kiểm tra `php artisan migrate` thật, không chỉ trên SQLite.
- **Collation không phân biệt hoa/thường và dấu.** `utf8mb4_unicode_ci` coi `DEMO-1` = `demo-1` và nhiều biến thể dấu tiếng Việt bằng nhau trong so sánh, `UNIQUE`, `ORDER BY`, `LIKE`. SQLite mặc định phân biệt hoa/thường. Migration `2026_10_06_100000_compare_skus_exactly_on_mysql.php` đã đổi `product_variants.sku` sang `utf8mb4_bin` để giữ SKU chính xác; các mã khác (coupon, `payments.reference`, `access_code_hash`, tên dịch vụ) vẫn CI — nên chuẩn hóa chữ hoa/thường ở app và đừng bỏ migration đó. MySQL cũng bỏ qua khoảng trắng cuối khi so sánh (`'abc' = 'abc '`), SQLite thì không.
- **Strict mode.** `config/database.php` đặt `'strict' => true`, bật `STRICT_TRANS_TABLES`, `ONLY_FULL_GROUP_BY`, `NO_ZERO_DATE`… SQLite dễ dãi hơn: cắt chuỗi quá dài, nhận ngày rỗng, cho `GROUP BY` thiếu cột. MySQL sẽ báo lỗi. **Không tắt strict để “chữa” lỗi**; sửa dữ liệu/validation/report query. Đây là lý do phải mở thử `/admin/reports` và các form nhập liệu.
- **Transaction và khóa.** SQLite ghi tuần tự, `lockForUpdate` gần như không có tác dụng; InnoDB khóa theo dòng, có gap lock và deadlock (`SQLSTATE 40001`). Hai checkout/thanh toán đồng thời có thể chết một bên và cần retry; giữ transaction ngắn, khóa theo thứ tự nhất quán. Test `RefreshDatabase` chạy SQLite nên **không** phủ concurrency — phải thử tay trên MySQL.
- **Thời gian và kiểu dữ liệu.** `TIMESTAMP` của MySQL chỉ tới 2038; `DATETIME`/`BIGINT` an toàn hơn cho mốc xa. `UNSIGNED` bị MySQL thực thi (SQLite bỏ qua), `DECIMAL` làm tròn theo precision, `JSON`/`LIKE`/`FULLTEXT` hành xử khác. Kiểm tra lại tiền, tồn kho, ngày giao và múi giờ khi đối chiếu.

## 8. Kiểm tra trước khi coi MySQL là đã nghiệm thu

- [ ] `docker compose up -d`, `docker compose ps` healthy; `php artisan db:show` thấy MySQL 8.4.x.
- [ ] `php artisan migrate --force` rồi `php artisan migrate:status` không còn `Pending`.
- [ ] `php artisan test --compact` xanh (nhắc lại: đây là SQLite).
- [ ] Smoke test đăng nhập, giỏ hàng, checkout, `/admin/orders`, `/admin/reports`, queue.
- [ ] `shop:backup` tạo file; phục hồi thử vào database tạm và đối chiếu số dòng/đơn.
- [ ] Nếu nhập từ SQLite: so sánh số dòng, giá, tồn kho và đơn hàng giữa hai database.
- [ ] Ghi lại ngày, phiên bản MySQL, người chạy và kết quả vào ticket/README.

## 9. Giới hạn của tài liệu này

`compose.yaml` mới chỉ được kiểm tra cú pháp YAML trên máy không có Docker. Chưa có lần chạy MySQL thật nào trong repo: chưa xác nhận migration, `->change()` của SKU, `shop:import-sqlite`, backup/restore hay concurrency. Trước khi mở bán, người có Docker/MySQL phải chạy đủ checklist trên; nếu chưa, production vẫn chưa được coi là đã kiểm chứng.
