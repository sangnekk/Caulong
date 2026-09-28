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

## Liên kết cửa hàng

Landing mở đầu sau mỗi lần tải lại trang. Màn mở đầu là bản vẽ nét của Hyper Core8000 (`racket-blueprint.tsx`, số đo từ model và đầu dây của lưới đã bake) được căng dây theo byte model tải thật: 20 dây dọc rồi 24 dây ngang, tối thiểu khoảng 1,2 giây khi model đã có trong cache. Model bắt đầu tải cùng chunk trang (`racket-download.ts`), song song với three.js. Khi 3D sẵn sàng, bản vẽ lùi về đúng tư thế vợt 3D (vị trí lấy từ camera, `getScreenAffine`) rồi mờ thành vợt thật, sau đó header và chữ vào; vì vậy landing không còn trạng thái tải thứ hai. Trần 10 giây cho mạng chậm; Bỏ qua/Escape đóng ngay; khi đóng sớm, nút “Đang căng dây…” giữ cùng tiến độ tại chỗ. Reload khi đang ở giữa/cuối trang: mở đầu vẫn chạy ở màn đầu (vị trí cuộn Inertia lưu được đặt lại về đầu, và trang được giữ ở đầu cho tới khi mở đầu kết thúc). Liên kết có neo (`/#hoi-dap`) bỏ qua mở đầu và tới thẳng mục đó. Giảm chuyển động: không tải 3D, không animation, không chờ. Xem `resources/js/components/landing-loader.tsx`.

Các nút “Vào cửa hàng”, kết thúc câu chuyện, và từng lối chơi là Inertia Link; không tải lại tài liệu. Trang sản phẩm nạp trước sau màn mở đầu/di chuột, dữ liệu giữ tối đa 5 giây để tránh giá/tồn kho quá cũ; server vẫn kiểm tra lại trước khi nhận đơn. Quay về landing bằng Inertia trong cùng tài liệu không phát lại mở đầu; reload thực sự phát lại. View Transitions của trình duyệt làm mờ ngắn; giảm chuyển động tắt hiệu ứng. Chạy `node tests/landing-loader-browser.mjs` và `node tests/landing-store-navigation.mjs` với Chrome debug :9222.

## Chuyển trang và lối vào cửa hàng

Header landing ghim trên cùng: trong suốt trên mặt sân, chuyển nền trắng khi phần câu chuyện đã cuộn qua; nút “Vào cửa hàng” (mobile: “Cửa hàng”) luôn trong tầm mắt. Cuối phần lối chơi có khối “Xem tất cả vợt”, footer có nút cửa hàng.

Mọi lượt chuyển trang Inertia sang đường dẫn khác chạy View Transitions (`resources/js/lib/page-transition.ts`, CSS trong `app.css`): giữa các trang: nội dung cũ nhấc lên và tắt trong 100ms, nội dung mới nhô lên vào chỗ ngay sau (320ms), hai trang chỉ chồng vài khung hình. Rời landing (kiểu `leave-landing`): cả trang cửa hàng trồi lên như một tấm che nhà thi đấu đang lùi và tối dần (480ms); về landing (`enter-landing`): tấm cửa hàng rơi xuống để lộ nhà thi đấu. Không trộn nền tối với nền trắng. Header cửa hàng và thanh bên admin đứng yên giữa các trang; ảnh sản phẩm được bấm ở danh sách biến hình thành ảnh trang chi tiết. Lọc, phân trang và form gửi về cùng trang không chạy hiệu ứng. Nền `html` theo trang hiện tại để khoảng giữa hai trang không lóe màu cũ. Giảm chuyển động: đổi trang tức thì. Nút lùi/tiến của trình duyệt đổi trang không hiệu ứng (Inertia khôi phục lịch sử không qua View Transitions). Cửa hàng dùng chung Archivo với landing.

## Vào trang

Giữ chiều cao phần giới thiệu ngay lần render đầu, không đổi từ danh sách sang màn hình ghim sau khi tải. Tiến độ là byte thật (Content-Length, dự phòng kích thước file đã biết), không giả phần trăm; giữ nội dung mở đầu cho đến lúc model, texture và shader đã sẵn sàng. Chuyển mờ ảnh sang canvas 450ms. Không kéo người dùng về đầu sau khi tải; có bỏ qua/bản tĩnh/thử lại. Tải bị hủy khi 20 giây không nhận thêm byte (mạng chậm nhưng còn chạy thì không bị cắt). Nền là sân thi đấu phối cảnh (SVG tĩnh, số đo BWF 13,40 × 6,10 m, vạch 40 mm, lưới 1,55 m ở cột; `resources/js/lib/court-view.ts`), không thêm vòng render.

Chữ dùng Archivo variable tự host (`public/fonts/archivo`, SIL OFL) có subset tiếng Việt; Instrument Sans của starter không có subset này nên dấu chồng (ể, ừ, ầ) từng rơi về font hệ thống.

Kiểm tra tải bị giữ lại/lỗi: `node tests/loading-browser.mjs` với Chrome debug :9222.

## Giới hạn

Shop có catalog, giỏ, đơn COD và gợi ý theo dữ liệu. Vợt nhập từ VNB ở trạng thái ẩn, tồn kho 0 cho tới khi chủ shop nhập số lượng thật và mở bán; trước đó cửa hàng chỉ hiện sản phẩm demo có nhãn. Ba lối chơi trên landing được đặt theo vị trí trên nửa sân (gần lưới/giữa sân/cuối sân), là định hướng, không phải mẫu bán chạy hay phân loại của hãng. Không có thanh toán online hoặc AI thật; không thu thông tin thẻ. Chưa tuyên bố điểm Core Web Vitals/FPS trên điện thoại thật.

Three.js được tải qua dynamic import; bundle cảnh khoảng 613 KB minified (~154 KB gzip). Build còn cảnh báo kích thước chunk và fontaine tùy chọn của starter; không thêm thư viện chỉ để bỏ cảnh báo.
