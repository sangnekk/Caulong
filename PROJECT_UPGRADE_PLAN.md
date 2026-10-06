# PROJECT_UPGRADE_PLAN — Shop Cầu Lông

Kế hoạch nâng cấp project hiện có thành E-commerce + CRM + phân tích hành vi + marketing cá nhân hóa + hỗ trợ khách + dịch vụ đan dây. Không viết lại hệ thống.

Cập nhật lần cuối: 2026-10-06 (sau Phase 0.6: đã gỡ giao diện Inertia/Vite cũ). Trạng thái dùng trong file: `DONE`, `IN PROGRESS`, `BLOCKED`, `TODO`.

## Khác biệt giữa bản yêu cầu và project thật

Bản yêu cầu mô tả stack là Laravel + MySQL + Redis + Next.js. Audit ngày 2026-10-06 cho thấy bốn điểm khác; cột giữa ghi tình trạng hiện tại:

| Bản yêu cầu giả định             | Thực tế trong repo                                                                                                                                                                          | Hệ quả                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend là Next.js (App Router) | Lúc audit frontend là Inertia + Vite. **Nay `frontend/` (Next.js 16.3.6) là giao diện duy nhất**, chạy đủ 30 trang với dữ liệu từ Laravel; giao diện Inertia/Vite cũ (`resources/js`) đã gỡ | Mọi tính năng mới làm giao diện trong `frontend/`                                                                                                                             |
| MySQL                            | **SQLite** (`database/database.sqlite`); test chạy trên SQLite. Máy chưa cài MySQL server (thư mục Laragon chỉ còn `my.ini`)                                                                | Đã có sẵn đường chuyển: migration chạy được trên MySQL và lệnh `shop:import-sqlite` chép dữ liệu (README, mục “Chuyển sang MySQL”). Chưa chạy thử trên MySQL thật (Phase 0.7) |
| Redis                            | Không dùng. Session, cache, queue đều dùng driver `database`                                                                                                                                | Không cần Redis ở quy mô hiện tại; queue `database` đủ cho email và automation                                                                                                |
| Cài được dependency PHP          | Máy **không có Composer**; `vendor/` có sẵn                                                                                                                                                 | Không thêm được package PHP (Resend SDK, Sanctum, spatie/permission) cho đến khi cài Composer. Kế hoạch dưới đây không cần package PHP mới                                    |

## Current Architecture

- **Backend:** Laravel 13.33, PHP 8.4.12. Controller → Service (`CartService`, `OrderService`, `CatalogImporter`, `ShopSettings`, `SupportChatResponder`) → Eloquent Model → `ProductResource`. Không có Repository/DTO/Policy/Job/Mailable/Event.
- **Cách backend trả dữ liệu:** trang GET trả props qua Inertia (`Inertia::render`), thao tác ghi trả redirect kèm flash/lỗi validate trong session. Riêng widget chat dùng JSON (`/support-chat/*`). Frontend Next.js đọc đúng dữ liệu này (gửi header `X-Inertia`), nên controller không phải viết hai lần.
- **Auth:** Laravel Fortify, session cookie. Có đăng ký, xác minh email, quên mật khẩu, 2FA, passkey. Khách mua hàng không cần tài khoản.
- **Phân quyền:** một cột `users.is_admin` + middleware `EnsureAdmin`. Chưa có vai trò hay permission.
- **Frontend Next.js (`frontend/`, cổng 3000):** Next 16.3.6 (App Router), React 19.2, TypeScript, Tailwind 4, Radix (shadcn). Mỗi route là `laravelPage(View, Layout)`: server component hỏi Laravel một lần cho mỗi trang; thao tác ghi đi qua `/api/[...path]` cùng origin; `src/lib/page` cung cấp `Link`, `useForm`, `Form`, `usePage`, `router` cùng tên với Inertia. Chi tiết: `frontend/README.md`.
- **Cổng 8000 của Laravel:** chỉ để Next.js gọi tới; mở bằng trình duyệt sẽ thấy một dòng chỉ sang địa chỉ giao diện (`resources/views/app.blade.php`).
- **Hạ tầng:** queue `database` (chưa có job nào), scheduler trống (`routes/console.php`), mail `log`, filesystem `local` + `public`.
- **Chất lượng:** 128 test PHPUnit, PHPStan level 7, Pint, `npm run check` (oxfmt + oxlint cho TypeScript, script và tài liệu), `tsc` + `next build` cho `frontend/`, test Node cho tool crawl và mô hình 3D, các bài kiểm tra trình duyệt trong `tests/` chạy với bản build của Next.js.
- **Dữ liệu:** 2.586 vợt nhập từ VNB (3.223 SKU) + 6 sản phẩm demo; 572 đơn, **tất cả là đơn demo** (`is_demo`), chưa có đơn thật.

