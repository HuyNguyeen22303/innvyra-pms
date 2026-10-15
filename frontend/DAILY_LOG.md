# 📓 NHẬT KÝ PHÁT TRIỂN FRONTEND — INNVYRA PMS

Tài liệu này ghi lại chi tiết tiến độ, công việc thực hiện, quyết định kỹ thuật và kết quả theo từng ngày trong quá trình xây dựng giao diện ứng dụng quản lý khách sạn **Innvyra PMS**.

---

## 📅 Ngày: 15/10/2026

### 🎯 Mục tiêu trong ngày:
- Khởi động dự án Frontend cho môn Phân tích & Thiết kế Hệ thống.
- Phân tích tài liệu thiết kế đồ án (`.docx`) và mã nguồn Backend có sẵn.
- Thống nhất công nghệ, cấu trúc thư mục, quy trình Git Flow và bảng màu giao diện.
- Hoàn thành trọn vẹn **Phase 1: Foundation & Setup** trên nhánh `feature/fe-foundation`.

---

### 🔍 Nghiên cứu & Phân tích hệ thống:
1. **Khảo sát tài liệu thiết kế:**
   - Hệ thống quản lý tài sản lưu trú (PMS) cho khách sạn giả định **Innvyra Hotel (50 phòng, 4 hạng phòng)**.
   - Nắm rõ 14 Use Cases nghiệp vụ: Đăng nhập, Quản lý phòng & giá, Đặt phòng, Check-in, Check-out, Folio công nợ, Buồng phòng, Khóa bảo trì, Báo cáo...
   - Phân tích 8 wireframe giao diện từ báo cáo đồ án.

2. **Khảo sát mã nguồn Backend hiện tại (Express + Prisma + MySQL):**
   - Đã có sẵn các module:
     - `auth`: Đăng nhập, làm mới token, đăng xuất, lấy thông tin user, kiểm tra admin.
     - `room-types` & `rooms`: CRUD loại phòng và phòng vật lý, trạng thái vận hành & dọn dẹp.
     - `guests`: CRUD hồ sơ khách hàng, mã hóa giấy tờ tùy thân (AES/HMAC), audit log, phân quyền kế toán.
     - `reservations`: Tra cứu tồn phòng (`/rooms/availability`), tạo đơn, hủy phòng.
     - `stays`: Check-in gán phòng, check-out, đổi phòng giữa kỳ (`transfer`).
   - Yêu cầu bảo mật: Bắt buộc header `X-CSRF-Protection: 1`, HttpOnly Cookie cho Refresh Token, Access Token 15 phút.

3. **Thống nhất chiến lược Git:**
   - Dùng chung nhánh tích hợp `develop` với bạn làm Backend.
   - Mỗi tính năng Frontend phát triển trên một nhánh riêng với tiền tố `feature/fe-...`.
   - Test độc lập, kiểm tra build trước khi tạo Pull Request merge vào `develop`.

---

### 💻 Công việc kỹ thuật đã hoàn thành:

#### 1. Khởi tạo nền tảng dự án (Phase 1):
- Tạo nhánh Git: `feature/fe-foundation`.
- Khởi tạo dự án bằng **Vite 8 + React 19 + TypeScript 6** trong thư mục `frontend/`.
- Cài đặt đầy đủ các thư viện chủ lực:
  - `@ant-design/icons`, `antd`: UI Component framework.
  - `react-router-dom`: Điều hướng SPA.
  - `axios`: HTTP client với interceptor.
  - `@tanstack/react-query`: Quản lý server state và cache.
  - `zustand`: Quản lý auth state toàn cục.
  - `dayjs`: Xử lý ngày tháng.

#### 2. Cấu hình Axios Client & Bảo mật:
- Tạo `src/api/axiosClient.ts`:
  - `baseURL: 'http://localhost:3000/api/v1'`.
  - `withCredentials: true` để trình duyệt tự động gửi/nhận cookie HttpOnly.
  - Tự động đính kèm header `X-CSRF-Protection: 1` cho mọi request.
  - **Cơ chế Silent Refresh Token**: Bắt mã lỗi `401`, hàng đợi (queue) các request đang chờ, tự động gọi `/auth/refresh` và retry lại request mà người dùng không nhận biết gián đoạn.

#### 3. Tinh chỉnh Bảng màu & Thiết kế (Boutique Clean & Crisp):
- Phân tích file mẫu `Innvyra-PMS.html`: Phát hiện vấn đề màu chữ bị chìm (độ tương phản thấp ~2.5:1, cỡ chữ quá nhỏ 9px-10px, màu ngả vàng đục).
- Nâng cấp bảng màu hiện đại tại `src/theme/themeConfig.ts`:
  - **Primary**: Xanh ngọc lục bảo sâu `#1b4d3e` (sang trọng, nổi bật).
  - **Sidebar**: Xanh rừng sẫm `#0f2922` kết hợp chữ trắng/xám sáng `#ffffff` / `#cbd5e1`.
  - **Background**: Xám sáng Slate 50 `#f8fafc`, thẻ Card trắng tinh `#ffffff` viền mỏng `#e2e8f0`.
  - **Typography**: Chữ than sẫm `#0f172a` và `#1e293b` (độ tương phản > 12:1 cực kỳ rõ nét), không dùng chữ dưới 12px.

#### 4. Xây dựng các thành phần giao diện ban đầu:
- `src/layouts/MainLayout.tsx`: Sidebar thu gọn, logo khách sạn `🏨 INNVYRA PMS`, thẻ ca trực, thanh điều hướng theo phân quyền 6 roles, header có Avatar và RoleBadge.
- `src/pages/auth/LoginPage.tsx`: Form đăng nhập chuyên nghiệp, bắt lỗi từ backend, tự động chuyển hướng trang.
- `src/pages/dashboard/DashboardPage.tsx`: 4 thẻ chỉ số KPI vận hành (Phòng có khách 32/50, Khách đến 08, Khách đi 06, Cần dọn 04), bảng phân tab "Khách đến hôm nay / Khách đi hôm nay", ghi chú ca trực.
- `src/components/ProtectedRoute.tsx`: Bảo vệ route theo trạng thái đăng nhập và ma trận quyền hạn (RBAC).
- `src/pages/common/`: Màn hình 403 (Không có quyền), 404 (Không tìm thấy trang), và Placeholder thông báo các phase tiếp theo.

