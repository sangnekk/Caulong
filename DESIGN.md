# Shop Cầu Lông — Landing

## Scene

Buổi ra mắt sản phẩm trong nhà thi đấu đã tắt đèn khán đài: chỉ một sân được rọi sáng. Màn đầu là sân thi đấu nhìn như máy quay truyền hình, từ sau đường biên cuối, cao và xa: thảm xanh, vạch trắng đúng số đo BWF, lưới giữa sân, xung quanh chìm vào bóng tối; cây vợt 3D đứng trên nửa sân gần. Sau câu chuyện: lối chơi trên nửa sân (nền tối), dải tư vấn chọn vợt (giấy trắng), hỏi đáp (giấy xám rất nhạt), chân trang tối. Chỉ hai thế giới: bóng tối nhà thi đấu và giấy trắng.

## Concept

"Căng dây". Màn mở đầu là bản vẽ nét của chính Hyper Core8000 (số đo lấy từ model, đầu dây trùng lưới dây đã bake). Dây được đan theo tiến độ tải thật: 20 dây dọc từ giữa ra hai bên, rồi 24 dây ngang từ đầu vợt xuống, như thợ căng vợt. Khi 3D sẵn sàng, camera lùi từ cận cảnh đầu vợt về đúng tư thế vợt 3D, bản vẽ mờ dần thành vợt thật; header và chữ vào sau. Không có màn tải thứ hai.

## Palette

Drenched tối. Nền nhà thi đấu oklch(0.145 0.032 262) (cũng là nền `html` của landing để chuyển trang không lóe), mặt nổi oklch(0.19 0.04 262); mặt sân oklch(0.44 0.15 262) chỉ ở chính sân; vạch sân oklch(0.97 0.012 250); chữ phụ trên nền tối oklch(0.84 0.022 262), chữ mờ oklch(0.7 0.028 262). Quả cầu (chanh) oklch(0.91 0.14 115) chỉ cho thứ đang chuyển động hoặc đang chọn: dây đang căng, chương hiện tại, nút chính, vùng sân đã chọn, một dải gợi ý. Giấy oklch(1 0 0), giấy xám oklch(0.972 0.005 262), mực oklch(0.19 0.02 262), mực phụ oklch(0.42 0.025 262). Chữ trắng trên sân 8:1, chanh trên sân 6,2:1, mực trên chanh 14:1.

## Type

Archivo variable (SIL OFL, tự host ở public/fonts/archivo, có subset tiếng Việt nên dấu chồng không rơi về font hệ thống). Một họ chữ: tiêu đề đứng, 600, rộng 106%, tracking -0.028em, line-height 1.04, cân dòng (`text-wrap: balance`): tự tin mà không hét; nội dung 400 rộng 100%; nhãn và nút 500–600. Lời giới thiệu ngắn, một ý mỗi chương. Cửa hàng dùng chung Archivo (độ rộng thường); admin dùng font hệ thống.

## Layout

Nhịp kể chuyện NANFU: header trong suốt trên sân; một sân khấu sticky 100svh xuyên 6 chương (720svh desktop/650svh mobile). Sân vẽ phối cảnh bằng SVG tĩnh (`lib/court-view.ts`: chiếu một lần từ số đo mét, vạch là dải 40 mm nên mảnh dần theo khoảng cách): màn rộng đặt sân lệch phải dưới cây vợt, chữ nằm trên nền tối bên trái có lớp phủ nhẹ; điện thoại nhìn cao hơn, lưới ngang giữa màn hình, chữ trên nửa sân gần có lớp phủ từ dưới lên. Canvas 3D trong suốt đè lên; sân đứng yên, chỉ vợt và camera chuyển động. Chế độ đọc tĩnh bỏ sân. Lối chơi đặt lên nửa sân: Tốc độ gần lưới, Cân bằng giữa sân, Tấn công cuối sân; không dùng lưới thẻ.

## Interaction

