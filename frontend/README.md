# Frontend Next.js của Shop Cầu Lông

Giao diện của cửa hàng, quản trị và tài khoản, chạy bằng Next.js 16 (App Router) và React 19. Laravel vẫn là nơi quyết định route, phiên đăng nhập và dữ liệu; app này hỏi Laravel rồi hiển thị.

## Chạy

Cần Laravel đang chạy ở cổng 8000 (`php artisan serve` ở thư mục gốc).

```sh
cp .env.example .env.local   # lần đầu
npm install                  # lần đầu
npm run dev                  # http://localhost:3000
```

Hoặc chạy cả hai cùng lúc từ thư mục gốc: `php artisan dev`.

Bản production: `npm run build` rồi `npm run start`.

## Cách hoạt động

- **Trang:** mỗi route trong `src/app` là một dòng `laravelPage(View, Layout)`. Khi có request, server component hỏi Laravel đúng URL đó (`src/lib/laravel/server.ts`), kèm cookie của khách, và nhận lại tên trang cùng props, giống dữ liệu Laravel trả cho Inertia. Một trang chỉ gọi Laravel một lần; thông tin dùng chung (người đăng nhập, số món trong giỏ, thông báo) đi kèm trong đó.
- **Chuyển hướng và lỗi:** Laravel trả redirect (chưa đăng nhập, quay lại kèm lỗi validate), 403 hay 404 thì Next.js chuyển thành redirect, trang `forbidden` hay `not-found` tương ứng.
- **Thao tác ghi:** trình duyệt không gọi thẳng Laravel. Mọi form, giỏ hàng, đăng nhập đi qua `/api/...` (`src/app/api/[...path]/route.ts`), cùng origin với trang, nên cookie phiên của Laravel là cookie của chính site và kiểm tra chống giả mạo request của Laravel vẫn áp dụng.
- **View:** `src/views`, `src/layouts`, `src/components` là các trang và component React. Chúng dùng `Link`, `useForm`, `Form`, `usePage`, `router` từ `@/lib/page`, cùng tên và cách dùng như của Inertia, nhưng chạy trên router của Next.js.
- **Đường dẫn đi thẳng tới Laravel:** ảnh trong `/storage`, liên kết xác minh email, file tải về của admin, chat hỗ trợ và passkey được khai báo trong `rewrites` của `next.config.ts`.
- **Phiên đăng nhập:** vì trang được dựng phía server, cookie phiên mà Laravel gia hạn không tới được trình duyệt. Khi khách còn đang duyệt, trình duyệt gọi `GET /api/session` khoảng 15 phút một lần để gia hạn (`src/lib/page/session.ts`).
- **Chuyển trang:** mỗi trang là một `<ViewTransition>` của React; kiểu chuyển động chọn theo điểm đi và điểm đến (`src/lib/page/transition.ts`), style nằm trong `src/css/app.css`. Nút lùi/tiến của trình duyệt đổi trang không có hiệu ứng: Next.js dựng lại trang ngay để trình duyệt trả đúng vị trí cuộn.
- **Trang landing** (`/`) chỉ dựng ở trình duyệt, vì màn mở đầu và cảnh 3D phụ thuộc thiết bị.

## Thêm một trang

1. Thêm route và controller ở Laravel như bình thường (`Inertia::render('shop/ten-trang', [...])`).
2. Viết view ở `src/views/shop/ten-trang.tsx`, dòng đầu là `'use client';`.
3. Tạo `src/app/(shop)/duong-dan/page.tsx`:

```tsx
import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import TenTrang from '@/views/shop/ten-trang';

export default laravelPage(TenTrang, ShopLayout);
```

`src/actions`, `src/routes` và `src/wayfinder` là file do Laravel Wayfinder sinh ra; đừng sửa tay. Sau khi thêm hoặc đổi route ở Laravel, chạy `npm run routes` ở thư mục gốc để sinh lại.

## Kiểm tra

```sh
npm run types:check       # kiểu
npm run build             # build production
npm run check             # chạy ở thư mục gốc: định dạng + lint
```

Các bài kiểm tra trong trình duyệt nằm ở `tests/` của thư mục gốc. Chúng cần bản build đang chạy (`npm run build`, `npm run start`), Laravel ở cổng 8000 và Chrome mở với `--remote-debugging-port=9222`:

```sh
node tests/commerce-browser.mjs          # ở thư mục gốc
node tests/landing-store-navigation.mjs
```

## Mô hình 3D

`public/models` chứa mô hình đã tối ưu cho web. `scripts/prepare-hyper-core.mjs` tách và gọn mô hình nguồn (đặt trong `glb/` ở thư mục gốc, không đưa lên Git), `scripts/bake-racket-strings.mjs` dựng lưới dây; `tests/*.mjs` kiểm tra kết quả. Chạy bằng `node`, ví dụ `node tests/racket-strings.mjs`. Xem `LANDING.md` ở thư mục gốc.
