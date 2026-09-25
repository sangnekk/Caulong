# Landing Shop Cầu Lông

## Chạy local
```sh
npm install
npm run build
php artisan serve --host=127.0.0.1 --port=8000
```
Mở http://127.0.0.1:8000. Phiên triển khai đã tạo APP_KEY còn trống và database SQLite local, chạy các migration có sẵn. Không có tài khoản admin được tạo.

## Đã làm
Landing kể chuyện theo cuộn tham khảo NANFU: một cảnh 3D sticky toàn màn hình, sáu chương nối tiếp (toàn vợt/khung & gen/thân/cán/mặt dây/lối chơi). Cuộn điều khiển góc xoay, zoom và tâm nhìn; chữ lần lượt xuất hiện, cuộn ngược đảo cảnh. Không cần bấm nút xoay. Có thanh chuyển chương, bỏ qua, chế độ đọc tĩnh; mobile đặt vợt trên chữ. Reduced-motion hoặc màn hình thấp dùng poster và toàn bộ văn bản; WebGL lỗi có retry. Bộ sưu tập và footer nằm sau câu chuyện. Không có wheel hijacking.

## Asset
`public/models/hyper-core.glb`: 4.989.476 bytes, 60.923 tam giác, 4 mesh, 3 material, 9 texture PNG 1024². Nguồn: `glb/hyper_core8000_-_badminton_racket_3d_modeling.glb` (10.921.552 bytes). File `(1)` trùng SHA-256; bản source 21.745.896 bytes giữ để lưu trữ. File nguồn không thay đổi.

Sinh bản web: `node scripts/prepare-hyper-core.mjs`. Tách group7_1, bỏ cây thứ hai và dữ liệu không dùng, gộp lưu trữ UV trùng; không giảm polygon hoặc chất lượng texture. GLB gốc chưa có dây; `racket-strings.ts` tạo lưới trước bằng `node --experimental-strip-types scripts/bake-racket-strings.mjs`, lưu `hyper-core-strings.glb` để trình duyệt chỉ tải file, không tính raycast/dựng dây lúc mở trang: 20 dây dọc + 24 dây ngang, đan trên/dưới, đường kính minh họa 0,65 mm; đầu dây đo theo mặt trong khung bằng raycast. Một mesh thêm 3.616 tam giác, không mô phỏng vật lý hay thông số căng hãng. Khung/thân/cốt cán gốc chung mesh; không giả tách lớp carbon bên trong.

`public/models/hyper-core-poster.png` là render từ model đang dùng. Sinh bằng `node scripts/capture-racket-poster.mjs` sau build, Laravel :8000 và Chrome debug :9222. Ghi công/liên kết nguồn CC BY 4.0 ở footer và `public/models/HYPER-CORE-LICENSE.txt`. Model tự dựng trước đây giữ nguyên nhưng không còn hiển thị.

## Kiểm tra
```sh
npm run types:check
node tests/hyper-core-model.mjs
node --experimental-strip-types tests/racket-strings.mjs
php artisan test --compact --filter=ExampleTest
```
Browser check không thêm thư viện: mở Chrome bằng profile thử nghiệm với `--remote-debugging-port=9222`; chạy `node tests/landing-browser.mjs`. Test mặc định URL 8000; đổi bằng LANDING_URL. Kiểm tra 1440/768/390/320px, 6 chương ghim, camera xuôi/ngược, chỉ một canvas, chữ active/inert, lọc, menu, Escape modal, chế độ đọc tĩnh, reduced motion, WebGL fallback/retry; ghi ảnh vào artifacts/. Không thay thế kiểm thử trên thiết bị thật.

## Cấu tạo và chuyển động cập nhật
Nhãn chỉ điểm được chiếu từ tọa độ 3D; mỗi chương có Cấu tạo/Vai trò. Mặt dây có chương riêng thay cảnh vung chung chung. Giữ model cùng phía thay vì di chuyển qua lại; bỏ clip-path đổi đột ngột theo chương. Làm dịu mục tiêu cuộn bằng frame loop ngắn tự dừng; không có render loop lúc đứng yên. Cache layout khi resize; cập nhật marker bằng transform. DPR giới hạn 1.25 thay vì 1.75 để giảm khoảng 49% số pixel render ở màn hình DPR2; không giảm texture/model.

Đo bằng `node tests/scroll-performance.mjs <nhãn>` với Chrome debug :9222. Kết quả trong artifacts/scroll-performance-*.json chỉ phản ánh máy kiểm thử, không thay FPS trên thiết bị thật.

## Vào trang
Giữ chiều cao phần giới thiệu ngay lần render đầu, không đổi từ danh sách sang màn hình ghim sau khi tải. Hiển thị ảnh dự phòng và thanh đang tải không giả phần trăm; giữ nội dung mở đầu cho đến lúc model, texture và shader đã sẵn sàng. Chuyển mờ ảnh sang canvas 450ms. Không khóa cuộn toàn trang, không kéo người dùng về đầu; có bỏ qua/bản tĩnh/thử lại. Timeout tải 30 giây. Nền sân phối cảnh, ánh sáng và quỹ đạo cầu dùng CSS/SVG tĩnh, không thêm vòng render.

Kiểm tra tải bị giữ lại/lỗi: `node tests/loading-browser.mjs` với Chrome debug :9222.

## Giới hạn
Chưa có catalog/SKU, giá/tồn kho thật, giỏ hàng, thanh toán, AI hoặc video người chơi. Ba bộ sưu tập là định hướng lối chơi, không phải thống kê bán chạy. Không thu tiền/thông tin thẻ. Chưa tuyên bố điểm Core Web Vitals/FPS trên điện thoại thật.

Three.js được tải qua dynamic import; bundle cảnh khoảng 613 KB minified (~154 KB gzip). Build còn cảnh báo kích thước chunk và fontaine tùy chọn của starter; không thêm thư viện chỉ để bỏ cảnh báo.
