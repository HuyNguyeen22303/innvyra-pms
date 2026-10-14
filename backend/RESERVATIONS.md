# Phase 4 — Reservation Management

Triển khai trên `feature/be-reservations`, tạo từ `develop` khi working tree sạch. Chỉ sửa `backend/`; không commit, push hoặc merge. Luồng Route → Middleware → Controller → Service → Repository → Prisma được giữ nguyên. Auth/JWT/session/RBAC/CSRF và error envelope được tái sử dụng.

## Dữ liệu và migration

Migration: `prisma/migrations/20261014020000_reservation_management/migration.sql`.

- `Reservation`: hotel, mã xác nhận unique, booker Guest, DATE nhận/trả, status, booking source, Decimal tổng tiền, currency, notes, người tạo và thông tin hủy.
- `ReservationRoom`: một bản ghi cho mỗi đơn vị phòng; hotel, reservation, room type, số người mỗi phòng; `roomId` nullable và luôn null trong Phase 4.
- `ReservationRoomNight`: một bản ghi mỗi đêm, DATE và Decimal giá snapshot; unique `(reservationRoomId, stayDate)`.
- Thêm `Hotel.timezone`, mặc định `Asia/Ho_Chi_Minh`. Khách sạn ngoài múi giờ này cần được cấu hình IANA timezone đúng trước khi dùng. Chưa có API quản trị timezone; timezone không đến từ request đặt phòng. Giá trị không hợp lệ trả 503.
- Thêm unique `(hotelId,id)` cho StaffUser và `(hotelId,roomTypeId,id)` cho Room để hỗ trợ FK ghép. FK ghép chặn booker/staff/type/room khác hotel; phòng gán trong tương lai phải cùng type. Các references giao dịch dùng RESTRICT.
- CHECK constraints trên bảng mới: checkout > checkin, total/nightly rate không âm, adults > 0, audit hủy nhất quán với status. Cần MySQL **8.0.16+** để CHECK được thực thi.

Migration chỉ thêm bảng/cột/index/constraints; không drop/reset/xóa dữ liệu cũ. Database ứng dụng chưa được migrate trong lần bàn giao này. Đã migrate và kiểm chứng riêng trên `innvyra_pms_reservations_phase4_test`. Ba migration Auth/Rooms/Guests cũ được giữ nguyên.

## Tồn phòng và chống overbooking

Không có bảng counter `room_type_inventory`. Các `ReservationRoomNight` của đơn `CONFIRMED` hoặc `CHECKED_IN` là nguồn tính số phòng đã giữ theo từng đêm. Không cần khởi tạo trước các ngày chưa có booking: ngày không có bản ghi giữ phòng có reserved = 0.

Capacity = số Room cùng hotel/type có `isActive=true` và `physicalStatus=ACTIVE`. Không dùng housekeeping readiness để giới hạn booking tương lai. Với mỗi đêm trong `[checkInDate,checkOutDate)`, available = capacity − reserved. API trả availableRooms = minimum của các đêm (clamp về 0 để không trả số âm nếu có dữ liệu vận hành bất thường).

Create/cancel dùng transaction `ReadCommitted` và parameterized `SELECT id FROM hotels WHERE id = ? FOR UPDATE` **trước mọi lần đọc điều kiện nghiệp vụ**. Room/RoomType/Guest mutations hiện có cũng khóa hotel trước. Do đó:

1. Request A lấy khóa, đọc sức chứa/giá/Guest/tồn mới nhất, tạo Reservation + toàn bộ room units + night snapshots, rồi commit.
2. Request B cùng hotel phải chờ A nhả khóa. Sau đó B đọc tồn đã gồm A; nếu phòng cuối cùng đã hết, B trả 409 và rollback.
3. Cùng hotel chỉ có một thứ tự khóa, kể cả đơn có nhiều room types; không có thứ tự khóa type/ngày đảo chiều. Khách sạn khác có thể ghi đồng thời.
4. Với lỗi Prisma P2034 hoặc unique collision P2002, retry toàn bộ transaction tối đa 2 lần (tổng 3 attempts), có delay ngắn. Không retry phần đã commit. Xung đột cuối cùng trả 409. Mã confirmation dùng 112 bit ngẫu nhiên và unique DB index, không dùng COUNT.
5. Thao tác giảm capacity trong Rooms (inactive, physical unavailable, chuyển type) kiểm tra peak reserved của tất cả đêm từ hôm nay theo timezone hotel trong cùng khóa. Nếu capacity mới thiếu so với booking đã giữ, trả `ROOM_INVENTORY_CONFLICT`.

