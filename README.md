# Shop Cầu Lông

Cửa hàng vợt cầu lông: trang giới thiệu có vợt 3D, cửa hàng với giỏ và đặt hàng trả tiền khi nhận (COD) hoặc chuyển khoản ngân hàng, tài khoản khách và trang quản trị. Dữ liệu và nghiệp vụ do Laravel 13 xử lý; giao diện là một app Next.js 16.

## Trạng thái và việc còn lại

Rà soát ngày **2026-10-12**. **Phase 1–10 đã triển khai trong mã nguồn**, không đồng nghĩa đã sẵn sàng nhận đơn thật. Local tiếp tục dùng **SQLite theo lựa chọn của chủ project**; Phase 0.7 (chuyển MySQL) tạm hoãn, không cần làm để chạy local. Chi tiết từng phase: [PROJECT_UPGRADE_PLAN.md](PROJECT_UPGRADE_PLAN.md#implementation-phases).

### Đã có, còn cấu hình hoặc kiểm thử thực tế

| Hạng mục                  | Việc còn lại                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email Resend              | Cấp API key, xác minh domain gửi, thử nhận email thật và liên kết xác minh/đặt lại mật khẩu. Local đang dùng `MAIL_MAILER=log`; test API giả không chứng minh thư đã tới hộp thư.                                       |
| Email tự động             | Bốn automation hiện tắt. Sau khi kiểm tra cấu hình và sự đồng ý của khách, chủ shop mới bật từng loại ở `/admin/settings`; máy chủ cần cả queue worker và scheduler.                                                    |
| Chuyển khoản              | Nhập tài khoản ngân hàng ở `/admin/settings`, quét VietQR bằng ứng dụng ngân hàng và chuyển thử một khoản nhỏ, rồi mới bật. Đã kiểm tra chuỗi và giải mã QR, chưa quét bằng tài khoản thật.                             |
| Đan dây                   | Nhập dây và giá ở `/admin/service-strings`, đặt phí công ở `/admin/settings`. Local chưa có dây; phí công mặc định 0 nghĩa là báo giá khi nhận vợt.                                                                     |
| Chính sách quyền riêng tư | Chủ shop kiểm tra bản nháp `/privacy`, thông tin liên hệ và cách vận hành thực tế rồi mới công bố ở Cài đặt. Bản nháp mô tả hệ thống, không thay thế tư vấn pháp lý.                                                    |
| Clarity (tùy chọn)        | Có mã hỏi sự đồng ý, nhưng chưa thử trên project thật. Cần project ID, build lại, kiểm tra trên dashboard việc đồng ý/từ chối/dừng ghi; công bố chính sách trước khi bật.                                               |
| SEO                       | Có metadata, JSON-LD, sitemap và robots. Cần tên miền HTTPS, địa chỉ canonical đúng, kiểm tra Google Rich Results Test và Search Console; local không cho lập chỉ mục.                                                  |
| Catalog                   | Local có 2.586 vợt nhập từ VNB; 239 vợt có ảnh phụ, 229 SKU có giá niêm yết. Chưa chạy lượt `--upgrade` cho phần còn lại; đây là lượt tải lớn, chỉ chạy khi được đồng ý. Giá và tồn kho bán thật phải do shop xác nhận. |
| Triển khai                | Chưa xác nhận trên máy chủ production: HTTPS, reverse proxy, `TRUST_PROXY`, worker/scheduler thường trực, sao lưu và phục hồi dữ liệu, tài khoản nhân viên bật 2FA. Xem [Đưa lên máy chủ](#đưa-lên-máy-chủ).            |
| MySQL (tạm hoãn)          | Có migration và lệnh nhập dữ liệu, chưa chạy trên MySQL thật. Chỉ xem lại khi cần chuyển môi trường; giữ SQLite cho local.                                                                                              |

### Chưa triển khai — chỉ bổ sung khi có nhu cầu

- **Đối soát ngân hàng tự động/webhook:** nhân viên vẫn xác nhận tiền và ghi nhận hoàn tiền bằng tay.
- **Kết nối hãng vận chuyển:** chưa tự tạo vận đơn hay đồng bộ trạng thái giao hàng.
- **Trả hàng sau khi giao, hoàn một phần, hoàn tiền COD:** chưa có quy trình; hoàn chuyển khoản hiện chỉ cho đơn chưa giao đi.
- **Lịch đan dây theo khung giờ/công suất, tồn kho dây:** thời điểm khách chọn chỉ là đề nghị; cửa hàng hẹn lại. Dây dịch vụ chưa được quản lý số lượng hay bán lẻ qua giỏ.
- **Chat đẩy thời gian thực, giao ticket thẳng cho người khác, đo thời gian phản hồi:** hiện dùng polling; trả ticket về hộp thư để người khác tự nhận.
- **Công cụ xử lý yêu cầu xóa thông tin trên đơn/yêu cầu đan dây:** xóa tài khoản không xóa thông tin đã lưu trên chứng từ; cần quy trình xử lý riêng.

### Giới hạn đã xác nhận

- Local có **572 đơn mẫu, chưa có đơn thật**. Không dùng đơn mẫu để chứng minh doanh thu, bán chạy hay gợi ý mua cùng của cửa hàng thật.
- Dữ liệu demo cũ có **12 nhóm SKU trùng khi bỏ qua hoa/thường**. Form sản phẩm chặn lưu bằng lỗi “Không được lặp mã hoặc biến thể”. Chưa dọn dữ liệu này; không tự xóa vì đơn mẫu còn tham chiếu SKU.
- Build Next.js thành công nhưng còn cảnh báo phát hiện nhiều lockfile và suy luận workspace root. Không phải lỗi build; chưa chỉnh cấu hình để bỏ cảnh báo.
- SQLite phù hợp để chạy local; chưa kiểm chứng khả năng chịu tải khi web và queue cùng ghi. Trước mở bán cần kiểm thử môi trường thật, không suy ra từ test bộ nhớ.

## Có gì

- **Trang giới thiệu:** vợt Hyper Core8000 bằng Three.js, sáu chương xoay và phóng theo cuộn, màn mở đầu “căng dây” chạy theo tiến độ tải mô hình thật, bản đọc tĩnh cho máy yếu hoặc khi tắt chuyển động.
- **Cửa hàng:** danh sách vợt có lọc theo hãng, lối chơi, mức giá và hàng còn; trang sản phẩm theo phiên bản; giỏ hàng; đặt hàng không cần tài khoản, trả tiền khi nhận (COD) hoặc chuyển khoản; gợi ý chọn vợt theo ngân sách, lối chơi, trình độ (theo quy tắc, không dùng AI).
- **Tài khoản:** khách xem đơn và yêu cầu đan dây của mình, lưu sản phẩm yêu thích, viết đánh giá cho sản phẩm đã nhận, sửa hồ sơ, đổi mật khẩu, bật/tắt email ưu đãi, xem lại các lần nhắn với cửa hàng, tự xóa tài khoản; đăng nhập có xác minh email, xác thực hai lớp và passkey.
- **Quản trị:** sản phẩm, tồn kho, đơn hàng, yêu cầu đan dây, khách hàng (hồ sơ từng khách: số liệu, đơn, dòng hoạt động, sản phẩm, đánh giá), duyệt đánh giá, báo cáo doanh số và lãi gộp kèm phễu từ xem tới đặt hàng, nhóm khách, mã giảm giá, cách thanh toán, đan dây và chat hỗ trợ, cài đặt phí giao và liên hệ, xuất đơn ra CSV, trả lời chat hỗ trợ.
- **Hành vi khách hàng:** cửa hàng tự ghi các sự kiện mua sắm (xem, tìm, thêm giỏ, đặt đơn…) vào database của mình; Microsoft Clarity là tùy chọn, chỉ chạy khi có project ID và khách đồng ý.
- **Nhóm khách và mã giảm giá:** mỗi khách được xếp vào một nhóm (Mới, Tiềm năng, Đang mua, VIP, Không hoạt động, Đã mất) theo ngưỡng chủ shop đặt; mã giảm giá cho mọi khách, cho riêng một khách hoặc cho một nhóm, có hạn dùng, giới hạn lượt và điều kiện đơn.
- **Email:** chào mừng, xác minh/đặt lại mật khẩu, cập nhật đơn và mã riêng qua queue; nhật ký ở `/admin/emails`. Bốn automation (nhắc giỏ, mời quay lại, mời đánh giá, quà VIP) mặc định tắt, chỉ gửi marketing cho khách đã đồng ý và xác minh email. Resend gọi HTTP, không cần thêm package PHP; local chỉ ghi log.
- **Chat hỗ trợ:** trợ lý tự động trả lời câu hỏi thường gặp (theo từ khóa, không dùng AI) và chuyển cho nhân viên khi cần. Nhân viên thấy khách là ai, đơn và sản phẩm của họ ngay cạnh cuộc trò chuyện. Mỗi cuộc trò chuyện đi qua bốn trạng thái: chờ shop, chờ khách, đã giải quyết, đã đóng. Khách có tài khoản xem lại ở trang tài khoản; khách vãng lai xem lại bằng một mã lấy khi cuộc trò chuyện kết thúc.
- **Chuyển khoản ngân hàng:** chủ shop nhập tài khoản nhận tiền ở Cài đặt và bật lên; chưa bật thì cửa hàng chỉ nhận COD. Khách chọn chuyển khoản lúc đặt, trang đơn hàng hiện số tài khoản, số tiền, nội dung chuyển khoản và mã QR (VietQR). Cửa hàng kiểm tra tài khoản rồi bấm xác nhận ở trang đơn; đơn chưa được xác nhận trong thời hạn giữ hàng (mặc định 24 giờ) tự hủy và hoàn tồn kho. Đơn đã thanh toán chỉ hủy được bằng cách ghi nhận đã hoàn tiền.
- **SEO:** mỗi trang công khai (trang giới thiệu, danh sách vợt, từng cây vợt, gợi ý chọn vợt, đan dây) có tiêu đề, mô tả, địa chỉ canonical, thẻ Open Graph và dữ liệu có cấu trúc (schema.org) ngay trong HTML máy chủ trả về; có `sitemap.xml` và `robots.txt`. Giỏ hàng, đơn hàng, tài khoản và trang quản trị không cho lập chỉ mục. Sản phẩm mẫu không vào sitemap và không được mô tả là hàng đang bán.
- **Dịch vụ đan dây:** khách gửi yêu cầu ở `/services` (vợt, dây của cửa hàng hoặc dây tự mang, mức căng, lúc định mang vợt tới), không cần tài khoản và không trả tiền online. Cửa hàng xử lý ở `/admin/service-orders`: hẹn, nhận vợt, đan, báo khách tới lấy, thu tiền tại quầy. Danh sách dây và giá do chủ shop nhập; phí công đan và công tắc nhận yêu cầu ở Cài đặt.
- **Ba vai trò nhân viên:** quản trị viên dùng toàn bộ `/admin`; nhân viên bán hàng làm việc hằng ngày (đơn, kho, khách hàng, chat) nhưng không mở được Cài đặt, Báo cáo, xuất CSV và không thấy số tiền ở Tổng quan; nhân viên hỗ trợ chỉ vào được Chat hỗ trợ. Quản trị viên cấp, đổi và gỡ vai trò ở `/admin/staff`, sau khi nhập lại mật khẩu.
- **Chính sách quyền riêng tư:** trang `/privacy` nói cửa hàng ghi lại gì về khách, dùng vào việc gì, giữ bao lâu và khách làm được gì, viết theo đúng những gì hệ thống đang làm. Nó là bản nháp chỉ quản trị viên mở được, cho tới khi chủ shop đọc và bật “Công bố chính sách quyền riêng tư” ở Cài đặt.
- **Nhập hàng:** từ CSV UTF-8 kèm ZIP ảnh, có xem trước và khớp theo SKU; file Excel phải lưu thành CSV trước, chưa nhận trực tiếp `.xlsx`/`.xls`. Đồng bộ danh mục vợt từ shopvnb.com (đã được cho phép) bằng `scripts/vnb-catalog.mjs`.
- **Chưa có:** cổng thanh toán tự đối soát (tiền chuyển khoản do cửa hàng tự kiểm tra và xác nhận), kết nối hãng vận chuyển.

## Hai phần của project

| Phần    | Thư mục     | Cổng local | Việc                                                                        |
| ------- | ----------- | ---------- | --------------------------------------------------------------------------- |
| Laravel | thư mục gốc | 8000       | Route, phiên đăng nhập, phân quyền, dữ liệu, email, lệnh nhập hàng          |
| Next.js | `frontend/` | 3000       | Mọi thứ khách và quản trị viên nhìn thấy; hỏi Laravel dữ liệu cho mỗi trang |

Trình duyệt chỉ mở địa chỉ của Next.js. Với mỗi trang, Next.js hỏi Laravel đúng đường dẫn đó và nhận về tên trang kèm dữ liệu; form, giỏ hàng và đăng nhập gửi qua `/api/...` của Next.js rồi mới tới Laravel. Vì vậy controller ở Laravel vẫn viết như thường (`Inertia::render('shop/products', [...])`), còn phần hiển thị nằm ở `frontend/src/views`. Mở thẳng cổng 8000 chỉ thấy một dòng chỉ sang địa chỉ giao diện. Chi tiết: [frontend/README.md](frontend/README.md).

Database local là SQLite (`database/database.sqlite`); session, cache và queue cũng dùng database, không cần Redis. Giữ SQLite cho local; hướng dẫn MySQL bên dưới chỉ dùng khi có nhu cầu chuyển.

## Chạy local

Cần PHP 8.3 trở lên (khuyến nghị 8.4) có `pdo_sqlite`, `mbstring`, `fileinfo`, `curl`, `zip`, `intl`, `gd`; Node.js 22. Composer cần khi cài mới hoặc cập nhật dependency PHP. Máy local hiện chưa có Composer, nhưng đã có `vendor/` nên vẫn chạy được các lệnh PHP dưới đây; không cần cài MySQL/Redis.

Cài lần đầu trên máy có Composer (không chạy lại hoặc ghi đè `.env` của checkout đã cấu hình):

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

Lệnh này mở Laravel ở cổng 8000, hàng đợi và Next.js ở cổng 3000 trong cùng một cửa sổ. Mở **http://localhost:3000**. Cửa hàng ở `/products`, gợi ý chọn vợt ở `/advisor`, quản trị ở `/admin`. **Scheduler chạy riêng:** mở terminal khác và chạy `php artisan schedule:work` nếu cần xếp nhóm, hủy đơn quá hạn, dọn dữ liệu hoặc automation.

Muốn chạy riêng từng phần thì dùng `php artisan serve` và `npm run dev`; thêm `php artisan queue:work` để gửi email và `php artisan schedule:work` cho các việc định kỳ. Trên Windows có sẵn `scripts/start-local.ps1`, kiểm tra `.env`, các gói đã cài và hai cổng rồi mới chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Chạy bản production trên máy (build giao diện, `php artisan optimize`, rồi Laravel, Next.js, hàng đợi và lịch trong cùng một cửa sổ; `Ctrl+C` tắt tất cả). Thêm `-SkipBuild` để dùng lại bản build trước khi `frontend/` không đổi; sửa `.env` thì chạy `php artisan optimize:clear` rồi chạy lại:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-production.ps1
```

### Dữ liệu và tài khoản để thử

```sh
php artisan db:seed --class=DemoCatalogSeeder   # sản phẩm minh họa, chỉ dùng ở local
php artisan shop:demo-sales                     # một năm đơn mẫu có nhãn, để xem báo cáo
```

Khi `APP_ENV=local`, trang đăng nhập tự tạo bốn tài khoản và có nút đăng nhập một lần bấm: `admin@test.local` (quản trị), `nhanvien@test.local` (nhân viên bán hàng), `hotro@test.local` (nhân viên hỗ trợ) và `khach@test.local` (khách), mật khẩu `Test-Cau-Long-2026!`. Mỗi lần mở trang đăng nhập, bốn tài khoản này được đặt lại đúng vai trò và mật khẩu đó. Xóa bốn tài khoản này trước khi dùng database đó cho hàng thật.

Tài khoản quản trị thật: đăng ký ở `/register`, xác minh email (ở local thư nằm trong `storage/logs/laravel.log` sau khi queue worker xử lý), rồi chạy `php artisan shop:make-admin email-cua-ban`. Từ đó quản trị viên cấp vai trò cho người khác ở `/admin/staff` (người được thêm phải tự đăng ký và xác minh email trước); lệnh trên cũng nhận `--role=staff` (nhân viên bán hàng) và `--role=support` (nhân viên hỗ trợ).

## Lệnh thường dùng

| Lệnh                                  | Việc                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `php artisan dev`                     | Chạy Laravel, hàng đợi và Next.js                                                                                                              |
| `npm run build` rồi `npm run start`   | Build và chạy bản production của giao diện                                                                                                     |
| `npm run check` / `npm run check:fix` | Kiểm tra / tự sửa định dạng và lint cho TypeScript, script, tài liệu                                                                           |
| `npm run types:check`                 | Kiểm tra kiểu TypeScript của giao diện                                                                                                         |
| `npm run routes`                      | Sinh lại `frontend/src/actions`, `routes`, `wayfinder` từ route của Laravel                                                                    |
| `php artisan test --compact`          | Chạy test của Laravel                                                                                                                          |
| `php artisan queue:work`              | Xử lý email đã xếp hàng; local ghi vào log, Resend gửi thật khi cấu hình                                                                       |
| `php artisan schedule:work`           | Chạy marketing, xếp nhóm khách, hủy đơn chuyển khoản quá hạn, đóng cuộc trò chuyện đã giải quyết, xóa sự kiện và nhật ký email cũ hơn 365 ngày |
| `php artisan shop:make-admin email`   | Cấp quyền quản trị cho một tài khoản đã xác minh; `--role=staff` cho nhân viên bán hàng, `--role=support` cho nhân viên hỗ trợ                 |
| `php artisan marketing:run`           | Chạy các automation đang bật; có thể thêm `abandoned_cart`, `winback`, `post_purchase` hoặc `vip`                                              |
| `php artisan crm:segment`             | Xếp lại nhóm cho mọi khách hàng ngay (bình thường chạy theo lịch mỗi ngày)                                                                     |
| `php artisan shop:import-catalog`     | Nhập sản phẩm, giá, tồn kho, ảnh từ CSV                                                                                                        |
| `node scripts/vnb-catalog.mjs`        | Đọc danh mục vợt từ shopvnb.com thành CSV để nhập                                                                                              |

Sau khi thêm hoặc đổi route ở Laravel, chạy `npm run routes` để giao diện có hàm gọi route mới.

## Kiểm tra

Chạy từ thư mục gốc. Kết quả kiểm tra ngày **2026-10-12**:

| Kiểm tra                                                                      | Kết quả                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Laravel/PHPUnit                                                               | **282/282 test đạt**, 4.788 assertions; database SQLite trong bộ nhớ, không phải MySQL.                |
| PHPStan, Pint                                                                 | Đạt.                                                                                                   |
| `npm run check`, `npm run types:check`                                        | Đạt.                                                                                                   |
| `npm run build`                                                               | Đạt; còn cảnh báo workspace root/lockfile đã ghi ở trên.                                               |
| Tool VNB và ba bài kiểm tra mô hình/dây vợt bên dưới                          | Đạt; không tải dữ liệu VNB mới.                                                                        |
| Kiểm tra trình duyệt end-to-end                                               | Chưa chạy lại trong lần rà soát này; xem kết quả các phase trước trong kế hoạch.                       |
| Resend thật, Clarity thật, quét QR bằng ngân hàng, Google Rich Results, MySQL | Chưa kiểm chứng thực tế; không được coi kết quả test local là bằng chứng đã hoạt động trên production. |

```sh
npm run check
npm run types:check
php vendor/bin/pint --test
php -d memory_limit=512M vendor/bin/phpstan analyse --no-progress
php artisan test --compact
npm run build
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

Địa chỉ mặc định là `http://localhost:3000`; đổi bằng biến `LANDING_URL`. **`commerce-browser` tạo một đơn hàng mẫu trong database đang dùng**: chỉ chạy với database thử, sao lưu trước và dọn đúng dữ liệu thử sau khi kiểm tra; không chạy trên dữ liệu khách thật.

## Nhập hàng và dữ liệu VNB

Quản trị viên nhập hàng ở `/admin/imports` hoặc bằng lệnh:

```sh
php artisan shop:import-catalog hang.csv --images=thu-muc-anh --dry-run   # chỉ kiểm tra
php artisan shop:import-catalog hang.csv --images=thu-muc-anh            # nhập, sản phẩm mới ở trạng thái ẩn
```

Định dạng file, cách khớp SKU, cách đọc danh mục VNB và những điều cần làm trước khi mở bán thật: [COMMERCE.md](COMMERCE.md).

## Chuyển sang MySQL

**Tạm hoãn theo lựa chọn giữ SQLite cho local.** Hướng dẫn này dành cho lần chuyển sau, chưa được kiểm thử trên MySQL thật.

Trước khi chuyển, dừng nhận đơn và các tiến trình ghi dữ liệu, xử lý hết email đang chờ, sao lưu database SQLite và ảnh trong `storage/app/public`. Lệnh nhập không chép phiên, cache, queue hoặc job lỗi, nên email đang chờ sẽ không đi theo.

Để chuyển sang MySQL mà giữ nguyên dữ liệu nghiệp vụ:

1. Cài MySQL 8 và bật `extension=pdo_mysql` trong `php.ini`.
2. Tạo database trống: `CREATE DATABASE caulong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Trong `.env`: `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE=caulong`, `DB_USERNAME=...`, `DB_PASSWORD=...`.
4. Chạy:

```sh
php artisan migrate
php artisan shop:import-sqlite        # chép mọi bảng từ database/database.sqlite, giữ nguyên id
```

Lệnh chép chỉ chạy khi các bảng nghiệp vụ ở database mới còn trống; mọi người phải đăng nhập lại. File SQLite nguồn không bị sửa. Muốn quay lại thì đổi `DB_CONNECTION=sqlite`, xóa hoặc sửa các biến `DB_DATABASE`/`DB_URL` của MySQL, trỏ tới đúng file SQLite rồi chạy `php artisan config:clear` và khởi động lại worker. **Đổi cấu hình không đồng bộ những đơn đã phát sinh trên MySQL về SQLite**; không dùng bản cũ để khôi phục sau khi đã mở nhận đơn mới nếu chưa có kế hoạch chuyển dữ liệu ngược.

Test luôn chạy trên SQLite trong bộ nhớ. Lệnh chép mới được thử từ SQLite sang SQLite, chưa chạy trên MySQL thật. So sánh số dòng, giá/tồn kho và luồng đặt hàng trên database mới trước khi mở nhận đơn.

## Đưa lên máy chủ

- **Laravel:** `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, database, hàng đợi và cache của production. Không chạy seeder demo.
- **Địa chỉ:** `APP_URL` và `FRONTEND_URL` là địa chỉ công khai của shop (app Next.js), vì đường dẫn ảnh, liên kết trong email, địa chỉ canonical và sitemap dựng từ đó.
- **Công cụ tìm kiếm:** chỉ khi `APP_ENV=production` thì các trang công khai mới cho lập chỉ mục và `robots.txt` mới mở; ở mọi môi trường khác `robots.txt` chặn toàn bộ và mọi trang có `noindex` (đặt `SHOP_SEO_INDEX=true` hoặc `false` để quyết định thay). Sau khi lên trang thật, khai báo `https://ten-mien/sitemap.xml` trong Google Search Console.
- **Next.js:** `npm run build` rồi `npm run start`, với `LARAVEL_URL` trong `frontend/.env.local` trỏ tới Laravel. Laravel chỉ cần Next.js gọi tới được, không cần mở ra Internet.
- **Proxy:** Laravel hiện chỉ tin header chuyển tiếp từ `127.0.0.1` (`bootstrap/app.php`). Nếu Next.js chạy ở máy khác, thêm địa chỉ máy đó.
- **`TRUST_PROXY` (quan trọng):** để trống khi trình duyệt nối thẳng tới Next.js. Chỉ đặt `TRUST_PROXY=1` trong `frontend/.env.local` khi Next.js đứng sau một reverse proxy (Nginx, Caddy, Cloudflare) **tự ghi đè** `X-Forwarded-For`, `X-Forwarded-Host` và `X-Forwarded-Proto` của khách. Đặt mà không có proxy như vậy thì ai cũng tự khai được địa chỉ IP và vượt giới hạn thử mật khẩu; để trống khi có proxy thì mọi khách chưa đăng nhập dùng chung một hạn mức. Không mở cổng của Next.js và của Laravel ra Internet.
- **Hiệu năng:** chạy `php artisan optimize` sau mỗi lần triển khai (gộp cấu hình, route, view), bật OPcache, và để web server trả thẳng thư mục `/storage` (ảnh sản phẩm) thay vì qua PHP.
- **Email:** đặt `MAIL_MAILER=resend`, `RESEND_API_KEY`, `MAIL_FROM_ADDRESS` thuộc domain đã xác minh trên Resend và `MAIL_FROM_NAME` trong `.env`; giữ `php artisan queue:work` chạy dưới process manager. `MAIL_MAILER=log` chỉ ghi file, không chứng minh email đã tới hộp thư. Transport HTTP đã kiểm thử bằng API giả; cần kiểm tra gửi thật trước khi mở bán.
- **Việc định kỳ:** thêm cron chạy `php artisan schedule:run` mỗi phút (hoặc giữ `php artisan schedule:work` chạy). Bật từng automation ở `/admin/settings`; lịch marketing dùng giờ Việt Nam. Giữ các tùy chọn tắt khi chưa có chính sách và cấu hình gửi thật.
- **Chính sách quyền riêng tư:** đăng nhập bằng tài khoản quản trị, đọc `/privacy`, rồi bật “Công bố chính sách quyền riêng tư” ở `/admin/settings` (cần có hotline hoặc email liên hệ). Trang tự nói theo cấu hình đang chạy (chuyển khoản, đan dây, Resend, Clarity), nên đọc lại sau khi đổi các thứ đó. Câu chữ nằm ở `frontend/src/views/shop/privacy.tsx`; sửa câu chữ thì đổi ngày ở `config/shop.php` (`privacy.updated`). Đây là bản mô tả hệ thống, không phải tư vấn pháp lý.
- **Clarity (tùy chọn):** đặt `NEXT_PUBLIC_CLARITY_ID` trong `frontend/.env.local` trước khi build. Công bố trang chính sách quyền riêng tư trước khi bật: lời hỏi đồng ý sẽ dẫn tới trang đó.
- **Tài khoản nhân viên:** bật xác thực hai lớp cho mọi tài khoản nhân viên ở `/settings/security` (màn Nhân viên cho thấy ai chưa bật).
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
