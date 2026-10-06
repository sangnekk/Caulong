# Shop Cầu Lông — chức năng bán hàng

## Phạm vi đợt này

- Danh mục, thương hiệu, sản phẩm và từng phiên bản hàng (mã hàng, giá, số lượng).
- Trang cửa hàng, lọc/tìm, chi tiết, giỏ, đặt hàng không cần tài khoản, COD.
- Admin quản lý sản phẩm, ảnh, số lượng và đơn; phân quyền server.
- Gợi ý theo ngân sách/lối chơi/trình độ từ catalog, **không phải AI**.
- Theo lựa chọn người dùng: chưa tích hợp thanh toán online hoặc nhà cung cấp AI.

## Dữ liệu local

Chưa có catalog thực do chủ shop cung cấp. Chạy `php artisan migrate`, sau đó chỉ tại local/testing: `php artisan db:seed --class=DemoCatalogSeeder`. Không chạy seeder minh họa khi mở bán thật.

## Nhập hàng thật

Admin → **Nhập hàng** (`/admin/imports`): tải file mẫu, điền hàng của shop, chọn file CSV UTF-8 (Excel: Lưu thành → CSV UTF-8) và tùy chọn tệp ZIP ảnh, bấm **Kiểm tra file**. Trang xem trước liệt kê sản phẩm/SKU mới, giá và tồn kho cũ → mới, lỗi theo số dòng; chưa ghi gì cho đến khi bấm **Nhập vào cửa hàng**.

- Mỗi dòng là một SKU; các dòng cùng tên (hoặc cùng `duong_dan`) là một sản phẩm. Cột bắt buộc: `ten_san_pham`, `sku`, `gia`, `ton_kho`; sản phẩm mới cần thêm `mo_ta` và `loi_choi`. Tiêu đề cột có thể viết có dấu (“Tên sản phẩm”, “Giá bán”…). Giá nhận `1290000`, `1.290.000`, `1.290.000 đ`; không đoán số lẻ.
- Khớp SKU không phân biệt hoa thường: nhập lại cùng file không tạo trùng; ô trống giữ giá trị cũ; sản phẩm không có trong file không bị đụng tới; không xóa gì.
- Sản phẩm mới mặc định **ẩn** để kiểm tra, trừ khi chọn “Mở bán ngay”. Không ghi đè sản phẩm demo; SKU đang thuộc sản phẩm khác bị báo lỗi.
- Tồn kho: nếu có đơn mới hoặc ai đó sửa sản phẩm sau lúc xem trước, lệnh nhập bị từ chối để không ghi đè số lượng mới hơn; xem trước lại rồi nhập. Nên nhập tồn kho lúc tạm ngưng nhận đơn, hoặc bỏ chọn “Cập nhật tồn kho”.
- Ảnh: tên trong cột `anh` khớp tên tệp trong ZIP (bỏ qua thư mục); chỉ JPEG/PNG/WebP thật, tối đa 5 MB/ảnh, 500 ảnh/lần. Ảnh trùng lần nhập trước không chép lại. Giới hạn tải lên theo PHP (`upload_max_filesize`, `post_max_size`; máy local hiện 2 MB). Bộ ảnh lớn dùng lệnh:

```sh
php artisan shop:import-catalog hang.csv --images=thu-muc-anh --dry-run   # chỉ kiểm tra
php artisan shop:import-catalog hang.csv --images=thu-muc-anh            # nhập, sản phẩm mới ẩn
php artisan shop:import-catalog hang.csv --publish --retire-demo         # mở bán ngay và ẩn demo
php artisan shop:import-catalog hang.csv --drop-missing --dry-run        # xem SKU nào sẽ bị bỏ
```

`--drop-missing` (chỉ có ở lệnh, không có trên trang admin) dành cho file liệt kê **đủ mọi SKU** của từng sản phẩm trong file: SKU của các sản phẩm đó mà file không còn nhắc tới sẽ bị xóa; SKU đã có đơn hoặc còn tồn kho thì chỉ bị ẩn, giữ nguyên số lượng. Sản phẩm không có trong file không bị đụng tới. Đừng dùng với file chỉ cập nhật vài SKU.

Khi hàng thật đã sẵn sàng: nút **Ẩn sản phẩm demo** ở trang Nhập hàng (hoặc `--retire-demo`) ẩn toàn bộ sản phẩm demo; không xóa vì đơn demo cũ còn tham chiếu.