Đây là khóa cơ sở dữ liệu, hoạt động giữa nhiều process/API instance, không dựa vào mutex JavaScript. Guarantee phụ thuộc mọi writer thay đổi booking/capacity tham gia protocol này. Không cho script quản trị hoặc module tương lai ghi thẳng bỏ qua service. Đổi sang khóa theo type/ngày sau này phải chuyển **toàn bộ** writer cùng lúc.

Availability GET dùng transaction snapshot `RepeatableRead`, không giữ chỗ. Create luôn kiểm tra lại trong transaction có khóa. Snapshot giá và tồn phòng được ghi nguyên tử; lỗi ở bất cứ bước nào rollback cả đơn, units và nights. Không có counter để giảm âm hoặc mất đồng bộ.

## State machine, giá và bảo mật

- Create xác nhận ngay: `CONFIRMED`. Không có PENDING giữ phòng vô hạn.
- Chuyển trạng thái duy nhất: `CONFIRMED → CANCELLED`. Hủy lại trả 200, giữ nguyên reason/cancelledAt/cancelledBy đầu tiên. Chuyển status trong cùng transaction khiến mọi đêm ngừng giữ tồn đúng một lần, vẫn giữ đầy đủ price snapshots.
- `CHECKED_IN`, `CHECKED_OUT`, `NO_SHOW` dành cho workflow sau; API hủy thường từ chối cả ba. Không có PATCH status, khôi phục, sửa ngày hoặc thay phòng.
- Không sửa/xóa payment, deposit hay thực hiện refund. Payments/Billing sau này xử lý chính sách hoàn tiền riêng.
- Giá MVP dùng `RoomType.basePrice` tại thời điểm xác nhận. Mỗi unit/đêm lưu Decimal(14,2); tổng chỉ tính bằng Prisma.Decimal. Giá hiện tại thay đổi không ảnh hưởng đơn cũ. Không tính VAT/phụ thu/giảm giá. Giới hạn tổng tiền `999999999999.99`.
- DATE nhập/xuất dạng `YYYY-MM-DD`, lưu `@db.Date` qua UTC midnight để không dịch ngày. Ngày check-out không phải một đêm. Kiểm tra quá khứ dựa trên hotel.timezone.
- Cấu hình `RESERVATION_MAX_NIGHTS=30`, `RESERVATION_MAX_ROOMS=20`; giới hạn cứng cấu hình lần lượt 366 và 100. `rooms` không rỗng, mỗi roomTypeId chỉ xuất hiện một lần; quantity nguyên dương. Adults/children là **số người cho mỗi phòng** và phải nằm trong maxAdults/maxChildren.
- Zod strict từ chối unknown fields, hotelId/createdBy/cancelledBy/status/price/currency/roomId. Hotel và actor lấy từ principal được middleware xác thực lại qua session hiện hành.
- Guest phải tồn tại, chưa soft delete và cùng hotel. Soft delete về sau không phá lịch sử đặt phòng. Booker response chỉ có id/fullName, không query giấy tờ/contact. ACCOUNTANT không nhận notes/reason và không được guestSearch qua Reservation.
- IDs BigInt được serialize thành string; tiền thành decimal string. Responses không cache. Không log request body, giấy tờ, SQL hoặc raw errors.

## API và quyền

Prefix `/api/v1`. Mọi endpoint cần Bearer token; hai POST cần `X-CSRF-Protection: 1`.

| Method | Path                       | Quyền                                    |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/rooms/availability`      | ADMIN, MANAGER, RECEPTIONIST             |
| POST   | `/reservations`            | ADMIN, MANAGER, RECEPTIONIST             |
| GET    | `/reservations`            | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT |
| GET    | `/reservations/:id`        | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT |
| POST   | `/reservations/:id/cancel` | ADMIN, MANAGER, RECEPTIONIST             |

Availability query: checkInDate/checkOutDate bắt buộc; adults mặc định 1, children mặc định 0; roomTypeId optional. Chỉ trả type active đủ sức chứa, kể cả type hết phòng với `availableRooms=0`. Lọc type thiếu/khác hotel trả 404; type inactive trả 409.

List query: page/limit; search theo confirmation code; guestId; guestSearch theo tên cho front desk; status; checkInDate/checkOutDate **exact date**; bookingSource; sortBy createdAt/checkInDate/checkOutDate/totalAmount/confirmationCode; sortOrder asc/desc. Dùng format hiện có `data.items` và `data.pagination.{total,page,limit,totalPages}`. Không lấy/trả nightly records cho list.

Booking sources: DIRECT, PHONE, EMAIL, WALK_IN, AGENT, OTHER. Đây là nhãn ghi nhận nội bộ, không tích hợp OTA.

Lỗi: 401 JWT/session; 403 role/CSRF; 404 scoped resource; 409 insufficient availability, inactive type, cancellation state hoặc transaction conflict; 422 validation/date/capacity/limits; 500 lỗi đã làm sạch; 503 timezone cấu hình sai. Thêm tag Reservations và 5 operations; tổng OpenAPI 25 operations, giữ Auth/Rooms/Guests.

## Áp dụng migration và chạy

Từ `backend/`, sau khi xác nhận `DATABASE_URL` trỏ đúng database và review SQL:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run db:inspect
npm run db:migrate
npm run build
npm run dev
```

