# 🏨 INNVYRA PMS — FRONTEND ARCHITECTURE & ROADMAP REPORT

> **Dự án:** Hệ thống Quản lý Khách sạn & Tài sản Lưu trú (Property Management System - PMS)  
> **Khách sạn quy mô:** Giả định Invyra Hotel (50 phòng, 4 hạng phòng)  
> **Đồ án môn học:** Phân tích và Thiết kế Hệ thống — Trường ĐH Giao thông Vận tải TP.HCM  

---

## 1. 🎯 Tổng Quan Dự Án

Innvyra PMS Frontend là giao diện điều hành tập trung cho toàn bộ quy trình vận hành khách sạn: từ lễ tân (đặt phòng, check-in, check-out), bộ phận buồng phòng (dọn dẹp, kiểm tra vệ sinh), bảo trì kỹ thuật, kế toán thu ngân cho đến quản lý điều hành.

Giao diện được thiết kế dựa trên:
- **Tài liệu đặc tả:** 14 Use Cases, 8 Wireframes chuẩn nghiệp vụ lưu trú.
- **Backend API:** Kiến trúc RESTful, bảo mật đa lớp (JWT Bearer Token, HttpOnly Cookie, CSRF Guard, RBAC 6 Roles).

---

## 2. ⚡ Tech Stack & Công Nghệ Lựa Chọn

| Thành phần | Công nghệ | Phiên bản | Lý do lựa chọn |
| :--- | :--- | :--- | :--- |
| **Framework** | **React** | 19.x | Thư viện UI số 1 thế giới, component hóa linh hoạt, hiệu năng cao |
| **Build Tool** | **Vite** | 8.x | Tốc độ HMR tức thì, tương thích tối đa với hệ sinh thái TS hiện đại |
| **Ngôn ngữ** | **TypeScript** | 6.x | Kiểu dữ liệu chặt chẽ, đồng bộ cấu trúc dữ liệu với backend |
| **UI Library** | **Ant Design** | 5.x / 6.x | Thư viện UI chuẩn doanh nghiệp cho Dashboard, Table, Form, DatePicker |
| **Router** | **React Router** | 7.x | Điều hướng trang SPA, hỗ trợ Protected Route & Role Checking |
| **HTTP Client** | **Axios** | 1.x | Hỗ trợ Request/Response Interceptor, tự động gắn CSRF và Refresh Token |
| **Server State** | **TanStack Query** | 5.x | Quản lý cache dữ liệu từ API, chống spam request, loading/error state chuẩn |
| **Client State** | **Zustand** | 5.x | Quản lý Auth State gọn nhẹ, không boilerplate phức tạp như Redux |
| **Date Time** | **Dayjs** | 1.x | Xử lý định dạng ngày nhận/trả phòng, tương thích gốc với Ant Design |

---

## 3. 📂 Cấu Trúc Thư Mục Frontend