## Existing Features

| Khu vực           | Đã có                                                                                                                                                               | Ghi chú                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Sản phẩm          | Sản phẩm, phiên bản (SKU, giá, tồn kho, giá nhập), hãng, danh mục, thông số, lối chơi, trình độ                                                                     | Mỗi sản phẩm một ảnh. Chưa có giá gốc, gallery, đánh giá             |
| Danh mục/tìm kiếm | Lọc theo từ khóa, hãng, danh mục, lối chơi, mức giá, còn hàng; sắp xếp; phân trang 24                                                                               | Hàng còn bán được xếp trước                                          |
| Gợi ý             | Trang "Gợi ý chọn vợt" theo ngân sách/lối chơi/trình độ (rule-based)                                                                                                | Nền để tái dùng cho recommendation                                   |
| Giỏ hàng          | Lưu trong session, kiểm tra tồn kho, tối đa 20/SKU                                                                                                                  | Không gắn với tài khoản                                              |
| Đặt hàng          | Checkout khách vãng lai hoặc tài khoản, khóa hàng chống bán quá tồn, token chống đặt trùng, phí giao hàng cấu hình được                                             | Chỉ COD                                                              |
| Đơn hàng          | Trạng thái pending → confirmed → shipped → delivered / cancelled, hoàn tồn khi hủy, xác nhận thu COD                                                                | `OrderService`                                                       |
| Tài khoản         | Trang tài khoản: đơn của tôi, sửa thông tin, đổi mật khẩu                                                                                                           |                                                                      |
| Admin             | Dashboard, báo cáo (doanh thu, lợi nhuận, top sản phẩm, theo hãng/lối chơi, tồn kho), sản phẩm, đơn, khách hàng (danh sách), nhập hàng CSV, phân loại, cài đặt shop | Chưa có trang chi tiết khách hàng                                    |
| Chat hỗ trợ       | Widget chat: bot trả lời theo từ khóa, chuyển nhân viên; admin nhận ticket, trả lời, đóng                                                                           | Gắn theo **session**, chưa gắn tài khoản; trạng thái chỉ open/closed |
| Nhập liệu         | Tool crawl VNB (`scripts/vnb-catalog.mjs`) + `shop:import-catalog`                                                                                                  | Cache đã có sẵn mọi ảnh gallery và giá niêm yết của từng sản phẩm    |
| Landing           | Trang giới thiệu 3D                                                                                                                                                 |                                                                      |

Chưa có: coupon, thanh toán chuyển khoản, email giao dịch/marketing, sự kiện khách hàng, CRM, phân nhóm khách, wishlist, đánh giá, dịch vụ đan dây, RBAC, SEO (sitemap, structured data), Microsoft Clarity.

## Existing Database

| Bảng                    | Cột chính                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                 | name, email, password, `is_admin`, email_verified_at, cột 2FA                                                                                                                                                   |
| `brands`, `categories`  | name, slug                                                                                                                                                                                                      |
| `products`              | brand_id, category_id, name, slug, description, image_path, specs (JSON), play_style, skill_level, is_active, is_featured, is_demo                                                                              |
| `product_variants`      | product_id, sku, name, price, cost_price, stock, is_active                                                                                                                                                      |
| `orders`                | public_id (UUID), checkout_token, user_id (nullable), name, phone, address, email, notes, status, payment_method, payment_status, subtotal, shipping_fee, total, is_demo, các mốc thời gian trạng thái, paid_at |
| `order_items`           | order_id, variant_id, product_name, variant_name, sku, unit_price, unit_cost, quantity, line_total                                                                                                              |
| `settings`              | key, value                                                                                                                                                                                                      |
| `support_conversations` | session_key, status, needs_human, assigned_to, last_message_at                                                                                                                                                  |
| `support_messages`      | conversation_id, sender, body, action_url, action_label, read_at                                                                                                                                                |
| Khung Laravel           | sessions, cache, jobs, passkeys, password_reset_tokens                                                                                                                                                          |

