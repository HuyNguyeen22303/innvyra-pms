# Innvyra PMS — Authentication, RBAC & Room Management (Phases 1–2)

Backend Express 5 + TypeScript strict/ESM, Prisma 7.10 với MariaDB driver adapter cho **MySQL 8+**, JWT (`jose`), Argon2id, Zod, Swagger, Vitest và Supertest. Toàn bộ thay đổi nằm trong `backend/`; không có frontend hoặc đăng ký công khai. Phase 2 bổ sung quản lý loại phòng và phòng, chưa triển khai reservation/stay.

## Cấu trúc và trách nhiệm

```text
backend/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/migration_lock.toml
│   ├── migrations/20261013000000_auth_init/migration.sql
│   ├── migrations/20261014000000_room_management/migration.sql
│   └── seed.ts
├── src/
│   ├── config/{env,cors,swagger,rooms.openapi}.ts
│   ├── database/{prisma,room-transaction}.ts
│   ├── modules/auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.schema.ts
│   │   └── auth.types.ts
│   ├── modules/room-types/      # routes/controller/service/repository/schema/types
│   ├── modules/rooms/           # routes/controller/service/repository/schema/types
│   ├── middlewares/
│   │   ├── authenticate.middleware.ts
│   │   ├── authorize.middleware.ts
│   │   ├── csrf.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── shared/
│   │   ├── errors/app-error.ts
│   │   ├── types/{express.d.ts,roles.ts}
│   │   ├── utils/{cookies,password,tokens}.ts
│   │   └── validation/room-input.ts
│   ├── generated/prisma/          # sinh bởi Prisma, gitignored
│   ├── routes/index.ts
│   ├── app.ts
│   └── server.ts
├── scripts/{database-tools,inspect-database,migrate,create-admin}.ts
├── tests/{helpers,auth.http.test,security.unit.test,mysql.integration.test}.ts
├── tests/{room-helpers,rooms.http.test,rooms.unit.test,rooms.mysql.integration.test}.ts
├── postman/
│   ├── .postman/resources.yaml
│   └── postman/collections/Innvyra PMS — Authentication & RBAC/
│       ├── .resources/definition.yaml
│       └── *.request.yaml
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── eslint.config.js
├── nodemon.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
└── README.md
```

Luồng: Route → middleware → controller → service → repository → Prisma → MySQL. `createApp(env, authRepository, { roomTypes, rooms })` inject các repository để kiểm thử HTTP trong bộ nhớ; production luôn dùng các Prisma repository. Không có database singleton hoặc biến môi trường ngầm trong service.

## Cài đặt và cấu hình

Dùng Node.js LTS 22.13+ hoặc 24+; nên dùng bản vá mới nhất của nhánh LTS. Prisma CLI, client và adapter được khóa cùng phiên bản. Lockfile lưu các dependency thực tế.

`package.json` có overrides cho MariaDB, MySQL2, DeepmergeTS, Hono adapter và Valibot để thay các bản gián tiếp có advisory. Khi cập nhật Prisma, kiểm tra lại overrides cùng typecheck/build/test/audit. Lần tạo lockfile đã dùng npm 11.6.2 để tránh lỗi resolver `edgesOut` của npm 10; cài lại bằng `npm ci` đã được kiểm tra với npm 10.9.2.

```powershell
cd C:\Users\ACER\Desktop\innvyra-pms\backend
npm ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Lưu kết quả ngẫu nhiên vừa sinh vào `JWT_ACCESS_SECRET` trong `.env`. Không gửi/commit secret. Điền `DATABASE_URL` bằng tài khoản MySQL riêng, URL-encode ký tự đặc biệt trong username/password. Đổi port trong URL thành `3307` nếu cần. `.env` và generated/build artifacts đã được ignore.

`FRONTEND_URL` và từng mục trong `CORS_ORIGINS` là origin chính xác, không có dấu `/` cuối. Ví dụ `http://localhost:5173` và `http://localhost:3000` để thử Swagger trực tiếp. Nếu đổi PORT, sửa origin tương ứng. Production yêu cầu các origin HTTPS, `COOKIE_SECURE=true`. Với frontend/API khác site: `COOKIE_SAME_SITE=none` và HTTPS. Cấu hình sai làm tiến trình dừng khi khởi động.