`db:migrate` dùng Prisma Migrate deploy, kiểm tra database có migration history trước khi áp dụng. Không dùng reset hoặc db push. Nếu đã tồn tại các bảng cùng tên ngoài migration history, cần đối chiếu/baseline trước. Khi deploy, migrate trước khi chuyển traffic sang bản backend mới. Kiểm tra timezone từng hotel; giá trị mặc định chỉ phù hợp khách sạn ở Việt Nam.

## Thử Swagger/Postman

1. Mở `/api-docs/`, hoặc import `/api-docs/openapi.json` vào Postman. Swagger cùng host cần API origin được cho phép trong CORS_ORIGINS.
2. Login `/api/v1/auth/login` bằng tài khoản đã provision, header CSRF. Dùng `data.accessToken` làm Bearer token.
3. Lấy/tạo Guest, Room Type active và Room active cùng hotel từ API hiện có. Dùng ID thật; chọn ngày tương lai theo timezone khách sạn.
4. GET `/api/v1/rooms/availability?checkInDate=2026-10-20&checkOutDate=2026-10-22&adults=2&children=0` (đổi ngày nếu đã qua).
5. POST `/api/v1/reservations` với header CSRF và body dưới đây; thay guestId/roomTypeId/ngày. Lưu data.id và confirmationCode.

```json
{
  "guestId": "12",
  "checkInDate": "2026-10-20",
  "checkOutDate": "2026-10-22",
  "rooms": [
    { "roomTypeId": "2", "quantity": 2, "adults": 2, "children": 0 },
    { "roomTypeId": "4", "quantity": 1, "adults": 2, "children": 1 }
  ],
  "bookingSource": "DIRECT",
  "notes": "Quiet rooms preferred"
}
```

6. GET list `?status=CONFIRMED&page=1&limit=10`, GET detail `/:id`, kiểm tra từng room unit có đúng số nights, DATE và tiền dạng string. GET availability lại thấy tồn giảm theo từng type.
7. Đổi basePrice qua API RoomType rồi GET detail: nightlyRate và totalAmount của đơn giữ nguyên.
8. POST `/:id/cancel` với `{"reason":"Guest changed travel plans"}`. Gửi lần nữa: vẫn 200, audit đầu tiên không đổi; availability phục hồi. POST status/price/roomId hoặc PATCH reservation đều bị từ chối.
9. ACCOUNTANT đọc được dữ liệu giới hạn, POST trả 403; HOUSEKEEPING/TECHNICIAN không đọc/tạo/hủy được. ID hotel khác trả 404.

