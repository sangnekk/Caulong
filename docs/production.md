# Đưa shop lên production

Checklist này dành cho lần đưa Laravel 13 + Next.js 16 lên máy chủ thật. Các lệnh giả định code nằm ở
`/var/www/bowfin`, chạy dưới user `www-data`, và domain là `https://your-domain.example`. Đổi lại
đường dẫn/domain cho đúng máy chủ.

> Trạng thái: quy trình này **chưa được chạy trên máy chủ production thật**. MySQL 8 và Resend mới
> được kiểm thử ở mức mã nguồn/API giả, chưa gửi email thật và chưa chạy trên MySQL thật (xem
> `README.md`). Làm theo checklist rồi kiểm tra từng mục, đừng coi test local là bằng chứng.

## 1. Kiến trúc và HTTPS

Trình duyệt chỉ được nói chuyện với reverse proxy (Nginx/Caddy/Cloudflare) qua HTTPS:

```
Internet --443/HTTPS--> reverse proxy --> Next.js 127.0.0.1:3000 --> Laravel (nội bộ)
```

- **Không mở cổng 8000 của Laravel ra Internet.** Laravel chỉ cần Next.js gọi tới được. Chạy
  PHP-FPM sau một server block nội bộ, hoặc bind `127.0.0.1:8000`, rồi firewall chặn 8000 và 3000
  từ bên ngoài.
- Next.js chạy `npm run build` rồi `npm run start` (không dùng `next dev`), bind `127.0.0.1:3000`
  và được giữ bởi systemd/PM2/Supervisor.
- Reverse proxy kết thúc TLS, chuyển tiếp tới Next.js và **ghi đè** các header chuyển tiếp:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.example;

    # ssl_certificate ...; ssl_certificate_key ...;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}

server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}
```

- Trong `frontend/.env.local`, đặt `LARAVEL_URL=http://127.0.0.1:8000`. File này không commit;
  `NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_CLARITY_ID` (nếu dùng) được nhúng lúc build, nên đổi phải build
  lại.
- Chỉ đặt `TRUST_PROXY=1` khi reverse proxy **tự ghi đè** `X-Forwarded-For`, `X-Forwarded-Host` và
  `X-Forwarded-Proto`. Đặt khi không có proxy như vậy là mở lại lỗ hổng vượt giới hạn thử mật khẩu
  theo IP. Để trống khi trình duyệt nối thẳng vào Next.js. `TRUST_PROXY` phải có cả lúc build và lúc
  chạy.
- Laravel hiện chỉ tin proxy `127.0.0.1` và `::1` (`bootstrap/app.php`). Nếu Next.js chạy ở máy khác,
  thêm đúng địa chỉ máy đó vào `trustProxies`; đừng dùng `*` trừ khi toàn bộ đường mạng là nội bộ
  và do bạn kiểm soát.
- Nếu dùng Cloudflare: bật **Full (strict)**, chỉ cho origin nhận IP của Cloudflare, và xác nhận
  proxy không xóa header HSTS.
- `APP_URL` và `FRONTEND_URL` đều là địa chỉ HTTPS công khai của shop (Next.js), không phải cổng 8000. Sai `FRONTEND_URL` thì canonical, sitemap, ảnh xem trước và liên kết trong email trỏ sai.

## 2. Biến môi trường, APP_KEY và cache

Sao chép mẫu rồi điền trên máy chủ:

```sh
cp .env.production.example .env
# sửa APP_URL, FRONTEND_URL, DB_*, MAIL_FROM_ADDRESS, RESEND_API_KEY
php artisan key:generate --force
chmod 600 .env
```

- `APP_ENV=production`, `APP_DEBUG=false`. Debug bật sẽ lộ stack trace, cấu hình và dữ liệu cho
  khách.
- `APP_KEY` sinh một lần trên máy chủ. **Không dùng lại key local** và không chạy `key:generate` lại
  sau khi đã có dữ liệu mã hóa (2FA, session); đổi key làm dữ liệu cũ không đọc được. Sao lưu key an
  toàn cùng với backup.
- Sau mỗi lần đổi `.env` phải làm mới cache cấu hình:

```sh
php artisan config:cache
php artisan route:cache
php artisan view:cache
# hoặc gộp: php artisan optimize
```

- `config:cache` đọc `.env` một lần. Khi sửa `.env` mà không chạy lại `config:cache`, ứng dụng vẫn
  dùng giá trị cũ. Khi cần debug: `php artisan optimize:clear`.