`DATABASE_SSL=true` bật TLS có kiểm tra chứng chỉ cho runtime adapter; `DATABASE_SSL_CA_FILE` nhận đường dẫn CA PEM nếu CA không có trong trust store. URL ứng dụng không nhận query parameters để tránh âm thầm bỏ qua cấu hình. Prisma config cũng chuyển cấu hình TLS sang `sslaccept=strict` và `sslcert` cho migration CLI.

`TRUST_PROXY_HOPS=0` mặc định; chỉ chỉnh theo reverse proxy thực sự được kiểm soát. Bộ rate limiter hiện dùng bộ nhớ tiến trình: production nhiều replica cần shared store hoặc giới hạn ở gateway. Không cấu hình trust proxy `true` tùy tiện.

## Database mới và migration

Workspace ban đầu trống, không có schema/database credentials để kiểm tra dữ liệu đang tồn tại. Chỉ chuẩn bị schema và migration; không tự reset hoặc xóa dữ liệu.

Với **database mới**, quản trị viên MySQL tạo database UTF-8 và cấp quyền cho tài khoản ứng dụng/migration:

```sql
CREATE DATABASE IF NOT EXISTS innvyra_pms
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sau khi cấu hình `.env`:

```powershell
npm run db:inspect
npm run prisma:validate
npm run db:migrate
npm run db:seed
npm run prisma:generate
```

`db:inspect` chỉ đọc danh sách bảng và cấu trúc cột. `db:migrate` kiểm tra metadata trước khi gọi `prisma migrate deploy`; từ chối database có bảng nhưng chưa có `_prisma_migrations`. Không có lệnh reset hoặc tự tạo tài khoản mặc định.

Các bảng của module Authentication:

| Bảng             | Mục đích                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `hotels`         | Khách sạn, code unique                                                     |
| `roles`          | Sáu role code unique                                                       |
| `staff_users`    | Nhân viên, khóa ngoại hotel/role, username/email unique, mật khẩu Argon2id |
| `auth_sessions`  | UUID phiên, nhân viên, hạn tuyệt đối, thời điểm/lý do thu hồi              |
| `refresh_tokens` | SHA-256 token, phiên, hạn, thời điểm đã sử dụng                            |

ID nghiệp vụ dùng unsigned BIGINT, chuyển sang chuỗi thập phân trong JSON/JWT. Các khóa ngoại có index; bảng nghiệp vụ không cascade-delete nhân viên. Token có unique hash và index phiên/hạn. `auth_sessions` chính là token family. Các refresh token đã dùng phải được giữ ít nhất đến khi phiên hết hạn để nhận diện reuse. Chưa có tác vụ dọn dữ liệu định kỳ.

### Nếu database đã có dữ liệu

Không chạy migration khởi tạo này trực tiếp và không đánh dấu đã áp dụng khi các bảng chưa khớp. Thực hiện trên bản sao đã backup trước:

1. Chạy `npm run db:inspect`; đọc cấu trúc và lịch sử `_prisma_migrations` nếu có. Dùng `npx prisma db pull --print` để lấy schema hiện tại mà không ghi đè file.
2. Nếu đã có lịch sử migration: giữ nguyên lịch sử đó, tái sử dụng model/bảng hiện hữu và tạo migration bổ sung chỉ cho thay đổi Auth. Không thay thế bằng migration khởi tạo của repository này.
3. Nếu chưa có lịch sử: lưu schema phản ánh **đúng các bảng hiện hữu** vào một file tạm dưới `backend/.tmp/`; tạo migration baseline `0_existing` bằng `prisma migrate diff --from-empty --to-schema <schema-hien-huu> --script`. Review SQL trước khi lưu vào lịch sử migration. Baseline này chỉ phản ánh trạng thái đã tồn tại, không bao gồm bảng Auth còn thiếu.
4. Chỉ sau khi đối chiếu schema với database thật, chạy `npx prisma migrate resolve --applied 0_existing`. Lệnh này ghi nhận baseline, không chạy SQL tạo bảng.
5. Tích hợp các model hiện hữu với `schema.prisma`, giữ nguyên kiểu ID, cột, dữ liệu và mapping. Tạo migration tiếp theo bằng diff từ schema baseline sang schema đích; review khóa ngoại, unique constraints và dữ liệu trùng trước khi deploy.
6. Thay migration khởi tạo chưa áp dụng bằng lịch sử baseline + migration bổ sung phù hợp. Chỉ `migrate resolve --applied 20261013000000_auth_init` nếu **toàn bộ schema của migration đó đã tồn tại và khớp chính xác**; không dùng cách này khi chỉ có `hotels/roles/staff_users`.

Không dùng `migrate reset`, `db push --accept-data-loss` hay drop bảng để chữa lỗi. MySQL DDL không rollback nguyên khối; nếu migration lỗi giữa chừng, kiểm tra từng bước đã áp dụng và dùng quy trình repair có backup.

## Seed và tạo ADMIN đầu tiên

Seed upsert sáu roles theo code; không đổi role đang có, không tạo mật khẩu/tài khoản. Nếu database mới chưa có hotel, có thể chỉ định hotel một cách tường minh:

```powershell
$env:SEED_HOTEL_CODE = 'MAIN'
$env:SEED_HOTEL_NAME = 'Khach san cua ban'
npm run db:seed
Remove-Item Env:SEED_HOTEL_CODE, Env:SEED_HOTEL_NAME
```

Seed sẽ in ID khách sạn. Dùng ID đó trong CLI admin. Nhập mật khẩu bằng `Read-Host -AsSecureString`, không gõ mật khẩu trực tiếp vào lịch sử lệnh:

```powershell
$env:ADMIN_USERNAME = 'admin'
$env:ADMIN_FULL_NAME = 'System Administrator'
$env:ADMIN_HOTEL_ID = '1' # thay bằng hotel ID thực tế
# $env:ADMIN_EMAIL = 'admin@your-domain.example' # tùy chọn
$adminSecure = Read-Host 'Admin password (at least 15 characters)' -AsSecureString
$adminBuffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure)
try {
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminBuffer)
  npm run create:admin
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminBuffer)
  Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $adminSecure.Dispose()
}
Remove-Item Env:ADMIN_USERNAME, Env:ADMIN_FULL_NAME, Env:ADMIN_HOTEL_ID
```

CLI yêu cầu mật khẩu 15–128 ký tự đủ đa dạng, hotel có thật, role ADMIN đã seed; kiểm tra username/email trùng. Khóa role ADMIN trong transaction để tránh hai lần bootstrap đồng thời. Khi đã có bất kỳ nhân viên ADMIN nào, CLI từ chối tạo thêm. Không tự chạy khi start server. Tạo/quản lý nhân viên tiếp theo thuộc phase sau.

## Chạy backend

`npm run dev` dùng Nodemon theo dõi `src/` và `.env`, chạy TypeScript qua `tsx` và tự khởi động lại khi file thay đổi. Prisma generated client được bỏ qua để tránh restart liên tục trong lúc generate. Có thể nhập `rs` trong terminal để restart thủ công.

```powershell
npm run dev
# Hoặc:
npm run build
npm run start
```

Build sinh Prisma client TypeScript và biên dịch toàn bộ import `.js` tương thích Node ESM. Entry production là `dist/src/server.js`. Server kiểm tra environment và kết nối database trước khi listen; có xử lý SIGINT/SIGTERM.

- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON: http://localhost:3000/api-docs/openapi.json

## API và mô hình bảo mật

| Method | Endpoint                   | Điều kiện                            |
| ------ | -------------------------- | ------------------------------------ |
| POST   | `/api/v1/auth/login`       | Body username/password + CSRF header |
| POST   | `/api/v1/auth/refresh`     | Refresh cookie + CSRF header         |
| POST   | `/api/v1/auth/logout`      | Bearer token + CSRF header           |
| GET    | `/api/v1/auth/me`          | Bearer token                         |
| GET    | `/api/v1/auth/admin-check` | Bearer token, role hiện hành ADMIN   |

Mọi POST trên yêu cầu `X-CSRF-Protection: 1`. Trình duyệt gửi `credentials: 'include'`; Origin phải nằm trong allowlist. Header tùy chỉnh buộc cross-origin request qua preflight, kết hợp CORS allowlist và kiểm tra Origin phía server; không chỉ dựa vào SameSite. Postman/curl không cần Origin nhưng vẫn cần header. Cookie host-only, HttpOnly, Path `/api/v1/auth`, Secure production; cùng thuộc tính được dùng khi xóa cookie.

JWT HS256 kiểm tra thuật toán, chữ ký, issuer, audience, exp và các claim bắt buộc; payload chỉ có sub/sid và standard claims. Lifetime mặc định 15 phút. Mỗi request đọc session + staff + role hiện hành từ DB, nên khóa tài khoản, đổi role/hotel và logout có hiệu lực ở request tiếp theo. Role/hotel gửi từ client không được tin cậy.

Refresh token là 32 byte ngẫu nhiên; DB chỉ giữ SHA-256. Mỗi lần refresh khóa dòng session bằng `SELECT ... FOR UPDATE`, đọc lại token trong transaction ReadCommitted, đánh dấu token cũ đã dùng và tạo token mới. Reuse thu hồi cả phiên và **commit revocation trước khi trả 401**. Cả JWT cũ và JWT mới của phiên đó đều bị từ chối.

Thời hạn phiên mặc định 7 ngày tính từ login, không kéo dài khi refresh. Frontend phải dùng một refresh request đang chạy chung cho các request đồng thời (và phối hợp giữa các tab nếu cùng dùng cookie): hai refresh cùng token được coi là reuse và buộc đăng nhập lại. Không có grace period cho token cũ. Một phiên logout không ảnh hưởng các phiên khác.

Logout cần access token chưa hết hạn; refresh trước nếu access token đã hết hạn. Access token nên giữ trong bộ nhớ frontend; không lưu refresh token trong localStorage. Không có log request body/header/token/password. Error response không trả stack trace; lỗi bất ngờ chỉ ghi mã sự kiện đã làm sạch.

## Postman

Với **Postman 12 Local View**, chọn **Open Folder** và mở `C:\Users\ACER\Desktop\innvyra-pms\backend\postman` (thư mục chứa `.postman/resources.yaml`). Sau đó chọn biểu tượng **Items** hình khối hộp ở thanh bên trái, mở **Collections → Innvyra PMS — Authentication & RBAC**. Có đủ 5 request được lưu bằng YAML v3 dưới `postman/postman/collections/`.

Collection JSON v2.1 ban đầu đã được Postman chuyển sang YAML v3. Mở một file JSON trong **Local Files** không đồng nghĩa với việc đã đăng ký một collection. Nếu chỉ thấy cây file, chuyển sang **Items**; nếu Postman báo **Upgrade files**, dùng **Upgrade to v3** rồi bảo đảm collection nằm dưới thư mục local `postman/collections/`. Xem [định dạng collection Postman 3.0](https://learning.postman.com/docs/use/use-collections/collections-schemas/).

Collection chứa biến `baseUrl`, `username`, `password`, `accessToken`; chỉ điền password trong workspace Postman riêng, không export hoặc commit secret. Dùng nhất quán `localhost` hoặc `127.0.0.1` để cookie jar đúng host. Các request POST đã có header CSRF; Login và Refresh có script cập nhật accessToken.

1. **Login**: POST `{{baseUrl}}/auth/login`, JSON `{"username":"admin","password":"<mat-khau-da-tao>"}`, header `X-CSRF-Protection: 1`. Kỳ vọng 200; collection tự lưu accessToken, Postman giữ HttpOnly cookie. Body không có refresh token/password hash.
2. **Me**: GET `/auth/me`, Bearer `{{accessToken}}`. Kỳ vọng 200 với ID dạng chuỗi và role từ server.
3. **Admin check**: GET `/auth/admin-check`, cùng Bearer. ADMIN nhận 200, RECEPTIONIST nhận 403. Dùng tài khoản receptionist được provision trong database phát triển; không thêm endpoint public để tạo người dùng. Bộ test tự tạo fixture để kiểm chứng trường hợp này.
4. **Refresh**: POST `/auth/refresh`, header CSRF, không body. Cookie jar tự gửi token; 200 và cookie mới, collection cập nhật accessToken. Để thử reuse trong database test: lưu cookie cũ, refresh một lần, sau đó gửi lại cookie cũ bằng cookie jar riêng. Kỳ vọng 401 và cả access token vừa nhận cũng bị từ chối.
5. **Logout**: POST `/auth/logout`, Bearer + header CSRF. Kỳ vọng 200, cookie bị xóa. Gọi lại Me bằng accessToken cũ hoặc refresh bằng cookie cũ: 401.
6. Thử password sai/username không tồn tại/tài khoản khóa: cùng 401 `INVALID_CREDENTIALS`. Thiếu trường: 422; thiếu CSRF/Origin không hợp lệ: 403; login quá giới hạn: 429.

## Kiểm thử và kiểm tra chất lượng

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test
```

