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

