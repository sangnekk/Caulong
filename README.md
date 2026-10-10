# Shop Cầu Lông

Cửa hàng vợt cầu lông: trang giới thiệu có vợt 3D, cửa hàng với giỏ và đặt hàng trả tiền khi nhận (COD), tài khoản khách và trang quản trị. Dữ liệu và nghiệp vụ do Laravel 13 xử lý; giao diện là một app Next.js 16.

## Có gì

- **Trang giới thiệu:** vợt Hyper Core8000 bằng Three.js, sáu chương xoay và phóng theo cuộn, màn mở đầu “căng dây” chạy theo tiến độ tải mô hình thật, bản đọc tĩnh cho máy yếu hoặc khi tắt chuyển động.
- **Cửa hàng:** danh sách vợt có lọc theo hãng, lối chơi, mức giá và hàng còn; trang sản phẩm theo phiên bản; giỏ hàng; đặt hàng COD không cần tài khoản; gợi ý chọn vợt theo ngân sách, lối chơi, trình độ (theo quy tắc, không dùng AI).
- **Tài khoản:** khách xem đơn của mình, lưu sản phẩm yêu thích, viết đánh giá cho sản phẩm đã nhận, sửa hồ sơ, đổi mật khẩu, bật/tắt email ưu đãi, xem lại các lần nhắn với cửa hàng; đăng nhập có xác minh email, xác thực hai lớp và passkey.
- **Quản trị:** sản phẩm, tồn kho, đơn hàng, khách hàng (hồ sơ từng khách: số liệu, đơn, dòng hoạt động, sản phẩm, đánh giá), duyệt đánh giá, báo cáo doanh số và lãi gộp, cài đặt phí giao và liên hệ, xuất đơn ra CSV, trả lời chat hỗ trợ.
- **Hành vi khách hàng:** cửa hàng tự ghi các sự kiện mua sắm (xem, tìm, thêm giỏ, đặt đơn…) vào database của mình; Microsoft Clarity là tùy chọn, chỉ chạy khi có project ID và khách đồng ý.
- **Nhóm khách và mã giảm giá:** mỗi khách được xếp vào một nhóm (Mới, Tiềm năng, Đang mua, VIP, Không hoạt động, Đã mất) theo ngưỡng chủ shop đặt; mã giảm giá cho mọi khách, cho riêng một khách hoặc cho một nhóm, có hạn dùng, giới hạn lượt và điều kiện đơn.
- **Email:** chào mừng, xác minh/đặt lại mật khẩu, cập nhật đơn và mã riêng qua queue; nhật ký ở `/admin/emails`. Bốn automation (nhắc giỏ, mời quay lại, mời đánh giá, quà VIP) mặc định tắt, chỉ gửi marketing cho khách đã đồng ý và xác minh email. Resend gọi HTTP, không cần thêm package PHP; local chỉ ghi log.
- **Chat hỗ trợ:** trợ lý tự động trả lời câu hỏi thường gặp (theo từ khóa, không dùng AI) và chuyển cho nhân viên khi cần. Nhân viên thấy khách là ai, đơn và sản phẩm của họ ngay cạnh cuộc trò chuyện. Mỗi cuộc trò chuyện đi qua bốn trạng thái: chờ shop, chờ khách, đã giải quyết, đã đóng. Khách có tài khoản xem lại ở trang tài khoản; khách vãng lai xem lại bằng một mã lấy khi cuộc trò chuyện kết thúc.
- **Hai vai trò nhân viên:** quản trị viên dùng toàn bộ `/admin`; nhân viên hỗ trợ chỉ vào được Chat hỗ trợ.
- **Nhập hàng:** từ CSV hoặc Excel kèm ZIP ảnh, có xem trước và khớp theo SKU; đồng bộ danh mục vợt từ shopvnb.com (đã được cho phép) bằng `scripts/vnb-catalog.mjs`.
- **Chưa có:** thanh toán online, kết nối hãng vận chuyển.

## Hai phần của project

