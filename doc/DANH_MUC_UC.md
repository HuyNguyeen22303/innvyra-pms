# Danh mục 13 Use Case Innvyra PMS

Danh mục đã được người dùng yêu cầu triển khai. Giá cơ bản thuộc hạng phòng; Tổng quan và Báo cáo là hai UC riêng. Các mục bên trong là chức năng con, không phải danh mục UC chính mới.

| Mã | UC chính | Use Case | Activity | Sequence |
|---|---|---|---|---|
| UC-01 | Đăng nhập và đăng xuất | [UC-01](Innvyra_13UC.drawio) | [ACT-01](Innvyra_13UC.drawio) | [SEQ-01](Innvyra_13UC.drawio) |
| UC-02 | Quản lý nhân viên và tài khoản | [UC-02](Innvyra_13UC.drawio) | [ACT-02](Innvyra_13UC.drawio) | [SEQ-02](Innvyra_13UC.drawio) |
| UC-03 | Quản lý phòng | [UC-03](Innvyra_13UC.drawio) | [ACT-03](Innvyra_13UC.drawio) | [SEQ-03](Innvyra_13UC.drawio) |
| UC-04 | Quản lý khách hàng | [UC-04](Innvyra_13UC.drawio) | [ACT-04](Innvyra_13UC.drawio) | [SEQ-04](Innvyra_13UC.drawio) |
| UC-05 | Quản lý đặt phòng | [UC-05](Innvyra_13UC.drawio) | [ACT-05](Innvyra_13UC.drawio) | [SEQ-05](Innvyra_13UC.drawio) |
| UC-06 | Quản lý lưu trú | [UC-06](Innvyra_13UC.drawio) | [ACT-06](Innvyra_13UC.drawio) | [SEQ-06](Innvyra_13UC.drawio) |
| UC-07 | Quản lý dịch vụ | [UC-07](Innvyra_13UC.drawio) | [ACT-07](Innvyra_13UC.drawio) | [SEQ-07](Innvyra_13UC.drawio) |
| UC-08 | Quản lý Folio / Thu ngân | [UC-08](Innvyra_13UC.drawio) | [ACT-08](Innvyra_13UC.drawio) | [SEQ-08](Innvyra_13UC.drawio) |
| UC-09 | Quản lý buồng phòng | [UC-09](Innvyra_13UC.drawio) | [ACT-09](Innvyra_13UC.drawio) | [SEQ-09](Innvyra_13UC.drawio) |
| UC-10 | Quản lý bảo trì | [UC-10](Innvyra_13UC.drawio) | [ACT-10](Innvyra_13UC.drawio) | [SEQ-10](Innvyra_13UC.drawio) |
| UC-11 | Quản lý vật tư và kho | [UC-11](Innvyra_13UC.drawio) | [ACT-11](Innvyra_13UC.drawio) | [SEQ-11](Innvyra_13UC.drawio) |
| UC-12 | Xem tổng quan vận hành | [UC-12](Innvyra_13UC.drawio) | [ACT-12](Innvyra_13UC.drawio) | [SEQ-12](Innvyra_13UC.drawio) |
| UC-13 | Xem báo cáo điều hành | [UC-13](Innvyra_13UC.drawio) | [ACT-13](Innvyra_13UC.drawio) | [SEQ-13](Innvyra_13UC.drawio) |

Ký hiệu: A — Quản trị viên; Q — Quản lý; L — Lễ tân; K — Kế toán; B — Buồng phòng; T — Kỹ thuật viên.

## UC-01 Đăng nhập và đăng xuất

Truy cập và kết thúc phiên làm việc bằng tài khoản nhân viên.

| Chức năng con | Quyền tham gia |
|---|---|
| Đăng nhập | A/Q/L/K/B/T: Xử lý |
| Đăng xuất | A/Q/L/K/B/T: Xử lý |

Đăng nhập sai thông tin bị từ chối. Đăng xuất kết thúc phiên hiện tại; không tạo UC riêng cho refresh token.


Nguồn: [LoginPage.tsx](../frontend/src/pages/auth/LoginPage.tsx), [auth.routes.ts](../backend/src/modules/auth/auth.routes.ts), [authStore.ts](../frontend/src/store/authStore.ts).

## UC-02 Quản lý nhân viên và tài khoản

Quản lý hồ sơ, tài khoản và vai trò nhân viên trong khách sạn.

