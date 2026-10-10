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
- Ảnh: tên trong cột `anh` (ảnh chính) khớp tên tệp trong ZIP (bỏ qua thư mục); chỉ JPEG/PNG/WebP thật, tối đa 5 MB/ảnh, 500 ảnh/lần. Ảnh trùng lần nhập trước không chép lại. Cột `anh_phu` ghi các ảnh khác của sản phẩm, cách nhau bằng dấu `|` (vd. `tc300-2.jpg | tc300-3.jpg`), tối đa 12 ảnh: có ghi thì bộ ảnh phụ đang lưu được thay bằng đúng danh sách này (ảnh đã có giữ nguyên tệp, ảnh bị bỏ thì xóa tệp), để trống thì giữ nguyên; ảnh trùng ảnh chính bị bỏ qua. Giới hạn tải lên theo PHP (`upload_max_filesize`, `post_max_size`; máy local hiện 2 MB). Bộ ảnh lớn dùng lệnh ở dưới.
- Giá niêm yết: cột `gia_goc` (không bắt buộc) là giá gạch ngang cạnh giá bán của SKU đó. Phải cao hơn `gia`, nếu không dòng bị báo lỗi; để trống thì giữ giá niêm yết đang lưu. Cửa hàng chỉ hiện giá niêm yết khi nó cao hơn giá bán hiện tại, nên đổi giá bán lên bằng hoặc hơn giá niêm yết thì dấu giảm giá tự mất.

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

`scripts/vnb-catalog.mjs` đọc danh mục vợt cầu lông theo từng hãng trên shopvnb.com (tên, mô tả, thông số, phiên bản, giá bán, giá niêm yết, ảnh chính và ảnh phụ) và ghi CSV đúng định dạng nhập hàng. Chạy lần lượt từng request, có nghỉ giữa các lần, không gọi `/ajax/` (robots.txt), lưu cache từng sản phẩm để chạy lại chỉ lấy phần mới (`--refresh` để đọc lại hết; `--upgrade` chỉ đọc lại các trang được lưu trước khi script biết lấy ảnh phụ và giá niêm yết).

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
- Cache mỗi sản phẩm (`products/*.json`) ghi đúng những gì trang nêu: tên, mã, hãng, tình trạng còn/hết hàng, giá bán và giá niêm yết, mọi ảnh trong gallery, mọi nhóm tùy chọn (phiên bản, màu kèm ảnh, giá từng lựa chọn), các size và size nào đang hết, bảng thông số, các dòng của bài mô tả. CSV dùng một phần: một nhóm phiên bản cho mỗi sản phẩm, ảnh chính (`anh`), tối đa 8 ảnh phụ (`anh_phu`, tệp đặt tên `{đường-dẫn}_2.webp`, `_3`…; dấu gạch dưới không có trong địa chỉ nào của VNB nên không trùng sản phẩm khác) và giá niêm yết (`gia_goc`).
- Giá niêm yết của VNB là của sản phẩm trang đang chọn sẵn, nên chỉ ghi cho đúng SKU đó (cùng giá với trang) và chỉ khi cao hơn giá bán. Các trang được đọc bằng bản script trước chưa có ảnh phụ và giá niêm yết trong cache: lần chạy thường không đọc lại chúng, chạy `node scripts/vnb-catalog.mjs --upgrade` một lần để lấy (đọc lại khoảng 2.400 trang và tải thêm vài nghìn ảnh, mất khoảng 2–3 giờ), rồi nhập lại với `--keep-stock`.
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

Đăng ký tài khoản tại `/register`, xác minh email theo hướng dẫn gửi qua email (local dùng `MAIL_MAILER=log`: thư nằm trong `storage/logs/laravel.log` sau khi `php artisan queue:work` xử lý; `php artisan dev` đã chạy sẵn việc này), rồi chạy `php artisan shop:make-admin email-cua-ban` cho tài khoản hiện có. Không có mật khẩu hoặc tài khoản quản trị mặc định. Không cấp quyền qua form đăng ký. `/admin` của khách sẽ dẫn về đăng nhập; tài khoản thường bị từ chối.

**Hai vai trò nhân viên** (cột `users.role`, cổng `manage-shop` trong `AppServiceProvider`): _quản trị viên_ (`admin`) dùng toàn bộ `/admin`; _nhân viên hỗ trợ_ (`support`, cấp bằng `php artisan shop:make-admin email --role=support`) chỉ vào được Chat hỗ trợ. Quyền được kiểm tra ở máy chủ trên từng route: nhân viên hỗ trợ mở trang khác của `/admin` thì bị từ chối (403), menu của họ chỉ có Chat hỗ trợ, và bảng thông tin khách trong màn chat không dẫn sang các trang họ không mở được. Cả hai vai trò đều là tài khoản nhân viên (`users.is_admin`): không được tính là khách hàng, không có nhóm khách, không nhận email ưu đãi. Chưa có màn hình quản lý nhân viên: đổi vai trò bằng lệnh trên.

**Tài khoản dùng thử (chỉ khi `APP_ENV=local`):** trang đăng nhập tự tạo và hiện `admin@test.local` (quản trị), `hotro@test.local` (nhân viên hỗ trợ) và `khach@test.local` (khách), mật khẩu `Test-Cau-Long-2026!`, mỗi tài khoản có nút đăng nhập một lần bấm (`app/Support/LocalAccounts.php`). Ở production và khi chạy test không tạo, không hiện gì. Trước khi dùng database local làm dữ liệu thật, xóa ba tài khoản này.