#### 5. Tài liệu & Kiểm thử:
- Tạo tài liệu kiến trúc toàn diện tại `frontend/README.md`.
- Tạo bản demo tương tác 8 màn hình tại `prototype.html`.
- Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript**.
- Đẩy code lên GitHub nhánh `feature/fe-foundation`.

---

### 🚀 Bắt đầu Phase 2 (`feature/fe-auth`) — Đăng nhập & Xác thực API:
1. Đã merge hoàn tất nhánh `feature/fe-foundation` vào nhánh chính `develop`.
2. Khởi tạo nhánh tính năng mới: `feature/fe-auth`.
3. Kiểm tra và khởi động Backend Express API listening trên cổng 3000 kết nối MySQL cục bộ.
4. Kiểm tra tài khoản seed trong database:
   - Mật khẩu mặc định: `Innvyra@Demo2026!`
   - Danh sách tài khoản:
     - `receptionist` (Lễ tân - Trần Ngọc Linh)
     - `manager` (Quản lý - Nguyễn Minh Anh)
     - `accountant` (Kế toán - Lê Thu Hà)
     - `housekeeping` (Buồng phòng - Phạm Thị Lan)
     - `technician` (Kỹ thuật - Hoàng Văn Nam)
5. Nâng cấp màn hình `LoginPage.tsx`:
   - Thêm bộ chọn nhanh tài khoản thử nghiệm (Quick Demo Account Selector).
   - Click chọn vai trò sẽ tự động điền username và password, sẵn sàng bấm đăng nhập kiểm thử.
   - Kiểm tra API `/api/v1/auth/login` hoạt động hoàn hảo 100%, trả về JWT Access Token và HttpOnly Refresh Cookie.
6. Build test `npm run build`: **Thành công 100%, 0 lỗi TypeScript**.
7. Merge nhánh `feature/fe-auth` vào `develop` và đẩy lên GitHub origin (`commit 34af998`).

---

### 🏨 Hoàn thành Phase 3 (`feature/fe-rooms`) — Quản lý Hạng phòng & Sơ đồ Phòng vật lý:

1. **Khởi tạo nhánh tính năng:**
   - Tạo nhánh `feature/fe-rooms` từ `develop` mới nhất.

2. **Đồng bộ cơ sở dữ liệu & Backend:**
   - Chạy lệnh `npx prisma migrate deploy` để áp dụng các migration mới nhất từ phía Backend:
     - `20261014020000_reservation_management`
     - `20261014030000_stay_management`
     - `20261015000000_billing_management`
     - `20261015010000_operations_management`
   - Tạo lại Prisma Client (`npx prisma generate`) để cập nhật type định nghĩa.
   - Kiểm tra dữ liệu seed idempotency: 20 hạng phòng chuẩn quốc tế và 20 phòng vật lý phân bố trên các tầng.

3. **Xây dựng Types & API Client:**
   - `src/types/rooms.types.ts`: Định nghĩa đầy đủ interface TypeScript cho RoomType, RoomItem, Enums trạng thái (`PhysicalStatus`: ACTIVE/MAINTENANCE/OUT_OF_SERVICE, `HousekeepingStatus`: READY/DIRTY/CLEANING/INSPECTION) và DTOs.
   - `src/api/rooms.api.ts`: Xây dựng đầy đủ các hàm gọi API cho `/room-types` và `/rooms` (GET danh sách có lọc, GET chi tiết, POST tạo mới, PATCH cập nhật, DELETE vô hiệu hóa).

4. **Phát triển Màn hình Quản lý Loại phòng (`RoomTypesPage.tsx`):**
   - Bảng Ant Design Table hiển thị: Mã hạng phòng, Tên hạng phòng, Giá cơ bản (VND định dạng chuẩn), Sức chứa (người lớn / trẻ em), Mô tả và Trạng thái kích hoạt.
   - Modal Thêm mới và Chỉnh sửa loại phòng với validation chặt chẽ (mã phòng viết hoa, giá tối thiểu > 0).
   - Nút bật/tắt kích hoạt (Kích hoạt lại / Ngưng áp dụng).
   - Phân quyền (RBAC): Chỉ `ADMIN` và `MANAGER` được quyền thao tác thêm/sửa/tắt; các vai trò khác ở chế độ chỉ đọc.

5. **Phát triển Màn hình Quản lý Phòng vật lý (`RoomsPage.tsx`):**
   - **Chuyển đổi 2 chế độ hiển thị (View Mode):**
     - **Grid View (Sơ đồ phòng trực quan):** Phân chia theo từng tầng (Tầng 1, Tầng 2...), hiển thị thẻ phòng trực quan với màu sắc phản ánh trạng thái dọn buồng (READY - Xanh lá, DIRTY - Cam đỏ, CLEANING - Xanh dương, INSPECTION - Tím) và huy hiệu bảo trì khi phòng gặp sự cố kỹ thuật. Click vào phòng để xem chi tiết hoặc cập nhật nhanh trạng thái.
     - **Table View (Danh sách bảng chi tiết):** Hiển thị chi tiết số phòng, tầng, hạng phòng tương ứng, trạng thái buồng phòng, trạng thái vật lý, ghi chú và các nút thao tác.
   - **Thanh công cụ lọc đa tiêu chí:**
     - Lọc theo tầng (Tất cả, Tầng 1, Tầng 2, Tầng 3...).
     - Lọc theo hạng phòng (Standard, Superior, Deluxe, Suite...).
     - Lọc theo tình trạng dọn dẹp (READY, DIRTY, CLEANING, INSPECTION).
     - Lọc theo tình trạng vật lý (Bình thường, Bảo trì, Ngừng vận hành).
     - Tìm kiếm nhanh theo số phòng (Search input).
   - **Cập nhật nhanh trạng thái (Quick Status Modal):**
     - Cho phép quản lý đổi nhanh trạng thái buồng phòng và trạng thái vật lý cùng ghi chú bảo trì mà không cần vào form sửa cồng kềnh.
   - **Kiểm soát bảo mật RBAC:**
     - Tuân thủ nghiêm ngặt theo phân quyền backend: Chỉ `ADMIN` và `MANAGER` thấy và thực hiện các hành động can thiệp dữ liệu phòng. Nhân viên Lễ tân, Buồng phòng, Kế toán chỉ có quyền tra cứu tình trạng phòng để phục vụ công việc hàng ngày.