- Kiểm tra nhanh: `php artisan about` phải thấy environment `production`, debug `false`.
- Phân quyền: `storage/` và `bootstrap/cache/` ghi được bởi user chạy PHP; `.env` chỉ đọc bởi user
  đó. Không để `.env` trong thư mục public.
- `php artisan storage:link` để ảnh trong `storage/app/public` được phục vụ qua `/storage`.
- Sau khi deploy code mới: `php artisan queue:restart` để worker nạp code mới.

## 3. MySQL 8

Database production dùng MySQL 8; **không dùng SQLite** (xem mục 10). Hướng dẫn cài đặt, cấu hình,
migration và kiểm tra chi tiết nằm ở [`docs/mysql.md`](mysql.md). Tóm tắt:

```sql
CREATE DATABASE caulong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'caulong'@'127.0.0.1' IDENTIFIED BY 'mật-khẩu-mạnh';
GRANT ALL PRIVILEGES ON caulong.* TO 'caulong'@'127.0.0.1';
FLUSH PRIVILEGES;
```

- Điền `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE`, `DB_USERNAME`,
  `DB_PASSWORD` trong `.env`.
- Chạy migration ở chế độ không hỏi (production):

```sh
php artisan migrate --force
php artisan migrate:status
```

- **Không chạy seeder demo trên production.** Tạo quản trị viên đầu tiên bằng tài khoản đã đăng ký
  và xác minh email:

```sh
php artisan shop:make-admin you@example.com --role=admin
```

- Chỉ dùng `php artisan shop:import-sqlite` khi chủ động chuyển dữ liệu từ database local sang
  MySQL trống; lệnh chỉ chạy khi các bảng nghiệp vụ còn trống. Sao lưu trước khi chuyển.
- Trước khi mở nhận đơn, kiểm tra số dòng, giá/tồn kho và luồng đặt hàng trên MySQL. Bộ test chạy
  SQLite trong bộ nhớ, nên test xanh **không** chứng minh MySQL đã đúng.

## 4. Queue worker

Email, thông báo và nhiều việc nền được đẩy vào queue `database`; không có worker thì chúng nằm mãi
trong bảng `jobs`.

Giữ một tiến trình thường trực bằng Supervisor/systemd, ví dụ Supervisor:

```ini
[program:bowfin-worker]
command=php /var/www/bowfin/artisan queue:work --tries=3 --timeout=90 --sleep=3
directory=/var/www/bowfin
user=www-data
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=1
```

- `--tries=3`: mỗi job thử tối đa 3 lần rồi vào `failed_jobs`.
- Sau mỗi deploy: `php artisan queue:restart` (Supervisor tự khởi động lại tiến trình).
- Theo dõi job lỗi: `php artisan queue:failed`; sửa nguyên nhân rồi `php artisan queue:retry <id>`
  hoặc `php artisan queue:retry all`. Đừng `queue:flush` trước khi xem lỗi.
- Có thể dọn job lỗi cũ bằng `php artisan queue:prune-failed --hours=168` sau khi đã lưu/điều tra.

## 5. Scheduler

Các việc định kỳ nằm trong `routes/console.php`: dọn dữ liệu, phân nhóm khách, đóng chat, hủy đơn
chuyển khoản quá hạn, email marketing và `shop:backup` lúc 02:30 (giờ shop). Chạy đúng một trong hai
cách:

```cron
* * * * * cd /var/www/bowfin && php artisan schedule:run >> /dev/null 2>&1
```

hoặc giữ `php artisan schedule:work` dưới Supervisor. **Chỉ một instance scheduler** để tránh chạy
trùng. Kiểm tra lịch bằng:

```sh
php artisan schedule:list
```

Nếu cron không chạy, backup, hủy đơn quá hạn và email marketing đều âm thầm dừng.

## 6. Sao lưu và phục hồi

`shop:backup` đã được đăng ký chạy hằng ngày lúc 02:30. Lệnh chỉ sao lưu **database** (SQLite hoặc
MySQL), không sao lưu ảnh trong `storage/app/public`.

Các biến môi trường lệnh dùng (khớp `config/backup.php`):

- `BACKUP_KEEP_DAYS`: số ngày giữ bản sao lưu; mặc định 14.
- `BACKUP_PATH`: thư mục ghi file; mặc định `storage/backups` (config dùng `storage_path('backups')`).
  Trên máy chủ nên dùng đường dẫn tuyệt đối, ví dụ `/var/www/bowfin/storage/backups`.
