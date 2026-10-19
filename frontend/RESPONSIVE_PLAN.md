# Kế hoạch Responsive toàn hệ thống Innvyra PMS

## 1. Mục tiêu

Hoàn thiện giao diện responsive cho toàn bộ frontend Innvyra PMS để các luồng chính có thể sử dụng thuận tiện trên điện thoại, máy tính bảng và máy tính để bàn.

Kế hoạch này tập trung vào bố cục và trải nghiệm giao diện. Không thay đổi API, schema cơ sở dữ liệu, quyền truy cập hoặc quy tắc nghiệp vụ. Nếu phát hiện vấn đề nghiệp vụ, ghi nhận riêng để thống nhất trước khi sửa.

## 2. Phạm vi màn hình

Kế hoạch bao gồm tất cả route hiện có trong frontend:

- Đăng nhập, trang 403 và 404.
- Dashboard.
- Lịch ma trận phòng.
- Phòng và hạng phòng.
- Đặt phòng và lưu trú.
- Khách hàng và nhân viên.
- Buồng phòng và bảo trì.
- Dịch vụ và đơn dịch vụ.
- Folio, thanh toán và biên nhận.
- Báo cáo.
- Quản lý vật tư và kho: tổng quan, vật tư, danh mục, nhà cung cấp, phiếu nhập, phiếu xuất, sổ kho và các modal chi tiết/điều chỉnh.

## 3. Nguyên tắc triển khai

1. Làm responsive từ layout và thành phần dùng chung trước, sau đó mới xử lý từng module.
2. Giữ nguyên luồng nghiệp vụ, dữ liệu gửi lên API và quyền theo vai trò.
3. Không thu nhỏ toàn bộ giao diện desktop một cách máy móc; sắp xếp lại nội dung theo mức độ ưu tiên trên màn hình nhỏ.
4. Chỉ cho phép cuộn ngang trong vùng dữ liệu cần thiết như bảng nhiều cột hoặc ma trận phòng; tránh cuộn ngang toàn trang.
5. Không ẩn hành động quan trọng chỉ để vừa màn hình. Ưu tiên menu thao tác, nút rõ ràng hoặc bố cục thẻ.
6. Giữ bộ lọc, phân trang, trạng thái tải/lỗi/rỗng và thông báo thao tác dễ dùng trên cảm ứng.
7. Mỗi phase giữ thay đổi trong phạm vi giao diện; nếu phát hiện cần đổi nghiệp vụ thì tạo ghi chú riêng.

## 4. Kích thước mục tiêu

Dùng breakpoint nhất quán với hệ thống giao diện hiện tại và kiểm tra tối thiểu tại các kích thước sau:

| Nhóm | Kích thước kiểm tra | Kỳ vọng |
| --- | --- | --- |
| Điện thoại nhỏ | 360 × 800 | Nội dung chính vừa màn hình; không tràn ngang toàn trang |
| Điện thoại phổ biến | 390 × 844 | Luồng thao tác thường dùng hoàn chỉnh |
| Máy tính bảng | 768 × 1024 | Bố cục tận dụng được chiều rộng; điều hướng thuận tiện |
| Laptop nhỏ | 1024 × 768 | Bảng và bộ lọc không chồng lấn |
| Desktop | 1440 × 900 | Giữ được bố cục desktop hiện tại |

Nếu có thời gian, kiểm tra thêm 320 × 700 để phát hiện các trường hợp hẹp đặc biệt. Có thể dùng vùng cuộn ngang cục bộ cho bảng hoặc ma trận có nhiều cột.

## 5. Quy ước responsive chung

### Điều hướng và khung trang

- Desktop: giữ sidebar và header theo thiết kế hiện có; bảo đảm vùng nội dung không bị co hoặc tràn khi sidebar thay đổi.
- Mobile: chuyển sidebar thành drawer/menu có thể mở và đóng; menu phải đóng sau khi chọn route.
- Tiêu đề trang, mô tả, nút chính và breadcrumb phải xếp lại gọn trên màn nhỏ.
- Các vùng flex/grid phải cho phép co đúng cách; tránh phần tử con có chiều rộng tối thiểu làm tràn viewport.
- Giữ trạng thái route và quyền truy cập hiện hành khi đổi cách hiển thị menu.

### Bảng, bộ lọc và danh sách