## Existing APIs

55 route, tất cả trong nhóm `web` (session + CSRF).

- **Cửa hàng:** `GET /products`, `GET /products/{slug}`, `GET /advisor`, `GET /cart`, `POST|PATCH|DELETE /cart/items[/{variant}]`, `GET|POST /checkout`, `GET /orders/{public_id}`.
- **Tài khoản:** `GET|PATCH /account`, `PUT /account/password`, `/settings/*`, các route Fortify (đăng nhập, đăng ký, 2FA, passkey).
- **Chat (JSON):** `GET /support-chat/context`, `GET|POST /support-chat/messages`.
- **Admin (`/admin`, cần `auth` + `verified` + `EnsureAdmin`):** dashboard, reports, settings, products (CRUD, bulk, sửa nhanh), taxonomies, customers (danh sách), imports, orders (danh sách, chi tiết, đổi trạng thái, thu COD, export CSV), support-chat (danh sách, claim, reply, close).

Quy ước cho API mới: trang thì trả props như các trang hiện có; thao tác ghi trả redirect + flash; widget cần JSON thì theo kiểu `/support-chat/*`. Không lập nhóm `/api` riêng ở Laravel.

## Existing Frontend

- **Shop:** `welcome`, `shop/products`, `shop/product`, `shop/cart`, `shop/checkout`, `shop/order`, `shop/advisor`, `shop/account`, widget `shop-support-chat`.
- **Admin:** `dashboard`, `reports`, `products`, `product-form`, `orders`, `order`, `customers`, `import`, `import-preview`, `taxonomies`, `settings`, `support-chat`, dùng chung `admin/shared.tsx` và `revenue-chart`.
- **Auth/settings:** 7 trang auth, 3 trang settings.
- **State:** không có thư viện state; dữ liệu đến từ props trang, form dùng `useForm` trong `frontend/src/lib/page`.
- **Design system:** `DESIGN.md`, CSS theo phạm vi `.storefront` và `.commerce-admin`. Giữ nguyên, không đổi giao diện tổng thể.

## Features To Add

Nguyên tắc từ `PRODUCT.md` và `COMMERCE-CONTRACT.md` vẫn áp dụng: không số bán chạy, đánh giá hay gợi ý giả. Mọi tín hiệu công khai chỉ tính từ đơn thật (`is_demo = false`, không hủy); chưa đủ dữ liệu thì rơi về quy tắc theo thuộc tính.