- `MYSQLDUMP_PATH`: đường dẫn `mysqldump` nếu không có trong `PATH`.

Kiểm tra thủ công ngay sau khi deploy:

```sh
php artisan shop:backup
ls -lh /var/www/bowfin/storage/backups
```

- Với MySQL, lệnh gọi `mysqldump --single-transaction --quick --routines --triggers`; phải cài MySQL
  client và user database phải đủ quyền đọc/`PROCESS` để dump. Nếu `mysqldump` báo thiếu `PROCESS`,
  cấp thêm `GRANT PROCESS ON *.* TO 'caulong'@'127.0.0.1';` (hoặc dùng user backup riêng có quyền
  đó). Chạy thử một lần và đọc lỗi thay vì tin rằng cron sẽ thành công.
- File backup nằm cùng máy với database: **mất máy là mất cả hai**. Mỗi ngày copy sang nơi khác
  (rclone/S3/Backblaze hoặc ổ khác) bằng user/khóa riêng, mã hóa khi lưu, và kiểm tra file đến nơi
  có kích thước/checksum hợp lý.
- Sao lưu ảnh riêng: `storage/app/public` (ảnh sản phẩm, ảnh đánh giá...) bằng `rsync`/`rclone` định
  kỳ. Database không chứa các file này.
- **Diễn tập phục hồi** định kỳ (ít nhất mỗi quý), trên database staging riêng:

```sh
mysql -u root -p -e "CREATE DATABASE caulong_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p caulong_restore < /đường/dẫn/shop-YYYYmmdd-HHMMSS.sql
```

Trỏ một bản staging vào database vừa phục hồi, kiểm tra số dòng `orders`, `products`, `users`, mở
được ảnh, đăng nhập được và đặt thử một đơn COD. Ghi lại thời gian phục hồi (RTO). Không thử restore
đè lên database production.

- Theo dõi việc backup có chạy: cron/Supervisor không tự báo khi lệnh thất bại. Dùng log của scheduler,
  `healthchecks.io`/cron monitor hoặc kiểm tra file mới mỗi sáng. Backup không kiểm tra được phục hồi
  thì chưa phải backup.

## 7. Xác thực hai lớp cho nhân viên

Đặt `SHOP_REQUIRE_STAFF_TWO_FACTOR=true`. Khi `APP_ENV=production`, giá trị mặc định đã bật, nhưng
ghi rõ trong `.env` để không phụ thuộc vào mặc định.

- Mỗi quản trị viên/nhân viên đăng nhập, mở `/settings/security`, bật 2FA bằng ứng dụng TOTP, xác
  nhận mã và **lưu bộ mã khôi phục** ở nơi an toàn (không lưu trong chat/email).
- Middleware `staff.2fa` chặn tài khoản quản trị chưa xác nhận 2FA vào `/admin` và chuyển về
  `/settings/security`. Khách hàng không bị ảnh hưởng.
- `/admin/staff` hiển thị ai chưa bật 2FA. Kiểm tra lại sau khi thêm nhân viên mới.
- Luôn có ít nhất hai quản trị viên và bộ mã khôi phục của từng người. Nếu mất điện thoại, dùng mã
  khôi phục; nếu mất cả hai, chỉ tạm đặt `SHOP_REQUIRE_STAFF_TWO_FACTOR=false`, `config:cache`, vào
  gỡ/đặt lại 2FA rồi bật lại ngay. Ghi lại mọi lần hạ cấp này.
- Kiểm tra bằng tài khoản nhân viên thật: chưa bật 2FA phải bị chặn; sau khi bật, đăng nhập phải hỏi
  mã; nhập mã sai không vào được.

## 8. Resend và email thật

1. Trong Resend, thêm domain gửi và tạo các bản ghi DNS **SPF + DKIM**; thêm DMARC (`p=none` trước)
   nếu tên miền chưa có. Chờ trạng thái domain là verified.
2. Trong `.env`:

    ```dotenv
    MAIL_MAILER=resend
    RESEND_API_KEY=re_...
    MAIL_FROM_ADDRESS="noreply@your-domain.example"
    MAIL_FROM_NAME="Shop Cầu Lông"
    ```

    Địa chỉ gửi phải thuộc domain đã xác minh; không dùng Gmail/địa chỉ ngoài domain.