| Chức năng con | Quyền tham gia |
|---|---|
| Tra cứu hồ sơ / danh bạ | A/Q/L/K/B/T: Xem |
| Cấp tài khoản và gán vai trò | A/Q: Xử lý |
| Cập nhật / khóa / mở tài khoản | A/Q: Xử lý |
| Đặt lại mật khẩu | A/Q: Xử lý |

Quản lý chỉ quản trị vai trò cấp dưới theo backend; không có UC chỉnh tùy ý hệ thống quyền hoặc tính lương.

Vai trò ngoài A/Q tra cứu danh bạ phục vụ công việc, không có màn hình quản trị nhân viên.

Nguồn: [EmployeesPage.tsx](../frontend/src/pages/employees/EmployeesPage.tsx), [employee.routes.ts](../backend/src/modules/employees/employee.routes.ts), [staffDirectory.ts](../frontend/src/utils/staffDirectory.ts).

## UC-03 Quản lý phòng

Quản lý cấu hình hạng, phòng vật lý và quan sát tình trạng phòng.

| Chức năng con | Quyền tham gia |
|---|---|
| Quản lý hạng phòng và giá | A/Q: Xem / xử lý; L/K/B/T: Xem |
| Quản lý phòng vật lý | A/Q: Xem / xử lý; L/K/B/T: Xem |
| Xem lịch / sơ đồ phòng | A/Q/L/K/B/T: Xem |

Đọc và sửa có quyền riêng. Nhận/chuyển/trả phòng thuộc UC-06; lịch chỉ là một đường truy cập đến nghiệp vụ đó.

Chỉnh giá cơ bản nằm trong form hạng phòng; giá đơn đã đặt có snapshot riêng.
Lịch dùng nhiều API, có giới hạn dữ liệu; không có một endpoint Calendar tổng hợp.

Nguồn: [RoomsPage.tsx](../frontend/src/pages/rooms/RoomsPage.tsx), [RoomTypesPage.tsx](../frontend/src/pages/room-types/RoomTypesPage.tsx), [RoomMatrixPage.tsx](../frontend/src/pages/calendar/RoomMatrixPage.tsx), [room.routes.ts](../backend/src/modules/rooms/room.routes.ts), [room-type.routes.ts](../backend/src/modules/room-types/room-type.routes.ts).

## UC-04 Quản lý khách hàng

Lưu và tra cứu hồ sơ khách phục vụ đặt phòng và vận hành.

| Chức năng con | Quyền tham gia |
|---|---|
| Tra cứu hồ sơ khách | A/Q/L/K: Xem |
| Thêm / cập nhật hồ sơ | A/Q/L: Xử lý |
| Xóa mềm hồ sơ | A/Q: Xử lý |

Khách là đối tượng được nhân viên nhập thông tin, chưa có tài khoản hoặc cổng khách trực tiếp.

Kế toán chỉ nhận thông tin định danh giới hạn.

Nguồn: [GuestsPage.tsx](../frontend/src/pages/guests/GuestsPage.tsx), [guest.routes.ts](../backend/src/modules/guests/guest.routes.ts).

## UC-05 Quản lý đặt phòng

Tiếp nhận nhu cầu và quản lý cam kết đặt phòng theo kỳ ở.

| Chức năng con | Quyền tham gia |
|---|---|
| Tra phòng trống / tạo đặt phòng | A/Q/L: Xem / xử lý |
| Tra cứu đơn đặt phòng | A/Q/L/K: Xem |
| Hủy đơn / ghi nhận không đến | A/Q/L: Xử lý |

Không thêm đổi ngày, gia hạn hoặc hủy một phần vào mô hình hiện trạng. Hủy/no-show không tự quyết toán tiền.

Đủ tồn mọi đêm; giá và số đêm được lưu theo đơn.
Kế toán không dùng bộ lọc tìm đơn theo tên khách.
Hai lựa chọn độc lập, không thực hiện tuần tự. Service no-show hiện chưa kiểm tra đã qua ngày đến.

Nguồn: [ReservationsPage.tsx](../frontend/src/pages/reservations/ReservationsPage.tsx), [reservation.routes.ts](../backend/src/modules/reservations/reservation.routes.ts).

## UC-06 Quản lý lưu trú

Ghi nhận sử dụng phòng thực tế từ nhận phòng đến trả phòng.

| Chức năng con | Quyền tham gia |
|---|---|
| Nhận phòng | A/Q/L: Xử lý |
| Tra cứu lưu trú và lịch sử | A/Q/L/K: Xem |
| Chuyển phòng / trả phòng | A/Q/L: Xử lý |