**Mở bán hàng loạt:** nút **Mở bán N sản phẩm có tồn kho** (hoặc `php artisan shop:publish-stocked`) chỉ bật sản phẩm thật đang ẩn có ít nhất một phiên bản đang bán còn hàng. Sản phẩm chưa có số lượng thật vẫn ẩn, nên không có món nào hiện “còn hàng” mà không có hàng.

## Dữ liệu vợt từ VNB (đã được VNB cho phép)

`scripts/vnb-catalog.mjs` đọc danh mục vợt cầu lông theo từng hãng trên shopvnb.com (tên, mô tả, thông số, phiên bản, giá, ảnh chính) và ghi CSV đúng định dạng nhập hàng. Chạy lần lượt từng request, có nghỉ giữa các lần, không gọi `/ajax/` (robots.txt), lưu cache từng sản phẩm để chạy lại chỉ lấy phần mới (`--refresh` để đọc lại hết).

```sh
node scripts/vnb-catalog.mjs                      # → storage/app/private/vnb (không commit)
php artisan shop:import-catalog storage/app/private/vnb/vnb-vot-cau-long-01.csv --images=storage/app/private/vnb/anh --force
# lặp cho -02, -03…; mỗi file tối đa 1.800 dòng
# khi script đổi cách chia phiên bản (hoặc VNB bỏ bớt lựa chọn), thêm --keep-stock --drop-missing để bỏ SKU cũ
node tests/vnb-catalog.mjs                        # kiểm tra phần đọc trang và dựng dòng CSV, không cần mạng
```

Script gồm ba phần: `scripts/vnb/html.mjs` đọc HTML thành cây (không dùng thư viện ngoài), `scripts/vnb/product.mjs` đọc một trang sản phẩm thành dữ liệu thô lưu vào cache, `scripts/vnb/rows.mjs` suy ra mô tả, lối chơi và các dòng CSV từ cache. Sửa cách suy diễn vì vậy không phải tải lại trang.