## Kiểm thử

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
```

MySQL integration chỉ chạy khi có `TEST_DATABASE_URL`, `NODE_ENV=test`, host local, tên DB kết thúc `_test` và khác database ứng dụng. Tạo database test riêng rồi áp dụng đủ migration bằng Prisma Migrate với DATABASE_URL tạm trỏ test; trước khi chạy Vitest khôi phục DATABASE_URL ứng dụng và đặt TEST_DATABASE_URL trỏ test. Không dùng production DB. Cleanup chỉ xóa fixture có hotel IDs riêng của suite; không reset/drop/truncate. Khi không có TEST_DATABASE_URL, các MySQL tests được skip rõ ràng.

Test gồm Zod/DATE/timezone/DST/Decimal, HTTP JWT/session/CSRF/RBAC/projection, SQL filters/FK/CHECK/unique, multi-room snapshots, ranh giới checkout, thiếu phòng giữa kỳ, giá không đổi, giảm capacity đồng thời, rollback sau khi đã ghi create/cancel, idempotent cancellation và hai HTTP request trên **hai Prisma clients/pools độc lập** tranh phòng cuối (lặp 5 lần). Auth/Rooms/Guests regression và OpenAPI references chạy cùng suite.

## Tệp tạo/chỉnh sửa

Kết quả kiểm chứng ngày **14/10/2026**:

| Kiểm tra                                              | Kết quả                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Prisma validate / generate                            | Đạt                                                                                                                             |
| Prisma Migrate deploy trên database test MySQL 8.0.41 | Đạt, đủ 4 migrations; lần chạy lại không còn migration pending                                                                  |
| Prisma diff database test ↔ schema                    | Không có khác biệt; CHECK constraints được kiểm chứng riêng bằng test ghi giá âm                                                |
| TypeScript `npm run typecheck`                        | Đạt                                                                                                                             |
| ESLint `npm run lint`                                 | Đạt, không warning                                                                                                              |
| Build `npm run build`                                 | Đạt                                                                                                                             |
| Vitest toàn bộ với MySQL test riêng                   | **241 passed, 0 skipped, 12 suites**                                                                                            |
| Concurrency tranh phòng cuối cùng                     | 5 lần, mỗi lần đúng 1 HTTP 201 và 1 HTTP 409 trên hai Prisma clients độc lập                                                    |
| Rollback create / cancel sau khi đã ghi DB            | Đạt; dữ liệu và tồn trở về trạng thái trước transaction                                                                         |
| Auth / Rooms / Guests regression                      | Đạt trong toàn bộ suite                                                                                                         |
| Smoke bản build ESM                                   | Swagger UI/JSON HTTP 200; đủ 25 operations; mọi schema reference hợp lệ; các module yêu cầu JWT; route không triển khai trả 404 |
| `git diff --check`                                    | Đạt                                                                                                                             |

Vitest và kiểm tra loopback/MySQL cần chạy ngoài sandbox Windows sau khi sandbox trả EPERM/EACCES. Các helper kiểm chứng nằm trong `.tmp/` gitignored, không chứa credentials; không dùng để deploy. Không có commit/push/merge hoặc migration lên database ứng dụng.

Tạo:

- `src/modules/reservations/reservation.routes.ts`, `reservation.controller.ts`, `reservation.service.ts`, `reservation.repository.ts`, `reservation.schema.ts`, `reservation.types.ts`, `reservation.mapper.ts`, `reservation.dates.ts`, `availability.service.ts`, `pricing.service.ts`, `inventory.repository.ts`.
- `src/config/reservations.openapi.ts`.
- `prisma/migrations/20261014020000_reservation_management/migration.sql`.
- `tests/reservation-helpers.ts`, `tests/reservations.unit.test.ts`, `tests/reservations.http.test.ts`, `tests/reservations.mysql.integration.test.ts`.
- `RESERVATIONS.md`.

Chỉnh sửa:

- `prisma/schema.prisma`, `.env.example`, `src/config/env.ts`.
- `src/app.ts`, `src/server.ts`, `src/routes/index.ts`, `src/config/swagger.ts`, `src/config/rooms.openapi.ts`.
- `src/modules/rooms/room.repository.ts`, `room.service.ts`, `src/database/room-transaction.ts`: bổ sung kiểm tra tồn trong khóa hiện có, không viết lại CRUD.
- `tests/room-helpers.ts`, `tests/auth.http.test.ts`, `tests/rooms.http.test.ts`, `tests/guests.http.test.ts`, `tests/mysql.integration.test.ts`, `tests/rooms.mysql.integration.test.ts`, `tests/guests.mysql.integration.test.ts`: dependency injection, capacity test seam, OpenAPI count/module presence; giữ các kiểm tra cũ.
- `README.md`, `FRONTEND_PERMISSIONS.md`.

Prisma Client được generate trong `src/generated/prisma` (gitignored). Dependencies, lockfile và frontend không đổi.

## Giới hạn vận hành

- Khóa hotel nối tiếp mọi mutation của một hotel, phù hợp MVP; chưa benchmark throughput/load. Availability hiện query theo type; cần đo tải trước khi mở rộng số lượng type/horizon.
- Capacity phản ánh trạng thái vật lý hiện tại cho toàn bộ kỳ tương lai. Chưa có khoảng bảo trì theo lịch, room blocks, Stay, OTA, rate plan/daily rate hay room assignment. `roomId` không nhận từ client; FK chuẩn bị quan hệ, **không thay thế thuật toán chống chồng lịch** cho module gán phòng sau này.
- Chưa có idempotency key cho POST create: retry sau mất response có thể tạo một đơn mới nếu còn capacity. Client nên tra mã/đơn đã tạo trước khi gửi lại; cancellation đã idempotent.
- Không có API sửa ngày/phòng/khôi phục đơn. Các workflow này phải điều chỉnh tồn nguyên tử trong phase riêng. CHECKED_IN/CHECKED_OUT/NO_SHOW chưa có endpoint chuyển trạng thái.
- Việc đổi timezone, sửa DB trực tiếp hoặc thêm writer bỏ qua khóa có thể phá giả định tồn. Quản trị production cần giới hạn quyền ghi DB và dùng workflow có kiểm tra.
- Migration ứng dụng và kiểm thử tải là bước vận hành còn lại; không tự áp dụng migration lên database đang dùng.
