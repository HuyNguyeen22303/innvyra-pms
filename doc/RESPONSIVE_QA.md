# Responsive Innvyra PMS

Ngày rà: **17/11/2026** · Nhánh: **feature/responsive**.

## Phạm vi thay đổi

- Chỉ frontend và tài liệu/ảnh kiểm thử. Không đổi API, phân quyền, phép tính tiền, dữ liệu hay nghiệp vụ; không chạy migration/seed.
- Điện thoại dưới 768px; tablet/workspace gọn dưới 1200px; sidebar từ 1200px.
- Bảng nghiệp vụ dùng cùng một Ant Table và cùng dữ liệu, phân trang, callback. Trên mobile đổi thành thẻ, giữ thông tin chính và trạng thái; nút **Chi tiết** mở các trường còn lại, **Thao tác khác** mở các thao tác phụ.
- Bảng sổ tiền, báo cáo và sổ kho tiếp tục cuộn ngang trong khung riêng. Bỏ clipping ngang ở body/layout.
- Tab dùng Select trên mobile; bộ lọc phụ có thu gọn, đếm lọc đang áp dụng và xóa lọc. Không tháo cây bộ lọc/form khi thu gọn hoặc resize.
- Khoảng ngày dùng hai lịch đơn trên mobile, giữ giá trị và sắp thứ tự ngày như RangePicker. Nội dung modal cuộn bên trong, footer và nút đóng còn truy cập được; drawer mobile toàn chiều rộng.
- Phiếu thu một cột trên mobile, tiền không bị cắt, chữ ký không gây cuộn ngang. Có CSS riêng cho bản in. QR giữ tỷ lệ vuông. Chi tiết chứng từ về một cột tới 767px.

## Môi trường và cách rà

- Windows, Node 24.11.0; frontend Vite ở localhost:5173, backend sẵn có ở localhost:3000.
- Chromium trong trình duyệt kiểm thử, thay đổi viewport bằng công cụ trình duyệt. Tài khoản seed ADMIN của Lotus và PLATFORM_ADMIN.
- Đối chiếu DOM, ảnh và chiều rộng thực tế. So sánh `documentElement.scrollWidth` với `clientWidth`; vùng cuộn bảng/lịch/biểu đồ được phép rộng hơn khung của chúng.
- 75 lượt rà tab: **25 tab × 375 / 768 / 1440px**. Các route chính được rà riêng; thêm 63 lượt ở kích thước và ranh giới khác.
- Mở form, xem chứng từ và thao tác với bản nháp; không xác nhận đặt phòng, thu/chi, nhận/trả phòng, xuất vật tư hoặc cấp tài khoản. Không ghi dữ liệu nghiệp vụ vào DB.
- Đã rà loading trong lúc tải, kết quả tìm khách rỗng, validation bắt buộc, 403/404 và lỗi khách sạn không tồn tại. Luồng lỗi mạng/khôi phục phiên được kiểm bằng bộ test hiện có và rà giao diện thông báo trong mã.

Đây là kiểm tra viewport Chromium, chưa phải kiểm tra trên điện thoại vật lý/Safari, bàn phím ảo thật hoặc máy in vật lý. QR đã mở modal và lịch sử yêu cầu đã xác nhận; không tạo yêu cầu thu mới chỉ để chụp QR.

## Bảng route

**Đạt**: route được mở và rà bố cục ở 375, 768 và 1440px. Các màn hình đăng nhập và đổi mật khẩu còn được kiểm ở 320px.

| Route | Cách hiển thị | Kết quả |
|---|---|---|
| /dashboard | KPI, công việc, thẻ/bảng | Đạt |
| /calendar | 7 ngày cuộn trong khung, cột phòng và header sticky | Đạt |
| /reservations | Thẻ/bảng và tạo đặt phòng | Đạt |
| /stays | Thẻ/bảng lưu trú và quầy check-in | Đạt |
| /guests | Thẻ/bảng hồ sơ và bộ lọc | Đạt |
| /rooms | Lưới phòng, chế độ bảng và form phòng | Đạt |
| /room-types | Thẻ/bảng hạng phòng | Đạt |
| /housekeeping | Kanban và hàng đợi phòng bẩn | Đạt |
| /maintenance | Sự cố và lệnh khóa phòng | Đạt |
| /services | Yêu cầu và danh mục dịch vụ | Đạt |
| /inventory | Tổng quan và 7 tab còn lại | Đạt |
| /folios | Chọn đơn bằng thẻ/bảng; sổ chi phí và giao dịch cuộn riêng | Đạt |
| /employees | Thẻ/bảng nhân sự | Đạt |
| /reports | 7 báo cáo, biểu đồ và bảng cuộn riêng | Đạt |
| /hotel | Thông tin khách sạn và cấu hình ngân hàng | Đạt |
| /subscription | Danh mục gói và gói đang sử dụng | Đạt |
| /platform | Tổng quan và thông tin quản trị | Đạt |
| /platform/plans | Thẻ/bảng các gói | Đạt |
| /platform/hotels | Tìm kiếm, bộ lọc và thẻ/bảng khách sạn | Đạt |
| /platform/hotels/new | Form tiếp nhận khách sạn | Đạt |
| /platform/hotels/1 | Thuê bao, thông tin, admin và nhật ký | Đạt |
| /platform/account | Thông tin và bảo mật | Đạt |
| /login | Đăng nhập khách sạn, validation rỗng | Đạt |
| /platform/login | Đăng nhập nền tảng | Đạt |
| /change-password | Form đổi mật khẩu; không gửi thay đổi mật khẩu | Đạt |
| /403 và route không tồn tại | Thông báo, nút quay lại | Đạt ở mobile |
| /platform/hotels/999999 | Lỗi dữ liệu, thử lại và về danh sách | Đạt ở mobile |