```text
frontend/
├── dist/                   # Bản build production
├── public/                 # Static assets công khai
├── src/
│   ├── api/                # Tầng gọi API qua Axios
│   │   ├── axiosClient.ts  # Axios instance + CSRF header + 401 refresh interceptor
│   │   ├── auth.api.ts     # Các hàm gọi API xác thực (/auth/login, /auth/me,...)
│   │   ├── rooms.api.ts    # API quản lý loại phòng (/room-types) & phòng vật lý (/rooms)
│   │   ├── guests.api.ts   # API quản lý hồ sơ khách hàng (/guests)
│   │   ├── reservations.api.ts # API đặt phòng & tra cứu tồn phòng (/reservations)
│   │   ├── stays.api.ts    # API lưu trú, check-in, check-out, đổi phòng (/stays)
│   │   ├── housekeeping.api.ts # API buồng phòng (/housekeeping)
│   │   ├── maintenance.api.ts  # API sự cố & khóa phòng bảo trì (/maintenance)
│   │   ├── billing.api.ts  # API quản lý dịch vụ, đơn dịch vụ, Folio & thanh toán (/billing)
│   │   └── employees.api.ts # API quản lý nhân sự & phân quyền tài khoản (/employees)
│   ├── components/         # Reusable UI components
│   │   ├── ProtectedRoute.tsx # Hộ tống Route theo trạng thái đăng nhập & role
│   │   ├── RoleBadge.tsx   # Tag màu hiển thị vai trò người dùng
│   │   └── ErrorBoundary.tsx # Bắt lỗi giao diện React an toàn, chống crash trắng màn hình
│   ├── layouts/            # Khung giao diện chính
│   │   └── MainLayout.tsx  # Layout chuẩn: Sider thu gọn, ngày vận hành & ca trực động, số phòng realtime
│   ├── pages/              # Màn hình chức năng
│   │   ├── auth/           # Màn hình Đăng nhập (tích hợp Quick Demo Account Selector)
│   │   ├── dashboard/      # Màn hình Tổng quan vận hành
│   │   ├── room-types/     # Màn hình Danh mục Hạng / Loại phòng
│   │   ├── rooms/          # Màn hình Quản lý Sơ đồ Lưới phòng (Grid) & Danh sách (Table)
│   │   ├── guests/         # Màn hình Quản lý Khách hàng & Mã hóa CCCD/Passport
│   │   ├── reservations/   # Màn hình Đặt phòng & Tra cứu Tồn phòng Thời gian thực
│   │   ├── stays/          # Màn hình Lưu trú, Quầy Check-in, Trả phòng, Đổi phòng
│   │   ├── housekeeping/   # Màn hình Quản lý Buồng phòng (Kanban, nghiệm thu, phòng bẩn)
│   │   ├── maintenance/    # Màn hình Bảo trì Kỹ thuật (Phiếu sự cố, Lệnh khóa phòng)
│   │   ├── billing/        # Màn hình Thu ngân, Sổ công nợ Folio, Dịch vụ & In phiếu thu
│   │   ├── employees/      # Màn hình Quản lý Nhân sự, Cấp tài khoản & Phân quyền Role Hierarchy
│   │   └── common/         # Màn hình 403, 404, Placeholder thông báo phase
│   ├── routes/             # Cấu hình định tuyến
│   │   └── AppRoutes.tsx   # Khai báo tập trung toàn bộ route của ứng dụng
│   ├── store/              # State management toàn cục
│   │   └── authStore.ts    # Zustand store lưu phiên đăng nhập & thông tin User
│   ├── theme/              # Tùy biến giao diện Ant Design
│   │   └── themeConfig.ts  # Bộ màu Hospitality Boutique Emerald (#1b4d3e) & Slate
│   ├── types/              # Định nghĩa kiểu dữ liệu TypeScript
│   │   ├── api.types.ts    # Chuẩn ApiResponse, ApiError, PaginatedResult, PaginationMeta
│   │   ├── auth.types.ts   # Role, CurrentUser, LoginCredentials
│   │   ├── rooms.types.ts  # RoomTypeItem, RoomItem, Enums trạng thái & DTOs
│   │   ├── guests.types.ts # GuestSummary, GuestDetail, DocumentType, Enums
│   │   ├── reservations.types.ts # ReservationSummary, Detail, Availability, DTOs
│   │   ├── stays.types.ts  # StaySummaryItem, StayDetailItem, CheckinDto, DTOs
│   │   ├── operations.types.ts # Housekeeping & Maintenance types
│   │   ├── billing.types.ts # Service, ServiceOrder, Folio, FolioItem, Payment, DTOs
│   │   └── employees.types.ts # EmployeeItem, Query, Create/UpdateDto, RoleHierarchy
│   ├── App.tsx             # Root component bọc ErrorBoundary, ConfigProvider, QueryClient, Router
│   ├── index.css           # Global reset styling
│   └── main.tsx            # Entry point ReactDOM
├── package.json            # Khai báo dependencies & scripts
├── tsconfig.app.json       # Cấu hình TypeScript cho App
├── vite.config.ts          # Cấu hình Vite server & alias (@/*)
├── DAILY_LOG.md            # Nhật ký tiến độ chi tiết từng ngày
└── README.md               # Tài liệu này
```

---

## 4. 🗺️ Kế Hoạch Triển Khai Chi Tiết & Git Branching

Dự án áp dụng mô hình **Git Flow chuẩn** kết hợp với bạn làm Backend. Cả hai dùng chung nhánh trung tâm `develop`. Mỗi Phase ở Frontend là một nhánh `feature/fe-...` độc lập:

```text
develop (origin/develop)
  │
  ├── feature/fe-foundation            [Phase 1]  ✅ Khởi tạo dự án, Axios, Router, Layout (Merged)
  ├── feature/fe-auth                  [Phase 2]  ✅ Login, Quick Demo Selector, RBAC (Merged)
  ├── feature/fe-rooms                 [Phase 3]  ✅ CRUD Loại phòng & Sơ đồ phòng vật lý (Merged)
  ├── feature/fe-guests                [Phase 4]  ✅ Quản lý Khách hàng & Mã hóa hồ sơ định danh (Merged)
  ├── feature/fe-reservations          [Phase 5]  ✅ Đặt phòng & Tra cứu phòng trống (Availability) (Merged)
  ├── feature/fe-stays                 [Phase 6]  ✅ Check-in gán phòng READY, Check-out & Đổi phòng (Merged)
  ├── feature/fe-operations            [Phase 7]  ✅ Buồng phòng (Kanban) & Bảo trì kỹ thuật (Merged)
  ├── feature/fe-billing               [Phase 8]  ✅ Thu ngân & Quản lý Folio công nợ, dịch vụ, hóa đơn (Merged)
  ├── feature/fe-employees             [Phase 9]  ✅ Quản lý Nhân sự, Cấp phát tài khoản & Phân quyền Role Hierarchy
  ├── feature/fe-matrix-dashboard      [Phase 10] ⏳ Lịch phòng trực quan (Room Matrix) & Dashboard KPI
  └── feature/fe-final-polish          [Phase 11] ⏳ Kiểm thử E2E toàn diện, đóng gói đồ án
```

### Bảng theo dõi tiến độ các Phase:

| Phase | Nhánh | Mục tiêu & Chức năng | Trạng thái |
| :---: | :--- | :--- | :---: |
| **Phase 1** | `feature/fe-foundation` | Dựng khung Vite + React 19 + TS + AntD + Axios + Layout | ✅ Đã merge `develop` |
| **Phase 2** | `feature/fe-auth` | Màn hình Login, Demo Account Chip Selector, JWT Refresh, RBAC | ✅ Đã merge `develop` |
| **Phase 3** | `feature/fe-rooms` | CRUD Loại phòng, Sơ đồ phòng Lưới/Bảng, bộ lọc đa năng, cập nhật nhanh | ✅ Đã merge `develop` |
| **Phase 4** | `feature/fe-guests` | Danh sách khách hàng, CCCD/Passport mã hóa an toàn, phân quyền kế toán | ✅ Đã merge `develop` |
| **Phase 5** | `feature/fe-reservations` | Tra cứu phòng trống theo khoảng ngày (`/rooms/availability`), tạo đơn & hủy đặt | ✅ Đã merge `develop` |
| **Phase 6** | `feature/fe-stays` | Check-in gán phòng READY, danh sách lưu trú, check-out và đổi phòng giữa kỳ | ✅ Đã merge `develop` |
| **Phase 7** | `feature/fe-operations` | Bảng nhiệm vụ dọn dẹp buồng phòng Kanban & Lệnh khóa bảo trì phòng | ✅ Đã merge `develop` |
| **Phase 8** | `feature/fe-billing` | Chi tiết hóa đơn Folio, thanh toán dịch vụ/tiền phòng, in phiếu thanh toán | ✅ Đã merge `develop` |
| **Phase 9** | `feature/fe-employees` | Quản lý Nhân sự, Cấp phát tài khoản, Phân quyền Role Hierarchy & Dynamic Staffing | ✅ Đã hoàn thành |
| **Phase 10**| `feature/fe-matrix-dashboard` | Lịch phòng trực quan (Room Matrix), Dashboard KPI theo Role & Báo cáo điều hành xuất CSV | ✅ Đã hoàn thành |
| **Phase 11**| `feature/fe-final-polish` | Kiểm thử luồng E2E từ Đặt ➔ Check-in ➔ Check-out ➔ Thu tiền, đóng gói đồ án | ⏳ Kế hoạch |


---

## 5. 🔐 Chuẩn Giao Tiếp Backend & Quy Tắc Bảo Mật