Sau khi đăng nhập: quản trị viên vào `/admin`, nhân viên hỗ trợ vào `/admin/support-chat`, khách vào **Tài khoản của tôi** (`/account`) hoặc quay lại trang đang mở dở (ví dụ thanh toán); khách không bao giờ bị đưa tới trang quản trị.

**Tài khoản của khách** (`/account`, giao diện cửa hàng): đơn hàng của tôi (trạng thái, sản phẩm, tổng tiền, xem chi tiết; chỉ đơn đặt khi đã đăng nhập), yêu cầu đan dây của tôi (10 yêu cầu gần nhất gửi khi đã đăng nhập, kèm trạng thái và số tiền), mã giảm giá của tôi, sản phẩm yêu thích, sửa họ tên/email (đổi email thì phải xác minh lại), bật/tắt nhận email ưu đãi, lịch sử hỗ trợ (các cuộc trò chuyện với cửa hàng, mở ra đọc lại), đổi mật khẩu, đăng xuất. Header cửa hàng có nút Đăng nhập cho khách, menu tài khoản (tài khoản, đơn hàng, quản trị nếu là admin, đăng xuất) khi đã đăng nhập. Trang đơn chỉ ghi “Đặt hàng thành công” ngay sau khi đặt; mở lại từ tài khoản là “Đơn hàng XXXXXXXX”.

**Trang quản trị** (thanh bên, trên điện thoại là menu kéo ra; khối tài khoản và nút Đăng xuất ở cuối thanh bên): Tổng quan (việc cần xử lý kèm lối tắt, số liệu chỉ tính đơn/hàng thật, hàng sắp hết, đơn gần đây) · Đơn hàng (tab theo trạng thái có số đếm, tìm theo mã đơn/tên/số điện thoại, lọc đã thu/chưa thu; chi tiết có tiến trình, sao chép địa chỉ, gọi điện, đơn khác cùng số điện thoại) · Đan dây (yêu cầu đan dây theo trạng thái, menu có số yêu cầu đang chờ xác nhận; xem mục riêng bên dưới) · Sản phẩm (tab đang bán/đang ẩn/mẫu, lọc tồn kho/hãng/lối chơi áp dụng ngay, tìm theo tên hoặc SKU, sắp xếp, ảnh nhỏ; “Hết hàng” chỉ báo đỏ với hàng đang bán; bấm vào giá hoặc tồn kho để **sửa nhanh** giá bán, giá nhập và tồn kho từng phiên bản ngay dưới dòng, có kiểm tra tồn kho vừa đổi do đơn mới) · Nhập hàng · Hãng & danh mục (số sản phẩm đang bán/tổng, thêm mới, đường dẫn tự gợi ý) · Khách hàng (tài khoản, số đơn, tiền COD đã thu, đơn gần nhất) · Chat hỗ trợ (hộp thư ticket, xem mục riêng bên dưới) · Email đã gửi (nhật ký mọi email, lọc theo trạng thái, loại và người nhận) · Báo cáo · Cài đặt. Sản phẩm có chọn nhiều dòng để mở bán, ẩn, đánh dấu/bỏ nổi bật cùng lúc (báo trước nếu mở bán hàng chưa có tồn kho); chọn cả trang rồi bấm “Chọn tất cả N sản phẩm khớp bộ lọc” để áp dụng cho mọi trang (hỏi xác nhận). Tổng quan có doanh số hôm nay/7 ngày, lãi gộp và tiền đã thu 7 ngày, việc “sản phẩm đang bán nhưng hết hàng”. Danh sách đơn ẩn đơn mẫu, bật “Hiện đơn mẫu” để xem. Đơn hàng có **Xuất CSV** theo bộ lọc đang xem (UTF-8 có BOM, mở thẳng bằng Excel; chỉ đơn thật). Ngôn ngữ mặc định `APP_LOCALE=vi` (thông báo lỗi, đăng nhập, đặt lại mật khẩu trong `lang/vi`); dự phòng `en` cho chuỗi của gói bên thứ ba.

**Báo cáo** (`/admin/reports`): chọn 7, 30, 90 ngày hoặc 12 tháng (theo tháng), so với kỳ liền trước cùng độ dài. _Doanh số_ = tổng tiền đơn đặt trong kỳ, không tính đơn hủy, tính vào ngày đặt; _Đã thu_ = tiền COD đã ghi nhận, tính vào ngày ghi nhận. Ngày tính theo giờ Việt Nam (`config/shop.php` → `timezone`), database lưu UTC. Có số đơn, giá trị trung bình, tỉ lệ hủy, khách đặt hàng (theo số điện thoại), biểu đồ theo ngày/tháng kèm bảng số liệu, 8 sản phẩm doanh số cao nhất, doanh số theo hãng và lối chơi, đơn theo trạng thái, kho hiện tại (giá trị tồn kho theo giá bán). Mặc định chỉ tính đơn thật; bật “Tính cả đơn mẫu” thì trang ghi rõ đó là dữ liệu thử. **Xuất đơn trong kỳ (CSV)** tải đúng các ngày đang xem. Đơn lưu thời điểm xác nhận, giao, hoàn tất, hủy, thu tiền (`confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at`, `paid_at`); đơn cũ trước khi có các cột này lấy tạm `updated_at`.

**Giá nhập và lãi gộp**: mỗi phiên bản có thể có giá nhập (`product_variants.cost_price`, không bắt buộc, chỉ admin thấy; nhập ở form sản phẩm, sửa nhanh trong danh sách, hoặc cột `gia_nhap` khi nhập file, để trống thì giữ giá đang lưu). Khi đặt hàng, mỗi dòng đơn lưu giá nhập lúc bán (`order_items.unit_cost`), nên đổi giá nhập sau này không làm sai lãi của đơn cũ. Báo cáo tính _lãi gộp_ = tiền hàng − giá nhập, chỉ trên các dòng có giá nhập, ghi rõ tính trên bao nhiêu phần trăm tiền hàng; không trừ phí giao hay chi phí vận hành. Giá trị tồn kho có thêm cột theo giá nhập.

