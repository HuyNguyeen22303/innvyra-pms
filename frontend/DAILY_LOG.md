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

### 🗺️ Bảng Kế Hoạch 11 Phases Toàn Diện Của Đồ Án Innvyra PMS:

| Phase | Nhánh Git | Nội dung công việc | Trạng thái |
| :---: | :--- | :--- | :---: |
| **Phase 1** | `feature/fe-foundation` | Khởi tạo Vite, React 19, TS, AntD, Axios, Theme ngọc lục bảo, Layout | ✅ Đã merge `develop` |
| **Phase 2** | `feature/fe-auth` | Đăng nhập, Demo Account Selector, JWT Silent Refresh, RBAC 6 Roles | ✅ Đã merge `develop` |
| **Phase 3** | `feature/fe-rooms` | CRUD Loại phòng, Sơ đồ phòng Lưới/Bảng, bộ lọc đa năng, cập nhật nhanh | ✅ Đã merge `develop` |
| **Phase 4** | `feature/fe-guests` | Quản lý Khách hàng, CCCD/Passport mã hóa an toàn, phân quyền kế toán | ✅ Đã merge `develop` |
| **Phase 5** | `feature/fe-reservations` | Tra cứu phòng trống theo ngày (`/rooms/availability`), tạo đơn & hủy đặt | ✅ Đã merge `develop` |
| **Phase 6** | `feature/fe-stays` | Check-in gán phòng READY, danh sách lưu trú, check-out và đổi phòng giữa kỳ | ✅ Đã merge `develop` |
| **Phase 7** | `feature/fe-operations` | Bảng nhiệm vụ dọn dẹp buồng phòng Kanban & Lệnh khóa bảo trì phòng | ✅ Đã merge `develop` |
| **Phase 8** | `feature/fe-billing` | Chi tiết hóa đơn Folio, thanh toán dịch vụ/tiền phòng, in phiếu thanh toán | ✅ Đã merge `develop` |
| **Phase 9** | `feature/fe-employees` | Quản lý Nhân sự, Cấp phát tài khoản, Phân quyền Role Hierarchy & Dynamic Staffing | ✅ Đã hoàn thành |
| **Phase 10**| `feature/fe-matrix-dashboard` | Bảng ma trận phòng theo ngày (Timeline Grid) & Báo cáo thống kê KPI | ⏳ Kế hoạch |
| **Phase 11**| `feature/fe-final-polish` | Kiểm thử luồng E2E toàn diện, tài liệu hướng dẫn và đóng gói đồ án | ⏳ Kế hoạch |

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

---

### 🚀 Triển khai Phase 8 (`feature/fe-billing`) — Thu ngân & Quản lý Folio Công nợ, Dịch vụ & Hóa đơn:

#### 1. Khởi tạo & Định hướng Kiến trúc:
- Tạo và chuyển sang nhánh làm việc: `feature/fe-billing`.
- Rà soát đối chiếu tài liệu kỹ thuật `backend/BILLING.md`, `backend/FRONTEND_PERMISSIONS.md` và mã nguồn OpenAPI/Prisma Schema backend:
  - **Không có endpoint `GET /folios`**: Backend không hỗ trợ liệt kê toàn bộ Folio. Việc tra cứu Folio được thực hiện qua danh sách/chi tiết đơn đặt phòng (Reservations) kết hợp với:
    - `GET /reservations/:reservationId/folio`: Lấy Folio của đơn. Nếu chưa có, trả về mã lỗi `FOLIO_NOT_FOUND` kèm HTTP 404.
    - `POST /reservations/:reservationId/folio/open`: Mở Folio mới cho đơn đặt phòng.
  - **Cơ chế Idempotency-Key**: Bắt buộc gắn header `Idempotency-Key` (chuỗi ASCII 8–128 ký tự) cho các thao tác tiền tệ nhạy cảm (`POST /folios/:id/payments`, `POST /payments/:id/refunds`, `POST /folios/:id/adjustments`) để ngăn chặn trừ tiền / thanh toán trùng lặp khi mạng chập chờn.
  - **Quy tắc An toàn Dữ liệu Tiền (Money Safety)**: Tiền được biểu diễn bằng chuỗi `Decimal` VND (ví dụ: `"500000.00"`). Tuyệt đối không dùng số thực `number` của JavaScript để tính toán số dư nghiệp vụ mà luôn ưu tiên hiển thị các chỉ số tài chính do backend tính toán và trả về (`totalCharges`, `totalPayments`, `totalRefunds`, `balanceAmount`).
  - **Chính sách Chụp giá Dịch vụ (Snapshot Pricing)**: Đơn giá của từng dịch vụ được chụp (snapshot) cố định tại thời điểm tạo đơn (`unitPriceSnapshot`, `totalAmount`). Khi hoàn thành đơn, số tiền sẽ được tự động ghi nợ vào Folio tương ứng.
  - **Chu trình Đóng Folio (Folio Settlement)**: Chỉ đóng được khi backend thỏa mãn cả 3 điều kiện: số dư bằng 0 ₫, không còn yêu cầu dịch vụ nào ở trạng thái `REQUESTED`, và toàn bộ các phòng đã hoàn tất Check-out hoặc đơn đã hủy.
  - **Phân quyền người dùng (RBAC 4 vai trò liên quan)**:
    - `ADMIN` & `MANAGER`: Toàn quyền quản trị danh mục dịch vụ (CRUD), quản lý Service Orders, mở Folio, thu tiền, điều chỉnh công nợ, hoàn tiền, đóng Folio.
    - `RECEPTIONIST`: Xem Folio & dịch vụ, tạo/hoàn thành/hủy Service Orders, mở Folio, thu tiền (Payment/Deposit), xem và in phiếu thu.
    - `ACCOUNTANT`: Xem danh mục & Orders, mở Folio, thu tiền, thực hiện điều chỉnh Debit/Credit, hoàn tiền (Refund), quyết toán đóng Folio, xem và in phiếu thu.
    - `HOUSEKEEPING` & `TECHNICIAN`: Bị chặn hoàn toàn, không hiển thị menu.

#### 2. Xây dựng Types & API Client:
- **`src/types/billing.types.ts`**:
  - Định nghĩa các enum: `ServiceOrderStatus`, `FolioStatus`, `FolioItemType`, `PaymentType`, `PaymentMethod`, `PaymentStatus`.
  - Định nghĩa các interface chuẩn: `ServiceItem`, `ServiceOrderItem`, `FolioResponse`, `FolioItem`, `PaymentItem`, các DTOs tạo/sửa dịch vụ, tạo order, thanh toán, điều chỉnh, hoàn tiền, đóng Folio.
- **`src/api/billing.api.ts`**:
  - Tích hợp hàm sinh khóa ngẫu nhiên an toàn: `createIdempotencyKey(prefix: string)`.
  - Triển khai đầy đủ 13 API endpoints:
    - Danh mục dịch vụ: `getServices`, `getServiceById`, `createService`, `updateService`.
    - Đơn dịch vụ: `getServiceOrders`, `getServiceOrderById`, `createServiceOrder`, `completeServiceOrder`, `cancelServiceOrder`.
    - Quản lý Folio: `getFolioByReservation`, `openFolioForReservation`, `getFolioById`, `getFolioItems`, `createAdjustment`, `closeFolio`.
    - Thanh toán & Hoàn tiền: `recordPayment`, `refundPayment`.

