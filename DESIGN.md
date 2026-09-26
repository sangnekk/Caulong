# Shop Cầu Lông — Landing

## Scene

Người chơi ngồi ngoài sân cầu lông dưới đèn sáng, dùng điện thoại so sánh vợt: chữ tối trên nền trắng; hero cobalt như bảng sân đấu, vợt có ánh sáng rõ.

## Palette

Committed strategy. Primary oklch(0.40 0.13 260); hero oklch(0.36 0.12 260); background oklch(1 0 0); ink oklch(0.20 0.015 260); muted oklch(0.44 0.025 260); accent oklch(0.91 0.14 115). Accent dùng chữ tối; cobalt dùng chữ trắng.

## Type

Giữ font Instrument Sans của starter để không thêm tải font; heading 600, tối đa 6rem, tracking -0.035em. Nội dung 16px trở lên.

## Layout

Tham khảo nhịp kể chuyện NANFU: header trong suốt trên nền cobalt tối; một sân khấu sticky 100svh xuyên 6 chương (720svh desktop/650svh mobile). Toàn vợt, cận khung/gen, thân, cán, mặt dây đan, lối chơi. Giữ model cùng phía, mỗi chương giải thích Cấu tạo/Vai trò với marker theo tọa độ 3D. Chữ thay phiên, camera theo vị trí cuộn và đảo chiều được. Sau sân khấu mới hiện bộ sưu tập/footer. Chế độ đọc tĩnh hiển thị tất cả nội dung; màn hình thấp hoặc reduced-motion không ghim.

## Interaction

3D lazy-load. Native scroll + requestAnimationFrame chỉ khi có sự kiện; không chặn wheel/touch. Thanh chương bàn phím, bỏ qua giới thiệu, đọc không chuyển động. Chỉ một chapter active/inert được điều phối cùng camera. Fallback poster khi lỗi, retry giữ tiến độ; không giả các lớp carbon. Dây dựng bổ sung để minh họa, công khai khác biệt với model gốc.