6. **Kiểm thử & Biên dịch (Verification):**
   - Tích hợp route `/rooms/types` và `/rooms/inventory` vào `src/routes/AppRoutes.tsx`.
   - Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript**.

7. **Xử lý sự cố kỹ thuật & Tinh chỉnh (Bug Fixes & Refinements):**
   - **Fix lỗi trắng màn hình**: Backend trả về cấu trúc phân trang `{ success: true, data: { items: [...], pagination: { ... } } }`. Ở phiên bản đầu, UI mong đợi mảng phẳng `[...]` nên hàm `rooms.reduce(...)` gây lỗi runtime `TypeError`. Đã bổ sung cơ chế Safe Extraction bóc tách dữ liệu mảng an toàn và bọc `ErrorBoundary.tsx` quanh toàn bộ app để triệt tiêu hiện tượng sập giao diện trắng tinh.
   - **Tuân thủ quy chuẩn khách sạn (Hotel SOP Invariant)**: Khi tạo phòng mới, backend bắt buộc phòng ban đầu phải là `DIRTY` (Chờ dọn dẹp) để nhân viên buồng phòng vào setup trước khi đón khách. Đã khóa ô chọn vệ sinh ban đầu là `DIRTY` kèm hướng dẫn trực quan, đồng thời trích xuất thông báo lỗi chi tiết từ server (`err.response.data.message`).
   - **Tự động hóa Ngày vận hành & Ca trực**: Thay thế ngày tĩnh mẫu đồ án cũ bằng `dayjs().format('DD/MM/YYYY')` lấy chính xác ngày thực tế của máy tính (`15/10/2026`) và ca trực theo giờ.
   - **Đồng bộ số lượng phòng thời gian thực**: Huy hiệu phòng ở Sidebar kết nối API tự động đếm số phòng có trong cơ sở dữ liệu (`● 21 phòng`), tự động cập nhật ngay khi tạo phòng mới.

---

### 🗺️ Bảng Kế Hoạch 10 Phases Toàn Diện Của Đồ Án Innvyra PMS:

| Phase | Nhánh Git | Nội dung công việc | Trạng thái |
| :---: | :--- | :--- | :---: |
| **Phase 1** | `feature/fe-foundation` | Khởi tạo Vite, React 19, TS, AntD, Axios, Theme ngọc lục bảo, Layout | ✅ Đã merge `develop` |
| **Phase 2** | `feature/fe-auth` | Đăng nhập, Demo Account Selector, JWT Silent Refresh, RBAC 6 Roles | ✅ Đã merge `develop` |
| **Phase 3** | `feature/fe-rooms` | CRUD Loại phòng, Sơ đồ phòng Lưới/Bảng, bộ lọc đa năng, cập nhật nhanh | ✅ Đã merge `develop` |
| **Phase 4** | `feature/fe-guests` | Quản lý Khách hàng, CCCD/Passport mã hóa an toàn, phân quyền kế toán | ✅ Đã merge `develop` |
| **Phase 5** | `feature/fe-reservations` | Tra cứu phòng trống theo ngày (`/rooms/availability`), tạo đơn & hủy đặt | ✅ Đã merge `develop` |
| **Phase 6** | `feature/fe-stays` | Check-in gán phòng READY, danh sách lưu trú, check-out và đổi phòng giữa kỳ | ✅ Đã hoàn thành |
| **Phase 7** | `feature/fe-operations` | Bảng nhiệm vụ dọn dẹp buồng phòng Kanban & Lệnh khóa bảo trì phòng | ⏳ Tiếp theo |
| **Phase 8** | `feature/fe-billing` | Chi tiết hóa đơn Folio, thanh toán dịch vụ/tiền phòng, in phiếu thanh toán | ⏳ Kế hoạch |
| **Phase 9** | `feature/fe-matrix-dashboard` | Bảng ma trận phòng theo ngày (Timeline Grid) & Thống kê KPI vận hành | ⏳ Kế hoạch |
| **Phase 10**| `feature/fe-final-polish` | Kiểm thử luồng E2E toàn diện, tài liệu hướng dẫn và đóng gói đồ án | ⏳ Kế hoạch |

---

### 👥 Hoàn thành Phase 4 (`feature/fe-guests`) — Quản lý Khách hàng & Hồ sơ Định danh:

1. **Khởi tạo nhánh tính năng:**
   - Tạo nhánh `feature/fe-guests` từ nhánh `develop` đã tích hợp đầy đủ Phase 1, Phase 2, Phase 3.

2. **Khảo sát nghiệp vụ & Bảo mật PII Backend:**
   - Phân tích cơ chế mã hóa AES-GCM và fingerprint HMAC SHA-256 cho trường `documentNumber` (CCCD/Hộ chiếu).
   - Phân quyền nghiêm ngặt 4 cấp độ theo `guestPermissions`:
     - `write`: `ADMIN`, `MANAGER`, `RECEPTIONIST` (Tạo mới, chỉnh sửa hồ sơ).
     - `delete`: `ADMIN`, `MANAGER` (Xóa mềm lưu vết Audit Log).
     - `sensitive`: `ADMIN`, `MANAGER`, `RECEPTIONIST` (Được xem SĐT, Email, giải mã số CCCD/Passport).
     - `read` (Chế độ Kế toán): `ACCOUNTANT` chỉ được xem Mã và Tên khách hàng để đối soát hóa đơn; toàn bộ PII (SĐT, Email, CCCD, Ngày sinh, Địa chỉ) bị backend tước bỏ để bảo vệ quyền riêng tư của khách hàng.

3. **Xây dựng Types & API Client:**
   - `src/types/guests.types.ts`: Định nghĩa TypeScript interfaces chuẩn cho `GuestSummary`, `GuestDetail`, `CreateGuestDto`, `UpdateGuestDto`, `GuestGender`, `DocumentType`.
   - `src/api/guests.api.ts`: Xây dựng đầy đủ các hàm gọi API cho `/guests` (GET danh sách phân trang có tìm kiếm, GET chi tiết giải mã, POST tạo mới, PATCH cập nhật, DELETE xóa mềm).

