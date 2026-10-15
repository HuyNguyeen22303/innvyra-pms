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
│   │   └── auth.api.ts     # Các hàm gọi API xác thực (/auth/login, /auth/me,...)
│   ├── components/         # Reusable UI components
│   │   ├── ProtectedRoute.tsx # Hộ tống Route theo trạng thái đăng nhập & role
│   │   └── RoleBadge.tsx   # Tag màu hiển thị vai trò người dùng
│   ├── layouts/            # Khung giao diện chính
│   │   └── MainLayout.tsx  # Layout chuẩn: Sider thu gọn, Header có avatar, role menu
│   ├── pages/              # Màn hình chức năng
│   │   ├── auth/           # Màn hình Đăng nhập
│   │   ├── dashboard/      # Màn hình Tổng quan vận hành
│   │   └── common/         # Màn hình 403, 404, Placeholder thông báo phase
│   ├── routes/             # Cấu hình định tuyến
│   │   └── AppRoutes.tsx   # Khai báo tập trung toàn bộ route của ứng dụng
│   ├── store/              # State management toàn cục
│   │   └── authStore.ts    # Zustand store lưu phiên đăng nhập & thông tin User
│   ├── theme/              # Tùy biến giao diện Ant Design
│   │   └── themeConfig.ts  # Bộ màu Hospitality Navy/Teal (#0f4c81)
│   ├── types/              # Định nghĩa kiểu dữ liệu TypeScript
│   │   ├── api.types.ts    # Chuẩn ApiResponse, ApiError, PaginatedResult
│   │   └── auth.types.ts   # Role, CurrentUser, LoginCredentials
│   ├── App.tsx             # Root component bọc ConfigProvider, QueryClient, Router
│   ├── index.css           # Global reset styling
│   └── main.tsx            # Entry point ReactDOM
├── package.json            # Khai báo dependencies & scripts
├── tsconfig.app.json       # Cấu hình TypeScript cho App
├── vite.config.ts          # Cấu hình Vite server & alias (@/*)
└── README.md               # Tài liệu này
```

---

## 4. 🗺️ Kế Hoạch Triển Khai 7 Phases & Git Branching

Dự án áp dụng mô hình **Git Flow chuẩn** kết hợp với bạn làm Backend. Cả hai dùng chung nhánh trung tâm `develop`. Mỗi Phase ở Frontend là một nhánh `feature/fe-...` độc lập:

```text
develop (origin/develop)
  │
  ├── feature/fe-foundation            [Phase 1] ✅ Khởi tạo dự án, Axios, Router, Layout
  ├── feature/fe-auth                  [Phase 2] 🚀 Login, Auth Store, Phân quyền RBAC
  ├── feature/fe-rooms                 [Phase 3] 📦 CRUD Loại phòng & Phòng vật lý
  ├── feature/fe-guests                [Phase 4] 👥 Quản lý Khách hàng & Mã hóa hồ sơ
  ├── feature/fe-reservations          [Phase 5] 📅 Đặt phòng & Tra cứu phòng trống
  ├── feature/fe-stays                 [Phase 6] 🛎️ Check-in, Check-out & Đổi phòng
  └── feature/fe-dashboard-and-mock    [Phase 7] 📊 Lịch phòng trực quan & Module đồ án
```

### Chi tiết các Phase:

| Phase | Nhánh | Mục tiêu & Chức năng | Trạng thái API |
| :---: | :--- | :--- | :---: |
| **Phase 1** | `feature/fe-foundation` | Dựng khung Vite + React + TS + Ant Design + Axios + Layout | ✅ Hoàn thành |
| **Phase 2** | `feature/fe-auth` | Màn hình Login, xử lý JWT, tự động refresh token, phân quyền Menu theo 6 Roles | ✅ API Có sẵn |
| **Phase 3** | `feature/fe-rooms` | Quản lý Loại phòng (Standard, Superior, Deluxe, Suite) & Phòng vật lý theo tầng | ✅ API Có sẵn |
| **Phase 4** | `feature/fe-guests` | Danh sách khách hàng, xem chi tiết CCCD/Passport, phân quyền Kế toán tối thiểu | ✅ API Có sẵn |
| **Phase 5** | `feature/fe-reservations` | Tra cứu phòng trống theo khoảng ngày (`/rooms/availability`), tạo đơn & hủy đặt | ✅ API Có sẵn |
| **Phase 6** | `feature/fe-stays` | Check-in gán phòng READY, danh sách lưu trú, check-out và đổi phòng giữa kỳ | ✅ API Có sẵn |
| **Phase 7** | `feature/fe-dashboard-and-mock` | Dashboard KPI, Lịch phòng dạng lưới (Room Calendar Matrix), Folio/Báo cáo | 🟡 Mock Data cho Đồ án |

---

## 5. 🔐 Chuẩn Giao Tiếp Backend & Quy Tắc Bảo Mật

Tất cả các API call từ Frontend tuân thủ nghiêm ngặt theo tài liệu `backend/FRONTEND_PERMISSIONS.md`:

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
| `ADMIN` | Quản trị viên | Toàn quyền xem & thao tác tất cả các module |
| `MANAGER` | Quản lý KS | Toàn quyền vận hành (loại phòng, phòng, khách hàng, đặt phòng, lưu trú) |
| `RECEPTIONIST` | Lễ tân | CRUD Khách hàng, Đặt phòng, Check-in, Check-out, Đổi phòng; Xem phòng |
| `ACCOUNTANT` | Kế toán | Xem Phòng, xem Khách hàng ở chế độ **tối thiểu** (chỉ hiển thị `id` & `fullName`) |
| `HOUSEKEEPING` | Buồng phòng | Chỉ xem danh sách Phòng & Loại phòng để phục vụ công tác vệ sinh |
| `TECHNICIAN` | Kỹ thuật | Chỉ xem danh sách Phòng & Loại phòng để phục vụ sửa chữa bảo trì |

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