- Bộ lọc xếp thành một hoặc hai cột phù hợp với chiều rộng; nút tìm kiếm/xóa lọc phải dễ chạm.
- Bảng nhiều cột cuộn ngang bên trong vùng bảng, không kéo cả trang theo.
- Giữ các cột nhận diện và thao tác quan trọng; có thể gom thao tác phụ vào menu.
- Với danh sách phù hợp, dùng dạng thẻ trên mobile nếu giúp xem thông tin và thao tác rõ hơn.
- Phân trang, tổng số bản ghi và trạng thái không có dữ liệu phải hiển thị rõ.

### Form, modal và drawer

- Form chuyển thành một cột trên mobile; nhãn và lỗi validation không bị cắt.
- Modal dài chuyển sang gần toàn màn hình hoặc drawer; phần nội dung cuộn riêng, nút xác nhận/hủy luôn dễ tìm.
- Tránh đặt nhiều trường số hoặc ngày trên cùng một hàng khi màn hình hẹp.
- Nút cảm ứng nên có vùng bấm khoảng 44 × 44 px khi không ảnh hưởng bố cục.

### Biểu đồ và dữ liệu chuyên biệt

- Biểu đồ đổi kích thước theo container; legend và tooltip vẫn đọc được.
- Ma trận phòng giữ ý nghĩa cấu trúc; dùng cuộn ngang cục bộ, giữ nhận diện phòng/ngày dễ theo dõi.
- Nội dung tiền tệ, mã phiếu, mã phòng và email dài phải xuống dòng hoặc có cách xem đầy đủ.

## 6. Kế hoạch theo phase

### Phase 0 — Khảo sát và lập danh sách vấn đề `[✅ Hoàn thành]`

**Phạm vi**

- Rà toàn bộ route, layout, bảng, biểu đồ, modal và thao tác chính.
- Mở từng module ở kích thước điện thoại, tablet và desktop.
- Ghi nhận lỗi theo mức độ: chặn thao tác, khó thao tác, lỗi trình bày.
- Chụp/ghi lại trạng thái ban đầu để so sánh sau khi sửa.

**Đầu ra**

- Danh sách vấn đề theo module và mức ưu tiên: Phát hiện lỗi rớt chữ cái theo chiều dọc trên các bảng nhiều cột, lỗi cột Thao tác `fixed: right` đè 50% diện tích màn hình trên mobile, thiếu `scroll.x`.
- Xác định các thành phần đang dùng chung để xử lý một lần.
- Xác nhận phạm vi bao gồm đầy đủ toàn bộ 14 module và phân hệ Inventory.

**Điều kiện hoàn tất**

- Mọi route trong phạm vi đã được kiểm tra ở điện thoại, tablet và desktop.
- Các lỗi gây tràn trang, ép co chữ hoặc che khuất màn hình đã được xử lý triệt để.

### Phase 1 — Nền tảng dùng chung `[✅ Hoàn thành]`

**Phạm vi**

- MainLayout: sidebar, header, vùng nội dung, khoảng cách và chiều rộng.
- Điều hướng mobile dạng drawer/menu (`placement="left"`, 270px).
- CSS toàn cục (`src/index.css`): khóa `overflow-x: hidden`, tối ưu touch target.
- Tiêu đề trang, thanh công cụ, hàng bộ lọc, nhóm nút co giãn linh hoạt.
- Kiểu hiển thị chung cho bảng, vùng cuộn, modal/drawer (`width={screens.xs ? '100%' : ...}`).
- Đăng nhập, 403 và 404: responsive container, căn giữa, thẻ demo account tự động wrap.

**Đầu ra**

- Khung trang dùng mượt mà trên điện thoại, tablet và desktop.
- Quy ước responsive nhất quán đã được áp dụng toàn bộ app.

**Điều kiện hoàn tất**

- Mở và chuyển route trên mobile bằng Drawer mượt mà, tự động đóng sau khi click.
- Header, sidebar, tiêu đề và nút chính không còn hiện tượng chồng lấn.
- RBAC và quyền truy cập bảo toàn 100%.

### Phase 2 — Dashboard và luồng phòng/tiền sảnh `[✅ Hoàn thành]`

**Module**

- Dashboard.
- Lịch ma trận phòng.
- Phòng và hạng phòng.
- Đặt phòng.
- Lưu trú/check-in/check-out.

**Công việc trọng tâm**

