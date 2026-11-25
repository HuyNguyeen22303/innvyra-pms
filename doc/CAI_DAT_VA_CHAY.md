# Cài đặt và chạy Innvyra PMS

Tài liệu dùng chung cho cách cài đặt, cấu hình, chạy bản phát triển, đóng gói và kiểm thử.

- [Chuẩn bị và chạy backend](#backend).
- [Chuẩn bị và chạy frontend](#frontend).
- [Database local và dữ liệu demo](DATABASE_MULTI_HOTEL_LOCAL.md).

## Backend

API Express và TypeScript cho PMS khách sạn và quản trị Platform. Prisma dùng MySQL để lưu dữ liệu khách sạn, đặt phòng, lưu trú, thu ngân, buồng phòng, bảo trì, kho và báo cáo.

### Chuẩn bị

- Node.js theo `engines` trong [package.json](../backend/package.json). Dùng Node 22.13 trở lên trong nhánh 22, hoặc Node 24 trở lên.
- MySQL 8.0.16 trở lên. Dùng tài khoản có quyền phù hợp trên schema đã chọn.

Chạy các lệnh PowerShell sau từ thư mục gốc của repo.

```powershell
cd backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Các biến chính được liệt kê bên dưới. Xem toàn bộ tùy chọn trong [`.env.example`](../backend/.env.example) và [bộ kiểm tra biến môi trường](../backend/src/config/env.ts).

| Biến | Dùng để |
| --- | --- |
| `DATABASE_URL` | Kết nối MySQL đến đúng schema. Mã hóa URL các ký tự đặc biệt trong tên đăng nhập và mật khẩu. |
| `JWT_ACCESS_SECRET` | Khóa JWT riêng của môi trường. Có thể sinh bằng `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. |
| `GUEST_ENCRYPTION_KEY`, `GUEST_HASH_KEY` | Hai khóa hex 32 byte độc lập cho tính năng giấy tờ khách. Sinh mỗi khóa bằng một lần chạy `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. |
| `FRONTEND_URL`, `CORS_ORIGINS` | Origin chính xác của frontend. Local thường là `http://localhost:5173`. Thêm `http://localhost:3000` vào danh sách CORS nếu thử Swagger ngay trên API. |
| `PORT` | Cổng API, mặc định `3000`. |

### Chuẩn bị database

#### Chạy bộ demo đa khách sạn

Chạy các lệnh sau khi `DATABASE_URL` đã trỏ về máy MySQL local.

```powershell
npm run prisma:generate
npm run db:seed:multi -- --database innvyra_demo --activate
npm run db:check:multi
```

Seed tạo schema mới, áp dụng migration, tạo dữ liệu mẫu và đối chiếu kết quả. `--activate` cập nhật `DATABASE_URL` trong `.env` sau khi kiểm chứng thành công. Chọn tên schema chưa tồn tại. Xem cách lấy tài khoản mẫu và cập nhật dữ liệu seed cũ trong [hướng dẫn database local](DATABASE_MULTI_HOTEL_LOCAL.md).

#### Dùng schema đã chuẩn bị

Tạo schema rỗng trong MySQL hoặc chọn schema đã có lịch sử Prisma của dự án. Kiểm tra `DATABASE_URL` trước khi chạy nhóm lệnh này.

```powershell
npm run prisma:validate
npm run prisma:generate
npm run db:inspect
npm run db:migrate
```

`prisma:generate` phải chạy trước các script import Prisma Client trong bản clone mới. `db:inspect` chỉ đọc metadata. `db:migrate` áp dụng migration lên schema đang cấu hình và dừng nếu có bảng nhưng thiếu lịch sử Prisma.

#### Baseline cho schema đã có bảng

1. Sao lưu và làm việc trên bản sao. Chạy `npm run db:inspect`, kiểm tra `_prisma_migrations` và dùng `npx prisma db pull --print` để lấy schema hiện hữu.
2. Nếu toàn bộ bảng và ràng buộc khớp chính xác với một tập migration đã tồn tại, đối chiếu từng migration trước khi ghi nhận các migration đó bằng `npx prisma migrate resolve --applied <tên-migration>`.
3. Với schema cũ có cấu trúc riêng, lưu schema đã đối chiếu vào tệp tạm. Dùng `npx prisma migrate diff --from-empty --to-schema <tệp-schema> --script` để tạo SQL baseline phản ánh đúng cấu trúc hiện hữu. Chuẩn bị lịch sử migration cho đường nâng cấp đó và kiểm tra bước chuyển từ baseline đến schema đích trên bản sao.
4. Khi baseline đã được kiểm tra và đặt đúng trong lịch sử nâng cấp, ghi nhận tên migration baseline bằng `prisma migrate resolve --applied`, rồi chạy thử các migration tiếp theo trên bản sao. `resolve` chỉ ghi lịch sử và không thực thi SQL của migration được đánh dấu.

Sử dụng lịch sử migration phù hợp với schema đã kiểm tra. Khi `db:migrate` dừng do thiếu lịch sử, xác định và xác minh baseline thay vì reset schema hoặc đánh dấu cả migration khi mới có một phần bảng.

#### Cấp tài khoản quản trị

Demo đã tạo tài khoản quản trị. Với schema tự chuẩn bị, chọn CLI theo khu vực cần cấp tài khoản và đặt các biến trong terminal.

| Lệnh | Biến đầu vào | Tiền điều kiện |
| --- | --- | --- |
| `npm run create:platform-admin` | `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_FULL_NAME`, `PLATFORM_ADMIN_PASSWORD` | Schema đã migrate và chưa có quản trị Platform. Có thể dùng tài khoản này để tiếp nhận khách sạn và cấp ADMIN qua giao diện Platform. |
| `npm run create:admin` | `ADMIN_USERNAME`, `ADMIN_FULL_NAME`, `ADMIN_HOTEL_ID`, `ADMIN_PASSWORD` và `ADMIN_EMAIL` nếu có | Khách sạn và role `ADMIN` đã tồn tại, còn hạn mức tài khoản và chưa có ADMIN của khách sạn đó. |

Để cấp quản trị Platform, đặt email, tên và nhập mật khẩu trực tiếp trong terminal.

```powershell
$env:PLATFORM_ADMIN_EMAIL = 'admin@example.test'
$env:PLATFORM_ADMIN_FULL_NAME = 'Innvyra Admin'
$env:PLATFORM_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Mật khẩu quản trị' -AsSecureString)).Password
try { npm run create:platform-admin }
finally { Remove-Item Env:PLATFORM_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
```

### Chạy API

```powershell
npm run dev
```

Nodemon theo dõi `src/` và `.env`. API local dùng `http://localhost:3000/api/v1`. Mở [Swagger UI](http://localhost:3000/api-docs) hoặc import [OpenAPI JSON](http://localhost:3000/api-docs/openapi.json) vào Postman.

Để chạy bản đã biên dịch, dùng `npm run build` rồi `npm run start` tại `backend`. Build sinh Prisma Client và biên dịch entry `dist/src/server.js`. Khi chạy với `NODE_ENV=production`, đặt các origin HTTPS, bật cookie an toàn và chọn `COOKIE_SAME_SITE` theo cách frontend và API được phục vụ. Áp dụng migration qua bước riêng trước khi chạy bản build.

API khách sạn lấy hotel và quyền từ phiên xác thực. Route Platform có phiên đăng nhập riêng. Khi thử API bằng Swagger/Postman, dùng Bearer token đúng khu vực và header `X-CSRF-Protection: 1` cho các thao tác ghi yêu cầu CSRF. Tra endpoint, quyền và dữ liệu trả về trong OpenAPI của bản đang chạy.

### Kiểm thử backend

```powershell
npm run typecheck
npm run lint
npm test
```

`npm test` chạy Vitest. Các suite cần MySQL sẽ được bỏ qua nếu thiếu database test được cấu hình.

Để chạy cả suite MySQL, dùng `npm run prisma:generate` và `npm run test:mysql`. `TEST_DATABASE_URL` phải trỏ tới MySQL loopback, schema kết thúc bằng `_test` và khác schema ứng dụng. Khi thiếu biến này, runner dùng tham số kết nối local từ `DATABASE_URL` với schema `innvyra_pms_operations_phase7_test`.

Runner từ chối chế độ production. Nó chuẩn bị schema test, áp dụng migration vào đó và đối chiếu với Prisma trước khi chạy test.

## Frontend

Giao diện PMS khách sạn và quản trị Platform. Dự án dùng React, TypeScript, Vite, Ant Design, TanStack Query, Axios và Recharts. Phiên bản phụ thuộc nằm trong [package.json](../frontend/package.json) và lockfile.

### Chạy frontend

Dùng cùng phiên bản Node.js được yêu cầu ở [backend](#backend). Chạy API và chuẩn bị database trước khi đăng nhập. Bắt đầu cài frontend từ thư mục gốc của repo.

```powershell
cd frontend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Trong `.env`, đặt địa chỉ API có hậu tố `/api/v1`. Ví dụ dưới đây dùng cổng backend local mặc định.

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

```powershell
npm run dev
```

Vite dùng cổng `5173` mặc định. Nếu terminal chọn cổng khác, cập nhật origin được backend cho phép. Dùng nhất quán `localhost` hoặc `127.0.0.1` khi cấu hình frontend và API để luồng cookie khớp môi trường.

| Khu vực | Đường dẫn | Đăng nhập |
| --- | --- | --- |
| PMS khách sạn | `/login` | Username và mật khẩu của nhân viên khách sạn. |
| Quản trị Platform | `/platform/login` | Email và mật khẩu của quản trị Innvyra. |

Lấy tài khoản demo từ [hướng dẫn database local](DATABASE_MULTI_HOTEL_LOCAL.md). Tài khoản nhân viên được cấp hoặc đặt lại mật khẩu tạm sẽ đi qua màn hình đổi mật khẩu trước khi vào nghiệp vụ.

### Cấu trúc

- [`src/routes/`](../frontend/src/routes/) khai báo route và quyền trên giao diện. [`src/auth/`](../frontend/src/auth/) xử lý phiên, cache theo phiên và điều kiện truy cập. Backend xác thực quyền và phạm vi khách sạn cho từng request.
- [`src/api/`](../frontend/src/api/) chứa API client và luồng gửi request, bao gồm cookie refresh. [`src/pages/`](../frontend/src/pages/) chứa các màn hình nghiệp vụ.
- [`src/layouts/`](../frontend/src/layouts/) và [`src/components/responsive/`](../frontend/src/components/responsive/) chứa khung giao diện, điều hướng, bảng, bộ lọc và chọn ngày. [`src/components/charts/`](../frontend/src/components/charts/) chứa biểu đồ báo cáo.

### Kiểm thử frontend

```powershell
npm test
npm run lint
npm run build
npm run preview
```

`build` chạy TypeScript, làm sạch thư mục đầu ra và tạo website tĩnh mới trong `dist/`. `preview` phục vụ bản build để kiểm tra local. Khi đóng gói cho môi trường khác, đặt `VITE_API_URL` trước lúc build và lấy toàn bộ asset từ lần build đó. Nếu dùng đường dẫn tương đối `/api/v1`, cấu hình máy phục vụ để chuyển đường dẫn đó tới API. Phục vụ `index.html` khi người dùng mở trực tiếp route giao diện như `/reports`.

Chạy các kiểm tra sau trên màn hình bị ảnh hưởng.

- Thử các mốc `320`, `768`, `1199`, `1200` và `1440` px, gồm nút điều hướng, bộ lọc, cửa sổ thao tác và nhãn dài. Thanh bên cố định từ `1200` px, dưới mốc đó dùng menu trượt.
- Kiểm tra thao tác chuột, bàn phím và chạm. Bảng có nhiều cột cuộn trong vùng của bảng. Kiểm tra Console và request lỗi trong các luồng bị ảnh hưởng.
- Với Báo cáo, thử nhóm **Theo ngày / Theo tháng** và đổi bộ lọc. Đối chiếu doanh thu âm, công suất `0%`, khoảng trống khi chưa đủ dữ liệu và tỷ lệ nguồn đặt với bảng chi tiết. Các biểu đồ đường tự giảm số nhãn ngày theo bề rộng.