4. **Phát triển Màn hình Quản lý Khách hàng (`GuestsPage.tsx`):**
   - **Thẻ thống kê định danh (Metrics Cards):** Tổng hồ sơ khách, Khách nội địa (Việt Nam), Khách quốc tế.
   - **Thanh công cụ tìm kiếm & lọc:** Tìm kiếm theo tên khách, số điện thoại, email; lọc theo quốc tịch; sắp xếp theo tên hoặc ngày tạo mới nhất.
   - **Bảng danh sách khách hàng (Ant Design Table):** Mã khách monospace, Avatar đại diện, Tên khách hàng, Số điện thoại, Email, Quốc tịch (Tag), Ngày tạo hồ sơ, các nút thao tác.
   - **Bảo mật phân quyền (RBAC):**
     - Khi `ACCOUNTANT` đăng nhập: Hiển thị Banner màu xanh thông báo cơ chế bảo vệ PII; các cột SĐT, Email hiển thị trạng thái `🔒 Đã mã hóa`; các nút Sửa/Xóa bị ẩn hoàn toàn.
     - Nút Xóa hồ sơ chỉ xuất hiện cho `ADMIN` và `MANAGER` (kèm xác nhận Popconfirm bảo vệ dữ liệu).
   - **Drawer Xem chi tiết hồ sơ định danh:**
     - Thiết kế giao diện sang trọng chuẩn Boutique Hotel.
     - Hiển thị đầy đủ thông tin cá nhân, ngày sinh, địa chỉ, ghi chú đặc quyền.
     - **Tính năng ẩn/hiện số CCCD/Passport**: Mặc định hiển thị dưới dạng che giấu (`07920******`) với nút con mắt để xem toàn bộ khi cần đối chiếu thủ tục check-in.
   - **Modal Thêm mới / Chỉnh sửa khách hàng:**
     - Form layout 2 cột rõ ràng, trực quan.
     - Validation thông minh: Nếu nhập số giấy tờ thì bắt buộc chọn loại giấy tờ (`NATIONAL_ID`, `PASSPORT`, `DRIVER_LICENSE`, `OTHER`); số điện thoại kiểm tra format chuẩn quốc tế và nội địa.
     - Bắt thông điệp lỗi chi tiết từ Backend.

5. **Tích hợp & Kiểm thử (Verification):**
   - Kết nối route `/guests` vào `AppRoutes.tsx`.
   - Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript**.

---

### 🛎️ Hoàn thành Phase 5 (`feature/fe-reservations`) — Quản lý Đặt phòng & Tra cứu Tồn phòng Thời gian thực:

1. **Khởi tạo nhánh tính năng:**
   - Tạo nhánh `feature/fe-reservations` từ nhánh `develop` đã tích hợp đầy đủ Phase 1, Phase 2, Phase 3, Phase 4.

2. **Khảo sát nghiệp vụ & Ràng buộc Backend (Backend Invariants):**
   - Phân tích chi tiết `reservation.service.ts`, `availability.service.ts` và `reservation.schema.ts`:
     - **Tra cứu phòng trống (`GET /rooms/availability`)**: Bắt buộc `checkOutDate > checkInDate`, tính toán tồn phòng theo đêm cao điểm nhất (`snapshot` giao dịch) và tính dự toán chi phí toàn bộ kỳ lưu trú (`estimatedTotalPerRoom = basePrice * totalNights`).
     - **Tạo đơn đặt phòng (`POST /reservations`)**: 
       - Mảng `rooms` phải có ít nhất 1 phòng và tối đa 100 phòng.
       - Mỗi `roomTypeId` chỉ được xuất hiện một lần trong danh sách; nếu khách đặt nhiều phòng cùng hạng thì sử dụng thuộc tính `quantity`.
       - Ràng buộc sức chứa: `adults` và `children` không được vượt quá `maxAdults`, `maxChildren` của hạng phòng đã cấu hình.
       - Kiểm tra tồn phòng trước khi ghi dữ liệu (với cơ chế khóa khách sạn `withHotelLock`).
     - **Hủy đặt phòng (`POST /reservations/:id/cancel`)**:
       - Chỉ áp dụng cho đơn ở trạng thái `CONFIRMED`.
       - Bắt buộc nhập lý do hủy (`reason` tối thiểu 1 ký tự, tối đa 2000 ký tự).
       - Ngay lập tức giải phóng toàn bộ số phòng giữ chỗ cho hệ thống.
     - **Phân quyền RBAC**:
       - `ADMIN`, `MANAGER`, `RECEPTIONIST`: Có toàn quyền tra cứu tồn phòng, xem danh sách, xem chi tiết, tạo đơn mới và hủy đơn.
       - `ACCOUNTANT`: Được quyền xem danh sách và chi tiết đơn để phục vụ đối soát tài chính; bị chặn hoàn toàn quyền tạo mới/hủy đơn, và **backend cấm truyền tham số `guestSearch`** (trả về lỗi `403 FORBIDDEN` nếu truyền).

3. **Xây dựng Types & API Client:**
   - `src/types/reservations.types.ts`: Định nghĩa TypeScript interfaces chuẩn: `ReservationStatus`, `BookingSource`, `RoomAvailabilityItem`, `ReservationSummaryItem`, `ReservationDetailItem`, `CreateReservationDto`, `CancelReservationDto`, `AvailabilityQueryParams`, `ReservationFilterParams`.
   - `src/api/reservations.api.ts`: Xây dựng đầy đủ các hàm gọi API: `getAll`, `getById`, `checkAvailability`, `create`, `cancel`.