**Dữ liệu mẫu cho báo cáo**: `php artisan shop:demo-sales` tạo khoảng một năm đơn mẫu cho các vợt demo (có giá nhập mẫu), tên “Khách mẫu …”, `is_demo`, ghi chú rõ là đơn mẫu; chỉ hiện trong báo cáo khi bật “Tính cả đơn mẫu”, không vào Tổng quan, không vào file CSV. Chạy lại thì thay bộ cũ (cùng kết quả); `php artisan shop:demo-sales --clear` xóa đúng các đơn do lệnh này tạo. Xóa trước khi dùng database làm dữ liệu thật.

**Máy local** (`APP_ENV=local`, `app/Support/DemoData.php`): Tổng quan, Báo cáo, Đơn hàng và Khách hàng tính sẵn dữ liệu mẫu, có thông báo vàng và công tắc để chỉ xem số liệu thật (`?demo=0`). `shop:demo-sales` còn tạo khoảng 40 tài khoản khách mẫu (`khach-mau-NNN@khach-mau.invalid`, tên miền dành riêng, mật khẩu ngẫu nhiên nên không đăng nhập được) gắn với đơn mẫu của họ; `--clear` xóa cả các tài khoản này. Production không đổi: mặc định chỉ số liệu thật, không tạo tài khoản mẫu.

**Cửa hàng**: hàng còn luôn đứng trước trong mọi cách sắp xếp; lọc theo hãng, lối chơi, mức giá (theo giá thấp nhất của các phiên bản đang bán), danh mục và “Chỉ hàng còn” áp dụng ngay, không cần nút; bộ lọc đang dùng hiện thành nhãn bấm để bỏ; 24 sản phẩm mỗi trang; cả thẻ sản phẩm bấm được. Trang sản phẩm có nút −/+ số lượng; hàng hết thì thay nút mua bằng gọi hotline (nếu đã cài) và lối tới vợt cùng lối chơi còn hàng.

**Trang sản phẩm**: ảnh chính và các ảnh phụ (`product_images`; thêm/xóa ở form sản phẩm hoặc cột `anh_phu` khi nhập file) xem bằng ảnh nhỏ, nút trước/sau hoặc vuốt ngang trên điện thoại. Giá niêm yết của phiên bản (`product_variants.compare_at_price`; ô “Giá niêm yết” ở form sản phẩm hoặc cột `gia_goc`) hiện gạch ngang kèm phần trăm giảm, chỉ khi cao hơn giá bán. Dưới giá là tình trạng hàng của phiên bản đang chọn (“Còn hàng”, “Sắp hết, còn N” từ 5 trở xuống, “Hết hàng”) và “Đã bán N” khi có đơn thật.

**Gợi ý sản phẩm** (`app/Services/RecommendationService.php`, chấm điểm theo quy tắc, không dùng AI): mỗi sản phẩm ứng viên được cộng điểm theo những gì nó chung với sản phẩm đang xem: cùng danh mục 5, cùng hãng 3, cùng lối chơi 4, cùng trình độ 2, giá lệch không quá 20% 3, cùng điểm cân bằng hoặc độ cứng 1 mỗi thứ, còn hàng 4, bán chạy tối đa 10 (sản phẩm bán nhiều nhất 90 ngày qua được đủ 10, các sản phẩm khác theo tỉ lệ). Điểm bằng nhau thì giá gần hơn đứng trước, rồi tới sản phẩm mới hơn.

- _Thường mua cùng_: sản phẩm nằm chung đơn với sản phẩm đang xem trong ít nhất 2 đơn.
- _Vợt tương tự_: cùng lối chơi, từ hãng khác. _Cùng hãng_: các vợt khác của hãng đó. Hai dải không bao giờ trùng nhau, và không lặp lại sản phẩm đã nằm ở “Thường mua cùng”.
- _Vừa xem_: mã sản phẩm lưu trong trình duyệt của khách (`localStorage`, tối đa 12, không gửi gì khác); thẻ sản phẩm lấy lại từ máy chủ nên giá và tồn kho luôn mới.
- _Gợi ý cho bạn_ (cuối trang danh sách): dựa trên sản phẩm khách đã mua (nếu đăng nhập, cộng 5), đã lưu vào yêu thích (cộng 4) và đã xem (cộng 2; gồm danh sách trong trình duyệt và, với tài khoản, sản phẩm đã xem hoặc thêm giỏ trên thiết bị khác); không có gì để dựa thì là _Bán chạy gần đây_; chưa có đơn thật thì không hiện dải nào.
- Mọi tín hiệu bán hàng (đã bán, bán chạy, mua cùng, đã mua) chỉ tính **đơn thật không bị hủy**; đơn mẫu không bao giờ được tính. Sản phẩm mẫu chỉ gợi ý sản phẩm mẫu, sản phẩm thật không bao giờ dẫn tới sản phẩm mẫu. Số bán chạy lưu cache 15 phút.
- Hai dải cuối tải sau khi trang hiện (`GET /recommendations`, JSON, giới hạn 60 lần/phút); request lỗi thì dải đó không hiện, phần còn lại của trang không bị ảnh hưởng.

**Sự kiện khách hàng** (`app/Services/CustomerEvents.php`, bảng `customer_events`): những gì khách làm trong cửa hàng mà chưa bảng nào ghi lại. Tài khoản, đơn hàng và đánh giá đã có bảng riêng nên không ghi thêm lần nữa.