- Tồn kho luôn là 0 và sản phẩm mới ở trạng thái ẩn: VNB không công bố số lượng, shop tự nhập (file có cột `ton_kho` khớp SKU, hoặc sửa từng sản phẩm), rồi **Mở bán sản phẩm có tồn kho**.
- Cập nhật giá sau này: chạy lại script rồi nhập với `--keep-stock` để không ghi đè số lượng shop đã nhập.
- Cache mỗi sản phẩm (`products/*.json`) ghi đúng những gì trang nêu: tên, mã, hãng, tình trạng còn/hết hàng, giá bán và giá niêm yết, mọi ảnh trong gallery, mọi nhóm tùy chọn (phiên bản, màu kèm ảnh, giá từng lựa chọn), các size và size nào đang hết, bảng thông số, các dòng của bài mô tả. CSV hiện chỉ dùng một phần (importer nhận một ảnh và một nhóm phiên bản cho mỗi sản phẩm); phần còn lại để sẵn cho sau này.
- Trang gộp nhiều sản phẩm có các nhóm lựa chọn: **phiên bản** (có/không bảo hành, thường khác giá), **màu** và size. Giá của từng tổ hợp chỉ có qua `/ajax/` nên không đọc, vì vậy chỉ một nhóm thành SKU của shop: nhóm **màu**, tên ghép với phiên bản khi trang chỉ có một phiên bản (vd. “Hồng Tím - Có bảo hành”, giống cách VNB đặt tên). Riêng trang cho chọn giữa nhiều phiên bản thì phiên bản là SKU (chúng mang chênh lệch giá) và màu không được tách; script in số trang như vậy khi chạy xong. Lựa chọn trang ghi giá 0 thì bỏ. Size chỉ ghi trong thông số trọng lượng.
- SKU: sản phẩm một phiên bản dùng mã VNB (vd. `vnb029165`). Trang gộp dùng `{mã trang}-{mã lựa chọn}` (vd. `vnb030143-7314`): mã trang và mã lựa chọn không đổi giữa các lần chạy. Bản script đầu tiên ghép SKU từ `id` trong form của trang, tức sản phẩm con trang đang chọn sẵn, mà VNB có thể đổi bất cứ lúc nào; các SKU đã tạo kiểu đó được ghi lại trong cache (`skus`) và giữ nguyên khi đọc lại trang, để SKU đã nhập vào shop vẫn khớp. Vì vậy **đừng xóa thư mục cache `products/`** nếu shop đã nhập hàng từ đó: mất cache thì các SKU kiểu cũ đổi sang kiểu mới và lần nhập sau phải dùng `--drop-missing` để bỏ bản cũ.
- Bài mô tả được đọc thành từng dòng chữ như người xem thấy: thẻ trong dòng (in đậm, liên kết, `span`) không tách chữ, chú thích ảnh căn giữa và nút “Xem thêm” bị bỏ. Tiêu đề mục là các dòng đánh số (“1. Giới thiệu…”, “2. Thông số…”); thẻ tiêu đề HTML không dùng được vì nhiều trang đặt cả nội dung trong thẻ đó. Mô tả là mục 1; trang không đánh số thì lấy mọi dòng. Dòng “Thông số : giá trị” bổ sung cho bảng thông số, bảng được ưu tiên. Chữ có dấu viết bằng mã HTML (`C&acirc;n`) được ghép lại thành chữ thường.
- Cache của bản script trước vẫn đọc được; riêng các trang có cả nhóm phiên bản lẫn màu được tự đọc lại một lần vì bản trước chỉ lưu nhóm đầu. Muốn mô tả sạch hơn (bản trước chèn dấu cách vào giữa chữ ở chỗ có thẻ, vd. “c ó”, “ShopVNB .”) và có đủ dữ liệu mới trong cache thì chạy một lần với `--refresh`.
- Lối chơi lấy từ trường “phong cách chơi” của VNB; thiếu thì suy từ điểm cân bằng: chữ “nặng đầu/nhẹ đầu/cân bằng” hoặc “head heavy/head light/even”, hoặc số mm trên khung 675 mm (từ 295 là nặng đầu, từ 285 trở xuống là nhẹ đầu, khoảng như 285-290 lấy giữa). Không có cả hai thì dùng lối chơi chính bài mô tả ghi (“phù hợp lối chơi công thủ toàn diện”), chỉ khi mọi câu như vậy thống nhất. Trình độ chỉ lấy từ thông số “trình độ chơi”, không đoán. Mô tả trống thì ghi lại chính bảng thông số, không viết thêm. Hãng “Không” lấy theo tên hãng xuất hiện trong tên vợt.
- Bỏ qua, ghi lý do trong `bo-qua.txt`: sản phẩm “liên hệ” (không có giá), combo kèm quà, món không phải vợt, và vợt không có bất kỳ thông tin lối chơi nào (không đoán). Shop có thể tự thêm các vợt này sau.
- Mã VNB trùng giữa hai trang: dùng mã trang (`vnb{id}`); cùng một trang xuất hiện hai lần thì chỉ giữ một.
- `--relist` đọc lại danh sách danh mục (mặc định dùng `links.json` đã lưu; `--refresh` cũng đọc lại danh sách); `--reverse` cho lượt chạy thứ hai đọc từ cuối danh sách để chạy song song trên cùng cache.

Chỉ nhập hàng, giá, tồn kho và ảnh shop có quyền dùng. Không lấy dữ liệu từ website cửa hàng khác: ảnh và mô tả của họ có bản quyền, còn giá/tồn kho của họ không phải của shop, đưa lên sẽ nhận đơn COD cho hàng shop không có.

## Tạo quản trị viên

Đăng ký tài khoản tại `/register`, xác minh email theo hướng dẫn gửi qua email (local dùng `MAIL_MAILER=log`: kiểm tra `storage/logs/laravel.log`), rồi chạy `php artisan shop:make-admin email-cua-ban` cho tài khoản hiện có. Không có mật khẩu hoặc tài khoản quản trị mặc định. Không cấp quyền qua form đăng ký. `/admin` của khách sẽ dẫn về đăng nhập; tài khoản thường bị từ chối.

**Tài khoản dùng thử (chỉ khi `APP_ENV=local`):** trang đăng nhập tự tạo và hiện `admin@test.local` (quản trị) và `khach@test.local` (khách), mật khẩu `Test-Cau-Long-2026!`, mỗi tài khoản có nút đăng nhập một lần bấm (`app/Support/LocalAccounts.php`). Ở production và khi chạy test không tạo, không hiện gì. Trước khi dùng database local làm dữ liệu thật, xóa hai tài khoản này.

Sau khi đăng nhập: quản trị viên vào `/admin`, khách vào **Tài khoản của tôi** (`/account`) hoặc quay lại trang đang mở dở (ví dụ thanh toán); khách không bao giờ bị đưa tới trang quản trị.