4. **Phát triển Màn hình Quản lý Đặt phòng (`ReservationsPage.tsx`) gồm 2 Tab vận hành:**
   - **Tab 1: Danh sách Đơn đặt phòng (Reservations List):**
     - **5 thẻ thống kê KPI trực quan**: Tổng số đơn, Đã xác nhận (CONFIRMED), Đang lưu trú (CHECKED_IN), Đã trả phòng (CHECKED_OUT), Đã hủy (CANCELLED).
     - **Thanh công cụ lọc đa năng**: Lọc mã đặt phòng, tên khách hàng (ẩn an toàn với Kế toán), trạng thái, kênh đặt phòng, khoảng ngày check-in.
     - **Bảng Ant Design Table chuyên nghiệp**: Mã xác nhận (màu xanh nổi bật), Tên khách, Lịch trình lưu trú (Check-in - Check-out kèm số đêm và số phòng), Kênh đặt với Tag màu (DIRECT, PHONE, EMAIL, WALK_IN, AGENT, OTHER), Tổng tiền định dạng chuẩn VND, Trạng thái Badge (Xanh lá, Xanh dương, Tím, Đỏ, Cam), Ngày tạo, Thao tác.
     - **Drawer Chi tiết Đơn đặt phòng**:
       - Thông tin người đặt, kênh bán, người tạo đơn, thời gian tạo.
       - Lịch trình nhận/trả phòng.
       - **Bảng chi tiết giá từng đêm (`ReservationRoomNight`)** cho từng phòng đã đặt kèm ngày lưu trú và đơn giá đêm.
       - Ghi chú yêu cầu đặc biệt của khách hàng.
       - Thông tin hủy đơn (nếu có): Thời gian hủy, người thực hiện hủy, lý do hủy chi tiết.
     - **Modal Hủy Đơn Đặt Phòng**:
       - Cảnh báo quy trình khách sạn về việc giải phóng phòng không thể hoàn tác.
       - Bắt buộc nhập lý do hủy trước khi xác nhận.
   - **Tab 2: Tra cứu Tồn phòng & Đặt phòng Nhanh (Real-time Availability & Booking Engine):**
     - **Bước 1**: Chọn khoảng thời gian lưu trú (Check-in / Check-out), số lượng người lớn và trẻ em trên mỗi phòng; nút kiểm tra tồn phòng thời gian thực.
     - **Bước 2**: Hiển thị thẻ các hạng phòng trống với số phòng còn lại, giá gốc, dự toán tổng tiền toàn bộ kỳ nghỉ. Cho phép chọn số lượng phòng muốn đặt và điều chỉnh số khách cho từng phòng.
     - **Bước 3**: Chọn khách hàng đặt phòng (tích hợp danh sách 20 khách hàng demo từ Phase 4), nguồn đặt phòng, ghi chú đặc biệt; bảng tóm tắt chi phí tự động tính tổng tiền dự toán; nút xác nhận tạo đặt phòng gửi dữ liệu an toàn và nhận mã xác nhận `RES-...`.

5. **Cập nhật Phân quyền & Định tuyến:**
   - Tích hợp `<ReservationsPage />` vào `AppRoutes.tsx` với quyền `['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']`.
   - Cập nhật menu `Đặt phòng` trong `MainLayout.tsx` cho phép cả Kế toán xem đối soát.

6. **Kiểm thử & Biên dịch (Verification):**
   - Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript**.

7. **Tinh chỉnh giao diện (UI Polish & Clarity):**
   - Thay thế các nhãn viết tắt `NL / phòng` và `TE / phòng` thành văn bản đầy đủ `Người lớn / phòng:` và `Trẻ em / phòng:` trên thẻ chọn hạng phòng của Tab 2 để tăng tính trực quan, chuyên nghiệp và tránh nhầm lẫn cho nhân viên khi thao tác đặt phòng.
   - **Tái thiết kế khối Lịch trình lưu trú trong Drawer Chi tiết đơn**: Thay thế bảng `Descriptions` 3 cột bị co hẹp làm gãy chữ ngày tháng (`16/10/2026` bị ngắt thành nhiều dòng) thành thẻ Card Timeline 2 khối đối xứng Check-in / Check-out riêng biệt:
     - Biểu tượng Lịch màu xanh dương và xanh lá trực quan.
     - Ngày tháng cỡ lớn 17px in đậm (`white-space: nowrap`), không bị co gãy.
     - Bổ sung thứ trong tuần bằng tiếng Việt (`Thứ Sáu`) và quy chuẩn giờ nhận/trả phòng khách sạn (`Sau 14:00` / `Trước 12:00`).
     - Huy hiệu ở giữa hiển thị tổng số đêm và số phòng kèm mũi tên điều hướng.
     - Mở rộng chiều rộng Drawer lên 720px và Việt hóa thứ trong tuần cho bảng giá từng đêm (`ReservationRoomNight`).




---

### 🔑 Hoàn thành Phase 6 (eature/fe-stays) — Quản lý Lưu trú & Check-in / Check-out:

1. **Khởi tạo nhánh tính năng:**
   - Tạo nhánh eature/fe-stays từ nhánh develop đã tích hợp đầy đủ Phase 1 đến Phase 5.

2. **Khảo sát nghiệp vụ & Ràng buộc Backend (Backend Invariants):**
   - Phân tích chi tiết stay.service.ts, oom-assignment.service.ts, stay.dates.ts và stay.schema.ts:
     - **Chính sách ngày nhận phòng (alidateArrival)**: Check-in chỉ được phép thực hiện vào đúng ngày khách đến theo múi giờ khách sạn (sDateOnly(checkInDate) === hotelToday(timezone, now)). Nếu ngày nhận phòng khác hôm nay, server trả về mã lỗi 409 INVALID_CHECKIN_DATE.
     - **Điều kiện phòng vật lý để check-in (ssignment.eligible)**:
       - Phòng vật lý bắt buộc phải cùng hạng phòng (oomTypeId) với phòng đã đặt trong đơn (ROOM_TYPE_MISMATCH).
       - Phòng vật lý bắt buộc phải ở trạng thái buồng phòng **READY** (Đã dọn dẹp sạch sẽ, đã kiểm tra). Nếu là DIRTY, CLEANING hoặc INSPECTION sẽ bị từ chối với mã lỗi 409 ROOM_NOT_READY.
       - Phòng vật lý phải có trạng thái vật lý ACTIVE (không bị khóa bảo trì ROOM_UNDER_MAINTENANCE hoặc ngừng vận hành ROOM_UNAVAILABLE).
       - Phòng vật lý chưa bị gán cho lượt lưu trú khác đang diễn ra (ROOM_ALREADY_OCCUPIED).
     - **Nghiệp vụ gán phòng & cập nhật trạng thái đơn đặt phòng**:
       - Khi gán phòng thành công: oomId được cập nhật vào ReservationRoom, tạo bản ghi Stay, chuyển phòng vật lý sang trạng thái occupied.
       - Nếu đơn đặt phòng có nhiều phòng: khi mới check-in 1 phòng thì trạng thái đơn chuyển thành PARTIALLY_CHECKED_IN; khi check-in đủ tất cả các phòng thì chuyển thành CHECKED_IN.
     - **Nghiệp vụ Trả phòng (POST /stays/:id/check-out)**:
       - Chỉ áp dụng cho lượt lưu trú đang CHECKED_IN.
       - Sau khi check-out thành công: phòng vật lý tự động được giải phóng khỏi khách và **tự động chuyển sang trạng thái DIRTY (Cần dọn dẹp)** để bộ phận Buồng phòng vào làm vệ sinh.
     - **Nghiệp vụ Đổi phòng giữa kỳ (POST /stays/:id/transfers)**:
       - Khách đang lưu trú có thể được đổi sang phòng khác cùng hạng phòng (oomTypeId) nếu phòng đích đang ở trạng thái READY.
       - Bắt buộc nhập lý do đổi phòng (eason từ 1 đến 2000 ký tự).
       - Phòng cũ tự động chuyển sang trạng thái DIRTY và hệ thống lưu lại vết lịch sử đổi phòng (romRoom, 	oRoom, 	ransferredAt, 	ransferredBy, eason).
     - **Phân quyền RBAC**:
       - ADMIN, MANAGER, RECEPTIONIST: Toàn quyền thực hiện Check-in gán phòng, Check-out trả phòng và Đổi phòng.
       - ACCOUNTANT: Được xem danh sách và chi tiết lượt lưu trú phục vụ công tác đối soát doanh thu & công nợ (ẩn các nút thao tác nghiệp vụ).

