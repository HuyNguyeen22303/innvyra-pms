# Innvyra PMS — Authentication & RBAC (Phase 1)

Backend Express 5 + TypeScript strict/ESM, Prisma 7.10 với MariaDB driver adapter cho **MySQL 8+**, JWT (`jose`), Argon2id, Zod, Swagger, Vitest và Supertest. Toàn bộ thay đổi nằm trong `backend/`; không có frontend, đăng ký công khai hoặc module nghiệp vụ khác.

## Cấu trúc và trách nhiệm

```text
backend/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/migration_lock.toml
│   ├── migrations/20261013000000_auth_init/migration.sql
│   └── seed.ts
├── src/
│   ├── config/{env,cors,swagger}.ts
│   ├── database/prisma.ts
│   ├── modules/auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.schema.ts
│   │   └── auth.types.ts
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
│   │   └── utils/{cookies,password,tokens}.ts
│   ├── generated/prisma/          # sinh bởi Prisma, gitignored
│   ├── routes/index.ts
│   ├── app.ts
│   └── server.ts
├── scripts/{database-tools,inspect-database,migrate,create-admin}.ts
├── tests/{helpers,auth.http.test,security.unit.test,mysql.integration.test}.ts
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

Luồng: Route → middleware → controller → service → repository → Prisma → MySQL. `createApp(env, repository)` hỗ trợ kiểm thử HTTP bằng repository trong bộ nhớ; production luôn dùng `PrismaAuthRepository`. Không có database singleton hoặc biến môi trường ngầm trong service.

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

Các bảng duy nhất trong module:

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

## Giới hạn của lần triển khai tại workspace

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

Chưa có `DATABASE_URL`/MySQL truy cập được và Docker engine chưa chạy. Vì vậy migration, seed, bootstrap admin và các transaction MySQL chưa được xác nhận trên database thật. Không có dữ liệu hiện hữu nào bị thay đổi. Kết quả các lệnh đã chạy được báo trong phản hồi bàn giao; cần chạy bốn MySQL integration test trước khi triển khai production.

Tham chiếu cấu hình chính thức: [Prisma 7 upgrade/config/adapter](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [ESM client generator](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators).