Header landing ghim, nút cửa hàng luôn hiện; menu landing chỉ neo tới các phần của chính trang (Cây vợt, Lối chơi, Gợi ý chọn vợt, Hỏi đáp), còn sang trang khác thì qua nút. Header cửa hàng ba nhóm: thương hiệu, các trang của cửa hàng (Cửa hàng, Gợi ý chọn vợt, Tìm hiểu vợt) có vạch dưới cho trang hiện tại, rồi giỏ hàng (số chỉ hiện khi có hàng) và tài khoản ở mép phải; điện thoại: thương hiệu + giỏ + tài khoản một hàng, các trang thành tab bên dưới. Cùng một trang thì cùng một tên ở mọi nơi; chuyển trang bằng View Transitions: giữa các trang cùng một trục dọc, nội dung cũ nhấc lên và tắt trong 100ms, nội dung mới nhô lên vào chỗ ngay sau (320ms), hai trang chỉ chồng vài khung hình nên không bao giờ thấy hai bố cục xuyên qua nhau; từ landing vào cửa hàng, cả trang cửa hàng trắng (cùng header) trồi lên như một tấm che nhà thi đấu tối đang lùi và tối dần (480ms), quay về landing thì ngược lại, không hòa màu tối/sáng; header cửa hàng và thanh bên admin đứng yên, ảnh sản phẩm biến hình từ thẻ sang trang chi tiết. Model 3D bắt đầu tải cùng chunk trang, song song three.js; mở đầu chỉ đóng khi 3D sẵn sàng, khi lỗi, khi hết trần 10 giây, hoặc khi Bỏ qua/Escape. Nếu đóng sớm, nút "Đang căng dây…" giữ cùng tiến độ tại chỗ. Native scroll + requestAnimationFrame chỉ khi có sự kiện; không chặn wheel/touch. Giảm chuyển động: không tải 3D, không animation. Fallback poster khi lỗi, retry giữ tiến độ; không giả các lớp carbon. Dây dựng bổ sung để minh họa, công khai khác biệt với model gốc.

## Admin

Công cụ làm việc, không phải trang giới thiệu: font hệ thống, nền xám lạnh oklch(0.976 0.005 262), bảng trắng viền mảnh, xanh sân oklch(0.44 0.15 262) chỉ cho hành động và vị trí hiện tại; màu trạng thái mang nghĩa (chờ vàng nâu, xác nhận xanh, đang giao tím, đã giao xanh lá, hủy đỏ) và luôn kèm chữ. Số trong cột dùng chữ số đều (tabular), số lớn trong ô chỉ số dùng chữ số tự nhiên.

Sản phẩm: bấm vào giá hoặc tồn kho để sửa nhanh ngay dưới dòng (giá bán, giá nhập kèm lãi/biên, tồn kho; Enter lưu, Esc đóng); cả ô chọn là vùng bấm 48px; chọn cả trang rồi “Chọn tất cả N sản phẩm khớp bộ lọc”. Bộ lọc áp dụng ngay khi đổi, gõ tìm tự tìm sau 0,45 giây.

Báo cáo (`/admin/reports`): một hàng lọc duy nhất phía trên mọi thứ (kỳ 7/30/90 ngày, 12 tháng; tính cả đơn mẫu có nhãn cảnh báo); hàng chỉ số có thay đổi so với kỳ trước bằng mũi tên + chữ (màu chỉ báo tốt/xấu, tỉ lệ hủy tăng là xấu). Biểu đồ vẽ tay bằng SVG, một trục tiền: cột doanh số (xanh #2a78d6, dày tối đa 24px, bo 4px ở đầu giá trị) và đường tiền đã thu (cam #eb6834, 2px); cặp màu đã kiểm tra mù màu và tương phản bằng validator của skill dataviz. Luôn có chú giải, lưới mảnh liền, nhãn chỉ ở cột cao nhất; rê chuột, chạm hoặc phím mũi tên hiện từng ngày; bảng số liệu đầy đủ ngay dưới. Xếp hạng (bán nhiều nhất, theo hãng, theo lối chơi) là thanh ngang một màu kèm số tiền chính xác. Chữ không bao giờ mang màu dữ liệu. Admin chỉ có giao diện sáng.