3. **Xây dựng Types & API Client:**
   - src/types/stays.types.ts: Định nghĩa TypeScript interfaces chuẩn: StayStatus, StaySummaryItem, StayDetailItem, CheckinDto, CheckoutDto, TransferRoomDto, StayFilterParams.
   - src/api/stays.api.ts: Xây dựng đầy đủ các hàm gọi API: getAll, getById, checkin, checkout, 	ransfer.

4. **Phát triển Màn hình Quản lý Lưu trú (StaysPage.tsx) gồm 2 Tab chuyên nghiệp:**
   - **Tab 1: Danh sách Đang lưu trú & Lịch sử trả phòng (In-house & Checked-out)**:
     - 3 thẻ thống kê KPI: Khách đang lưu trú trong khách sạn (In-house), Đã trả phòng (Checked-out), Tổng lượt lưu trú ghi nhận.
     - Thanh công cụ lọc theo số phòng, mã đơn đặt phòng, trạng thái lưu trú.
     - Bảng Ant Design Table hiển thị: Số phòng (Badge xanh nổi bật), Hạng phòng, Tên khách lưu trú, Mã đơn đặt phòng (kèm nút copy), Thời gian nhận phòng thực tế, Thời gian trả phòng thực tế, Trạng thái (Xanh lá / Tím), Nút Thao tác.
     - Nút Xem chi tiết: Mở Drawer hiển thị đầy đủ thông tin lưu trú, nhân viên check-in/checkout, ghi chú nghiệp vụ và dòng thời gian lịch sử đổi phòng (Timeline).
     - Nút Đổi phòng (Transfer): Mở Modal chọn phòng vật lý READY cùng hạng và nhập lý do đổi phòng.
     - Nút Trả phòng (Check-out): Mở Modal xác nhận trả phòng, cảnh báo phòng tự động chuyển về DIRTY.
   - **Tab 2: Quầy làm thủ tục Check-in (Check-in Arrival Desk)**:
     - Danh sách các đơn đặt phòng chờ nhận hôm nay (trạng thái CONFIRMED và PARTIALLY_CHECKED_IN).
     - Bấm nút "Làm thủ tục" mở Modal Check-in:
       - Hỗ trợ đơn đặt nhiều phòng: Cho phép chọn phòng cụ thể trong đơn để gán phòng vật lý.
       - Lọc danh sách phòng vật lý tự động: Chỉ hiển thị các phòng thuộc đúng hạng phòng đã đặt và đang ở trạng thái READY: Sạch sẽ. Nếu không có phòng sẵn sàng, hệ thống hiển thị cảnh báo yêu cầu liên hệ Buồng phòng.
       - Kiểm tra ngày check-in hợp lệ theo chính sách khách sạn.
       - Ô nhập ghi chú khi nhận phòng.

5. **Tích hợp liên kết chéo giữa các Phase (Cross-Phase Integration)**:
   - Thêm nút tắt Check-in nhanh (biểu tượng Login màu xanh lá) trực tiếp trên bảng danh sách của `ReservationsPage.tsx` cho các đơn `CONFIRMED` và `PARTIALLY_CHECKED_IN` để điều hướng ngay sang quầy Check-in.
   - Cập nhật định tuyến `/stays` trong `AppRoutes.tsx` và sidebar menu trong `MainLayout.tsx`.

6. **Tinh chỉnh UI / UX (Khắc phục lỗi trùng số đếm ký tự 0/2000)**:
   - Khắc phục hiện tượng bộ đếm ký tự `showCount` (`0 / 2000`) của `Input.TextArea` trong Ant Design bị tràn sát mép footer của Modal.
   - Bổ sung khoảng đệm an toàn `paddingBottom: 16` tại các khung chứa TextArea trong `StaysPage.tsx` (Check-in, Check-out, Đổi phòng) và `ReservationsPage.tsx` (Hủy phòng, Ghi chú đặt phòng).

7. **Kiểm thử & Biên dịch (Verification)**:
   - Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript**.

---

### 💻 Phase 7: Quản lý Buồng phòng (Housekeeping Kanban) & Lệnh Bảo trì Kỹ thuật (Maintenance Operations)

- **Nhánh Git**: `feature/fe-operations` (tách từ `develop` sau khi merge Phase 6).
- **Mục tiêu**:
  - Triển khai phân hệ Vận hành khách sạn (Operations) gồm Quản lý Buồng phòng và Quản lý Kỹ thuật & Khóa phòng bảo trì.
  - Tuân thủ nghiêm ngặt theo tài liệu đặc tả `backend/OPERATIONS.md` và `backend/FRONTEND_PERMISSIONS.md`.
  - Phân quyền RBAC chuẩn xác cho cả 6 vai trò (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `HOUSEKEEPING`, `TECHNICIAN`).