## Bảng tab

Mỗi mục dưới đây đã chuyển tab bằng Select mobile và tab tablet/desktop. Không có tràn ngang toàn trang ở ba kích thước chính.

| Nhóm | Các tab đã rà |
|---|---|
| Đặt phòng | Danh sách; Tra cứu & tạo đơn |
| Lưu trú | Danh sách & lịch sử; Quầy check-in |
| Buồng phòng | Kanban; Hàng đợi phòng bẩn |
| Bảo trì | Phiếu sự cố; Lệnh khóa phòng |
| Dịch vụ | Yêu cầu; Danh mục |
| Kho | Tổng quan; Vật tư; Danh mục; Định mức; Nhà cung cấp; Nhập; Xuất; Sổ biến động |
| Báo cáo | Doanh thu; Dòng tiền; Mua vật tư; Công suất; Đặt phòng; Vận hành; Công nợ |
| Folio | Sổ chi phí; Lịch sử thanh toán/hoàn tiền (kiểm riêng với folio đã có dữ liệu) |

## Bảng cửa sổ thao tác

Đã lập danh sách các khai báo Modal/Drawer trong `frontend/src`. Quy tắc viewport, scroll, safe area, chữ dài và vùng chạm nằm trong CSS dùng chung. Các cửa sổ theo trạng thái/role chưa mở trực tiếp dùng cùng nền tảng đó; bảng phân biệt rõ mức kiểm tra.

| Nhóm | Đã mở trực tiếp, không lưu | Rà thêm trong mã và component dùng chung |
|---|---|---|
| Điều hướng | Drawer khách sạn/platform; menu platform ở 1024px | Chuyển sidebar tại 1200px |
| Khách | Form từ đặt phòng và từ Hồ sơ khách | Drawer hồ sơ, giấy tờ và xác nhận sửa hồ sơ |
| Đặt phòng | Form tra cứu, chọn phòng/khách, lịch đơn, bản nháp khi resize | Drawer đơn, hủy và no-show |
| Lưu trú | Check-in, đổi phòng, trả phòng | Drawer lịch sử |
| Phòng/hạng phòng | Tạo phòng; tạo hạng phòng | Chỉnh sửa và chuyển trạng thái |
| Nhân sự | Tạo nhân viên | Sửa, reset và Popconfirm kích hoạt/vô hiệu hóa |
| Buồng phòng | Tạo việc; định mức và các dòng vật tư thực tế trên màn hình cấu hình | Phân công, hủy, nghiệm thu, hoàn thành dọn, drawer lịch sử; không chuyển trạng thái nhiệm vụ để tạo ca kiểm thử |
| Bảo trì | Báo sự cố; khóa phòng; lịch đơn trong form khóa | Phân công, bắt đầu/hoàn thành/nghiệm thu/hủy, giải phóng khóa, drawer sự cố/lệnh khóa |
| Dịch vụ | Tạo yêu cầu | Tạo/sửa danh mục, xác nhận hoàn thành/hủy |
| Kho | Nhập kho, bật thanh toán ngay, chi tiết phiếu nhập, xuất kho, tạo danh mục/NCC, chi tiết vật tư, kiểm kê | Sửa vật tư/danh mục/NCC, chi tiết phiếu xuất, trả NCC/đối soát/đảo chi và chi tiết báo cáo mua hàng |
| Folio | Phiếu thu có dữ liệu; modal QR và lịch sử QR | Thu/cọc, điều chỉnh, hoàn tiền, đóng sổ, quyết toán CANCELLED/NO_SHOW |
| Platform | Tạo gói, kỳ thuê bao, cấp admin, yêu cầu reset mật khẩu | Tạm ngừng/mở lại, thông tin tài khoản được cấp; không cấp tài khoản hoặc đổi mật khẩu |
| Gói của khách sạn | Trang danh mục/gói hiện tại | Chi tiết kỳ và yêu cầu đăng ký/gia hạn |

