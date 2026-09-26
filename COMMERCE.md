# Shop Cầu Lông — chức năng bán hàng

## Phạm vi đợt này

- Danh mục, thương hiệu, sản phẩm và từng phiên bản hàng (mã hàng, giá, số lượng).
- Trang cửa hàng, lọc/tìm, chi tiết, giỏ, đặt hàng không cần tài khoản, COD.
- Admin quản lý sản phẩm, ảnh, số lượng và đơn; phân quyền server.
- Gợi ý theo ngân sách/lối chơi/trình độ từ catalog, **không phải AI**.
- Theo lựa chọn người dùng: chưa tích hợp thanh toán online hoặc nhà cung cấp AI.

## Dữ liệu local

Chưa có catalog thực do chủ shop cung cấp. Chạy `php artisan migrate`, sau đó chỉ tại local/testing: `php artisan db:seed --class=DemoCatalogSeeder`. Không chạy seeder minh họa khi mở bán thật.

## Tạo quản trị viên

Đăng ký tài khoản, xác minh email, rồi chạy `php artisan shop:make-admin email-cua-ban` cho tài khoản hiện có. Không có mật khẩu hoặc tài khoản quản trị mặc định. Không cấp quyền qua form đăng ký.

## Lưu ý triển khai thật

- Thay sản phẩm minh họa bằng giá/tồn kho/ảnh có quyền dùng của shop; bỏ nhãn minh họa chỉ khi dữ liệu thật đã xác minh.
- Tiền VND tính tại server; trừ tồn khi nhận đơn COD; hủy hợp lệ hoàn hàng đúng một lần.
- “Đã giao” khác “Đã thu tiền”; thu COD cần xác nhận đối soát.
- Khách vãng lai xem đơn trong phiên đã đặt; mất phiên không thể mở lại chỉ bằng mã đơn.
- Phí giao hàng là mức cấu hình đơn giản, chưa kết nối hãng vận chuyển.
- Trước mở bán: chính sách giao/đổi/trả, liên hệ cửa hàng, bảo vệ dữ liệu cá nhân, nghĩa vụ website bán hàng và hóa đơn cần chủ shop xác nhận.
- Không lưu dữ liệu thẻ. Thêm cổng thanh toán/AI khi có yêu cầu và tài khoản dịch vụ.

## Vận hành

`php artisan storage:link` cho ảnh upload. Không public .env hoặc storage private. Backup DB trước nâng cấp; không chạy migrate:fresh trên dữ liệu thật.

`COMMERCE-CONTRACT.md` là giao diện dữ liệu giữa các phần, không phải chính sách khách hàng. `LANDING.md` mô tả landing; cửa hàng ở /products.