Nhận/chuyển/trả là các thao tác độc lập. Trả phòng vật lý không yêu cầu dư nợ bằng 0 và không tự đóng sổ.

Đúng ngày đến; cùng hạng; phòng ACTIVE, READY, trống và không xung đột.
Chuyển chỉ cùng hạng và trong kỳ đặt; trả phòng không đồng nghĩa đóng folio.

Nguồn: [StaysPage.tsx](../frontend/src/pages/stays/StaysPage.tsx), [stay.routes.ts](../backend/src/modules/stays/stay.routes.ts).

## UC-07 Quản lý dịch vụ

Quản lý danh mục và sử dụng dịch vụ trong thời gian khách đang ở.

| Chức năng con | Quyền tham gia |
|---|---|
| Quản lý danh mục dịch vụ | A/Q: Xem / xử lý; L/K: Xem |
| Tạo yêu cầu sử dụng dịch vụ | A/Q/L: Xử lý |
| Hoàn tất / hủy yêu cầu | A/Q/L: Xử lý |

Danh mục và yêu cầu là hai tab trong cùng UC chính. Không tự trừ vật tư kho khi hoàn tất dịch vụ.

Có thể lập yêu cầu trước khi mở folio.
Hoàn tất cần folio mở, ghi phí một lần; hủy chỉ khi yêu cầu chưa hoàn tất.

Nguồn: [ServicesPage.tsx](../frontend/src/pages/services/ServicesPage.tsx), [billing.routes.ts](../backend/src/modules/billing/billing.routes.ts).

## UC-08 Quản lý Folio / Thu ngân

Theo dõi khoản phí, khoản thu và công nợ của từng đơn đặt phòng.

| Chức năng con | Quyền tham gia |
|---|---|
| Mở / xem folio và công nợ | A/Q/L/K: Xem / xử lý |
| Ghi nhận thu tiền / đặt cọc | A/Q/L/K: Xử lý |
| Hoàn tiền / điều chỉnh phí | A/Q/K: Xử lý |
| Quyết toán và đóng folio | A/Q/K: Xử lý |

Chỉ ghi nhận tiền nhân viên đã nhận/đã hoàn; không có chuyển tiền ngân hàng tự động. Trả phòng khác đóng folio.

Xem sổ đã có không tạo sổ mới.
Hoàn tiền làm đổi tiền đã thu; điều chỉnh DEBIT/CREDIT làm đổi phí. Hai lựa chọn không tự thay thế nhau.
Dư nợ 0, không việc chờ; đơn hủy hoặc CHECKED_OUT và mọi phòng đã trả. NO_SHOW chưa thuộc đường đóng hiện tại.

Nguồn: [BillingPage.tsx](../frontend/src/pages/billing/BillingPage.tsx), [billing.routes.ts](../backend/src/modules/billing/billing.routes.ts).

## UC-09 Quản lý buồng phòng

Điều phối và kiểm tra vệ sinh để chuẩn bị phòng đón khách.

| Chức năng con | Quyền tham gia |
|---|---|
| Theo dõi việc dọn / phòng bẩn | A/Q/L: Xem; B: Xem việc được giao |
| Tạo / phân công / hủy việc dọn | A/Q: Xử lý; L: Tạo việc |
| Thực hiện việc được giao | A/Q/B: Xử lý |
| Kiểm tra / yêu cầu làm lại | A/Q: Xử lý |

Báo dọn xong chưa phải READY. Kiểm tra không đạt đưa task về PENDING và phòng DIRTY.

B chỉ thấy nhiệm vụ được giao; hàng đợi phòng bẩn dành cho A/Q/L.
L chỉ tạo việc; phân công và hủy dành cho A/Q.
Bắt đầu và báo xong cách nhau bởi công việc dọn thực tế; A/Q cũng phải đúng người được giao.

Nguồn: [HousekeepingPage.tsx](../frontend/src/pages/housekeeping/HousekeepingPage.tsx), [housekeeping.routes.ts](../backend/src/modules/housekeeping/housekeeping.routes.ts).

## UC-10 Quản lý bảo trì

Tiếp nhận sự cố, điều phối sửa chữa và kiểm soát khóa phòng.