`auth.http.test.ts` chạy Express/Supertest, Argon2 thật, JWT thật và middleware thật với repository trong bộ nhớ. `security.unit.test.ts` kiểm tra environment, validation và deny-by-default. Các test này không kết nối database và không chứng minh hành vi khóa dòng MySQL.

`mysql.integration.test.ts` chỉ chạy khi có `TEST_DATABASE_URL`, `NODE_ENV=test` (Vitest tự đặt), host local và tên database kết thúc `_test`; không cho trùng tên với database ứng dụng. Không fallback sang `DATABASE_URL`. Suite dùng bảng đã migrate, tạo fixture có mã ngẫu nhiên và chỉ xóa fixture của nó; không reset/truncate database. Bốn test bao gồm persistence, refresh race/reuse, logout race và role/account thay đổi trong database.

Chuẩn bị database test riêng `innvyra_pms_test` và cấu hình URL bằng tài khoản giới hạn quyền:

```powershell
$env:TEST_DATABASE_URL = 'mysql://TEST_USER:TEST_PASSWORD@127.0.0.1:3306/innvyra_pms_test'
$previousDb = $env:DATABASE_URL
try {
  $env:DATABASE_URL = $env:TEST_DATABASE_URL
  npm run db:migrate
} finally {
  if ($null -eq $previousDb) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
  else { $env:DATABASE_URL = $previousDb }
}
npm run test
```