| Phần    | Thư mục     | Cổng local | Việc                                                                        |
| ------- | ----------- | ---------- | --------------------------------------------------------------------------- |
| Laravel | thư mục gốc | 8000       | Route, phiên đăng nhập, phân quyền, dữ liệu, email, lệnh nhập hàng          |
| Next.js | `frontend/` | 3000       | Mọi thứ khách và quản trị viên nhìn thấy; hỏi Laravel dữ liệu cho mỗi trang |

Trình duyệt chỉ mở địa chỉ của Next.js. Với mỗi trang, Next.js hỏi Laravel đúng đường dẫn đó và nhận về tên trang kèm dữ liệu; form, giỏ hàng và đăng nhập gửi qua `/api/...` của Next.js rồi mới tới Laravel. Vì vậy controller ở Laravel vẫn viết như thường (`Inertia::render('shop/products', [...])`), còn phần hiển thị nằm ở `frontend/src/views`. Mở thẳng cổng 8000 chỉ thấy một dòng chỉ sang địa chỉ giao diện. Chi tiết: [frontend/README.md](frontend/README.md).

Database mặc định là SQLite (`database/database.sqlite`); có thể chuyển sang MySQL, xem bên dưới.

## Chạy local

Cần PHP 8.3 trở lên (khuyến nghị 8.4) có `pdo_sqlite`, `mbstring`, `fileinfo`, `curl`, `zip`, `intl`, `gd`; Composer; Node.js 22.

Cài lần đầu:

```sh
composer install
cp .env.example .env
php artisan key:generate
php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
php artisan migrate
php artisan storage:link
npm install
npm --prefix frontend install
cp frontend/.env.example frontend/.env.local
```

Chạy:

```sh
php artisan dev
```

Lệnh này mở Laravel ở cổng 8000, hàng đợi và Next.js ở cổng 3000 trong cùng một cửa sổ. Mở **http://localhost:3000**. Cửa hàng ở `/products`, gợi ý chọn vợt ở `/advisor`, quản trị ở `/admin`.

Muốn chạy riêng từng phần thì dùng `php artisan serve` và `npm run dev`; thêm `php artisan queue:work` để gửi email và `php artisan schedule:work` để chạy automation. Trên Windows có sẵn `scripts/start-local.ps1`, kiểm tra `.env`, các gói đã cài và hai cổng rồi mới chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

### Dữ liệu và tài khoản để thử

```sh
php artisan db:seed --class=DemoCatalogSeeder   # sản phẩm minh họa, chỉ dùng ở local
php artisan shop:demo-sales                     # một năm đơn mẫu có nhãn, để xem báo cáo
```

Khi `APP_ENV=local`, trang đăng nhập tự tạo ba tài khoản và có nút đăng nhập một lần bấm: `admin@test.local` (quản trị), `hotro@test.local` (nhân viên hỗ trợ) và `khach@test.local` (khách), mật khẩu `Test-Cau-Long-2026!`. Xóa ba tài khoản này trước khi dùng database đó cho hàng thật.

Tài khoản quản trị thật: đăng ký ở `/register`, xác minh email (ở local thư nằm trong `storage/logs/laravel.log` sau khi queue worker xử lý), rồi chạy `php artisan shop:make-admin email-cua-ban`. Thêm `--role=support` để tài khoản đó chỉ là nhân viên hỗ trợ.

## Lệnh thường dùng

| Lệnh                                  | Việc                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `php artisan dev`                     | Chạy Laravel, hàng đợi và Next.js                                                                                |
| `npm run build` rồi `npm run start`   | Build và chạy bản production của giao diện                                                                       |
| `npm run check` / `npm run check:fix` | Kiểm tra / tự sửa định dạng và lint cho TypeScript, script, tài liệu                                             |
| `npm run types:check`                 | Kiểm tra kiểu TypeScript của giao diện                                                                           |
| `npm run routes`                      | Sinh lại `frontend/src/actions`, `routes`, `wayfinder` từ route của Laravel                                      |
| `php artisan test --compact`          | Chạy test của Laravel                                                                                            |
| `php artisan queue:work`              | Xử lý email đã xếp hàng; local ghi vào log, Resend gửi thật khi cấu hình                                         |
| `php artisan schedule:work`           | Chạy marketing, xếp nhóm khách, đóng cuộc trò chuyện đã giải quyết, xóa sự kiện và nhật ký email cũ hơn 365 ngày |
| `php artisan shop:make-admin email`   | Cấp quyền quản trị cho một tài khoản đã xác minh; `--role=support` cho nhân viên hỗ trợ                          |
| `php artisan marketing:run`           | Chạy các automation đang bật; có thể thêm `abandoned_cart`, `winback`, `post_purchase` hoặc `vip`                |
| `php artisan crm:segment`             | Xếp lại nhóm cho mọi khách hàng ngay (bình thường chạy theo lịch mỗi ngày)                                       |
| `php artisan shop:import-catalog`     | Nhập sản phẩm, giá, tồn kho, ảnh từ CSV                                                                          |
| `node scripts/vnb-catalog.mjs`        | Đọc danh mục vợt từ shopvnb.com thành CSV để nhập                                                                |