#### 1. Khảo sát Nghiệp vụ & Ràng buộc Hệ thống (Backend Invariants):
1. **Chu trình Buồng phòng (Housekeeping Turnover State Machine)**:
   - Quy trình: `PENDING ➔ IN_PROGRESS ➔ AWAITING_INSPECTION ➔ COMPLETED`.
   - Song song với việc cập nhật trạng thái phòng vật lý: `DIRTY ➔ CLEANING ➔ INSPECTION ➔ READY`.
   - **Tạo nhiệm vụ (`POST /housekeeping/tasks`)**: Chỉ áp dụng cho phòng trống đang `DIRTY`. Mỗi phòng tại một thời điểm chỉ tồn tại duy nhất 1 nhiệm vụ dọn dẹp hoạt động (`activeRoomId`).
   - **Phân công (`PATCH /housekeeping/tasks/:id/assign`)**: Chỉ phân công cho nhân viên buồng phòng (`HOUSEKEEPING`), Quản lý (`MANAGER`) hoặc Quản trị viên (`ADMIN`).
   - **Bắt đầu & Báo xong**: Chỉ nhân viên được phân công mới có quyền bấm bắt đầu dọn phòng (`/start`) và báo dọn xong (`/complete`).
   - **Nghiệm thu (`POST /housekeeping/tasks/:id/inspect`)**: Chỉ `ADMIN` và `MANAGER` được duyệt.
     - Nếu **Đạt (Pass)**: Phòng chính thức chuyển sang trạng thái `READY: Sạch sẽ` để quầy lễ tân check-in cho khách.
     - Nếu **Không đạt (Reject)**: Bắt buộc nhập lý do lỗi; nhiệm vụ quay về `PENDING` và phòng quay về `DIRTY` để dọn lại.
   - **Hủy nhiệm vụ (`POST /housekeeping/tasks/:id/cancel`)**: Bắt buộc nhập lý do; phòng duy trì `DIRTY`.