- Sắp xếp lại thẻ chỉ số và biểu đồ dashboard (Grid `xs={12} lg={6}`, table `scroll.x: 680-700`).
- Làm ma trận phòng có vùng cuộn ngang riêng (`overflowX: auto`), giữ cột Số phòng cố định `left: 0`, Drawer `width={screens.xs ? '100%' : 420}`.
- Cải thiện bảng, bộ lọc, chi tiết đặt phòng (bảng `scroll.x: 1350`, tên khách `width: 220` + `nowrap`, Thao tác dynamic fixed, Drawer timeline card không gãy ngày tháng).
- Bảng phòng vật lý và hạng phòng (Table view `scroll.x: 1000`, `nowrap`, Modal form grid 1 cột trên mobile).
- Bảng lưu trú & Quầy Check-in (`scroll.x: 1200`, `nowrap`, Thao tác dynamic fixed).

**Điều kiện hoàn tất**

- Thao tác tìm kiếm, xem chi tiết và check-in/check-out hoạt động chuẩn xác trên mobile.
- Cuộn ma trận và bảng dữ liệu cục bộ trơn tru, không gây tràn ngang toàn trang.
- Trạng thái, ngày giờ, giá và hành động hiển thị rõ ràng, không bị che cắt.

### Phase 3 — Vận hành khách sạn và dịch vụ `[✅ Hoàn thành]`

**Module**

- Buồng phòng.
- Bảo trì.
- Dịch vụ/danh mục dịch vụ/đơn dịch vụ.

**Công việc trọng tâm**

- Điều chỉnh Kanban buồng phòng: cuộn ngang trực quan, thẻ nhiệm vụ hiển thị gọn gàng; bảng Hàng đợi phòng dơ bổ sung `scroll.x: 1100`, Hạng phòng `width: 180` + `nowrap`, Thao tác dynamic fixed.
- Danh sách phiếu bảo trì (`scroll.x: 1250`, Tiêu đề `width: 250` + `nowrap`) và Lệnh khóa phòng (`scroll.x: 1080`, Lý do `width: 250` + `nowrap`).
- Xếp lại danh mục dịch vụ (`scroll.x: 1080`, Tên `width: 220` + `nowrap`) và Đơn dịch vụ (`scroll.x: 1250`, Chi tiết items `width: 320` + `nowrap`).
- Toàn bộ cột Thao tác chuyển sang `fixed: (screens.xs ? false : 'right')`.

**Điều kiện hoàn tất**

- Nhân viên buồng phòng và kỹ thuật viên thao tác tiện lợi trên điện thoại tại phòng khách.
- Các nút Bắt đầu / Báo xong / Nghiệm thu / Đóng phiếu dễ tìm, không bị che khuất.
- Form và modal bảo trì, buồng phòng co giãn tốt.

### Phase 4 — Khách hàng, nhân viên, thanh toán và báo cáo `[✅ Hoàn thành]`

**Module**

- Khách hàng.
- Nhân viên và modal tạo/sửa/reset mật khẩu.
- Folio, thanh toán và biên nhận.
- Báo cáo và xuất dữ liệu.

**Công việc trọng tâm**

- Bảng khách hàng: `scroll.x: 1050`, Họ tên `width: 200` + `nowrap`, Email `width: 220` + `nowrap`, Drawer định danh `width={screens.xs ? '100%' : 560}`.
- Bảng nhân viên: `scroll.x: 1100`, Tên & user, email, ngày tạo có `nowrap`, Thao tác dynamic fixed.
- FolioTab: Cả 3 bảng đều bổ sung `scroll.x` (Đơn đặt phòng: 1050px, Sổ cái Folio Items: 1100px, Lịch sử thanh toán: 1220px), cố định width và `nowrap` cho các cột diễn giải, mã tham chiếu.
- Báo cáo (`ReportsPage.tsx`): Cả 6 tab (Doanh thu, Dòng tiền, Công suất, Đặt phòng, Vận hành, Công nợ Outstanding) đều có `scroll.x: 750-1000`, bộ lọc ngày và preset wrap tự nhiên.

**Điều kiện hoàn tất**

- Không cắt mất số tiền, mã hóa đơn, trạng thái thanh toán và thông tin cá nhân.
- Thao tác lọc và xuất báo cáo CSV hoàn toàn sử dụng được trên màn hình nhỏ.
- Dữ liệu nhiều cột cuộn nội bộ trơn tru, không xô lệch trang.

### Phase 5 — Quản lý vật tư và kho `[✅ Hoàn thành]`

**Module**