Tất cả các API call từ Frontend tuân thủ nghiêm ngặt theo tài liệu `backend/FRONTEND_PERMISSIONS.md` và `backend/OPERATIONS.md`:

1. **Prefix URL:** Mọi request hướng tới `http://localhost:3000/api/v1`.
2. **CSRF Protection:** Mọi request thay đổi dữ liệu (POST, PATCH, DELETE) và login/refresh/logout đều tự động đính kèm header:
   ```http
   X-CSRF-Protection: 1
   ```
3. **Cookie Credentials:** Bắt buộc cấu hình `withCredentials: true` trên Axios Client để trình duyệt gửi và nhận `HttpOnly` Refresh Cookie an toàn.
4. **Cơ chế Silent Refresh Token:** 
   - Access token có hạn 15 phút.
   - Khi request trả về mã `401 Unauthorized`, Axios Response Interceptor sẽ tạm hoãn các request tiếp theo, tự động gọi `/auth/refresh`.
   - Nếu lấy được token mới thành công: tự động retry lại các request ban đầu một cách trong suốt (người dùng không bị văng ra ngoài).
   - Nếu refresh thất bại: phát tín hiệu đăng xuất và điều hướng về `/login`.
5. **Không truyền thông tin phân quyền từ Client:** Frontend không tự gửi `hotelId`, `actorId`, `role` trong body nhằm tránh tấn công phân quyền. Backend tự trích xuất thông tin này từ Access Token.

---

## 6. 🛡️ Ma Trận Phân Quyền (RBAC 6 Roles) Trên Giao Diện

| Vai trò (Role) | Tên hiển thị | Quyền hạn trên giao diện Frontend |
| :--- | :--- | :--- |
| `ADMIN` | Quản trị viên | Toàn quyền xem & thao tác tất cả các module (Phòng, Khách, Đặt phòng, Lưu trú, Buồng phòng, Bảo trì, Dịch vụ & Folio, Thu tiền; **Quản lý toàn bộ Nhân sự & Cấp tài khoản mọi cấp bậc**) |
| `MANAGER` | Quản lý KS | Toàn quyền vận hành (CRUD Loại phòng/Phòng, Khách hàng, Đặt phòng, Check-in/out, Nghiệm thu Buồng phòng, Khóa/Mở bảo trì, Dịch vụ & Folio; **Quản lý Nhân sự & Cấp tài khoản theo Role Hierarchy cho Lễ tân, Buồng phòng, Kế toán, Kỹ thuật**) |
| `RECEPTIONIST` | Lễ tân | CRUD Khách hàng, Đặt phòng, Check-in, Check-out, Đổi phòng; Tạo việc dọn buồng phòng, Báo cáo sự cố bảo trì; Mở Folio, Tạo & Hoàn thành Order dịch vụ, Thu tiền Payment/Deposit, In phiếu thu |
| `ACCOUNTANT` | Kế toán | Xem Phòng, xem Khách hàng ở chế độ tối thiểu; Tra cứu Folio & Orders, Thu tiền Payment/Deposit, Điều chỉnh Debit/Credit, Ghi nhận Refund hoàn tiền, Quyết toán đóng Folio, In phiếu thu |
| `HOUSEKEEPING` | Buồng phòng | Xem nhiệm vụ dọn phòng của mình, Bắt đầu dọn (CLEANING), Báo hoàn thành (INSPECTION); Báo sự cố hỏng hóc; Không truy cập Thu ngân |
| `TECHNICIAN` | Kỹ thuật | Xem phiếu sự cố được phân công, Bắt đầu sửa (IN_PROGRESS), Báo hoàn thành sửa chữa (RESOLVED); Không truy cập Thu ngân |

---

## 7. 🚀 Hướng Dẫn Chạy & Phát Triển Cục Bộ

### Yêu cầu môi trường:
- Node.js >= 20.x (khuyến nghị v24.x)
- npm >= 10.x

### Các lệnh cơ bản:
```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt thư viện (nếu mới clone)
npm install

# 3. Chạy môi trường phát triển (Local Dev Server)
npm run dev
# Mở trình duyệt tại: http://localhost:5173

# 4. Kiểm tra kiểu và đóng gói bản build
npm run build
```