**Tài khoản của khách** (`/account`, giao diện cửa hàng): đơn hàng của tôi (trạng thái, sản phẩm, tổng tiền, xem chi tiết; chỉ đơn đặt khi đã đăng nhập), sửa họ tên/email (đổi email thì phải xác minh lại), đổi mật khẩu, đăng xuất. Header cửa hàng có nút Đăng nhập cho khách, menu tài khoản (tài khoản, đơn hàng, quản trị nếu là admin, đăng xuất) khi đã đăng nhập. Trang đơn chỉ ghi “Đặt hàng thành công” ngay sau khi đặt; mở lại từ tài khoản là “Đơn hàng XXXXXXXX”.

**Trang quản trị** (thanh bên, trên điện thoại là menu kéo ra; khối tài khoản và nút Đăng xuất ở cuối thanh bên): Tổng quan (việc cần xử lý kèm lối tắt, số liệu chỉ tính đơn/hàng thật, hàng sắp hết, đơn gần đây) · Đơn hàng (tab theo trạng thái có số đếm, tìm theo mã đơn/tên/số điện thoại, lọc đã thu/chưa thu; chi tiết có tiến trình, sao chép địa chỉ, gọi điện, đơn khác cùng số điện thoại) · Sản phẩm (tab đang bán/đang ẩn/mẫu, lọc tồn kho/hãng/lối chơi áp dụng ngay, tìm theo tên hoặc SKU, sắp xếp, ảnh nhỏ; “Hết hàng” chỉ báo đỏ với hàng đang bán; bấm vào giá hoặc tồn kho để **sửa nhanh** giá bán, giá nhập và tồn kho từng phiên bản ngay dưới dòng, có kiểm tra tồn kho vừa đổi do đơn mới) · Nhập hàng · Hãng & danh mục (số sản phẩm đang bán/tổng, thêm mới, đường dẫn tự gợi ý) · Khách hàng (tài khoản, số đơn, tiền COD đã thu, đơn gần nhất) · Báo cáo · Cài đặt. Sản phẩm có chọn nhiều dòng để mở bán, ẩn, đánh dấu/bỏ nổi bật cùng lúc (báo trước nếu mở bán hàng chưa có tồn kho); chọn cả trang rồi bấm “Chọn tất cả N sản phẩm khớp bộ lọc” để áp dụng cho mọi trang (hỏi xác nhận). Tổng quan có doanh số hôm nay/7 ngày, lãi gộp và tiền đã thu 7 ngày, việc “sản phẩm đang bán nhưng hết hàng”. Danh sách đơn ẩn đơn mẫu, bật “Hiện đơn mẫu” để xem. Đơn hàng có **Xuất CSV** theo bộ lọc đang xem (UTF-8 có BOM, mở thẳng bằng Excel; chỉ đơn thật). Ngôn ngữ mặc định `APP_LOCALE=vi` (thông báo lỗi, đăng nhập, đặt lại mật khẩu trong `lang/vi`); dự phòng `en` cho chuỗi của gói bên thứ ba.

**Báo cáo** (`/admin/reports`): chọn 7, 30, 90 ngày hoặc 12 tháng (theo tháng), so với kỳ liền trước cùng độ dài. _Doanh số_ = tổng tiền đơn đặt trong kỳ, không tính đơn hủy, tính vào ngày đặt; _Đã thu_ = tiền COD đã ghi nhận, tính vào ngày ghi nhận. Ngày tính theo giờ Việt Nam (`config/shop.php` → `timezone`), database lưu UTC. Có số đơn, giá trị trung bình, tỉ lệ hủy, khách đặt hàng (theo số điện thoại), biểu đồ theo ngày/tháng kèm bảng số liệu, 8 sản phẩm doanh số cao nhất, doanh số theo hãng và lối chơi, đơn theo trạng thái, kho hiện tại (giá trị tồn kho theo giá bán). Mặc định chỉ tính đơn thật; bật “Tính cả đơn mẫu” thì trang ghi rõ đó là dữ liệu thử. **Xuất đơn trong kỳ (CSV)** tải đúng các ngày đang xem. Đơn lưu thời điểm xác nhận, giao, hoàn tất, hủy, thu tiền (`confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at`, `paid_at`); đơn cũ trước khi có các cột này lấy tạm `updated_at`.