- Tổng quan kho.
- Vật tư và chi tiết vật tư.
- Danh mục.
- Nhà cung cấp.
- Phiếu nhập và chi tiết phiếu.
- Phiếu xuất và chi tiết phiếu.
- Điều chỉnh tồn kho.
- Sổ kho/biến động.

**Công việc trọng tâm**

- Tối ưu thanh tab phân quyền (7 tabs cho Admin/Manager/Accountant, 3 tabs cho Buồng phòng/Kỹ thuật) tự động cuộn ngang khi màn hình hẹp.
- Thêm `scroll.x` cho toàn bộ các bảng trong 7 tab:
  - Bảng Sắp hết hàng (`scroll.x: 860`), Bảng Danh mục tổng quan (`scroll.x: 560`).
  - Bảng Vật tư (`scroll.x: 1110`, Tên `width: 220` + `nowrap`).
  - Bảng Danh mục (`scroll.x: 980`), Bảng Nhà cung cấp (`scroll.x: 1150`).
  - Bảng Phiếu nhập (`scroll.x: 1000`), Bảng Phiếu xuất (`scroll.x: 1010`).
  - Bảng Biến động sổ kho (`scroll.x: 1500`, Ghi chú `width: 200` + `nowrap`).
- Modal Xem chi tiết phiếu nhập và phiếu xuất: Nâng cấp `width={screens.xs ? '100%' : ...}` và thêm `scroll.x` cho bảng hàng hóa bên trong.
- Cột Thao tác chuyển sang dynamic fixed giải phóng diện tích màn hình.

**Điều kiện hoàn tất**

- Nhân viên kho, buồng phòng và kỹ thuật tạo phiếu xuất, kiểm tra tồn và xem chứng từ dễ dàng trên di động.
- Không bị nhầm lẫn số lượng, đơn vị, đơn giá hay che khuất mã phiếu.

### Phase 6 — Kiểm thử responsive toàn hệ thống và hoàn thiện `[✅ Hoàn thành]`

**Phạm vi**

- Rà soát toàn bộ route ở 5 kích thước chuẩn: 360px, 390px, 768px, 1024px, 1440px.
- Đăng nhập kiểm thử cả 6 vai trò: Admin, Manager, Receptionist, Accountant, Housekeeping, Technician.
- Xử lý dứt điểm các lỗi rớt chữ cái dọc và lỗi đè cột sticky trên mobile.
- Kiểm tra tính toàn vẹn luồng nghiệp vụ trên desktop (không phát sinh hồi quy).

**Điều kiện hoàn tất**

- Mọi route đều hoạt động mượt mà trên cả 3 nền tảng: điện thoại, tablet, desktop.
- Không có hiện tượng tràn ngang toàn trang ngoài chủ ý.
- Bảng và ma trận cuộn ngang nội bộ chuẩn xác, nội dung không bao giờ bị bẻ gãy ký tự dọc.
- `npm run build` (`tsc -b && vite build`): **100% biên dịch thành công, 0 lỗi TypeScript**.
- `npm run lint` (`oxlint`): **0 lỗi linter**.

## 7. Checklist kiểm tra theo module