| Sự kiện            | Ghi khi nào                                          | Ai ghi      | Kèm theo                           |
| ------------------ | ---------------------------------------------------- | ----------- | ---------------------------------- |
| `product_view`     | Trang sản phẩm đã hiện                               | Trình duyệt | sản phẩm                           |
| `search`           | Khách dừng lại ở một từ khóa (trang đầu của kết quả) | Trình duyệt | từ khóa, số kết quả                |
| `checkout_started` | Trang thanh toán đã hiện, giỏ có hàng                | Trình duyệt | số món, tiền hàng (máy chủ tính)   |
| `coupon_applied`   | Mã giảm giá được nhận vào giỏ                        | Máy chủ     | mã                                 |
| `add_to_cart`      | Thêm vào giỏ thành công                              | Máy chủ     | sản phẩm, phiên bản, số lượng, giá |
| `remove_from_cart` | Bỏ một phiên bản khỏi giỏ                            | Máy chủ     | sản phẩm, phiên bản                |
| `order_placed`     | Đặt đơn thành công (nối lượt truy cập với đơn)       | Máy chủ     | đơn, số món, tổng tiền             |
| `wishlist_added`   | Lưu một sản phẩm vào yêu thích                       | Máy chủ     | sản phẩm                           |
| `chat_started`     | Tin nhắn đầu tiên của một cuộc chat mới              | Máy chủ     | —                                  |

- Ba sự kiện đầu do trình duyệt báo (`POST /events`, giới hạn 60 lần/phút) vì Next.js còn tải trước trang khi khách rê chuột vào liên kết: request tới Laravel chưa chắc là có người xem. Trình duyệt chỉ nói tên sự kiện; số liệu do máy chủ tự lấy. Cùng một trang (hoặc cùng từ khóa) trong 30 phút chỉ ghi một lần.
- Metadata chỉ nhận đúng các khóa ghi ở `CustomerEvents::EVENTS`, giá trị là số nguyên, đúng/sai hoặc chữ tối đa 100 ký tự; mọi thứ khác bị bỏ. Không lưu IP, trình duyệt, tên, số điện thoại, địa chỉ hay bất cứ thứ gì khách gõ ở trang thanh toán.
- Khách vãng lai được nhóm theo `session_key`: HMAC của một giá trị ngẫu nhiên nằm trong session (không phải mã phiên). Khi khách đăng nhập, sự kiện của lượt truy cập đó được gắn về tài khoản. Xóa tài khoản thì sự kiện xóa theo.
- Không ghi gì cho tài khoản quản trị. Sự kiện cũ hơn 365 ngày bị xóa mỗi ngày (`php artisan model:prune`, đã đặt lịch; cần `php artisan schedule:work` hoặc cron).

**Yêu thích**: khách đã đăng nhập lưu sản phẩm bằng nút dưới nút mua (tối đa 100), xem và bỏ lưu ở **Tài khoản của tôi**. Sản phẩm ngừng bán vẫn nằm trong danh sách, ghi rõ “Cửa hàng đã ngừng bán”, để khách bỏ đi được.

**Đánh giá** (`app/Services/ReviewService.php`, bảng `product_reviews`): chỉ khách đã nhận sản phẩm từ một **đơn thật đã giao** đặt bằng tài khoản của mình mới viết được, mỗi sản phẩm một đánh giá (gửi lại thì thay bài cũ). Chỉ chấm sao thì hiện ngay; có lời bình thì ở trạng thái chờ cho tới khi quản trị viên bấm “Hiện ở cửa hàng” tại `/admin/reviews` (menu có số đang chờ). Trang sản phẩm hiện điểm trung bình, số đánh giá và 20 đánh giá mới nhất đã hiện, ký bằng tên gọi của khách (từ cuối trong họ tên). Sản phẩm chưa có đánh giá thì ghi đúng như vậy; không có đánh giá mẫu.

**Khách hàng** (`/admin/customers/{id}`, `app/Services/CustomerProfile.php`): bấm tên ở danh sách khách hàng hoặc ở trang đơn. Phía trên là bốn số: đã thu (tiền thực nhận), số đơn (không tính đơn hủy), giá trị đơn trung bình, lần mua gần nhất. Bên dưới là các tab, mỗi tab có địa chỉ riêng:

- _Tổng quan_: 5 đơn gần nhất và 8 hoạt động gần nhất.
- _Đơn hàng_: mọi đơn của tài khoản.
- _Hoạt động_: dòng thời gian gộp từ sự kiện khách hàng, các mốc của đơn (đặt, xác nhận, giao đi, đã nhận, hủy, thu tiền), đánh giá và ngày tạo tài khoản; 40 dòng mỗi trang.
- _Sản phẩm_: đã mua (số lượng, tiền, lần gần nhất), hãng và danh mục thường mua, đã xem khi đăng nhập, yêu thích.
- _Mã giảm giá_: mã tạo riêng cho khách (kèm nút “Tạo mã riêng”) và các đơn khách đã dùng mã.
- _Đan dây_: 50 yêu cầu đan dây gần nhất khách gửi khi đã đăng nhập (vợt, dây, mức căng, trạng thái, số tiền); bấm để mở yêu cầu.
- _Hội thoại_: mọi cuộc trò chuyện của khách ở khung chat (kể cả những lần chỉ trợ lý tự động trả lời), trạng thái và ai đã nhận; bấm để mở trong Chat hỗ trợ.
- _Đánh giá_: các đánh giá của khách và trạng thái.

Cạnh tên khách là nhóm của họ, tính lại ngay lúc mở trang. Trên máy local các số này tính cả đơn mẫu (có thông báo vàng); production chỉ tính đơn thật.