| Nhóm                    | Mở rộng cái đang có                                    | Thêm mới                                                                                     |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A. Trải nghiệm sản phẩm | Trang `shop/product`, `ProductResource`, importer      | Gallery nhiều ảnh, giá gốc/giá giảm, số đã bán (thật), các dải gợi ý                         |
| B. Recommendation       | Logic `AdvisorController`                              | `RecommendationService` chấm điểm: popular, related, similar, mua cùng, vừa xem, cá nhân hóa |
| C. Analytics            | —                                                      | Microsoft Clarity trong frontend, bật bằng biến môi trường, che dữ liệu nhập                 |
| D. Sự kiện khách hàng   | Các controller hiện có ghi sự kiện ở phía server       | Bảng `customer_events` + service ghi sự kiện                                                 |
| E. CRM                  | `admin/customers`, `User`, `Order`                     | Trang chi tiết khách hàng, hồ sơ, timeline, wishlist, đánh giá                               |
| F. Phân nhóm            | `settings` (ngưỡng cấu hình)                           | `CustomerSegmentationService` + lệnh chạy theo lịch                                          |
| G. Coupon               | `OrderService::checkout`, giỏ hàng                     | Coupon chung/chiến dịch/cá nhân/theo nhóm, lượt dùng                                         |
| H. Automation           | Scheduler + queue `database`                           | Giỏ bỏ dở, khách lâu không mua, sau mua, VIP                                                 |
| I. Email                | Mail của Laravel (đang `log`)                          | Mailable giao dịch + marketing, gửi qua queue, `email_logs`, Resend                          |
| J. Chat hỗ trợ          | Toàn bộ module chat hiện có                            | Gắn tài khoản, trạng thái OPEN/PENDING/RESOLVED/CLOSED, bảng ngữ cảnh khách cho nhân viên    |
| K. Mã truy xuất chat    | `support_conversations`                                | Mã ngẫu nhiên khi đóng, lưu dạng hash, có hạn, giới hạn số lần thử                           |
| L. Lịch sử chat         | Bảng ngữ cảnh ở J                                      | Hội thoại, đơn, sản phẩm, dịch vụ trước đó của cùng khách                                    |
| M. Dịch vụ đan dây      | Tài khoản, admin layout, email                         | Module `service_orders` riêng, không nhét vào order                                          |
| N. Chuyển khoản         | `orders.payment_method/payment_status`, `OrderService` | Bảng `payments`, hướng dẫn + QR, admin xác nhận, sẵn chỗ cho webhook                         |
| O. SEO                  | —                                                      | Metadata động, canonical, Open Graph, sitemap, robots, JSON-LD (cần Next.js)                 |
| P. Dashboard            | `admin/dashboard`, `admin/reports`                     | Nhóm khách, coupon, phễu chuyển đổi, thanh toán chờ, chat mở, đơn dịch vụ                    |
| Q. Phân quyền           | `is_admin`, `EnsureAdmin`                              | Cột `users.role` + Gate theo vai trò, kiểm tra ở backend                                     |

## Database Changes

Tất cả là migration cộng thêm, không sửa hay xóa dữ liệu đang có.

| Phase | Thay đổi                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `product_images` (product_id, path, position). `product_variants.compare_at_price` (nullable). Index cho truy vấn gợi ý                                                                                                                                                                                                                                      |
| 2     | `customer_events` (user_id?, session_key?, event_name, product_id?, order_id?, metadata JSON, created_at; index theo user, session, event+thời gian). `wishlists` (user_id, product_id, unique). `product_reviews` (user_id, product_id, order_item_id, rating, body, status)                                                                                |
| 3     | `users.segment`, `users.segment_updated_at`. `coupons` (code unique, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, per_customer_limit, user_id?, segment?, campaign?, giới hạn sản phẩm/danh mục, is_active). `coupon_redemptions` (coupon_id, user_id?, order_id unique, amount). `orders.discount_total`, `orders.coupon_code` |
| 4     | `email_logs` (type, recipient, subject, status, provider_message_id, sent_at, error). `users.marketing_opt_in` (đồng ý nhận email quảng cáo)                                                                                                                                                                                                                 |
| 5     | `support_conversations`: thêm `user_id?`, `closed_at`, `access_code_hash`, `access_code_expires_at`; mở rộng giá trị `status`. `users.role`                                                                                                                                                                                                                  |
| 6     | `service_orders` (public_id UUID, user_id?, tên/điện thoại, loại dịch vụ, vợt, dây, mức căng, số lượng, ghi chú, thời gian mong muốn, status, technician_id?, giá, các mốc thời gian). `service_strings` (danh mục dây + giá) nếu chọn phương án có danh sách dây                                                                                            |
| 7     | `payments` (order_id, method, amount, reference unique, status, provider_transaction_id unique?, paid_at, payload). Thông tin tài khoản ngân hàng trong `settings`                                                                                                                                                                                           |

Không tạo `customers`: khách hàng là `users`; đơn của khách vãng lai giữ nguyên trong `orders`.

## API Changes

Đặt tên theo quy ước route hiện tại. Danh sách dự kiến, chốt lại khi vào từng phase.