3. Chạy `php artisan config:cache`, `php artisan queue:restart`, và chắc chắn worker đang chạy. Email
   được đẩy vào queue, không gửi ngay nếu không có worker.
4. Gửi thử thật: đặt một đơn COD, yêu cầu đặt lại mật khẩu, và gửi một email từ admin. Kiểm tra hộp
   thư đến **và** thư rác ở Gmail/Outlook, mở liên kết trong email (phải là HTTPS, đúng
   `FRONTEND_URL`), và xem Resend dashboard có trạng thái delivered.
5. `MAIL_MAILER=log` chỉ ghi nội dung vào log, không chứng minh email đã tới. Đừng dùng log ở
   production.
6. Bảo vệ `RESEND_API_KEY` như mật khẩu; không đưa vào frontend, không commit, xoay vòng nếu lộ.

## 9. HSTS

`frontend/next.config.ts` gửi header sau **chỉ khi build/run với `NODE_ENV=production`**:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Không có `preload`. `next build`/`next start` mặc định là production; nếu dùng Docker hoặc script
riêng, phải đặt `NODE_ENV=production` cho cả lúc build và lúc chạy.

Trước khi bật, kiểm tra:

- Chứng chỉ TLS hợp lệ và tự gia hạn; HTTP chuyển hướng 301 sang HTTPS.
- **Mọi subdomain** đều chạy HTTPS. `includeSubDomains` sẽ khiến trình duyệt chặn subdomain còn HTTP
  sau lần ghé đầu tiên, kể cả staging.
- Không còn mixed content (ảnh/script HTTP) trên các trang chính.
- Reverse proxy không xóa header.

Kiểm tra sau deploy:

```sh
curl -sSI https://your-domain.example/ | grep -i '^strict-transport-security:'
```

HSTS chỉ có hiệu lực khi được gửi qua HTTPS. Đã gửi `max-age=31536000` thì trình duyệt sẽ nhớ gần
một năm; muốn rút lại phải bỏ header và chờ hết thời gian đó (hoặc giảm `max-age` trước). **Không
thêm `preload`** và không nộp domain vào hstspreload.org cho tới khi chắc chắn mọi subdomain sẽ mãi
dùng HTTPS. Cân nhắc dùng domain riêng cho staging để không dính `includeSubDomains`.

## 10. Vận hành: log, job lỗi, dung lượng

- **Log:** `LOG_CHANNEL=stack`, `LOG_STACK=daily`, `LOG_LEVEL=warning`, `LOG_DAILY_DAYS=14` (mẫu
  production). Nếu dùng `single`, phải cấu hình `logrotate` cho `storage/logs/laravel.log`, không thì
  file phình đến đầy đĩa. Log có thể chứa email/địa chỉ/đơn hàng: giới hạn quyền đọc, cân nhắc gửi
  sang nơi lưu log tập trung, và không log token/mật khẩu.
- **Job lỗi:** theo dõi `failed_jobs` và log worker mỗi ngày; đặt cảnh báo khi có job mới thất bại.
  Job email lỗi nghĩa là khách không nhận được xác nhận đơn.
- **Dung lượng:** kiểm tra `df -h` và `du -sh storage/logs storage/backups storage/app/public`; đặt
  cảnh báo ở 80%. Backup 14 ngày cộng log cộng ảnh có thể đầy đĩa nhanh hơn dự kiến. Đừng để backup
  là thứ duy nhất lấp đầy ổ.
- **SQLite không dùng cho production.** SQLite chỉ cho phép một writer và dễ khóa khi web + queue
  worker cùng ghi; file cục bộ cũng không phù hợp khi có nhiều tiến trình/máy. Dùng MySQL 8 như mục 3.
- **Giám sát:** uptime cho `https://your-domain.example/up`, cảnh báo hết hạn chứng chỉ
  (`certbot renew --dry-run`), theo dõi worker/scheduler còn sống, và kiểm tra dung lượng/CPU/RAM.
- Cập nhật bảo mật PHP/Laravel/Node và OS định kỳ; chạy `composer audit`, `npm audit` trước khi
  nâng cấp. `APP_DEBUG=false` phải giữ nguyên trên production.

## 11. Thứ tự deploy