**Nhóm khách hàng** (`app/Services/CustomerSegmentation.php`, cột `users.segment`): mỗi tài khoản khách thuộc đúng một nhóm, xếp theo quy tắc từ đơn thật và hoạt động của chính họ, không dùng AI. Ngưỡng do chủ shop đặt ở `/admin/settings` (mặc định trong `config/shop.php`).

| Nhóm            | Khi nào                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Đã mất          | Không đặt đơn, không ghé cửa hàng (khi đăng nhập) quá 365 ngày, kể cả khách từng là VIP               |
| VIP             | Đã mua và tiền shop **đã thu** từ họ đạt 10.000.000 ₫; giữ nhóm này giữa các lần mua                  |
| Không hoạt động | Đã mua nhưng quá 90 ngày chưa đặt đơn mới; hoặc chưa mua, đăng ký đã quá 30 ngày và không quan tâm gì |
| Đang mua        | Đã mua (có đơn không bị hủy) trong 90 ngày gần đây                                                    |
| Tiềm năng       | Chưa mua nhưng có từ 5 lượt xem, lưu, thêm giỏ hoặc mở thanh toán trong 30 ngày gần đây               |
| Mới             | Chưa mua, đăng ký trong 30 ngày gần đây                                                               |

- Quy tắc xét từ trên xuống: nhóm đầu tiên khớp là nhóm của khách.
- Nhóm được xếp lại mỗi ngày lúc 03:00 (`php artisan crm:segment`, cần `schedule:work` hoặc cron), ngay khi đơn của khách được đặt, đổi trạng thái hoặc thu tiền, và ngay sau khi đổi ngưỡng ở Cài đặt.
- Xem và lọc theo nhóm ở `/admin/customers`. Tài khoản quản trị không có nhóm. Nhóm là nhận định nội bộ của shop: không gửi về trình duyệt của khách.

**Mã giảm giá** (`/admin/coupons`, `app/Services/CouponService.php`): khách nhập một mã ở giỏ hàng; mức giảm hiện ở giỏ, trang thanh toán và trên đơn.

- **Ai dùng được:** mọi khách (kể cả không đăng nhập), riêng một tài khoản, hoặc một nhóm khách (phải đăng nhập và đang thuộc nhóm đó lúc dùng). Mã riêng tạo nhanh từ tab Mã giảm giá ở trang khách hàng, với mã 10 ký tự ngẫu nhiên.
- **Mức giảm:** phần trăm tiền hàng (có thể đặt mức tối đa) hoặc một số tiền; không bao giờ vượt tiền của các món được giảm. Phí giao tính trên tiền hàng trước khi giảm.
- **Điều kiện:** đơn tối thiểu, ngày bắt đầu và ngày hết hạn (tính trọn ngày theo giờ Việt Nam), tổng số đơn được dùng, số đơn mỗi khách (theo tài khoản; khách không đăng nhập tính theo số điện thoại nhận hàng), chỉ một số danh mục hoặc sản phẩm. Mã không áp dụng cho sản phẩm mẫu.
- **Tính ở máy chủ:** trình duyệt chỉ gửi mã. Lúc đặt hàng mức giảm được tính lại cùng lúc với việc lưu đơn và giữ chỗ lượt dùng, nên lượt cuối chỉ thuộc về một đơn; nếu mức giảm khác với mức trang thanh toán đã hiện thì đơn bị từ chối và khách được mời xem lại. Hủy đơn thì lượt dùng được trả lại.
- **Mã của người khác:** mã không tồn tại, đã tắt, của khách khác hoặc của nhóm khác đều nhận cùng một câu “Mã giảm giá không hợp lệ…”, và mỗi phiên chỉ được thử 10 lần mỗi phút. Trang tài khoản của khách có mục “Mã giảm giá của tôi” chỉ gồm mã riêng của họ và mã của nhóm họ đang thuộc.
- **Sửa và xóa:** sửa mã không đổi các đơn đã đặt (đơn giữ mã và số tiền đã giảm của nó). Mã đã có đơn dùng thì không xóa được, chỉ tắt.
- **Gửi mã cho khách:** mã riêng đang bật có nút “Gửi mã qua email cho khách” ở trang sửa mã. Mã do nhân viên tạo là thư của shop gửi riêng một khách, không cần khách đã bật email ưu đãi. Mã do email tự động tạo (chiến dịch `winback`, `vip`) vẫn là email ưu đãi khi gửi lại: chỉ gửi được cho khách đang bật nhận, kèm liên kết ngừng nhận.
- **Số liệu:** doanh số là số khách phải trả (đã trừ giảm giá); lãi gộp trừ phần giảm giá rơi vào các dòng có giá nhập; file CSV đơn hàng có cột Giảm giá và Mã giảm giá.

**Email** (`app/Services/EmailService.php`, bảng `email_logs`): mọi email được ghi vào nhật ký rồi xếp hàng; `php artisan queue:work` mới là nơi gửi, nên đặt hàng hay đăng ký không bao giờ chờ hoặc hỏng vì email.

| Loại                      | Gửi khi nào                                                      | Ai nhận                                                                 |
| ------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Chào mừng, xác minh email | Đăng ký tài khoản                                                | Tài khoản mới                                                           |
| Đặt lại mật khẩu          | Khách yêu cầu                                                    | Tài khoản đó                                                            |
| Đơn hàng                  | Đã nhận đơn, đang giao, đã giao, đã hủy (xác nhận đơn không gửi) | Email ghi lúc đặt hàng, không có thì email tài khoản; đơn mẫu không gửi |
| Đan dây                   | Đã nhận yêu cầu, vợt đã đan xong, yêu cầu bị hủy                 | Email ghi trong yêu cầu, không có thì email tài khoản                   |
| Mã giảm giá riêng         | Nhân viên bấm gửi ở trang sửa mã                                 | Chủ của mã                                                              |
| Email ưu đãi tự động      | Bốn automation bên dưới, theo lịch                               | Chỉ khách đã bật nhận email ưu đãi và đã xác minh email                 |