#### 3. Phát triển Thành phần Giao diện (Billing Components):
- **Tab 1: Sổ công nợ Folio (`FolioTab.tsx`)**:
  - **Thanh tra cứu Reservation**: Hỗ trợ chọn nhanh từ Select danh sách đơn đặt phòng đang hoạt động hoặc nhập mã Reservation ID tùy ý để tìm kiếm.
  - **Trạng thái chưa mở Folio (`FOLIO_NOT_FOUND`)**: Hiển thị thẻ thông báo thân thiện kèm nút bấm "Mở Sổ công nợ Folio ngay" (dành cho Lễ tân, Quản lý, Kế toán).
  - **Thống kê 4 Thẻ KPI Tài chính trực quan**:
    - *Tổng phát sinh (Charges)*: Đỏ sẫm `#cf1322` (Tiền phòng + Dịch vụ).
    - *Đã thanh toán (Payments)*: Xanh lá `#389e0d` (Bao gồm Đặt cọc + Thanh toán).
    - *Đã hoàn tiền (Refunds)*: Cam `#d46b08` (Các khoản hoàn trả cho khách).
    - *Số dư còn lại (Balance)*: Hiển thị nổi bật; nếu `> 0` cảnh báo khách còn nợ (Đỏ cam), nếu `= 0` hiển thị Đã quyết toán xong (Xanh lá).
  - **Bảng Chi tiết Phí (Ledger Items)**: Liệt kê chi tiết từng khoản phòng, dịch vụ, khoản ghi nợ/ghi có điều chỉnh (Debit/Credit), hiển thị rõ số lượng, đơn giá và thời điểm phát sinh.
  - **Bảng Lịch sử Giao dịch (Payments & Refunds)**: Liệt kê chi tiết từng đợt thu/hoàn tiền, phương thức (Tiền mặt/Chuyển khoản), mã tham chiếu, nhân viên xử lý và nút "In phiếu thu" trực tiếp.
  - **Modal Thu tiền (Payment / Deposit)**:
    - Lựa chọn loại giao dịch: Thanh toán (`PAYMENT`) hoặc Đặt cọc (`DEPOSIT`).
    - Lựa chọn phương thức: Tiền mặt (`CASH`) hoặc Chuyển khoản (`BANK_TRANSFER`).
    - Nếu là chuyển khoản: Bắt buộc nhập Mã tham chiếu ngân hàng (`referenceCode`).
    - Bắt buộc tích xác nhận nhân viên đã thực nhận đủ tiền trước khi bấm Lưu.
  - **Modal Điều chỉnh Công nợ (Debit / Credit Adjustment)**:
    - Chọn loại: Ghi nợ phát sinh thêm (`DEBIT`) hoặc Ghi có giảm trừ (`CREDIT`).
    - Bắt buộc nhập số tiền và lý do giải trình.
    - Chặn giao diện không cho tạo khoản CREDIT lớn hơn tổng phí phát sinh khiến số dư âm.
    - Hỗ trợ liên kết Ledger Item gốc nếu là điều chỉnh cho một mục cụ thể.
  - **Modal Hoàn tiền (Refund)**:
    - Bắt buộc nhập lý do hoàn tiền và tích cam kết đã thực hiện hoàn tiền cho khách.
    - Yêu cầu mã tham chiếu giao dịch chuyển tiền nếu hoàn qua chuyển khoản.
  - **Modal Quyết toán đóng Folio (Close Folio)**:
    - Kiểm tra điều kiện và gửi yêu cầu đóng Folio.
    - Trích xuất chi tiết mã lỗi nghiệp vụ từ backend nếu chưa đủ điều kiện đóng (còn dư nợ, còn order REQUESTED, phòng chưa check-out).

- **Tab 2: Đơn dịch vụ (`ServiceOrdersTab.tsx`)**:
  - Bảng danh sách đơn dịch vụ kèm phân trang, lọc trạng thái (`REQUESTED`, `COMPLETED`, `CANCELLED`) và tìm kiếm.
  - Modal tạo đơn dịch vụ: Chọn đơn đặt phòng/stay, thêm động nhiều dịch vụ, chọn số lượng, hiển thị trực tiếp tạm tính tiền và cảnh báo Snapshot Pricing.
  - Thao tác 1-click "Hoàn thành" đơn dịch vụ (tự động ghi nợ vào Folio).
  - Modal "Hủy yêu cầu dịch vụ" với lý do hủy bắt buộc.

- **Tab 3: Danh mục dịch vụ (`ServiceCatalogTab.tsx`)**:
  - Bảng hiển thị danh mục dịch vụ: Tên, mã code, danh mục, đơn giá niêm yết VND, trạng thái Kích hoạt/Ngưng hoạt động.
  - Modal tạo mới dịch vụ và Modal chỉnh sửa thông tin dịch vụ (dành riêng cho `ADMIN` và `MANAGER`).
  - Nút chuyển đổi trạng thái Kích hoạt/Ngưng hoạt động nhanh.

- **Thành phần In Phiếu thu (`ReceiptModal.tsx`)**:
  - Giao diện thiết kế chuẩn in ấn (Print-friendly CSS `@media print`).
  - Hiển thị đầy đủ thông tin: Logo Innvyra Hotel, Mã phiếu thu, Ngày in, Tên khách hàng, Số phòng, Đơn đặt phòng, Mã Folio, Loại giao dịch (Thanh toán / Đặt cọc / Hoàn tiền), Phương thức, Số tiền VND bằng số & chữ, Mã tham chiếu giao dịch, Chữ ký người nộp và nhân viên thu ngân.
  - Kèm ghi chú pháp lý rõ ràng: Phiếu thu nội bộ, không thay thế hóa đơn tài chính VAT hoặc giấy báo có ngân hàng độc lập.

#### 4. Cấu hình Định tuyến & Menu:
- Cập nhật `src/routes/AppRoutes.tsx`: Chuyển route `/folios` từ màn hình placeholder sang `BillingPage`, cấp quyền cho `['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']`.
- Cập nhật `src/layouts/MainLayout.tsx`: Mở rộng quyền xem mục menu "Thu ngân & Folio" cho `RECEPTIONIST`.

#### 5. Sửa lỗi & Tối ưu hóa (Bug Fixes):
- **Khắc phục lỗi `Invalid request` khi tạo Yêu cầu Dịch vụ mới**:
  - *Nguyên nhân*: API lượt lưu trú (`GET /stays`) trả về đối tượng `StaySummaryItem` với thuộc tính định danh là `stayId` (thay vì `id`). Khi binding vào Select dropdown, giao diện đọc nhầm `s.id` khiến giá trị lưu vào form là chuỗi `"undefined"` (hiển thị trên giao diện dạng `Lưu trú #undefined - Phòng #302`). Khi submit, backend Zod validator (`idSchema`) kiểm tra chuỗi số nguyên và từ chối vì `"undefined"` không khớp định dạng ID, trả về lỗi `422 VALIDATION_ERROR: Invalid request`.
  - *Giải pháp triển khai*:
    1. Chuẩn hóa binding options đọc đúng `s.stayId`: `value: String(s.stayId)` và nhãn `Phòng #${s.room?.roomNumber} (Lưu trú #${s.stayId})`.
    2. Bổ sung `Form.useWatch('reservationId')` để tự động lọc chỉ hiển thị các phòng lưu trú (`availableStays`) thuộc đơn đặt phòng được chọn.
    3. Tự động chọn phòng nếu đơn chỉ có duy nhất 1 phòng đang lưu trú.
    4. Lọc danh sách đơn đặt phòng ở modal tạo đơn dịch vụ chỉ hiển thị các đơn đang có khách lưu trú thực tế (`CHECKED_IN` hoặc `PARTIALLY_CHECKED_IN`) theo đúng quy định nghiệp vụ của backend (`SERVICE_NOT_ALLOWED: Services require an active stay`).
    5. Viết hàm trích xuất lỗi chuyên biệt `getApiErrorMessage` bóc tách chính xác mảng `error.details` từ backend (ví dụ: `body.stayId: ...`) thay vì chỉ hiện dòng chữ `Invalid request` chung chung.