Không dùng production database hoặc production credentials cho test. Khi thiếu `TEST_DATABASE_URL`, bốn MySQL test báo skipped, không được coi là passed.

## Kết quả lịch sử của Phase 1

Kết quả đã chạy ngày 13/10/2026 với Node 22.13.0:

| Kiểm tra                                 | Kết quả                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm ci` (npm 10.9.2)                    | Thành công từ lockfile                                                                                      |
| Typecheck, ESLint, build, Prettier check | Đạt                                                                                                         |
| Prisma schema validate                   | Đạt; migration SQL đã sinh từ schema                                                                        |
| Vitest/Supertest                         | 37 passed, 4 MySQL tests skipped                                                                            |
| `npm audit` toàn bộ dependencies         | 0 vulnerabilities được báo                                                                                  |
| Smoke test bản build                     | ESM import, Prisma adapter, Swagger HTTP và HTTP 401 đạt; server thoát an toàn khi MySQL không kết nối được |
| Migration/seed/admin trên MySQL thật     | Chưa chạy vì thiếu kết nối/configuration                                                                    |

Tại thời điểm bàn giao Phase 1 chưa có kết nối MySQL để kiểm chứng. Kết quả kiểm thử MySQL mới nhất của Phase 2 được ghi bên dưới, bao gồm cả bốn regression tests MySQL của Authentication.

Tham chiếu cấu hình chính thức: [Prisma 7 upgrade/config/adapter](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [ESM client generator](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators).

## Room Management — Phase 2

Migration bổ sung `20261014000000_room_management` chỉ tạo `room_types`, `rooms`, indexes và foreign keys. Không thay cột/bảng Auth, không drop/reset. Kiểm tra database local ngày 14/10/2026 xác nhận trước Phase 2 chỉ có năm bảng Auth và `_prisma_migrations`; chưa có reservation/stay/history.

| Bảng         | Cột và ràng buộc mới                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room_types` | `id`, `hotel_id`, `code`, `name`, `description`, `max_adults`, `max_children`, `base_price DECIMAL(14,2)`, `is_active`, `created_at`, `updated_at`; unique `(hotel_id,code)` và `(hotel_id,id)` |
| `rooms`      | `id`, `hotel_id`, `room_type_id`, `room_number`, `floor_number`, `physical_status`, `housekeeping_status`, `notes`, `is_active`, `created_at`, `updated_at`; unique `(hotel_id,room_number)`    |