- **Gửi lại khi lỗi:** mỗi email được thử 3 lần (sau 1 phút, rồi 10 phút). Hết 3 lần thì nhật ký ghi “Lỗi” kèm lý do; đơn hàng và tài khoản không bị ảnh hưởng. Email xác minh và đặt lại mật khẩu chỉ vào nhật ký khi đã gửi được.
- **Liên kết trong email đơn hàng** mở đúng đơn đó trong 60 ngày, không cần đăng nhập và trên thiết bị nào cũng được; liên kết bị sửa hoặc của đơn khác không mở được.
- **Đồng ý nhận email ưu đãi:** ô chọn ở trang đăng ký (không tích sẵn) và công tắc ở trang tài khoản. Mỗi email ưu đãi có liên kết “Ngừng nhận email ưu đãi” mở được mà không cần đăng nhập; mở liên kết chưa đổi gì, bấm nút trên trang mới ngừng. Lựa chọn được xét lại ngay lúc gửi: email ưu đãi đang chờ trong hàng đợi không được gửi nếu khách vừa tắt (nhật ký ghi rõ lý do). Email về đơn hàng và tài khoản vẫn gửi.
- **Bốn automation** (`app/Services/MarketingAutomation.php`), đều **tắt** cho tới khi chủ shop bật ở Cài đặt, chỉ tính đơn thật, không gửi cho tài khoản quản trị hay khách mẫu:
    - _Nhắc giỏ hàng:_ khách đã đăng nhập thêm vợt vào giỏ, sau 24 giờ (chỉnh được, tối đa 72) chưa đặt và không thêm gì nữa. Email nêu tối đa 4 cây còn hàng. Mỗi khách nhiều nhất một lần mỗi 7 ngày.
    - _Mời quay lại:_ khách đã mua nay thuộc nhóm Không hoạt động nhận một mã riêng giảm 10%, dùng trong 14 ngày. Mỗi khách nhiều nhất một lần trong 180 ngày.
    - _Mời đánh giá:_ 7 ngày sau khi đơn đã giao, kèm vài cây vợt hợp với cây đã mua. Mỗi đơn một lần, mỗi khách không quá một email trong 7 ngày.
    - _Cảm ơn khách VIP:_ một mã riêng giảm 10%, dùng trong 30 ngày, một lần duy nhất cho mỗi khách.
    - Mã của hai automation có tặng mã giảm tối đa 300.000 ₫ (`config/shop.php` → `marketing.max_discount`), dùng một lần, và nằm trong “Mã giảm giá của tôi” của khách ngay cả khi email không tới. Vì vậy email lỗi không được tự gửi lại bằng một mã mới: nhân viên gửi lại từ trang sửa mã.
- **Lịch** (cần `php artisan schedule:work` hoặc cron, giờ Việt Nam): xếp nhóm khách 03:00; nhắc giỏ hàng mỗi giờ từ 08:00 đến 21:00; cả bốn automation lúc 09:30. Mỗi lượt xếp hàng tối đa 200 email cho mỗi automation. Chạy tay: `php artisan marketing:run [abandoned_cart|winback|post_purchase|vip]`.
- **Nhật ký** (`/admin/emails`): trạng thái Chờ gửi / Đã gửi / Lỗi, lý do lỗi, mã của nhà cung cấp, liên kết tới khách và đơn. Trang báo khi máy chỉ ghi email ra log và khi có email chờ quá 10 phút (worker chưa chạy). Nhật ký cũ hơn 365 ngày bị xóa mỗi ngày.
- **Resend:** `MAIL_MAILER=resend` gọi thẳng HTTP API của Resend bằng HTTP client của Laravel (`app/Mail/ResendTransport.php`), không cần package. Mới kiểm thử với API giả; chưa gửi thật lần nào.

**Chat hỗ trợ** (`app/Services/SupportChat.php`, khung chat ở góc mọi trang cửa hàng, hộp thư ở `/admin/support-chat`): trợ lý tự động trả lời theo từ khóa (phí giao, thanh toán, đơn hàng, địa chỉ, chọn vợt; không dùng AI). Câu nào nó không trả lời được thì cuộc trò chuyện thành _ticket_ cho nhân viên.

| Trạng thái    | Nghĩa là                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Chờ shop      | Khách vừa nhắn; tới lượt nhân viên                                              |
| Chờ khách     | Nhân viên đã trả lời; tới lượt khách                                            |
| Đã giải quyết | Nhân viên coi là xong. Khách nhắn tiếp thì mở lại; không thì tự đóng sau 3 ngày |
| Đã đóng       | Kết thúc. Khách nhắn tin mới sẽ mở một cuộc trò chuyện khác                     |

