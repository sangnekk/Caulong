# Caulong

Trang giới thiệu vợt cầu lông bằng Laravel, Inertia, React và Three.js.

## Hiện có
- Vợt Hyper Core8000, mặt dây minh họa, giới thiệu bộ phận theo cuộn.
- Giao diện tiếng Việt, điện thoại/máy tính, chế độ đọc tĩnh.
- Ảnh dự phòng, tải lại khi lỗi. Phần tải ban đầu và nền sân đang được hoàn thiện.
- Chưa có đặt hàng, thanh toán hoặc AI tư vấn hoạt động.

## Chạy local
Yêu cầu PHP phù hợp composer.lock (khuyến nghị PHP 8.4), Composer, Node.js 22 và SQLite.

```sh
composer install
npm ci
```

Sao chép `.env.example` thành `.env`, sau đó:

```sh
php artisan key:generate
php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
php artisan migrate
npm run build
php artisan serve --host=127.0.0.1 --port=8000
```

Mở http://127.0.0.1:8000. `npm run build` sinh route TypeScript bằng Laravel Wayfinder; cần PHP trong PATH.

## Kiểm tra
```sh
npm run types:check
node --experimental-strip-types tests/racket-strings.mjs
node --experimental-strip-types tests/baked-strings.mjs
php artisan test --compact --filter=ExampleTest
```

Các kiểm tra trình duyệt trong `tests/*browser.mjs` cần Chrome riêng chạy với `--remote-debugging-port=9222` và Laravel ở cổng 8000.

## Tài nguyên và giấy phép
Model Hyper Core8000 do **ghks1120** tạo, cấp phép **CC BY 4.0**. Bản web đã tách một cây và tối ưu dữ liệu; mặt dây là phần minh họa bổ sung, không phải hướng dẫn căng dây của hãng. Chi tiết: [thông tin giấy phép](public/models/HYPER-CORE-LICENSE.txt).

- [Nguồn model](https://sketchfab.com/3d-models/hyper-core8000-badminton-racket-3d-modeling-c6f5e27f657a48d6b3cbb52120d75f83)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Các file đã tối ưu trong `public/models/` đủ để chạy web. Thư mục model nguồn `glb/` không đưa lên Git; muốn chạy lại `scripts/prepare-hyper-core.mjs` cần tải model hợp lệ từ nguồn trên.

Không đưa `.env`, database, log, ảnh kiểm thử, `vendor/`, `node_modules/` hoặc bản build lên GitHub.

Xem thêm [LANDING.md](LANDING.md).