**Giá nhập và lãi gộp**: mỗi phiên bản có thể có giá nhập (`product_variants.cost_price`, không bắt buộc, chỉ admin thấy; nhập ở form sản phẩm, sửa nhanh trong danh sách, hoặc cột `gia_nhap` khi nhập file, để trống thì giữ giá đang lưu). Khi đặt hàng, mỗi dòng đơn lưu giá nhập lúc bán (`order_items.unit_cost`), nên đổi giá nhập sau này không làm sai lãi của đơn cũ. Báo cáo tính _lãi gộp_ = tiền hàng − giá nhập, chỉ trên các dòng có giá nhập, ghi rõ tính trên bao nhiêu phần trăm tiền hàng; không trừ phí giao hay chi phí vận hành. Giá trị tồn kho có thêm cột theo giá nhập.

**Dữ liệu mẫu cho báo cáo**: `php artisan shop:demo-sales` tạo khoảng một năm đơn mẫu cho các vợt demo (có giá nhập mẫu), tên “Khách mẫu …”, `is_demo`, ghi chú rõ là đơn mẫu; chỉ hiện trong báo cáo khi bật “Tính cả đơn mẫu”, không vào Tổng quan, không vào file CSV. Chạy lại thì thay bộ cũ (cùng kết quả); `php artisan shop:demo-sales --clear` xóa đúng các đơn do lệnh này tạo. Xóa trước khi dùng database làm dữ liệu thật.

**Máy local** (`APP_ENV=local`, `app/Support/DemoData.php`): Tổng quan, Báo cáo, Đơn hàng và Khách hàng tính sẵn dữ liệu mẫu, có thông báo vàng và công tắc để chỉ xem số liệu thật (`?demo=0`). `shop:demo-sales` còn tạo khoảng 40 tài khoản khách mẫu (`khach-mau-NNN@khach-mau.invalid`, tên miền dành riêng, mật khẩu ngẫu nhiên nên không đăng nhập được) gắn với đơn mẫu của họ; `--clear` xóa cả các tài khoản này. Production không đổi: mặc định chỉ số liệu thật, không tạo tài khoản mẫu.

**Cửa hàng**: hàng còn luôn đứng trước trong mọi cách sắp xếp; lọc theo hãng, lối chơi, mức giá (theo giá thấp nhất của các phiên bản đang bán), danh mục và “Chỉ hàng còn” áp dụng ngay, không cần nút; bộ lọc đang dùng hiện thành nhãn bấm để bỏ; 24 sản phẩm mỗi trang; cả thẻ sản phẩm bấm được. Trang sản phẩm có nút −/+ số lượng; hàng hết thì thay nút mua bằng gọi hotline (nếu đã cài) và lối tới vợt cùng lối chơi còn hàng.

**Cài đặt** (`/admin/settings`, bảng `settings`): phí giao hàng, mức miễn phí giao (0 = không miễn phí theo giá trị đơn; phí 0 = luôn miễn phí), số điện thoại và email liên hệ. Lưu xong áp dụng ngay cho giỏ và đơn mới; đơn đã đặt giữ số tiền cũ. Liên hệ hiện ở chân trang cửa hàng và trang đơn; giỏ hàng nhắc “Mua thêm … để được miễn phí giao hàng”. Chưa lưu gì thì dùng mặc định trong `config/shop.php`.

## Lưu ý triển khai thật

- Thay sản phẩm minh họa bằng giá/tồn kho/ảnh có quyền dùng của shop; bỏ nhãn minh họa chỉ khi dữ liệu thật đã xác minh.
- Tiền VND tính tại server; trừ tồn khi nhận đơn COD; hủy hợp lệ hoàn hàng đúng một lần.
- “Đã giao” khác “Đã thu tiền”; thu COD cần xác nhận đối soát.
- Khách vãng lai xem đơn trong phiên đã đặt; mất phiên không thể mở lại chỉ bằng mã đơn.
- Phí giao hàng là một mức cố định chỉnh ở Cài đặt, chưa kết nối hãng vận chuyển.
- Trước mở bán: chính sách giao/đổi/trả, liên hệ cửa hàng, bảo vệ dữ liệu cá nhân, nghĩa vụ website bán hàng và hóa đơn cần chủ shop xác nhận.
- Không lưu dữ liệu thẻ. Thêm cổng thanh toán/AI khi có yêu cầu và tài khoản dịch vụ.

## Vận hành

`php artisan storage:link` cho ảnh upload. Không public .env hoặc storage private. Backup DB trước nâng cấp; không chạy migrate:fresh trên dữ liệu thật.

`COMMERCE-CONTRACT.md` là giao diện dữ liệu giữa các phần, không phải chính sách khách hàng. `LANDING.md` mô tả landing; cửa hàng ở /products.