Cả hai bảng có FK tới `hotels` với `ON DELETE RESTRICT`. FK ghép `rooms(hotel_id,room_type_id) → room_types(hotel_id,id)` ngăn tham chiếu loại phòng khác hotel cả khi ghi trực tiếp vào DB. Index bắt đầu bằng `hotel_id` phục vụ lọc loại phòng, tầng, trạng thái, active, tên, giá và ngày tạo. MySQL collation `utf8mb4_unicode_ci` khiến uniqueness không phân biệt hoa/thường và dấu. `code` được trim/uppercase ở API. Mã/số của bản ghi inactive vẫn được giữ và không thể dùng lại.

ID được trả bằng chuỗi; giá đầu vào phải là chuỗi thập phân không âm, tối đa `999999999999.99`, không dùng số JSON/exponent hay quá hai chữ số thập phân. Giá được lưu bằng Prisma Decimal và trả đúng hai chữ số thập phân. `maxAdults` trong `1..65535`, `maxChildren` trong `0..65535`; `floorNumber` là integer `-32768..32767` (cho phép tầng hầm). `description`/`notes` có thể null và tối đa 10000 ký tự; body JSON tối đa 16 KB theo cấu hình sẵn có. `hotelId`, `isAvailable` và các trường không được hỗ trợ bị từ chối với 422.