- [x] **Login**: Form đăng nhập chuẩn responsive, thông báo lỗi bắt từ server, bộ chọn tài khoản demo tự động wrap linh hoạt.
- [x] **Dashboard**: 4 thẻ KPI vận hành & 4 thẻ tài chính co giãn `xs={12} lg={6}`, bảng Arrivals (`scroll.x: 680`) và In-House (`scroll.x: 700`) cuộn ngang mượt mà, tên khách không rớt dòng.
- [x] **Lịch phòng (Room Matrix)**: Ma trận phòng cuộn ngang nội bộ (`overflowX: auto`), cột Số phòng ghim cố định `left: 0`, Drawer chi tiết ô phòng `width={screens.xs ? '100%' : 420}`.
- [x] **Phòng / Hạng phòng**: Chuyển đổi linh hoạt Grid View (thẻ phòng `xs={12} sm={8}`) và Table View (`scroll.x: 1000`, Hạng phòng & Khách lưu trú `nowrap`), Modal tạo/sửa phòng 1 cột trên mobile.
- [x] **Đặt phòng**: 5 thẻ KPI, bảng danh sách (`scroll.x: 1350`, Khách hàng `width: 220` + `nowrap`, Thao tác dynamic fixed), Drawer chi tiết thẻ Timeline không gãy ngày tháng, công cụ tra cứu tồn phòng Tab 2 trực quan.
- [x] **Lưu trú**: Bảng Lưu trú & Quầy Check-in (`scroll.x: 1200`, Khách `width: 200` + `nowrap`, Thao tác dynamic fixed), Drawer chi tiết lưu trú và các modal Check-in / Transfer / Check-out tương thích mobile.
- [x] **Khách hàng**: Thẻ thống kê định danh, bảng khách hàng (`scroll.x: 1050`, Họ tên `width: 200` + `nowrap`, Email `width: 220` + `nowrap`), Drawer hồ sơ định danh `width={screens.xs ? '100%' : 560}`.
- [x] **Buồng phòng**: 4 cột Kanban buồng phòng hiển thị trực quan, bảng Hàng đợi phòng dơ (`scroll.x: 1100`, Hạng phòng `width: 180` + `nowrap`, Thao tác dynamic fixed), Drawer lịch sử kiểm toán.
- [x] **Bảo trì**: Bảng Phiếu sự cố kỹ thuật (`scroll.x: 1250`, Tiêu đề & Mô tả `width: 250` + `nowrap`) và Bảng Lệnh khóa phòng (`scroll.x: 1080`, Lý do `width: 250` + `nowrap`), Thao tác dynamic fixed.
- [x] **Dịch vụ**: Bảng Danh mục dịch vụ (`scroll.x: 1080`, Tên `width: 220` + `nowrap`) và Bảng Đơn dịch vụ (`scroll.x: 1250`, Chi tiết items `width: 320` + `nowrap`), Thao tác dynamic fixed.
- [x] **Folio / Thanh toán**: Bảng Đơn đặt phòng (`scroll.x: 1050`), Bảng Sổ cái chi phí (`scroll.x: 1100`, Diễn giải `width: 250` + `nowrap`), Bảng Lịch sử thanh toán (`scroll.x: 1220`, Tham chiếu `width: 220` + `nowrap`), Thao tác dynamic fixed.
- [x] **Nhân viên**: Bảng danh sách nhân sự (`scroll.x: 1100`, Nhân viên/User/Email `nowrap`, Thao tác dynamic fixed), Modal tạo/sửa nhân viên và Reset mật khẩu co giãn tốt.
- [x] **Báo cáo**: Cả 6 tab (Doanh thu, Dòng tiền, Công suất, Đặt phòng, Vận hành, Công nợ Outstanding) đều có `scroll.x: 750-1000`, cột `nowrap`, bộ lọc ngày và preset wrap tự nhiên.
- [x] **Inventory**: Cả 7 tab (`Overview`, `Items`, `Categories`, `Suppliers`, `Receipts`, `Issues`, `Movements`) và 2 Modal chi tiết đều có `scroll.x`, cột text cố định width + `nowrap`, Thao tác dynamic fixed, modal chi tiết `width={screens.xs ? '100%' : ...}`.
- [x] **403 / 404**: Khung hiển thị căn giữa chuẩn responsive, nút CTA to rõ, điều hướng an toàn.

## 8. Quy trình làm việc và kiểm soát phạm vi

1. Làm trên một nhánh responsive riêng, được tạo từ phiên bản có đủ các module cần xử lý.
2. Hoàn thành và rà lại từng phase trước khi chuyển sang phase kế tiếp.
3. Commit theo phase hoặc nhóm module; ghi rõ phạm vi responsive đã thay đổi.
4. Nếu phát hiện lỗi nghiệp vụ, ghi lại route, vai trò, bước tái hiện và kết quả mong muốn; không tự thay đổi quy tắc nghiệp vụ trong phase responsive.
5. Không chạy seed trên database đang dùng chỉ để kiểm tra giao diện. Dùng dữ liệu hiện có hoặc database kiểm thử riêng theo quy trình của nhóm.
6. Sau mỗi phase, kiểm tra lại ít nhất một luồng desktop và một luồng mobile của module vừa sửa.

## 9. Tiêu chí hoàn thành toàn dự án

- Tất cả route hiện có đã được rà soát.
- Menu và luồng điều hướng hoạt động trên màn hình nhỏ.
- Màn hình không có lỗi tràn, chồng lấn hoặc mất thao tác quan trọng.
- Bảng, ma trận, form, modal và biểu đồ có cách hiển thị phù hợp theo kích thước.
- Không phát sinh thay đổi API, database hoặc nghiệp vụ ngoài phạm vi đã thống nhất.
- Frontend build/lint và kiểm tra thủ công trên các viewport mục tiêu hoàn tất.