| Phase | Route                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Props mới trên `GET /products/{slug}` (gallery, related, similar, boughtTogether) và `GET /products` (popular). `GET /products/{slug}/recommendations` (JSON) cho dải tải sau |
| 2     | `POST /events` (JSON, giới hạn tần suất, chỉ nhận tên sự kiện trong danh sách cho phép). `POST                                                                                | DELETE /wishlist/{product}`. `POST /products/{slug}/reviews`. `GET /admin/customers/{user}` |
| 3     | `POST                                                                                                                                                                         | DELETE /cart/coupon`. Props coupon trên `/account`. `/admin/coupons` (CRUD)                 |
| 4     | `/admin/emails` (nhật ký). Lệnh: `crm:segment`, `marketing:abandoned-carts`, `marketing:winback`, `marketing:post-purchase`                                                   |
| 5     | Mở rộng `/support-chat/*` và `/admin/support-chat/*`. `POST /support-chat/lookup` (tra cứu bằng mã)                                                                           |
| 6     | `GET /services`, `POST /service-orders`, `GET /service-orders/{public_id}`, `/admin/service-orders`                                                                           |
| 7     | `GET /orders/{public_id}/payment`, `POST /admin/orders/{order}/payments/{payment}/confirm`, chỗ gắn webhook nhà cung cấp                                                      |
| 8     | Dữ liệu cho sitemap (danh sách slug sản phẩm đang bán)                                                                                                                        |

## UI Changes

- **Shop:** trang sản phẩm (gallery, giá gốc/giảm, tồn kho, đã bán, đánh giá, các dải gợi ý), danh sách sản phẩm (dải phổ biến, vừa xem), giỏ/checkout (ô coupon, chọn chuyển khoản, trang hướng dẫn + QR), tài khoản (coupon của tôi, wishlist, đơn dịch vụ, lịch sử chat), trang dịch vụ đan dây, tra cứu chat bằng mã.
- **Admin:** trang chi tiết khách hàng (Overview, Orders, Timeline, Products, Coupons, Conversations, Services, Reviews), coupon, nhật ký email, đơn dịch vụ, xác nhận thanh toán, bảng ngữ cảnh khách trong màn chat, thẻ mới trên dashboard và báo cáo.
- Mọi màn hình mới có trạng thái đang tải, rỗng, lỗi và chạy tốt trên điện thoại; dùng lại component và CSS hiện có.

## Dependencies

| Gói                               | Dùng cho          | Ghi chú                                                                                                                                               |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Không thêm package PHP            | —                 | Resend gọi qua HTTP API bằng `Http` client có sẵn (một mail transport nhỏ), nên không cần Composer. Nếu cài Composer thì đổi sang `resend/resend-php` |
| `qrcode` (npm, trong `frontend/`) | QR chuyển khoản   | Chỉ thêm ở Phase 7                                                                                                                                    |
| Microsoft Clarity                 | Phân tích hành vi | Chèn script, không cần package                                                                                                                        |

Cần chạy thêm hai tiến trình khi có email/automation: `php artisan queue:work` và `php artisan schedule:work`.

## Risks