`physicalStatus`: `ACTIVE`, `OUT_OF_SERVICE`, `MAINTENANCE` (mặc định ACTIVE). `housekeepingStatus`: `DIRTY`, `CLEANING`, `INSPECTION`, `READY` (mặc định DIRTY). `isActive` biểu thị còn sử dụng trong cấu hình; cả ba trường độc lập. ACTIVE/READY không có nghĩa phòng trống. Không có cột `is_available` hoặc thuật toán availability.

| Method | Room Types               | Rooms               | Hành vi                                                                |
| ------ | ------------------------ | ------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/v1/room-types`     | `/api/v1/rooms`     | Danh sách có phân trang                                                |
| GET    | `/api/v1/room-types/:id` | `/api/v1/rooms/:id` | Chi tiết trong hotel hiện hành                                         |
| POST   | `/api/v1/room-types`     | `/api/v1/rooms`     | Tạo, HTTP 201                                                          |
| PATCH  | `/api/v1/room-types/:id` | `/api/v1/rooms/:id` | Partial update, tối thiểu một field                                    |
| DELETE | `/api/v1/room-types/:id` | `/api/v1/rooms/:id` | Vô hiệu hóa, HTTP 200, trả bản ghi `isActive:false`; không hard delete |

Mọi endpoint yêu cầu Bearer Access Token qua Auth/session hiện có. ADMIN và MANAGER được đọc/ghi; RECEPTIONIST, HOUSEKEEPING, ACCOUNTANT, TECHNICIAN chỉ đọc. HOUSEKEEPING chưa được sửa housekeeping status. ADMIN cũng chỉ truy cập hotel hiện hành. Thiếu/sai token hoặc session bị thu hồi: 401; thiếu quyền: 403; ID không có/thuộc hotel khác: cùng 404. POST/PATCH/DELETE yêu cầu `X-CSRF-Protection: 1`, browser Origin phải nằm trong allowlist. CORS đã hỗ trợ PATCH và DELETE.

Query chung: `page` mặc định 1 (tối đa 1000000), `limit` mặc định 20 (tối đa 100), `search`, `isActive=true|false`, `sortOrder=asc|desc`. Query không hỗ trợ, boolean sai, query lặp và sort ngoài whitelist trả 422. Omit `isActive` sẽ lấy cả active/inactive. Không nhận hotel từ query.

- Room Types: search code/name; `sortBy=name|basePrice|createdAt`, mặc định name.
- Rooms: search roomNumber; filter `roomTypeId`, `floorNumber`, `physicalStatus`, `housekeepingStatus`; `sortBy=roomNumber|floorNumber|createdAt`, mặc định roomNumber (sắp xếp chuỗi, không phải số). Include loại phòng với id/code/name/isActive.
- Cùng giá trị sort được phân thứ tự bằng ID tăng dần. List/count chạy trong cùng transaction RepeatableRead, trả snapshot nhất quán.

Response giữ convention `success/message/data`; list trả `data.items` và `data.pagination`:

```json
{
  "success": true,
  "message": "Rooms retrieved",
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  }
}
```

Các lỗi nghiệp vụ chính: 409 `ROOM_TYPE_CODE_EXISTS`, `ROOM_NUMBER_EXISTS`, `ROOM_TYPE_INACTIVE`, `ROOM_TYPE_IN_USE`, `ROOM_REFERENCE_CONFLICT`, `CONCURRENT_MODIFICATION`; 404 `ROOM_TYPE_NOT_FOUND`, `ROOM_NOT_FOUND`; 422 `VALIDATION_ERROR` kèm `error.details` (path/message). Không trả Prisma message, SQL hoặc database metadata.

### Vô hiệu hóa và tính nguyên tử

DELETE và PATCH `isActive:false` sử dụng cùng service. Loại phòng còn phòng active bị từ chối 409; trước tiên phải vô hiệu hóa hoặc chuyển các phòng sang loại active khác cùng hotel. Phòng/loại phòng inactive vẫn xem được và được giữ nguyên references; gọi DELETE lại thành công. Tạo phòng hoặc đổi loại phòng chỉ được chọn loại active trong cùng hotel. Kích hoạt lại phòng cũng kiểm tra loại phòng còn active. Giá cấu hình thay đổi không ghi vào dữ liệu lưu trú/đặt phòng.

Mọi thao tác ghi room/type khóa dòng hotel bằng parameterized `SELECT ... FOR UPDATE` trong transaction ReadCommitted, rồi kiểm tra và ghi trong transaction đó. Thứ tự khóa chung ngăn race tạo/kích hoạt lại phòng với việc vô hiệu hóa loại phòng; unique constraints vẫn là lớp bảo vệ cuối cùng. Đây là khóa ở mức hotel, phù hợp số lượng thao tác quản trị hiện tại; cần đo tải nếu triển khai nhiều thao tác ghi đồng thời.

**Giới hạn tích hợp Reservation:** hiện chưa có bảng reservation/stay/room-block, nên module không xác định có khách hoặc booking tương lai. Chưa có thuật toán giả hoặc dữ liệu occupancy. Trước khi triển khai Reservation, phải bổ sung kiểm tra booking/stay trong transaction cho đổi loại phòng, vô hiệu hóa và thay trạng thái vận hành có ảnh hưởng; luồng reservation cũng phải tuân theo cùng cơ chế khóa. API hiện luôn giữ bản ghi và không xóa lịch sử. Capacity/price/status validation thuộc API; các quy tắc service như loại phòng active không thay thế được bằng FK, nên không ghi trực tiếp bỏ qua service.

### Migration và thử trên Swagger/Postman

Migration đã được chạy thử trên MySQL **8.0.41**, database riêng `innvyra_pms_rooms_phase2_test`; Prisma diff xác nhận không có khác biệt giữa DB đã migrate và schema. Database ứng dụng `innvyra_pms` chưa được áp dụng migration Phase 2 trong lần bàn giao này.

Sau khi review SQL, từ `backend/` với `.env` trỏ đến database phát triển cần cập nhật:

```powershell
npm run db:inspect
npm run prisma:validate
npm run db:migrate
npm run prisma:generate
npm run dev
```

Không dùng `migrate reset` hoặc `db push --accept-data-loss`. Giữ migration Auth cũ nguyên vẹn.

1. Mở `/api-docs` trên host/port backend, ví dụ `http://localhost:3000/api-docs`; OpenAPI JSON tại `/api-docs/openapi.json`. Đăng nhập qua `POST /api/v1/auth/login` với username/password đã provision và header CSRF.
2. Copy `data.accessToken`, chọn **Authorize → bearerAuth**, nhập token (không thêm chữ Bearer trong ô Swagger). Trong Postman chọn Bearer Token. Có thể import trực tiếp OpenAPI JSON để tạo đủ 15 operations của Auth + Rooms.
3. `POST /api/v1/room-types`, body `{"code":"DLX","name":"Deluxe","maxAdults":2,"maxChildren":1,"basePrice":"900000.00"}`; thêm `X-CSRF-Protection: 1`. Lưu `data.id` thực tế.
4. `POST /api/v1/rooms`, body `{"roomNumber":"301","floorNumber":3,"roomTypeId":"<ID-vua-tao>","physicalStatus":"ACTIVE","housekeepingStatus":"READY"}`; dùng cùng Bearer và CSRF.
5. Thử GET `/api/v1/rooms?floorNumber=3&housekeepingStatus=READY&page=1&limit=20`, PATCH notes/status, DELETE room trước rồi DELETE type. Các bản ghi vẫn đọc được với `isActive:false`.
6. Thử trùng code/roomNumber (409), hotelId trong body (422), token sai (401), tài khoản receptionist ghi (403), ID hotel khác (404). Không dùng ID mẫu nếu chưa tạo dữ liệu tương ứng.