- **Nhân viên:** nhận ticket rồi mới trả lời được; chỉ người đang nhận mới trả lời, đánh dấu đã giải quyết hoặc đóng. Danh sách hiện lời gần nhất của người thật (khách hoặc shop), không hiện câu trả lời tự động. Cuộc trò chuyện đang mở được ghi trong địa chỉ trang, nên danh sách đổi thứ tự khi khách khác nhắn cũng không làm đổi cuộc trò chuyện đang trả lời.
- **Biết đang trả lời ai:** cạnh cuộc trò chuyện là tên, email và nhóm của khách, tiền đã thu, số đơn, 5 đơn gần nhất kèm trạng thái, sản phẩm đã mua và vừa xem, 3 yêu cầu đan dây gần nhất, các cuộc trò chuyện trước. Với khách chưa đăng nhập chỉ có những gì diễn ra trong lượt truy cập đó (sản phẩm đã xem, đơn vừa đặt).
- **Gắn với tài khoản:** khách nhắn khi đã đăng nhập thì cuộc trò chuyện thuộc về tài khoản, mở lại được trên thiết bị khác, và chỉ tài khoản đó đọc được. Khách nhắn trước rồi mới đăng nhập trong cùng lượt truy cập thì cuộc trò chuyện được gắn về tài khoản. Trang tài khoản có mục “Lịch sử hỗ trợ”; trang khách hàng ở admin có tab “Hội thoại”. Xóa tài khoản thì các cuộc trò chuyện của nó xóa theo.
- **Mã xem lại cho khách vãng lai:** khi cuộc trò chuyện đã giải quyết hoặc đã đóng, khách bấm “Lấy mã xem lại” để nhận một mã 10 ký tự (dạng `ABCDE-FGH23`), dùng trong 30 ngày, hiện đúng một lần. Về sau, trên máy nào cũng được, bấm “Có mã xem lại?” trong khung chat và nhập mã để đọc lại, không viết thêm được. Shop chỉ lưu bản băm của mã (có khóa của ứng dụng), nên không ai xem lại được mã đã cấp; lấy mã mới thì mã cũ hết dùng được. Nhập sai 5 lần thì địa chỉ đó phải chờ 10 phút.
- **Lịch:** `php artisan support:close-resolved` chạy mỗi ngày (cần `schedule:work` hoặc cron). Số ngày chờ và hạn của mã ở `config/shop.php` → `support`.
- Khung chat tự hỏi tin mới mỗi 4 giây khi đang mở. Mỗi giới hạn tần suất của cửa hàng có bộ đếm riêng, nên việc này không làm khách bị chặn khi gửi tin, nhập mã giảm giá hay đặt hàng.

**Dịch vụ đan dây** (`app/Services/StringingService.php`, trang `/services` ở cửa hàng, `/admin/service-orders` ở quản trị): khách gửi yêu cầu trước, mang vợt tới cửa hàng, nhận lại và trả tiền tại quầy. Không giao hàng, không thanh toán online, nên yêu cầu đan dây nằm ở bảng riêng (`service_orders`), không phải đơn hàng.

| Trạng thái (quản trị) | Khách thấy            | Nghĩa là                                                |
| --------------------- | --------------------- | ------------------------------------------------------- |
| Chờ xác nhận          | Chờ cửa hàng xác nhận | Khách vừa gửi; cửa hàng gọi lại để hẹn lúc mang vợt tới |
| Đã hẹn                | Đã hẹn                | Cửa hàng đã hẹn, đang chờ vợt                           |
| Đang đan              | Đang đan              | Vợt đã ở cửa hàng                                       |
| Chờ khách lấy         | Đã đan xong           | Khách nhận email báo tới lấy, kèm số tiền               |
| Đã trả vợt            | Đã trả vợt            | Khách đã lấy vợt và trả tiền. Kết thúc, không sửa được  |
| Đã hủy                | Đã hủy                | Hủy được cho tới trước khi đan xong; khách nhận email   |

- **Khách gửi yêu cầu:** tên vợt, số vợt (tối đa 10, cùng dây và mức căng), dùng dây của cửa hàng hoặc dây tự mang, mức căng từ 8 đến 15 kg cách nhau nửa kg, lúc định mang vợt tới (trong 30 ngày tới, không bắt buộc), ghi chú, họ tên, số điện thoại Việt Nam, email (không bắt buộc). Không cần tài khoản; khách đã đăng nhập thì yêu cầu nằm trong tài khoản. Mỗi khách gửi tối đa 6 lần mỗi phút; bấm gửi hai lần chỉ tạo một yêu cầu.
- **Dây và giá** (`/admin/service-strings`, bảng `service_strings`): danh sách dây của dịch vụ do chủ shop tự nhập (tên, hãng, cỡ dây, giá cho một cây vợt). Đây không phải sản phẩm bán lẻ: không có tồn kho, không vào giỏ hàng. Dây không còn dùng thì tắt, không xóa; yêu cầu cũ giữ tên dây lúc khách chọn. Chưa nhập dây nào thì khách chỉ chọn được “Tôi mang dây tới”. Cửa hàng không có sẵn danh sách dây mẫu.
- **Số tiền** do máy chủ tính, trình duyệt chỉ gửi lựa chọn: số vợt × (giá dây + phí công đan). Dây khách mang tới chỉ tính phí công. Giá dây và phí công được chép vào yêu cầu lúc gửi, nên đổi giá sau này không đổi yêu cầu cũ. Phí công đan đặt ở Cài đặt; để 0 thì trang ghi “Báo khi nhận vợt”. Nhân viên sửa được số tiền thu trên từng yêu cầu khi đã thống nhất giá khác với khách.
- **Cửa hàng xử lý:** danh sách có tab theo trạng thái kèm số đếm, tìm theo số yêu cầu, mã, tên hoặc số điện thoại. Trang yêu cầu có việc cần làm (vợt, dây, mức căng, giờ hẹn, ghi chú), khách hàng (gọi điện, liên kết sang trang khách nếu có tài khoản), số tiền, người đan (một tài khoản nhân viên bất kỳ) và các yêu cầu khác cùng số điện thoại. Trạng thái chỉ đi từng bước theo bảng trên; hai nhân viên cùng bấm một bước thì khách chỉ nhận một email.
- **Khách theo dõi:** trang của yêu cầu (`/service-orders/{mã}`) mở được trong lượt truy cập đã gửi, bằng tài khoản đã gửi, hoặc bằng liên kết có chữ ký trong email của yêu cầu (60 ngày). Trang hiện mã ngắn 8 ký tự để khách đọc tại quầy. Khách không ghi email và không đăng nhập thì mất lượt truy cập là không mở lại được; cửa hàng vẫn tìm ra yêu cầu theo số điện thoại.
- **Email:** “đã nhận yêu cầu”, “vợt đã đan xong” và “yêu cầu bị hủy” đi qua hàng đợi như mọi email khác, không phụ thuộc lựa chọn email ưu đãi. Các bước còn lại không gửi email: cửa hàng gọi điện để hẹn.
- **Tạm ngưng:** tắt “Nhận yêu cầu đan dây trên website” ở Cài đặt thì header cửa hàng bỏ liên kết Đan dây, trang `/services` ghi đang tạm ngưng kèm liên hệ, và form gửi lên bị từ chối. Yêu cầu đang xử lý không bị ảnh hưởng.
- **Phân quyền:** chỉ quản trị viên xử lý yêu cầu và sửa danh sách dây; nhân viên hỗ trợ thấy 3 yêu cầu gần nhất của khách trong bảng thông tin cạnh cuộc chat.
- Giới hạn mức căng, số vợt và số ngày đặt trước ở `config/shop.php` → `stringing`.