2. **Chu trình Phiếu sự cố kỹ thuật (Maintenance Tickets)**:
   - Quy trình: `OPEN ➔ ASSIGNED ➔ IN_PROGRESS ➔ RESOLVED ➔ CLOSED`.
   - Báo cáo sự cố: Mở cho mọi nhân viên (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`, `TECHNICIAN`).
   - Phân công: Chỉ phân công cho kỹ thuật viên (`TECHNICIAN`), `MANAGER`, `ADMIN`.
   - Bắt đầu sửa & Báo xong: Dành cho kỹ thuật viên được phân công (`resolutionNotes`).
   - Nghiệm thu đóng phiếu: Dành cho Quản lý / Admin (`closingNotes`).

3. **Chu trình Lệnh khóa phòng bảo trì (Maintenance Blocks)**:
   - Trạng thái: `SCHEDULED ➔ ACTIVE ➔ RELEASED` (hoặc `CANCELLED` nếu hủy lịch tương lai).
   - Khoảng ngày khóa nửa mở `[startDate, endDate)` (1–365 đêm) loại trừ trực tiếp phòng khỏi kho bán phòng (`/rooms/availability`).
   - Phòng phải không có khách đang ở trước khi tạo lệnh khóa (`ROOM_CURRENTLY_OCCUPIED`).
   - **Mở khóa phòng (`POST /maintenance/blocks/:id/release`)**: Bắt buộc ghi nhận biên bản nghiệm thu an toàn kỹ thuật (`notes`). Khi giải phóng, phòng vật lý tự động chuyển sang **`DIRTY`** và tự động sinh 1 nhiệm vụ dọn dẹp buồng phòng trước khi có thể đón khách.

#### 2. Xây dựng Types & API Clients:
- `src/types/operations.types.ts`: Định nghĩa đầy đủ `HousekeepingTaskItem`, `DirtyRoomItem`, `MaintenanceTicketItem`, `MaintenanceBlockItem`, `OperationsAuditLogItem`, các DTOs và params.
- `src/api/housekeeping.api.ts`: Xây dựng các hàm gọi API buồng phòng: `getAll`, `getById`, `create`, `assign`, `start`, `complete`, `inspect`, `cancel`, `getDirtyRooms`.
- `src/api/maintenance.api.ts`: Xây dựng các hàm gọi API bảo trì: `getTickets`, `getTicketById`, `createTicket`, `assignTicket`, `startRepair`, `resolveTicket`, `closeTicket`, `cancelTicket`, `getBlocks`, `getBlockById`, `createBlock`, `releaseBlock`, `cancelBlock`.

#### 3. Phát triển Giao diện Quản lý Buồng phòng (HousekeepingPage.tsx):
- **Thống kê KPI**: 4 thẻ màu phân biệt theo trạng thái (Chờ dọn, Đang dọn, Chờ kiểm tra, Đã hoàn thành).
- **Tab 1: Bảng Kanban Buồng phòng (Kanban Board)**:
  - 4 cột tiến trình chuẩn kèm thẻ đếm số lượng.
  - Thẻ nhiệm vụ (Task Card): Mã phòng, Tầng, Hạng phòng, Tag mức độ ưu tiên (`URGENT`, `HIGH`, `NORMAL`, `LOW`), Avatar nhân viên phụ trách, Ghi chú và thời gian.
  - Các nút hành động ngữ cảnh (Contextual Actions) theo vai trò: Phân công, Bắt đầu dọn, Báo dọn xong, Nghiệm thu chất lượng, Hủy việc, Xem lịch sử.
- **Tab 2: Hàng đợi phòng bẩn (Dirty Rooms Queue)**:
  - Bảng danh sách các phòng `DIRTY` từ endpoint `GET /housekeeping/dirty-rooms`.
  - Nút "Tạo việc dọn" 1-click cho phép chuyển nhanh phòng bẩn vào chu trình xử lý.
- **Modals & Drawer**:
  - Modal tạo nhiệm vụ (chọn phòng DIRTY, chọn mức ưu tiên, ghi chú có `paddingBottom: 16`).
  - Modal phân công nhân viên (danh sách nhân viên buồng phòng active).
  - Modal nghiệm thu chất lượng (chọn Đạt/Không đạt, bắt buộc nhập lý do nếu từ chối).
  - Modal gửi yêu cầu nghiệm thu & Modal hủy nhiệm vụ.
  - Drawer hiển thị dòng thời gian kiểm toán (`OperationsAuditLog`) trực quan với đầy đủ nhân viên thao tác và ghi chú.

#### 4. Phát triển Giao diện Bảo trì Kỹ thuật (MaintenancePage.tsx):
- **Tab 1: Phiếu sự cố kỹ thuật (Maintenance Tickets)**:
  - 4 thẻ KPI: Mới báo cáo, Đang xử lý, Đã sửa xong, Đã nghiệm thu đóng phiếu.
  - Thanh tìm kiếm và bộ lọc đa năng (theo từ khóa, trạng thái, mức độ ưu tiên).
  - Bảng danh sách Ant Design Table đầy đủ thông tin phòng, tiêu đề, mô tả, kỹ thuật viên phụ trách.
  - Các modal nghiệp vụ: Báo cáo sự cố mới, Phân công kỹ thuật viên, Báo hoàn thành sửa chữa, Nghiệm thu đóng phiếu, Hủy phiếu.
  - Drawer xem lịch sử kiểm toán dòng thời gian của phiếu sự cố.
- **Tab 2: Lệnh khóa phòng bảo trì (Maintenance Blocks)**:
  - 3 thẻ KPI: Đang khóa kỹ thuật (ACTIVE), Đã lên lịch tương lai (SCHEDULED), Đã mở khóa (RELEASED).
  - Bảng danh sách các khoảng ngày khóa, số đêm giữ chỗ, lý do khóa, liên kết phiếu sự cố.
  - Modal tạo lệnh khóa phòng với RangePicker ngày bắt đầu - kết thúc.
  - Modal mở khóa phòng nghiệm thu an toàn (cảnh báo phòng tự động chuyển về DIRTY).
  - Modal hủy lệnh bảo trì tương lai.
  - Drawer xem chi tiết và dòng thời gian lịch sử lệnh khóa.

#### 5. Tích hợp Định tuyến & RBAC Menu:
- Cập nhật `src/routes/AppRoutes.tsx`: Gắn `HousekeepingPage` vào `/housekeeping` và `MaintenancePage` vào `/maintenance`.
- Cập nhật `src/layouts/MainLayout.tsx`: Phân quyền hiển thị menu sidebar:
  - `/housekeeping`: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`.
  - `/maintenance`: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`, `TECHNICIAN`.

#### 6. Tinh chỉnh & Sửa lỗi (Bug Fixes):
- **Sửa lỗi gửi ghi chú rỗng (`notes: ''`) khi tạo nhiệm vụ buồng phòng**:
  - Khi bấm nút "Tạo việc dọn" từ bảng Hàng đợi phòng bẩn hoặc mở Modal tạo việc dọn dẹp, nếu người dùng để trống ô ghi chú thì form gửi chuỗi rỗng `notes: ""`.
  - Backend sử dụng Zod schema: `notes: z.string().trim().min(1).max(2000).optional()`. Do `""` không phải `undefined` nên Zod báo lỗi 422: `Too small: expected string to have >=1 characters`.
  - Đã chuẩn hóa sanitization trên form: `notes: values.notes?.trim() ? values.notes.trim() : undefined`. Nếu không nhập ghi chú thì loại bỏ field khỏi payload.
  - Cập nhật trích xuất thông báo lỗi từ server: `err.response?.data?.message || err.response?.data?.error?.message` để hiển thị rõ ràng nguyên nhân lỗi.

#### 7. Tối ưu hóa hiển thị danh tính nhân sự & Dòng thời gian kiểm toán (Operations Audit Log):
- **Vấn đề nhận diện**: Trong Drawer xem chi tiết nhiệm vụ buồng phòng và phiếu sự cố bảo trì, các bản ghi kiểm toán chỉ hiển thị ID thô dạng `Nhân viên #2`, `Nhân viên #4` và các mã hành động tiếng Anh kỹ thuật (`TASK_START`, `TASK_COMPLETE`, `TASK_CANCEL`, `BLOCK_RELEASE`...), gây khó khăn cho nhân viên khi theo dõi ca trực.
- **Giải pháp triển khai**:
  - Tạo module trợ năng `src/utils/staffDirectory.ts`:
    - Quản lý danh bạ nhân sự khách sạn `KNOWN_STAFF_DIRECTORY` (Nguyễn Minh Anh - Quản lý, Trần Ngọc Linh - Lễ tân, Lê Thu Hà - Kế toán, Phạm Thị Lan - Buồng phòng, Hoàng Văn Nam - Kỹ thuật viên, System Administrator - Quản trị viên).
    - Hàm `getStaffDisplay(staffId, currentUser)`: Tự động phân giải ID thành đối tượng `{ fullName, roleTitle, roleCode, color }`.
    - Hàm `getHousekeepingActionDisplay` và `getMaintenanceActionDisplay`: Chuyển đổi mã hành động sang tiếng Việt kèm màu Tag chuyên nghiệp (Xanh lục: Đạt chuẩn/Hoàn tất; Vàng/Cam: Đang chờ nghiệm thu/Mới báo cáo; Tím: Đã khắc phục/Rework; Đỏ: Không đạt/Khóa phòng; Xám: Đã hủy).
    - Hàm `formatAuditNote`: Chuyển đổi tự động các ghi chú mặc định tiếng Anh sang tiếng Việt (`Turnover after checkout or room transfer` ➔ `Dọn dẹp phòng sau khi khách trả phòng hoặc đổi phòng`; `Assigned to staff 4` ➔ `Phân công nhiệm vụ cho: Phạm Thị Lan (Buồng phòng)`).
  - Tích hợp toàn diện vào `HousekeepingPage.tsx` và `MaintenancePage.tsx`:
    - Bảng Kanban buồng phòng và bảng sự cố bảo trì hiển thị tên nhân viên kèm Huy hiệu chức vụ (Role Tag).
    - Toàn bộ Dòng thời gian Timeline kiểm toán hiển thị trực quan: Tên nhân viên rõ ràng, chức danh, nhãn hành động tiếng Việt và ghi chú kiểm toán format chuẩn.

#### 8. Kiểm thử & Biên dịch (Verification):
- Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript, 0 lỗi linter**.