### Kiểm chứng và tệp Phase 2

Test gồm HTTP với JWT/middleware/service thật và repository trong bộ nhớ; unit tests cho biên BIGINT/Decimal và ánh xạ lỗi transaction; MySQL tests cho dữ liệu thật, unique/FK ghép, rollback, phân trang/lọc, cách ly hotel và race tạo/kích hoạt phòng với vô hiệu hóa loại phòng. Auth regression được chạy cùng bộ test.

Để chạy lại MySQL tests, dùng `TEST_DATABASE_URL` trỏ tới database local riêng có hậu tố `_test` như hướng dẫn kiểm thử phía trên. Không fallback sang `DATABASE_URL`; khi thiếu biến test, 14 MySQL tests bị skipped. Fixture dùng hotel/username ngẫu nhiên và cleanup chỉ dữ liệu do suite tạo, không reset/truncate/drop bảng. Role ADMIN/RECEPTIONIST được upsert và giữ lại trong database test. Database test trong lần kiểm chứng được giữ để có thể chạy lại.

Tệp mới:

- `prisma/migrations/20261014000000_room_management/migration.sql`.
- `src/modules/room-types/room-type.{routes,controller,service,repository,schema,types}.ts` (6 tệp).
- `src/modules/rooms/room.{routes,controller,service,repository,schema,types}.ts` (6 tệp).
- `src/config/rooms.openapi.ts`, `src/database/room-transaction.ts`, `src/shared/validation/room-input.ts`.
- `tests/room-helpers.ts`, `tests/rooms.http.test.ts`, `tests/rooms.unit.test.ts`, `tests/rooms.mysql.integration.test.ts`.