## Tương tác và ranh giới

- [x] Mở **Chi tiết** trên thẻ đặt phòng, lưu trú, khách, nhân viên, bảo trì và kho: không còn trường bị ẩn sau khi mở.
- [x] Menu **Thao tác khác** vẫn mở đúng callback; nhãn nút lấy từ Tooltip có sẵn. Giữ Popconfirm và trạng thái disabled.
- [x] Bộ lọc đặt phòng hiện số đang áp dụng, thu gọn/mở lại, giữ lọc sau resize và xóa lọc được.
- [x] Bản nháp đặt phòng (số khách) giữ nguyên qua 375 → 768 → 1440 → 375. Hồ sơ khách chưa lưu giữ tên khi xoay ngang và trở lại.
- [x] Popup ngày ở đặt phòng/bảo trì chỉ có một lịch, nằm trong màn hình mobile.
- [x] Đổi ngày bắt đầu vượt ngày kết thúc ở form đặt phòng: cặp ngày được sắp lại đúng như RangePicker (19–21/11), không gửi cặp ngày ngược.
- [x] Chạm cột công suất hoặc chú giải nguồn khách hiển thị số liệu trực tiếp trong vùng trạng thái; không phụ thuộc vào tooltip hover. Có thao tác bàn phím và dấu focus.
- [x] Phiếu thu ở 320/375px: một cột, nhãn không cắt, số tiền tách hàng, không có cuộn ngang trong modal.
- [x] Màn hình ngang thấp 844×390: body phiếu thu cuộn riêng, modal kết thúc ở y=382, nút đóng/in còn trong viewport.
- [x] Bổ sung sau phản hồi: menu khách sạn có nút đóng × ở header riêng, vùng chạm 44×44px, không cuộn cùng danh sách. Đã xác nhận bấm đóng ở 320/375/768/1024px sau khi cuộn và đóng bằng Escape. Nguyên nhân cũ là `closable={false}`; đã bật lại và bỏ `height: 100%` ở body để dành chỗ cho header.
- [x] Nút xóa dòng vật tư thực tế đo được 44×44px; dòng vật tư không ép icon vào cột hẹp.
- [x] Các màn hình chính và danh sách platform kiểm thêm 320, 390, 430, 767, 1024, 1199, 1200, 1280, 1920px.
- [x] Bỏ clipping ở toàn trang; xử lý ô tìm dịch vụ 320px, gutter form/modal, chữ dài trong thẻ và chiều rộng chú giải biểu đồ tại thành phần gây lỗi.

## Kết quả lệnh kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npm --prefix frontend test` | 63/63 đạt |
| `npm --prefix frontend run lint` | Đạt |
| `npm --prefix frontend run build` | Đạt |
| `git diff --check` | Đạt |
| `npm --prefix backend test` (không bật TEST_DATABASE_URL) | 531 đạt, 403 bỏ qua, 3 thất bại do số API OpenAPI |
| `python -m pip check` theo AGENTS.md | Không chạy được: Python WindowsApps alias không truy cập được; dự án dùng Node, không thay dependency Python |

Ba lỗi backend nằm ở `guests.http.test.ts`, `rooms.http.test.ts`, `reservations.http.test.ts`: test kỳ vọng **145** operation, OpenAPI hiện trả **153**. Không có diff backend trong nhánh responsive. Không sửa test/backend để vượt giới hạn frontend của đợt này. Các bài MySQL không chạy và không tạo DB kiểm thử.

## Bằng chứng và chạy lại

Ảnh và mẫu đo DOM: [thư mục responsive](responsive/), [qa-metrics.json](responsive/qa-metrics.json).

- [Thẻ đặt phòng 375px](responsive/reservations-375.jpg)
- [Form khách 375px](responsive/guest-form-375.jpg)
- [Phiếu thu 375px](responsive/receipt-375.jpg), [header](responsive/receipt-header-375.jpg), [ngang thấp](responsive/receipt-landscape-844.jpg)
- [Lịch phòng 375px](responsive/calendar-375.jpg)
- [Báo cáo 375px](responsive/reports-375.jpg), [768px](responsive/reports-768.jpg), [1440px](responsive/reports-1440.jpg)
- [Tổng quan desktop](responsive/dashboard-1440.jpg), [sổ kho desktop](responsive/inventory-1440.jpg)
- [Khách sạn platform mobile](responsive/platform-hotels-375.jpg), [menu tablet](responsive/platform-menu-1024.jpg)
- [Nút đóng menu khi đã cuộn xuống cuối, 375px](responsive/menu-close-375.jpg)

Để xem thay đổi, chạy frontend/backend bằng quy trình dev hiện có rồi tải lại trang. Không có dependency mới; không cần lệnh migration/seed. Khi phát hành nên kiểm tra bổ sung Safari iOS/Android thật, bàn phím ảo và in thử PDF/giấy.