- **Tối ưu hóa Giao diện Tra cứu Sổ công nợ Folio (Hiển thị Bảng danh sách Đơn đặt phòng có sẵn)**:
  - *Vấn đề*: Backend không có endpoint `GET /folios` để lấy toàn bộ danh sách Folio, mà quản lý Folio theo quan hệ 1-1 với từng Đơn đặt phòng (`Reservation`). Trước đó giao diện để khung trống yêu cầu nhân viên phải tự tìm kiếm đơn trên dropdown thì mới hiển thị Folio, gây cảm giác thiếu trực quan.
  - *Giải pháp triển khai*:
    1. Khi chưa chọn đơn cụ thể, tab Folio sẽ hiển thị ngay **Bảng Danh sách Đơn đặt phòng** đầy đủ với phân trang, bộ lọc trạng thái (`CHECKED_IN`, `CONFIRMED`, `CHECKED_OUT`, `CANCELLED`), thanh tìm kiếm theo tên khách hoặc mã đơn.
    2. Cung cấp nút 1-click **"Xem Folio"** trên từng dòng để nhân viên xem nhanh công nợ, thu tiền hoặc mở Folio mới mà không cần thao tác tìm kiếm thủ công.
    3. Khi đang xem chi tiết một Folio, hiển thị thanh điều hướng phía trên với nút **"← Quay lại danh sách đơn"** và dropdown chọn nhanh để chuyển đổi tức thì giữa các đơn.
    4. **Bổ sung cột "Sổ công nợ Folio" ngay trên Bảng danh sách ngoài**: Tích hợp `useQueries` kiểm tra đồng thời trạng thái Folio cho các đơn trên trang hiện tại, hiển thị rõ ràng:
       - 🔒 **`ĐÃ QUYẾT TOÁN`**: Tag xám kèm icon khóa và mốc thời gian chốt sổ (`closedAt`). Nút hành động chuyển thành `Xem (Đã đóng)`.
       - 🔓 **`ĐANG MỞ (OPEN)`**: Tag xanh kèm số dư nợ hiện tại. Nút hành động `Xem Folio`.
       - ⚪ **`Chưa mở Folio`**: Tag cam cảnh báo đơn chưa mở sổ. Nút hành động đổi thành `Mở Folio`.
    5. **Bổ sung Khung Thông báo Quyết toán Trang trọng (Settlement Banner)** khi xem chi tiết Folio đã đóng (`CLOSED`): Hiển thị rõ mốc thời gian đóng sổ (`closedAt`), chu kỳ ghi nợ từ lúc mở đến lúc chốt, thông tin giao dịch thanh toán chốt gần nhất kèm danh tính nhân viên thu ngân và xác nhận tình trạng số dư 0 ₫ đã đóng băng an toàn.

#### 6. Kiểm thử & Đóng gói (Verification):
- Chạy `npm run build`: **Biên dịch thành công 100%, 0 lỗi TypeScript, 0 cảnh báo linter**.
- Giữ nguyên trạng thái code trên nhánh `feature/fe-billing` và **không commit, push hay merge** theo đúng chỉ thị người dùng.





---

## 📅 Ngày: 16/10/2026

### 🎯 Mục tiêu & Sự kiện quan trọng:
- Đã merge thành công **Phase 8: Billing & Folio Management** vào nhánh `develop`.
- Đồng bộ mã nguồn từ Backend: Phía Backend vừa hoàn thành và đẩy lên nhánh `develop` toàn bộ module **Quản lý Nhân sự & Phân quyền Tài khoản (`employees`)**.
- Rà soát mã nguồn Backend, kiểm thử tự động 35 test suites đạt 100% tỷ lệ pass (`vitest run tests/employees.http.test.ts`).
- Bổ sung và cập nhật lại lộ trình tổng thể: Bổ sung **Phase 9: Quản lý Nhân sự & Phân quyền Tài khoản (`feature/fe-employees`)** trước khi triển khai Ma trận phòng & Báo cáo.

---

### 🔍 Nghiên cứu & Phân tích Kỹ thuật Backend Module `employees`:

#### 1. Các Endpoints RESTful (`/api/v1/employees`):
- `GET /employees`:
  - **Mục đích**: Tra cứu danh sách nhân sự của khách sạn.
  - **Phân quyền**: Tất cả 6 vai trò (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`, `ACCOUNTANT`, `TECHNICIAN`) đều có quyền đọc (`employeePermissions.read`).
  - **Bộ lọc & Phân trang**: Hỗ trợ `page`, `limit` (tối đa 100), `search` (tìm kiếm theo họ tên, username hoặc email), `role` (lọc theo vai trò), `isActive` (lọc trạng thái Đang hoạt động / Đã vô hiệu hóa), `sortBy` (`fullName`, `createdAt`, `username`), `sortOrder` (`asc`, `desc`).
  - **Bảo mật Tenant**: Luôn khóa phạm vi theo `hotelId` của người dùng đã xác thực, không bao giờ lộ tài khoản khách sạn khác.
- `POST /employees`:
  - **Mục đích**: Tạo mới hồ sơ nhân viên kèm tài khoản đăng nhập hệ thống.
  - **Phân quyền**: Chỉ `ADMIN` và `MANAGER` (`write`).
  - **Yêu cầu bảo mật**: Bắt buộc header `X-CSRF-Protection: 1`.
  - **Dữ liệu đầu vào**:
    - `fullName`: Họ và tên (1 - 191 ký tự, chuẩn hóa khoảng trắng).
    - `username`: Tên đăng nhập (3 - 64 ký tự, chữ thường, số, dấu `. _ -`, duy nhất toàn hệ thống).
    - `email`: Địa chỉ email (tùy chọn, duy nhất toàn hệ thống).
    - `password`: Mật khẩu ban đầu (tối thiểu 15 ký tự, tối đa 128 ký tự, bắt buộc có ít nhất 8 ký tự phân biệt). Được băm bằng thuật toán **Argon2id**.
    - `role`: Vai trò chức vụ trong khách sạn.
- `PATCH /employees/:id`:
  - **Mục đích**: Cập nhật thông tin nhân viên (họ tên, email, thay đổi vai trò).
  - **Phân quyền**: `ADMIN` và `MANAGER`. Bắt buộc `X-CSRF-Protection: 1`.
  - **Quy tắc an toàn**: Không cho phép thay đổi `username` hay `password` qua endpoint này (đảm bảo tính toàn vẹn định danh).
- `PATCH /employees/:id/deactivate`:
  - **Mục đích**: Vô hiệu hóa tài khoản nhân viên (Soft-deactivate, `isActive = false`).
  - **Phân quyền**: `ADMIN` và `MANAGER`. Bắt buộc `X-CSRF-Protection: 1`.
  - **Cơ chế thu hồi phiên tức thì (Session Revocation)**: Ngay khi vô hiệu hóa, hệ thống tự động đánh dấu thu hồi toàn bộ phiên đăng nhập còn hiệu lực của nhân viên đó trong bảng `auth_sessions` (`revokedReason: 'ACCOUNT_DEACTIVATED'`). Nhân viên này sẽ bị đá văng khỏi hệ thống và không thể đăng nhập lại.
  - **Bảo vệ tài khoản tối cao (Safety Invariants)**:
    - Không được tự vô hiệu hóa chính mình (`Cannot deactivate your own account`).
    - Không được vô hiệu hóa Quản trị viên (`ADMIN`) cuối cùng còn lại của khách sạn (`Cannot deactivate the last active administrator`).

#### 2. Cơ chế Phân cấp Vai trò Chặt chẽ (Role Hierarchy):
- Trọng số cấp bậc:
  - `ADMIN`: 100
  - `MANAGER`: 80
  - `RECEPTIONIST`: 60
  - `HOUSEKEEPING`, `ACCOUNTANT`, `TECHNICIAN`: 40
- Quy tắc kiểm soát quyền lực:
  - `ADMIN` có toàn quyền quản trị tất cả các vai trò.
  - `MANAGER` chỉ được tạo, chỉnh sửa hoặc vô hiệu hóa các nhân viên có cấp bậc **thấp hơn** mình (Lễ tân, Buồng phòng, Kế toán, Kỹ thuật viên).
  - `MANAGER` tuyệt đối **không được phép** tạo hoặc can thiệp vào tài khoản `ADMIN` hay một `MANAGER` khác (chống leo thang đặc quyền - Privilege Escalation).

#### 3. Tác động tích cực giải quyết triệt để các tồn đọng trước đây:
- **Xóa bỏ hoàn toàn Hardcode ID Kỹ thuật viên / Buồng phòng**:
  - Trước đây ở Phase 7, khi giao việc bảo trì hoặc dọn buồng, giao diện phải dựa vào danh bạ tĩnh `KNOWN_STAFF_DIRECTORY` và gán cứng ID (dẫn đến lỗi khi môi trường database cục bộ của từng thành viên có ID tự tăng khác nhau).
  - Với API `/employees?role=TECHNICIAN&isActive=true` và `/employees?role=HOUSEKEEPING&isActive=true`, Frontend sẽ lấy danh sách nhân sự thực tế từ cơ sở dữ liệu theo thời gian thực!

---

### 🚀 Kế hoạch Triển khai Chi tiết Phase 9: Quản lý Nhân sự (`feature/fe-employees`):

#### 1. Xây dựng Types & API Client:
- `src/types/employees.types.ts`: Định nghĩa `EmployeeItem`, `EmployeeQuery`, `CreateEmployeeDto`, `UpdateEmployeeDto`, `RoleCode`, bảng trọng số `ROLE_HIERARCHY`, màu sắc nhận diện vai trò.
- `src/api/employees.api.ts`: Các hàm gọi API `getEmployees`, `createEmployee`, `updateEmployee`, `deactivateEmployee`.

#### 2. Phát triển Màn hình Quản lý Nhân sự (`EmployeesPage.tsx`):
- **Thẻ KPI Thống kê Nhân sự**: Tổng nhân viên, Nhân viên đang hoạt động, Đã vô hiệu hóa, Phân bổ theo 6 vai trò.
- **Thanh công cụ lọc & tìm kiếm**: Tìm kiếm đa năng (Tên, username, email), Lọc theo vai trò (Dropdown Tất cả / Lễ tân / Buồng phòng / Kỹ thuật...), Lọc trạng thái hoạt động.
- **Bảng Danh sách Nhân sự (Ant Design Table)**:
  - Họ và tên + Avatar chữ cái đầu.
  - Tên đăng nhập (username) font monospace nổi bật.
  - Email liên hệ.
  - Vai trò kèm Tag màu thương hiệu chuẩn (Admin đỏ/tím, Quản lý xanh dương, Lễ tân xanh ngọc, Buồng phòng cam, Kế toán vàng, Kỹ thuật xanh lá).
  - Trạng thái Hoạt động (Tag xanh "Đang hoạt động" / Tag xám "Đã khóa").
  - Ngày tạo tài khoản.
  - Cột Hành động: Nút Sửa, Nút Khóa/Vô hiệu hóa (với Popconfirm giải thích rõ việc hủy mọi phiên đăng nhập).
- **Modal Thêm mới Nhân viên (`CreateEmployeeModal`)**:
  - Form nhập Họ tên, Username, Email, Vai trò.
  - Chọn vai trò tuân thủ Role Hierarchy (nếu người đang đăng nhập là Manager thì dropdown tự động loại bỏ lựa chọn Admin & Manager).
  - Ô nhập mật khẩu ban đầu kèm nút "Tự động sinh mật khẩu ngẫu nhiên an toàn" (đáp ứng tiêu chuẩn >= 15 ký tự, >= 8 ký tự phân biệt).
  - Checkbox / Nút sao chép thông tin tài khoản để gửi cho nhân viên mới.
- **Modal Chỉnh sửa Nhân viên (`EditEmployeeModal`)**:
  - Chỉnh sửa Họ tên, Email, Thay đổi vai trò (chặn sửa username & mật khẩu theo đúng thiết kế backend).
- **Quyền hạn hiển thị & An toàn (RBAC)**:
  - Chỉ `ADMIN` và `MANAGER` thấy nút "Thêm nhân viên" và các nút chỉnh sửa/khóa tài khoản.
  - Các nút thao tác trên dòng của chính mình hoặc trên cấp bậc cao hơn sẽ bị disable / ẩn theo đúng phân cấp vai trò.

#### 3. Tích hợp Dynamic Staffing vào các Module Vận hành:
- Nâng cấp Dropdown phân công kỹ thuật viên trong `MaintenancePage.tsx`: Gọi `useQuery` lấy danh sách kỹ thuật viên thực tế từ `/employees?role=TECHNICIAN&isActive=true`.
- Nâng cấp Dropdown phân công buồng phòng trong `HousekeepingPage.tsx`: Lấy danh sách nhân viên buồng phòng từ `/employees?role=HOUSEKEEPING&isActive=true`.
- Cập nhật tiện ích `staffDirectory.ts` để cache và tra cứu tên nhân sự tự động.

#### 4. Cấu hình Định tuyến & Menu Sidebar:
- Thêm route `/employees` trong `src/routes/AppRoutes.tsx`.
- Thêm mục "Quản lý Nhân sự" trên thanh điều hướng Sidebar (`MainLayout.tsx`) hiển thị cho `ADMIN` và `MANAGER`.


---

### 💻 Triển khai Hoàn tất Phase 9: Quản lý Nhân sự & Dynamic Staffing:

#### 1. Các thành phần đã tạo mới:
- `src/types/employees.types.ts`:
  - Định nghĩa chuẩn TypeScript cho `EmployeeItem`, `CreateEmployeeDto`, `UpdateEmployeeDto`, `EmployeeQuery`.
  - Ma trận trọng số cấp bậc `ROLE_HIERARCHY`: ADMIN (100), MANAGER (80), RECEPTIONIST (60), HOUSEKEEPING/ACCOUNTANT/TECHNICIAN (40).
  - Trợ năng `canManageRole(actorRole, targetRole)` và `getAssignableRoles(actorRole)`.
  - Bảng ánh xạ màu sắc và huy hiệu chức vụ `ROLE_CONFIG`.
- `src/api/employees.api.ts`:
  - Các hàm gọi API `list`, `create`, `update`, `deactivate`.
  - Tự động chuẩn hóa dữ liệu đầu vào (trim họ tên, email lowercase hoặc null, username lowercase).
- `src/pages/employees/components/CreateEmployeeModal.tsx`:
  - Form tạo tài khoản nhân viên.
  - Trình sinh mật khẩu an toàn ngẫu nhiên bằng Web Crypto API (`window.crypto.getRandomValues`) cam kết $\ge 16$ ký tự và $\ge 8$ ký tự khác nhau.
  - Bộ công cụ kiểm tra độ mạnh mật khẩu trực quan và nút 1-click sao chép mật khẩu vào bộ nhớ tạm.
  - Dropdown vai trò tuân thủ nghiêm ngặt Role Hierarchy: Nếu Quản lý đăng nhập thì chỉ được tạo các vai trò cấp dưới (Lễ tân, Kế toán, Buồng phòng, Kỹ thuật).
- `src/pages/employees/components/EditEmployeeModal.tsx`:
  - Form chỉnh sửa họ tên, email và thay đổi vai trò.
  - Khóa trường username (chỉ đọc) và không cung cấp trường đổi mật khẩu theo đúng hợp đồng thiết kế của Backend.
- `src/pages/employees/EmployeesPage.tsx`:
  - **Thẻ KPI Thống kê chuẩn xác**: Tổng số nhân sự, Đang hoạt động, Đã vô hiệu hóa; Phân bổ theo 6 vai trò chức danh. Sử dụng `limit: 1` và `useQueries` để lấy số lượng chính xác mà không tải dữ liệu dư thừa.
  - **Bộ lọc đa năng**: Tìm kiếm theo họ tên, username hoặc email; Lọc theo vai trò; Lọc theo trạng thái; Sắp xếp theo các trường hợp lệ của backend.
  - **Bảng dữ liệu Ant Design Table**: Cột Họ tên & Avatar chữ cái đầu, Monospace username, Email, Tag chức vụ màu thương hiệu, Tag trạng thái, Ngày tạo.
  - **Cột Hành động thông minh**:
    - Nút Sửa: Tự động vô hiệu hóa nếu nhân viên có cấp bậc bằng hoặc cao hơn người đang đăng nhập.
    - Nút Khóa / Vô hiệu hóa: Popconfirm cảnh báo rõ ràng việc thu hồi mọi phiên đăng nhập; Ẩn với tài khoản đã khóa; Chặn tự khóa chính mình; Bắt mã lỗi `LAST_ADMIN` từ máy chủ.

#### 2. Tích hợp Dynamic Staffing vào Buồng phòng & Bảo trì:
- Nâng cấp `src/utils/staffDirectory.ts`:
  - Bổ sung `dynamicStaffRegistry` (Map lưu trữ thông tin nhân viên tải động từ API).
  - Hàm `registerStaffMembers` nạp danh sách nhân sự vào bộ nhớ đệm giao diện.
  - Hàm `getStaffDisplay` kiểm tra dynamic registry trước, giữ fallback trung tính `Nhân viên #ID` (không đoán tên) để lịch sử cũ không bị mất ngay cả khi nhân viên đã bị khóa tài khoản.
- Nâng cấp `src/pages/maintenance/MaintenancePage.tsx`:
  - Xóa bỏ hoàn toàn mảng tĩnh `TECHNICIAN_STAFF_OPTIONS`.
  - Thay bằng hook `useQuery` gọi `GET /employees?role=TECHNICIAN&isActive=true`.
  - Modal phân công kỹ thuật viên hiển thị danh sách kỹ thuật viên thực tế từ cơ sở dữ liệu.
- Nâng cấp `src/pages/housekeeping/HousekeepingPage.tsx`:
  - Xóa bỏ hoàn toàn mảng tĩnh `HOUSEKEEPING_STAFF_OPTIONS`.
  - Thay bằng hook `useQuery` gọi `GET /employees?role=HOUSEKEEPING&isActive=true`.
  - Modal phân công buồng phòng hiển thị danh sách nhân sự buồng phòng thực tế từ cơ sở dữ liệu.

#### 3. Phân quyền & Điều hướng:
- `src/routes/AppRoutes.tsx`: Định tuyến `/employees` được bảo vệ bởi `ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}`. Các vai trò khác truy cập trực tiếp sẽ được chuyển hướng tới trang 403 Forbidden.
- `src/layouts/MainLayout.tsx`: Bổ sung menu "Quản lý Nhân sự" với biểu tượng `<TeamOutlined />` trên thanh Sidebar dành riêng cho `ADMIN` và `MANAGER`.

#### 4. Kết quả Kiểm thử & Đóng gói:
- `npm run build` (`tsc -b && vite build`): **Biên dịch thành công 100%, 0 lỗi TypeScript**.
- `npm run lint` (`oxlint`): **0 lỗi linter**.


---

## 📅 Ngày: 16/10/2026 (Buổi chiều)

### 🎯 Mục tiêu trong buổi:
- Triển khai toàn diện **Phase 10 — Room Matrix, Dashboard KPI và Báo cáo Điều hành (Reporting & Analytics)** trên nhánh `feature/fe-matrix-dashboard`.
- Xóa bỏ 100% dữ liệu giả lập (mock data) trên Dashboard.
- Hiện thực hóa Bảng ma trận phòng theo ngày (Room Matrix Grid) tại route `/calendar`.
- Hiện thực hóa Trung tâm Báo cáo Điều hành 6 phân hệ tại route `/reports` kèm trích xuất CSV trực tiếp từ máy chủ.
- Tuân thủ nghiêm ngặt bảo mật phân quyền Role-Based Access Control (RBAC), cấp bậc dữ liệu và chuẩn kế toán số học thập phân (Decimal precision).

---

### 💻 Công việc kỹ thuật đã hoàn thành:

#### 1. Khởi tạo Nhánh Git & Khung Kiểu Dữ Liệu:
- Tạo và checkout nhánh mới: `feature/fe-matrix-dashboard`.
- Tạo `src/types/reports.types.ts`:
  - Định nghĩa chuẩn toàn bộ DTOs và Metrics theo tài liệu `backend/REPORTS.md` và `backend/src/config/reports.openapi.ts`.
  - Bao gồm: `ReportPeriod`, `DataQuality`, `BalanceAt`, `FinanceBasis`, `RevenueReport`, `PaymentReport`, `OccupancyReport`, `ReservationReport`, `OperationsReport`, `OutstandingReport`, `DashboardReport`.
  - Các interface tham số truy vấn: `ReportPeriodQuery`, `ReportPaymentQuery`, `ReportOccupancyQuery`, `ReportOutstandingQuery`, `ReportExportQuery`.
- Tạo `src/api/reports.api.ts`:
  - Đóng gói 7 endpoint báo cáo: `getDashboard`, `getRevenue`, `getPayments`, `getOccupancy`, `getReservations`, `getOperations`, `getOutstanding`.
  - Phương thức `exportCsv`: Gửi request với `responseType: 'blob'`, phân tích tiêu đề `Content-Disposition` để nhận tên file CSV chính xác từ máy chủ.

#### 2. Xóa bỏ Mock Data & Nâng cấp Dashboard Đa Vai Trò (`/dashboard`):
- Xóa sạch toàn bộ mảng dữ liệu mẫu `sampleArrivals`, `sampleDepartures`.
- Phân luồng giao diện thông minh theo vai trò người dùng (Dynamic Role View):
  - **Lễ tân & Cấp Quản lý (`ADMIN`, `MANAGER`, `RECEPTIONIST`)**:
    - Gọi API `/reports/dashboard` theo ngày (mặc định hôm nay, có bộ chọn ngày).
    - Thẻ thống kê 8 trạng thái phòng thời gian thực: Đang có khách, Sẵn sàng, Phòng trống, Bẩn, Đang dọn, Chờ nghiệm thu, Đang bảo trì, Tạm ngừng phục vụ.
    - Dự kiến đến (Expected Arrivals) và Dự kiến đi (Expected Departures).
    - Phân hệ Tài chính nhanh (Financial Snapshot): Chỉ hiển thị cho Quản lý / Admin; tự động ẩn cho Lễ tân theo chính sách bảo mật nội bộ.
    - Hai bảng nghiệp vụ trực tiếp từ database: Danh sách khách dự kiến đến (`reservationsApi.getAll({ status: 'CONFIRMED' })`) kèm nút Check-in nhanh; Danh sách khách đang lưu trú (`staysApi.getAll({ status: 'CHECKED_IN' })`) kèm nút mở Folio thanh toán.
  - **Kế toán (`ACCOUNTANT`)**:
    - Gọi API `/reports/revenue` và `/reports/outstanding` trong 30 ngày gần nhất.
    - Hiển thị Doanh số phòng ghi nợ, Thực thu ròng tiền mặt & chuyển khoản, Tổng dư nợ chưa quyết toán.
    - Bảng danh sách Folio còn dư nợ kèm nút điều hướng nhanh sang quầy Thu ngân.
  - **Buồng phòng (`HOUSEKEEPING`)**:
    - Gọi API `/reports/operations`.
    - Thẻ đếm: Phòng bẩn (Dirty), Đang làm vệ sinh (Cleaning), Chờ kiểm tra (Inspection), Phòng sạch đạt chuẩn (Ready).
    - Nút chuyển nhanh đến Bảng Kanban Buồng phòng.
  - **Kỹ thuật viên (`TECHNICIAN`)**:
    - Gọi API `/reports/operations`.
    - Thẻ đếm: Phòng đang bảo trì, Phòng ngừng phục vụ (OOS), Sự cố mới (Open), Đang xử lý (In-progress), Lệnh khóa phòng (Blocks).
    - Nút chuyển nhanh đến Bảng Bảo trì Kỹ thuật.

#### 3. Xây dựng Bảng Ma Trận Phòng Vật Lý Trực Quan (`/calendar`):
- Tạo `src/pages/calendar/RoomMatrixPage.tsx`:
  - Khung nhìn 7 ngày linh hoạt: Nút Tuần trước, Hôm nay, Tuần sau, và DatePicker chọn ngày chính xác.
  - Bộ lọc đa tiêu chí: Lọc theo Tầng (Floors), Hạng phòng (Room Types), Trạng thái phòng (Status).
  - Cột đầu tiên cố định (Sticky Room Column): Hiển thị Số phòng vật lý, Tầng lầu, Mã hạng phòng và Tag trạng thái vận hành hiện tại.
  - Thanh cuộn ngang mượt mà cho 7 ngày:
    - Ô có khách lưu trú: Huy hiệu màu xanh lá, tên khách hàng và thời hạn lưu trú (Check-in ➔ Check-out).
    - Ô phòng bị khóa bảo trì: Huy hiệu màu đỏ, lý do sự cố và mã lệnh khóa.
    - Ô ngày hiện tại: Hiển thị trạng thái buồng phòng tức thời (Sạch / Bẩn / Đang dọn / Nghiệm thu).
    - Ô tương lai trống: Huy hiệu xám "Trống / Sẵn sàng".
  - **Khu vực chuyên biệt "Đặt phòng chưa gán phòng (Unassigned Reservations)"**:
    - Thu gom toàn bộ các đơn đặt phòng chưa có `roomId` cụ thể.
    - Hiển thị theo thẻ gọn gàng kèm nút 1-click "Gán phòng & Check-in" điều hướng sang `/stays`.
  - **Drawer Chi tiết Tương tác (Cell Click Drawer)**:
    - Nhấp vào bất kỳ ô nào để xem toàn diện thông tin: Phòng vật lý, thông tin khách lưu trú, thời gian nhận/trả phòng, chi tiết phiếu bảo trì.
    - Nút điều hướng ngữ cảnh: "Xem đặt phòng", "Mở quầy lưu trú", "Mở quản lý bảo trì".

#### 4. Trung Tâm Báo Cáo Điều Hành & Xuất CSV (`/reports`):
- Tạo `src/pages/reports/ReportsPage.tsx`:
  - **6 Phân hệ Báo cáo Chuyên sâu**:
    1. *Doanh thu & Bán phòng (`RevenueReport`)*: Tiền phòng billed, Tiền dịch vụ, Điều chỉnh nợ/có, Ghi nhận ròng, Thực thu ròng, Biến động công nợ, Số lượng giao dịch.
    2. *Dòng tiền & Thu chi (`PaymentReport`)*: Lọc theo Tiền mặt (CASH) hoặc Chuyển khoản (BANK_TRANSFER); Thống kê Thanh toán, Đặt cọc, Hoàn trả và Thực thu ròng.
    3. *Công suất phòng & Chỉ số (`OccupancyReport`)*: Lọc theo Hạng phòng; Tỷ lệ lấp đầy (Occupancy Rate), Giá bán bình quân phòng (ADR), Doanh thu trên phòng sẵn có (RevPAR), Phòng-đêm bảo trì. Ẩn các chỉ số tài chính đối với Lễ tân.
    4. *Đặt phòng & Nguồn khách (`ReservationReport`)*: Thống kê số lượng tạo mới, xác nhận, đã hủy, no-show, check-in/out; Biểu đồ phân bổ kênh đặt phòng (DIRECT, WEBSITE, OTA, WALK_IN, PHONE, OTHER).
    5. *Vận hành Buồng phòng & Bảo trì (`OperationsReport`)*: Dữ liệu tức thời và hiệu suất kỳ cho Housekeeping & Maintenance.
    6. *Sổ theo dõi Công nợ (`OutstandingReport`)*: Phải thu khách hàng (Debit), Khách trả thừa (Credit), Bảng phân trang và sắp xếp danh sách Folio chưa tất toán.
  - **Xử lý số liệu kế toán chuẩn mực**:
    - Không tính toán lại ADR/RevPAR bằng số thực JavaScript (floating point) mà hiển thị giá trị chuỗi Decimal chính xác từ backend.
    - Hiển thị rõ ràng "Chưa đủ dữ liệu đêm đã chốt" hoặc "-" khi số liệu là null; không tự ép về 0 hoặc 0%.
    - Cảnh báo trực quan ghi chú chất lượng dữ liệu (`dataQuality.limitations`) khi có ngày chưa chốt đêm (unclosed days).
  - **Trích xuất dữ liệu CSV (Export Engine)**:
    - Nút "Xuất báo cáo CSV" tích hợp cơ chế tải file Blob mượt mà.
    - Phân quyền chuẩn xác: `ADMIN` và `MANAGER` được xuất cả 4 loại báo cáo; `ACCOUNTANT` được xuất Doanh thu và Dòng tiền; các vai trò khác không hiển thị nút xuất.
  - **Bộ lọc thời gian toàn cục**:
    - Khoảng thời gian nửa mở `[startDate, endDate)` có kiểm tra chặn giới hạn tối đa 366 ngày và $startDate < endDate$.
    - Các nút gán sẵn: 7 ngày qua, 30 ngày qua, Tháng này, Quý này.
    - Công tắc chuyển đổi gộp nhóm: `Theo ngày` hoặc `Theo tháng`.

#### 5. Cập nhật Định tuyến & Menu:
- Cập nhật `src/routes/AppRoutes.tsx`:
  - Thay thế `PhasePlaceholderPage` tại route `/calendar` bằng `<RoomMatrixPage />`.
  - Thay thế `PhasePlaceholderPage` tại route `/reports` bằng `<ReportsPage />`.
  - Mở quyền truy cập `/reports` cho tất cả 6 vai trò đã xác thực.
- Cập nhật `src/layouts/MainLayout.tsx`:
  - Mở quyền hiển thị menu "Báo cáo điều hành" trên Sidebar cho toàn bộ người dùng đăng nhập.

#### 6. Kết quả Kiểm thử & Đóng gói:
- `npm run build` (`tsc -b && vite build`): **Biên dịch thành công 100%, 0 lỗi TypeScript**.
- `npm run lint` (`oxlint`): **0 lỗi linter**.

---

## 📅 Ngày: 19/10/2026

### 🎯 Mục tiêu trong ngày:
- Triển khai toàn diện **Phase Frontend cho Module Quản lý Vật tư & Kho (Inventory & Warehouse Management)** trên nhánh `feature/fe-inventory`.
- Thay thế hoàn toàn màn hình placeholder `InventoryPage.tsx` bằng giao diện kho chuyên nghiệp, tích hợp liền mạch với Backend API hiện có.
- Hiện thực hóa 6 luồng màn hình nghiệp vụ trọng yếu: Tổng quan định mức, Danh mục vật tư, Nhóm danh mục, Nhà cung cấp, Phiếu nhập kho, Phiếu xuất kho, Kiểm kê và Sổ kho biến động.
- Áp dụng chuẩn nhận diện thương hiệu PMS (Emerald `#1b4d3e`, Slate `#0f2922`, Card trắng viền `#e2e8f0`).
- Thực hiện cơ chế phân quyền truy cập ma trận RBAC chặt chẽ khớp 100% với `inventoryPermissions` của Backend.
- Kiểm tra biên dịch TypeScript, Lint và xác nhận vận hành thành công cùng cơ sở dữ liệu đã nạp seed data.

---

### 💻 Công việc kỹ thuật đã hoàn thành:

#### 1. Khởi tạo Nhánh Git & Định nghĩa Kiểu dữ liệu (`types/inventory.types.ts`):
- Khởi tạo và làm việc trên nhánh tính năng chuẩn: `feature/fe-inventory`.
- Tạo `frontend/src/types/inventory.types.ts`:
  - Định nghĩa chuẩn toàn bộ interface Views tương thích với backend response:
    - `InventoryCategoryView`, `SupplierView`, `InventoryItemView`, `InventoryItemCategoryInfo`.
    - `StockReceiptView`, `StockReceiptItemView`.
    - `StockIssueView`, `StockIssueItemView`.
    - `StockAdjustmentView`, `InventoryMovementView`.
    - `InventorySummary`, `InventorySummaryCategory`.
  - Định nghĩa DTOs cho các thao tác ghi dữ liệu:
    - `CreateCategoryDto`, `UpdateCategoryDto`, `CategoryQueryParams`.
    - `CreateSupplierDto`, `UpdateSupplierDto`, `SupplierQueryParams`.
    - `CreateItemDto`, `UpdateItemDto`, `ItemQueryParams`, `StockStatusFilter` (`ALL`, `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
    - `CreateReceiptDto`, `CreateReceiptItemDto`, `ReceiptQueryParams`.
    - `CreateIssueDto`, `CreateIssueItemDto`, `IssueQueryParams`.
    - `CreateAdjustmentDto`, `MovementQueryParams`, `LowStockQueryParams`.
  - **Quy chuẩn số liệu & ID**: Giữ ID dưới dạng `string` (hạn chế tràn số BigInt trên trình duyệt), số lượng và đơn giá dạng `string` decimal hai chữ số thập phân (`"0.00"`).

#### 2. Xây dựng API Client Wrapper (`api/inventory.api.ts`):
- Sử dụng trực tiếp `apiClient` từ `axiosClient.ts` (đã tích hợp tự động Access Token, CSRF token qua header `X-CSRF-Protection: 1`, và Silent Refresh Token khi gặp mã lỗi 401).
- Đóng gói đầy đủ các endpoints:
  - Báo cáo tổng hợp: `GET /inventory/summary`, `GET /inventory/low-stock`.
  - Danh mục: `GET/POST /inventory/categories`, `GET/PATCH /inventory/categories/:id`, `PATCH /inventory/categories/:id/deactivate`.
  - Nhà cung cấp: `GET/POST /inventory/suppliers`, `GET/PATCH /inventory/suppliers/:id`, `PATCH /inventory/suppliers/:id/deactivate`.
  - Vật tư: `GET/POST /inventory/items`, `GET/PATCH /inventory/items/:id`, `PATCH /inventory/items/:id/deactivate`.
  - Phiếu nhập: `GET/POST /inventory/receipts`, `GET /inventory/receipts/:id`.
  - Phiếu xuất: `GET/POST /inventory/issues`, `GET /inventory/issues/:id`.
  - Điều chỉnh kiểm kê: `POST /inventory/adjustments`.
  - Biến động sổ kho: `GET /inventory/movements`.
- **Hàm xử lý Clean Params (`cleanParams`)**: Tự động loại bỏ các thuộc tính `undefined`, `null` hoặc chuỗi rỗng trước khi gửi request params. Đảm bảo tuân thủ nghiêm ngặt Zod `.strict()` schema của Backend (tuyệt đối không gửi `sortBy` hay `sortOrder` tránh bị trả về HTTP 400).
- **Hàm ánh xạ mã lỗi chuyên sâu (`getInventoryErrorMessage`)**: Bắt mã lỗi từ `error.response?.data?.error?.code` và chuyển dịch thành thông báo tiếng Việt trực quan:
  - `CATEGORY_CODE_EXISTS`, `CATEGORY_IN_USE`, `CATEGORY_NOT_FOUND`.
  - `SUPPLIER_CODE_EXISTS`, `SUPPLIER_INACTIVE`, `SUPPLIER_NOT_FOUND`.
  - `ITEM_CODE_EXISTS`, `ITEM_INACTIVE`, `ITEM_NOT_FOUND`.
  - `INSUFFICIENT_STOCK`, `RECEIPT_NUMBER_EXISTS`, `ISSUE_NUMBER_EXISTS`, `ADJUSTMENT_NUMBER_EXISTS`.

#### 3. Xây dựng các Tab & Components Giao diện Kho:

1. **Tab Tổng quan & Định mức (`InventoryOverviewTab.tsx`)**:
   - 4 Thẻ KPI vận hành: Tổng số vật tư đang quản lý, Vật tư sắp hết (dưới định mức tối thiểu), Vật tư đã hết hàng, Tổng giá trị tồn kho ước tính (VNĐ).
   - Bảng cảnh báo vật tư dưới ngưỡng tối thiểu: Hiển thị nhanh mức tồn hiện tại, định mức và nút tắt mở lập phiếu nhập kho hoặc xem chi tiết.
   - Bảng phân nhóm danh mục: Thống kê số lượng mặt hàng và số lượng vật tư chạm ngưỡng cảnh báo theo từng nhóm.

2. **Tab Danh mục Vật tư kho (`InventoryItemsTab.tsx`)**:
   - Bảng Ant Design Table phân trang (10, 20, 50, 100), thanh tìm kiếm theo mã/tên, bộ lọc theo danh mục, trạng thái hoạt động và 4 trạng thái tồn (`ALL`, `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
   - Cột tồn kho hiển thị màu trạng thái: Xanh lá (Đủ hàng), Cam (Sắp hết), Đỏ (Hết hàng).
   - Modal Thêm & Sửa vật tư: Nhập mã, tên, danh mục, đơn vị tính, định mức tồn tối thiểu và mô tả. **Khóa hoàn toàn trường `currentStock`** (không cho nhập tồn trực tiếp để bảo vệ tính toàn vẹn sổ kho).
   - Modal Chi tiết vật tư ([`ItemDetailModal.tsx`](file:///c:/Users/trand/hoc_tap/H%E1%BB%8Dc%20K%E1%BB%B3%20Doanh%20Nghi%E1%BB%87p/D%E1%BB%B1%20%C3%A1n%20Qly/innvyra-pms/frontend/src/pages/inventory/components/ItemDetailModal.tsx)) kèm nút kích hoạt nhanh biên bản kiểm kê.

3. **Tab Nhóm Danh mục (`InventoryCategoriesTab.tsx`)**:
   - Bảng quản lý danh mục vật tư: Mã, tên, mô tả, trạng thái hoạt động.
   - Modal tạo mới và chỉnh sửa danh mục.
   - Thao tác ngừng hoạt động với Popconfirm xác nhận, bắt và giải thích mã lỗi `CATEGORY_IN_USE` khi còn vật tư gán vào nhóm.

4. **Tab Nhà Cung Cấp (`InventorySuppliersTab.tsx`)**:
   - Danh sách nhà cung cấp vật tư & trang thiết bị kèm thông tin liên lạc (người đại diện, số điện thoại, email, địa chỉ).
   - Modal thêm mới và chỉnh sửa nhà cung cấp, thao tác ngừng hợp tác.

5. **Tab Phiếu Nhập kho (`InventoryReceiptsTab.tsx`)**:
   - Bảng lịch sử phiếu nhập có bộ lọc theo nhà cung cấp và khoảng ngày (`RangePicker`).
   - Modal lập phiếu nhập kho linh hoạt: Chọn nhà cung cấp (hoặc nhập lẻ), ngày nhập, ghi chú.
   - Danh sách dòng mặt hàng động: Cho phép thêm nhiều dòng vật tư, số lượng (> 0) và đơn giá nhập (VNĐ).
   - **Cơ chế tự động gộp dòng (Auto-Merge Deduplication)**: Tự động phát hiện khi người dùng chọn trùng vật tư ở các dòng khác nhau, cộng dồn số lượng và thông báo rõ ràng cho người dùng.
   - Tính toán xem trước tổng tiền phiếu nhập thời gian thực.
   - Modal Xem chi tiết phiếu nhập ([`ReceiptDetailModal.tsx`](file:///c:/Users/trand/hoc_tap/H%E1%BB%8Dc%20K%E1%BB%B3%20Doanh%20Nghi%E1%BB%87p/D%E1%BB%B1%20%C3%A1n%20Qly/innvyra-pms/frontend/src/pages/inventory/components/ReceiptDetailModal.tsx)) hiển thị đầy đủ bảng hàng hóa và đơn giá.

6. **Tab Phiếu Xuất kho (`InventoryIssuesTab.tsx`)**:
   - Bảng lịch sử phiếu xuất có bộ lọc theo bộ phận nhận và khoảng ngày.
   - Modal lập phiếu xuất kho: Chọn bộ phận nhận (Housekeeping, Technician, Front Desk, F&B, v.v.), mục đích xuất dùng, ngày xuất.
   - Bảng chọn vật tư xuất hiển thị tức thời tồn kho khả dụng để người dùng chủ động điều chỉnh số lượng.
   - **Xử lý sự cố tồn kho thân thiện (`INSUFFICIENT_STOCK` & `ITEM_INACTIVE`)**: Khi máy chủ từ chối do thiếu tồn kho hoặc vật tư ngừng hoạt động, form xuất kho **giữ nguyên toàn bộ dữ liệu** đã nhập kèm thông báo cảnh báo để người dùng dễ dàng chỉnh sửa mà không bị mất công nhập lại từ đầu.
   - Modal Xem chi tiết phiếu xuất ([`IssueDetailModal.tsx`](file:///c:/Users/trand/hoc_tap/H%E1%BB%8Dc%20K%E1%BB%B3%20Doanh%20Nghi%E1%BB%87p/D%E1%BB%B1%20%C3%A1n%20Qly/innvyra-pms/frontend/src/pages/inventory/components/IssueDetailModal.tsx)).

7. **Tab Sổ kho & Nhật ký Biến động (`InventoryMovementsTab.tsx`)**:
   - Ghi nhận dòng chảy vật tư theo thời gian thực từ `GET /inventory/movements`.
   - Phân loại rõ ràng 3 loại giao dịch: Nhập kho (`RECEIPT` - Xanh lá), Xuất kho (`ISSUE` - Cam đỏ), Kiểm kê (`ADJUSTMENT` - Tím).
   - Thể hiện rõ chiều biến động số lượng ($+X$ hoặc $-X$), lượng tồn trước và tồn sau giao dịch để kế toán và quản lý đối chiếu chứng từ.

8. **Modal Kiểm kê & Điều chỉnh Tồn kho (`StockAdjustmentModal.tsx`)**:
   - Form kiểm kê cho phép nhập số lượng thực tế đếm được trong kho ($\ge 0$).
   - Tự động tính toán và hiển thị độ chênh lệch tăng/giảm ($Difference = Actual - System$) bằng Tag màu trực quan trước khi gửi.
   - Bắt buộc ghi rõ lý do kiểm kê/điều chỉnh (hao hụt, kiểm kê định kỳ, hư hỏng) để phục vụ thanh tra nội bộ.

#### 4. Phân Quyền & Tích Hợp Hệ Thống:
- Nâng cấp `src/pages/inventory/InventoryPage.tsx`:
  - Đồng bộ trạng thái tab đang chọn lên URL query string (`?tab=...`).
  - Phân luồng hiển thị tab theo vai trò:
    - `ADMIN` & `MANAGER`: Hiển thị trọn vẹn 7 tab, đầy đủ nút Tạo/Sửa/Ngừng HĐ/Kiểm kê.
    - `ACCOUNTANT`: Hiển thị 7 tab ở chế độ Chỉ đọc (Read-only, ẩn toàn bộ nút can thiệp dữ liệu).
    - `HOUSEKEEPING` & `TECHNICIAN`: Chỉ hiển thị 3 tab được phép (Vật tư, Danh mục, Phiếu xuất kho); được phép lập phiếu xuất kho.
- Cập nhật `src/routes/AppRoutes.tsx`: Gỡ bỏ vai trò `RECEPTIONIST` khỏi route `/inventory` để bảo vệ từ tầng router (tránh tình trạng truy cập vào bị lỗi 403 Forbidden).
- Cập nhật `src/layouts/MainLayout.tsx`: Gỡ bỏ vai trò `RECEPTIONIST` khỏi menu điều hướng "Quản lý vật tư & Kho".

#### 5. Đồng Bộ Cơ Sở Dữ Liệu & Kiểm Thử Toàn Diện:
- Thực hiện sinh lại Prisma Client: `npm run prisma:generate`.
- Áp dụng migration tạo bảng: `npm run db:migrate` (`20261016000000_inventory_management`).
- Nạp dữ liệu mẫu ban đầu: `npm run seed:inventory` (5 danh mục, 5 nhà cung cấp, 25 mặt hàng vật tư đa ngành, các phiếu nhập kho mẫu tạo tồn khả dụng).
- Kiểm tra biên dịch dự án Frontend:
  - `npm run build` (`tsc -b && vite build`): **100% thành công, 0 lỗi TypeScript**.
  - `npm run lint` (`oxlint`): **0 lỗi linter**.
- Đã commit toàn bộ mã nguồn vào nhánh `feature/fe-inventory` trên local Git.