Tệp sửa: `prisma/schema.prisma`, `src/app.ts`, `src/server.ts`, `src/routes/index.ts`, `src/config/cors.ts`, `src/config/swagger.ts`, `tests/auth.http.test.ts`, `tests/mysql.integration.test.ts`, `README.md`. Auth source, dependencies và lockfile không thay đổi. Các test Auth chỉ cập nhật dependency injection và assertion danh sách tài liệu/module theo Phase 2; vẫn giữ kiểm tra bảo mật cũ.

Kết quả thực chạy ngày **14/10/2026**, Node **22.13.0**, MySQL **8.0.41**:

| Kiểm tra                                               | Kết quả                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Prisma validate / generate                             | Đạt                                                                                                                     |
| Migration trên database test riêng                     | Cả migration Auth và Rooms áp dụng thành công; chạy lại không có pending migration                                      |
| Prisma diff: database test → schema                    | Không có khác biệt                                                                                                      |
| `npm run typecheck` / `npm run lint` / `npm run build` | Đạt                                                                                                                     |
| Vitest toàn bộ với `TEST_DATABASE_URL`                 | **110 passed, 0 skipped**, 6 suites; gồm 37 Auth/security cũ, 52 Room HTTP, 7 Room unit và 14 MySQL (4 Auth + 10 Rooms) |
| Smoke bản build ESM                                    | Swagger UI và JSON HTTP 200, đủ 15 operations; Rooms/Room Types/Auth me không token trả 401                             |
| Prettier cho toàn bộ tệp Phase 2 đã tạo/sửa            | Đạt                                                                                                                     |
| `npm run format:check` toàn dự án                      | Chưa đạt do 7 tệp không sửa trong Phase 2: `package.json` và 6 YAML collection/request Postman Auth                     |

Migration trên database ứng dụng và kiểm thử tải production chưa thực hiện. Không commit, push hoặc merge; nhánh làm việc là `feature/be-rooms`. Helper kiểm chứng tạm nằm trong `.tmp/` (gitignored), không chứa credentials; không thay `.env`.