1. **Khác biệt so với giao diện cũ.** Nút lùi/tiến của trình duyệt đổi trang không còn hiệu ứng (ảnh sản phẩm không thu về thẻ): Next.js dựng lại trang ngay để giữ đúng vị trí cuộn. Script chụp poster vợt phụ thuộc bản build Vite nên đã gỡ; ảnh poster hiện có vẫn dùng được.
2. **SQLite.** Queue worker và web cùng ghi dễ gặp khóa file; cần MySQL trước khi chạy thật. Đường chuyển đã chuẩn bị nhưng chưa chạy trên MySQL thật.
3. **Không có Composer.** Chặn mọi package PHP mới; kế hoạch đã tránh, nhưng nên cài để về sau cập nhật được Laravel.
4. **Chưa có đơn thật.** "Phổ biến" và "thường mua cùng" sẽ trống; hệ thống phải rơi về gợi ý theo thuộc tính và không dùng đơn demo cho tín hiệu công khai.
5. **Khách vãng lai và giỏ trong session.** CRM chỉ đầy đủ với tài khoản; nhắc giỏ bỏ dở chỉ gửi được cho khách đã đăng nhập.
6. **Quyền riêng tư.** Clarity và email marketing cần sự đồng ý của khách theo quy định bảo vệ dữ liệu cá nhân của Việt Nam; sự kiện không chứa mật khẩu, token, OTP, thông tin thanh toán.
7. **Catalog chỉ có vợt.** `products.play_style` bắt buộc, nên dây cho dịch vụ đan không đưa thẳng vào bảng sản phẩm được; cần chọn phương án ở Phase 6.
8. **Mã truy xuất chat.** Mẫu `CHAT-8F2K91` (6 ký tự) dễ dò; đề xuất 10 ký tự, lưu hash, giới hạn số lần thử, có hạn.
9. **Chuyển khoản.** Chưa có nhà cung cấp đối soát tự động: bản đầu là admin xác nhận tay; đơn chưa trả tiền giữ tồn kho nên cần tự hủy sau một thời hạn.
10. **Khối lượng.** 17 nhóm tính năng; làm theo phase, mỗi phase có test và chạy lại toàn bộ kiểm tra.

## Implementation Phases

| Phase | Nội dung                                                                                                                                            | Trạng thái                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 0     | Audit và kế hoạch (file này)                                                                                                                        | `DONE`                                     |
| 0.5   | Frontend Next.js: lớp tương thích, lấy dữ liệu phía server, `/api` proxy, route cho 30 trang, chuyển trang, kiểm tra trình duyệt (dev và bản build) | `DONE`                                     |
| 0.6   | Gỡ giao diện Inertia/Vite cũ (`resources/js`, Vite, script build); lint/format chuyển sang oxlint + oxfmt; script mô hình 3D chuyển vào `frontend/` | `DONE`                                     |
| 0.7   | Chuyển database sang MySQL                                                                                                                          | `BLOCKED` (máy chưa cài MySQL server)      |
| 1     | Trải nghiệm sản phẩm + nền recommendation                                                                                                           | `TODO`                                     |
| 2     | Sự kiện khách hàng + CRM + Clarity                                                                                                                  | `TODO`                                     |
| 3     | Phân nhóm khách + coupon cá nhân                                                                                                                    | `TODO`                                     |
| 4     | Email (Resend) + automation                                                                                                                         | `TODO` (cần API key và domain gửi)         |
| 5     | Chat: gắn khách, ngữ cảnh, lịch sử, mã truy xuất; nền RBAC                                                                                          | `TODO`                                     |
| 6     | Dịch vụ đan dây                                                                                                                                     | `TODO` (chờ quyết định 4)                  |
| 7     | Thanh toán chuyển khoản                                                                                                                             | `TODO` (cần thông tin tài khoản ngân hàng) |
| 8     | SEO                                                                                                                                                 | `TODO`                                     |
| 9     | Dashboard phân tích                                                                                                                                 | `TODO`                                     |
| 10    | RBAC đầy đủ, bảo mật, hiệu năng, test, hoàn thiện                                                                                                   | `TODO`                                     |

Sau mỗi phase: `php artisan test`, PHPStan, Pint, typecheck + build frontend, kiểm tra migration trên database trống, rồi cập nhật bảng trạng thái ở trên.

Thứ tự đề xuất: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Phase 0.7 làm được bất cứ lúc nào khi máy đã có MySQL.

## Quyết định cần chủ project chốt

1. **Database:** cài MySQL server (ổ C hiện còn khoảng 7,6 GB trống) rồi chạy hai lệnh chuyển, hay tiếp tục SQLite cho local.
2. **Composer:** cài để dùng package chính thức, hay tiếp tục không thêm package PHP (kế hoạch hiện theo hướng này).
3. **Dây cho dịch vụ đan:** bảng danh sách dây riêng của dịch vụ (đề xuất), hay mở rộng catalog để bán cả dây.
4. **Thông tin cần cung cấp khi tới phase tương ứng:** Clarity project ID, Resend API key + domain gửi, tài khoản ngân hàng nhận chuyển khoản, các ngưỡng VIP/không hoạt động.