1. DNS, chứng chỉ TLS, reverse proxy, firewall; chặn 3000/8000 từ Internet.
2. Deploy code, cài dependency và build:

    ```sh
    composer install --no-dev --optimize-autoloader
    npm ci
    npm --prefix frontend ci
    npm run build
    php artisan storage:link
    ```

3. Tạo `.env` từ `.env.production.example`, điền giá trị, `php artisan key:generate --force`,
   `chmod 600 .env`, phân quyền `storage/` + `bootstrap/cache/`.
4. Tạo database/user MySQL, chạy `php artisan migrate --force`.
5. Chạy `php artisan optimize`; khởi động Next.js, PHP-FPM, queue worker và scheduler.
6. Tạo/kiểm tra quản trị viên, bật 2FA, gửi thử email Resend.
7. Chạy smoke checklist bên dưới **trước khi** mở nhận đơn thật.

## 12. Smoke checklist sau deploy

- [ ] `GET /up` trả 200 (qua HTTPS, qua Next.js).
- [ ] `/` trả 200; CSS/JS/ảnh tải được, không có mixed content.
- [ ] `/products` và một trang sản phẩm trả 200; tìm kiếm/lọc, thêm vào giỏ hoạt động.
- [ ] Đăng nhập/đăng xuất tài khoản khách; đặt lại mật khẩu nhận được email thật.
- [ ] Đăng nhập admin: tài khoản đã bật 2FA phải hỏi mã; tài khoản chưa bật bị chặn khỏi `/admin`
      và được đưa về `/settings/security`; `/admin/staff` hiển thị đúng trạng thái.
- [ ] Đặt một đơn COD từ đầu đến cuối: xác nhận đơn, admin thấy đơn, tồn kho giảm, email xác nhận
      được gửi.
- [ ] `/sitemap.xml` và `/robots.txt` trả 200; URL trong sitemap là HTTPS và đúng `FRONTEND_URL`;
      robots không còn `Disallow: /`; trang công khai không có `noindex`.
- [ ] `Strict-Transport-Security` có trên response HTTPS; cookie phiên có `Secure`, `HttpOnly`,
      `SameSite=Lax`.
- [ ] Queue worker xử lý job; `failed_jobs` trống hoặc đã được điều tra; scheduler đã chạy ít nhất
      một lần (`schedule:list`, file backup mới).
- [ ] `shop:backup` tạo file, bản copy ngoài máy tồn tại; đã thử phục hồi trên staging.
- [ ] Log không có lỗi lặp lại; `APP_DEBUG=false`; trang 404 không lộ stack trace.
- [ ] Chứng chỉ TLS hợp lệ, tự gia hạn; disk còn nhiều chỗ; cảnh báo uptime/worker đã bật.

Kiểm tra nhanh bằng curl:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://your-domain.example/up
curl -sSI https://your-domain.example/ | grep -i '^strict-transport-security:'
curl -sS https://your-domain.example/robots.txt
curl -sS https://your-domain.example/sitemap.xml | head -n 5
```

## 13. Khi có sự cố

- Giữ bản release trước đó và một bản backup đã kiểm tra phục hồi. Khi deploy lỗi: bật maintenance
  (`php artisan down --retry=60`), chuyển về release trước, `php artisan queue:restart`, rồi
  `php artisan optimize`. Không rollback migration phá dữ liệu nếu chưa có backup.
- Nếu đã lỡ gửi HSTS: bỏ header khỏi build mới và chờ hết `max-age`; không có cách xóa ngay trong
  trình duyệt của khách.
- Nếu nghi ngờ lộ `APP_KEY`/`RESEND_API_KEY`/mật khẩu DB: xoay vòng khóa, cập nhật `.env`, chạy
  `config:cache`, `queue:restart`, và kiểm tra log truy cập.
- Sự cố email: kiểm tra worker, `failed_jobs`, Resend dashboard, domain verification và hộp thư đến
  trước khi kết luận Resend hỏng.

## 14. Điều chưa kiểm chứng

- Chưa chạy toàn bộ quy trình này trên MySQL 8 thật; mới chạy test trên SQLite trong bộ nhớ.
- Chưa gửi email thật qua Resend (chưa có API key/domain), chưa quét QR ngân hàng thật.
- Chưa thử HSTS trên domain công khai; `includeSubDomains` cần rà toàn bộ subdomain trước khi bật.
- Chưa có backup ngoài máy cho tới khi cấu hình rclone/S3; `shop:backup` một mình chỉ là bản sao
  cùng ổ đĩa.