**Microsoft Clarity** (`frontend/src/lib/analytics.ts`, `frontend/src/components/shop-analytics.tsx`): đặt project ID vào `NEXT_PUBLIC_CLARITY_ID` trong `frontend/.env.local` rồi build lại; để trống thì không có gì được tải.

- Cửa hàng hỏi mỗi khách một lần (góc dưới bên trái); chỉ khi khách bấm “Đồng ý” script của Clarity mới được tải. Chân trang có dòng cho khách đổi lựa chọn.
- Clarity chỉ nhận **tên** sự kiện (cùng bộ tên ở bảng trên, thêm `review_submitted`), không nhận từ khóa tìm kiếm, mã sản phẩm, số tiền hay danh tính.
- Clarity luôn che nội dung ô nhập. Ngoài ra các vùng có dữ liệu cá nhân được đánh dấu `data-clarity-mask`: tên và email ở menu tài khoản, trang tài khoản, form và trang đơn hàng, khung chat, form đánh giá.
- Trang đăng nhập/đăng ký, cài đặt tài khoản và toàn bộ trang quản trị dừng hẳn việc ghi; tài khoản quản trị không bao giờ bị ghi dù trước đó đã bấm đồng ý.

**Cài đặt** (`/admin/settings`, bảng `settings`): phí giao hàng, mức miễn phí giao (0 = không miễn phí theo giá trị đơn; phí 0 = luôn miễn phí), số điện thoại và email liên hệ, ngưỡng của các nhóm khách hàng, công tắc và con số của bốn email tự động, công tắc nhận yêu cầu đan dây và phí công đan mỗi cây. Lưu xong áp dụng ngay cho giỏ và đơn mới; đơn đã đặt giữ số tiền cũ. Liên hệ hiện ở chân trang cửa hàng và trang đơn; giỏ hàng nhắc “Mua thêm … để được miễn phí giao hàng”. Chưa lưu gì thì dùng mặc định trong `config/shop.php`.

## Lưu ý triển khai thật

- Thay sản phẩm minh họa bằng giá/tồn kho/ảnh có quyền dùng của shop; bỏ nhãn minh họa chỉ khi dữ liệu thật đã xác minh.
- Tiền VND tính tại server; trừ tồn khi nhận đơn COD; hủy hợp lệ hoàn hàng đúng một lần.
- “Đã giao” khác “Đã thu tiền”; thu COD cần xác nhận đối soát.
- Khách vãng lai xem đơn trong phiên đã đặt; mất phiên không thể mở lại chỉ bằng mã đơn. Ngoại lệ duy nhất là liên kết có chữ ký trong email của đơn (60 ngày), nên khách muốn theo dõi đơn về sau cần ghi email lúc đặt.
- Email: giữ `php artisan queue:work` và scheduler chạy; `MAIL_MAILER=log` không gửi gì ra ngoài. Trước khi bật automation cần gửi thử thật qua Resend và có chính sách về email ưu đãi.
- Phí giao hàng là một mức cố định chỉnh ở Cài đặt, chưa kết nối hãng vận chuyển.
- Đan dây: nhập danh sách dây và giá thật của cửa hàng, đặt phí công đan ở Cài đặt; chưa nhập thì trang chỉ nhận dây khách mang tới và ghi “Báo khi nhận vợt”. Tiền đan dây thu tại quầy: chuyển yêu cầu sang “Đã trả vợt” nghĩa là đã thu. Tiền đan dây chưa được tính vào Tổng quan và Báo cáo.
- Trước mở bán: chính sách giao/đổi/trả, liên hệ cửa hàng, bảo vệ dữ liệu cá nhân, nghĩa vụ website bán hàng và hóa đơn cần chủ shop xác nhận.
- Không lưu dữ liệu thẻ. Thêm cổng thanh toán/AI khi có yêu cầu và tài khoản dịch vụ.

## Vận hành

`php artisan storage:link` cho ảnh upload. Không public .env hoặc storage private. Backup DB trước nâng cấp; không chạy migrate:fresh trên dữ liệu thật.

`COMMERCE-CONTRACT.md` là giao diện dữ liệu giữa các phần, không phải chính sách khách hàng. `LANDING.md` mô tả landing; cửa hàng ở /products.