| Chức năng con | Quyền tham gia |
|---|---|
| Báo / theo dõi sự cố | A/Q/L/B: Xem / xử lý; T: Báo / xem việc được giao |
| Phân công / nghiệm thu / hủy phiếu | A/Q: Xử lý |
| Thực hiện sửa chữa được giao | A/Q/T: Xử lý |
| Quản lý khóa phòng bảo trì | A/Q: Xem / xử lý; L/B/T: Xem |

Sửa xong không tự giải phóng block. Giải phóng khóa và hủy lịch khóa tương lai có điều kiện riêng.

Kỹ thuật viên tra danh sách/chi tiết theo người được giao.
Bắt đầu và báo xong là hai yêu cầu, có thời gian sửa thực tế ở giữa.
Lịch tương lai SCHEDULED chờ worker; không tự mở khóa khi hết ngày.

Nguồn: [MaintenancePage.tsx](../frontend/src/pages/maintenance/MaintenancePage.tsx), [maintenance.routes.ts](../backend/src/modules/maintenance/maintenance.routes.ts).

## UC-11 Quản lý vật tư và kho

Quản lý danh mục, chứng từ và số lượng vật tư phục vụ khách sạn.

| Chức năng con | Quyền tham gia |
|---|---|
| Quản lý danh mục vật tư và NCC | A/Q: Xem / xử lý; K: Xem; B/T: Xem vật tư / nhóm |
| Nhập kho | A/Q: Xem / xử lý; K: Xem |
| Xuất kho | A/Q/B/T: Xem / xử lý; K: Xem |
| Kiểm kê tồn kho | A/Q: Xử lý |
| Theo dõi tồn và biến động | A/Q/K: Xem; B/T: Xem tồn thấp |

Nhập/xuất/kiểm kê có kiểm tra và cập nhật tồn trong giao dịch; không sửa currentStock qua form danh mục vật tư.

B/T chỉ đọc vật tư và nhóm, không đọc nhà cung cấp.
B/T xem tồn thấp, không xem tổng quan định giá hoặc sổ biến động.

Nguồn: [InventoryPage.tsx](../frontend/src/pages/inventory/InventoryPage.tsx), [inventory.routes.ts](../backend/src/modules/inventory/inventory.routes.ts), [StockAdjustmentModal.tsx](../frontend/src/pages/inventory/components/StockAdjustmentModal.tsx).

## UC-12 Xem tổng quan vận hành

Theo dõi tình hình phục vụ và công việc theo vai trò trên trang chủ.

| Chức năng con | Quyền tham gia |
|---|---|
| Xem chỉ số vận hành ngày | A/Q/L: Xem |
| Xem khách đến / đang ở | A/Q/L: Xem |
| Xem tổng quan theo bộ phận | K/B/T: Xem |

Tổng quan là màn hình theo dõi nhanh. Quyền và nguồn dữ liệu của từng vai trò khác nhau.

Các nút Check-in dẫn đến UC-06. Danh sách có giới hạn trang, chưa phải lịch đầy đủ.
K dùng nguồn tài chính; B/T dùng nguồn buồng/bảo trì, không được gọi dashboard API của A/Q/L.

Nguồn: [DashboardPage.tsx](../frontend/src/pages/dashboard/DashboardPage.tsx), [report.routes.ts](../backend/src/modules/reports/report.routes.ts), [reports.api.ts](../frontend/src/api/reports.api.ts).

## UC-13 Xem báo cáo điều hành

Phân tích hoạt động theo kỳ, loại báo cáo và quyền được cấp.

| Chức năng con | Quyền tham gia |
|---|---|
| Xem báo cáo tài chính / công nợ | A/Q/K: Xem |
| Xem công suất / đặt phòng | A/Q/L: Xem |
| Xem báo cáo vận hành | A/Q/L/B/T: Xem |
| Xuất CSV theo loại được hỗ trợ | A/Q: Xuất CSV; K: Xuất CSV tài chính |

Báo cáo khác màn hình tổng quan. Không thêm giao diện procurement hoặc báo cáo chi trả NCC khi frontend chưa có.

L không nhận các trường tiền roomSalesValue, ADR và RevPAR của công suất.
B chỉ khối buồng, T chỉ khối bảo trì.
A/Q: doanh thu, dòng tiền, công suất, đặt phòng; K: doanh thu và dòng tiền.

Nguồn: [ReportsPage.tsx](../frontend/src/pages/reports/ReportsPage.tsx), [report.routes.ts](../backend/src/modules/reports/report.routes.ts), [reports.api.ts](../frontend/src/api/reports.api.ts).