Sau khi thêm hoặc đổi route ở Laravel, chạy `npm run routes` để giao diện có hàm gọi route mới.

## Kiểm tra

```sh
npm run check
npm run types:check
php vendor/bin/pint --test
php -d memory_limit=512M vendor/bin/phpstan analyse --no-progress
php artisan test --compact
node tests/vnb-catalog.mjs                 # tool đọc danh mục VNB, không cần mạng
node frontend/tests/hyper-core-model.mjs   # mô hình 3D; cần file nguồn trong glb/
node frontend/tests/racket-strings.mjs
node frontend/tests/baked-strings.mjs
```

Các bài kiểm tra trong trình duyệt (`tests/*-browser.mjs`, `tests/landing-store-navigation.mjs`, `tests/scroll-performance.mjs`) không dùng thư viện ngoài. Chúng cần shop đang chạy bằng bản build (`php artisan serve`, `npm run build`, `npm run start`) và một Chrome riêng mở với `--remote-debugging-port=9222`:

```sh
node tests/commerce-browser.mjs
node tests/landing-loader-browser.mjs
```

Địa chỉ mặc định là `http://localhost:3000`; đổi bằng biến `LANDING_URL`. `commerce-browser` tạo một đơn hàng mẫu trong database đang dùng.

## Nhập hàng và dữ liệu VNB

Quản trị viên nhập hàng ở `/admin/imports` hoặc bằng lệnh:

```sh
php artisan shop:import-catalog hang.csv --images=thu-muc-anh --dry-run   # chỉ kiểm tra
php artisan shop:import-catalog hang.csv --images=thu-muc-anh            # nhập, sản phẩm mới ở trạng thái ẩn
```

Định dạng file, cách khớp SKU, cách đọc danh mục VNB và những điều cần làm trước khi mở bán thật: [COMMERCE.md](COMMERCE.md).

## Chuyển sang MySQL

Để chuyển sang MySQL mà giữ nguyên dữ liệu:

1. Cài MySQL 8 và bật `extension=pdo_mysql` trong `php.ini`.
2. Tạo database trống: `CREATE DATABASE caulong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Trong `.env`: `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE=caulong`, `DB_USERNAME=...`, `DB_PASSWORD=...`.
4. Chạy:

```sh
php artisan migrate
php artisan shop:import-sqlite        # chép mọi bảng từ database/database.sqlite, giữ nguyên id
```

Lệnh chép chỉ chạy khi database mới còn trống và không chép phiên đăng nhập (mọi người đăng nhập lại). File SQLite không bị sửa: muốn quay lại thì đổi `DB_CONNECTION=sqlite`. Test luôn chạy trên SQLite trong bộ nhớ. Lệnh chép mới được thử từ SQLite sang SQLite, chưa chạy trên MySQL thật: sao lưu trước khi dùng với dữ liệu thật.

## Đưa lên máy chủ

- **Laravel:** `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, database, hàng đợi và cache của production. Không chạy seeder demo.
- **Địa chỉ:** `APP_URL` và `FRONTEND_URL` là địa chỉ công khai của shop (app Next.js), vì đường dẫn ảnh và liên kết trong email dựng từ đó.
- **Next.js:** `npm run build` rồi `npm run start`, với `LARAVEL_URL` trong `frontend/.env.local` trỏ tới Laravel. Laravel chỉ cần Next.js gọi tới được, không cần mở ra Internet.
- **Proxy:** Laravel hiện chỉ tin header chuyển tiếp từ `127.0.0.1` (`bootstrap/app.php`). Nếu Next.js chạy ở máy khác, thêm địa chỉ máy đó.
- **Email:** đặt `MAIL_MAILER=resend`, `RESEND_API_KEY`, `MAIL_FROM_ADDRESS` thuộc domain đã xác minh trên Resend và `MAIL_FROM_NAME` trong `.env`; giữ `php artisan queue:work` chạy dưới process manager. `MAIL_MAILER=log` chỉ ghi file, không chứng minh email đã tới hộp thư. Transport HTTP đã kiểm thử bằng API giả; cần kiểm tra gửi thật trước khi mở bán.
- **Việc định kỳ:** thêm cron chạy `php artisan schedule:run` mỗi phút (hoặc giữ `php artisan schedule:work` chạy). Bật từng automation ở `/admin/settings`; lịch marketing dùng giờ Việt Nam. Giữ các tùy chọn tắt khi chưa có chính sách và cấu hình gửi thật.
- **Clarity (tùy chọn):** đặt `NEXT_PUBLIC_CLARITY_ID` trong `frontend/.env.local` trước khi build. Cần có trang chính sách quyền riêng tư nói rõ cửa hàng ghi lại gì trước khi bật.
- Dùng HTTPS, và xác nhận chính sách giao, đổi, trả trước khi nhận đơn thật.

## Thư mục

| Thư mục                         | Nội dung                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `app/`, `routes/`, `database/`  | Laravel: controller, service, model, lệnh `shop:*`, migration            |
| `resources/views/app.blade.php` | Trang hiện khi mở thẳng cổng của Laravel                                 |
| `frontend/src/app`              | Route của Next.js, mỗi trang một dòng `laravelPage(View, Layout)`        |
| `frontend/src/views`            | Các trang React; tên file trùng tên trang Laravel trả về                 |
| `frontend/src/lib/page`         | `Link`, `useForm`, `Form`, `usePage`, `router` dùng trong các trang      |
| `frontend/public/models`        | Mô hình 3D đã tối ưu cho web                                             |
| `frontend/scripts`              | Script dựng mô hình 3D (`prepare-hyper-core`, `bake-racket-strings`)     |
| `scripts/`                      | Tool đọc danh mục VNB và script khởi động local                          |
| `tests/`                        | Test của Laravel (`Feature/`), test tool VNB, kiểm tra trong trình duyệt |

## Tài nguyên và giấy phép

Mô hình Hyper Core8000 do **ghks1120** tạo, cấp phép **CC BY 4.0**. Bản web đã tách một cây vợt và tối ưu dữ liệu; mặt dây là phần minh họa bổ sung, không phải hướng dẫn căng dây của hãng. Chi tiết: [thông tin giấy phép](frontend/public/models/HYPER-CORE-LICENSE.txt).

- [Nguồn mô hình](https://sketchfab.com/3d-models/hyper-core8000-badminton-racket-3d-modeling-c6f5e27f657a48d6b3cbb52120d75f83)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Các file trong `frontend/public/models/` đủ để chạy web. Thư mục mô hình nguồn `glb/` không đưa lên Git; muốn chạy lại `frontend/scripts/prepare-hyper-core.mjs` cần tải mô hình từ nguồn trên.

Không đưa `.env`, database, log, dữ liệu đọc từ VNB, `vendor/`, `node_modules/` hoặc bản build lên GitHub.

## Tài liệu khác

- [frontend/README.md](frontend/README.md): giao diện Next.js nói chuyện với Laravel thế nào, cách thêm một trang.
- [COMMERCE.md](COMMERCE.md): bán hàng, nhập hàng, dữ liệu VNB, quản trị.
- [LANDING.md](LANDING.md): trang giới thiệu, mô hình 3D và các bài kiểm tra của nó.
- [PROJECT_UPGRADE_PLAN.md](PROJECT_UPGRADE_PLAN.md): kế hoạch nâng cấp theo từng giai đoạn và trạng thái hiện tại.
