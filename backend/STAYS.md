# Phase 5 — Stay Management

Triển khai backend trên branch `feature/be-stays`, tạo từ `develop` với working tree sạch. Luồng Route → Middleware → Controller → Service → Repository → Prisma được giữ nguyên; không thêm dependency. Sau khi kiểm chứng, người dùng yêu cầu áp dụng migration và commit/push feature branch; không merge hoặc reset database.

## API và quyền

Tất cả đường dẫn dưới đây có prefix `/api/v1`, dùng Bearer token, hotel/actor/role từ session được xác thực. Mọi POST cần `X-CSRF-Protection: 1`; browser Origin phải nằm trong allowlist.

| Method | Endpoint                                                         | Quyền                                    | Thành công |
| ------ | ---------------------------------------------------------------- | ---------------------------------------- | ---------- |
| GET    | `/stays`                                                         | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT | 200        |
| GET    | `/stays/:id`                                                     | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT | 200        |
| POST   | `/reservations/:reservationId/rooms/:reservationRoomId/check-in` | ADMIN, MANAGER, RECEPTIONIST             | 201        |
| POST   | `/stays/:id/check-out`                                           | ADMIN, MANAGER, RECEPTIONIST             | 200        |
| POST   | `/stays/:id/transfers`                                           | ADMIN, MANAGER, RECEPTIONIST             | 201        |

ACCOUNTANT chỉ nhận stay/booking identifiers, mã đặt, phòng/loại phòng, ngày và trạng thái; không nhận guest, staff, notes hoặc lịch sử chuyển phòng. HOUSEKEEPING/TECHNICIAN không có quyền Stay. Endpoint Rooms hiện có tiếp tục cho phép xem `occupancyStatus` mà không tiết lộ Stay ID hoặc guest.

`GET /stays` hỗ trợ `page`, `limit`, `status`, `roomId`, `roomNumber`, `checkInDate`, `checkOutDate`, `search` theo confirmation code, `sortBy`, `sortOrder`. Không truyền status sẽ trả cả hai trạng thái; dùng `status=CHECKED_IN` để lấy khách đang lưu trú. Room filters là phòng hiện tại, hoặc phòng cuối cùng nếu đã trả. Date filters là **ngày thực tế theo timezone khách sạn**, có xử lý ngày DST 23/25 giờ. Sort whitelist: `actualCheckinAt`, `actualCheckoutAt`, `createdAt`, `id`.

Tất cả ID là chuỗi unsigned BIGINT, không chuyển sang JavaScript Number. Body/query strict; không nhận hotelId, role, timestamps, status hay nhân viên từ client. Error envelope hiện có được giữ nguyên; foreign IDs trả 404 giống ID không tồn tại. GET detail có snapshot nhất quán giữa Stay, assignment và transfer history.

## Dữ liệu

Migration mới: `prisma/migrations/20261014030000_stay_management/migration.sql`.

- `Stay` → `stays`: unique `reservation_room_id`, hotel/type/current room, CHECKED_IN/CHECKED_OUT, actual check-in/out UTC, staff vào/ra, notes vào/ra, timestamps. Current room giữ lại sau checkout để tra cứu phòng cuối cùng.
- `RoomOccupancy` → `room_occupancies`: `room_id` primary key, `stay_id` unique, hotel/type và thời điểm bắt đầu chiếm phòng hiện tại. Không có cột `isOccupied`. `Room.occupancyStatus` được suy ra từ bảng này.
- `RoomTransfer` → `room_transfers`: Stay ID, phòng nguồn/đích, UTC timestamp, nhân viên, lý do. Bản ghi append-only qua API và giữ sau checkout. Không nhân bản guest PII.
- Foreign keys ghép hotel/type/id chặn reference khác hotel hoặc khác loại phòng; staff phải cùng hotel. Dùng RESTRICT để bảo vệ references và lịch sử. Thêm composite unique/index cho ReservationRoom để hỗ trợ FK và tra cứu lịch gán phòng.
- Thêm `PARTIALLY_CHECKED_IN` vào cuối enum ReservationStatus, giữ nguyên các giá trị cũ. Migration không drop bảng/cột hoặc sửa dữ liệu nghiệp vụ cũ.

`ReservationRoom.roomId` được tái sử dụng làm current/last assignment. Trạng thái từng ReservationRoom suy ra từ quan hệ `stay` (null = chưa nhận); không thêm cột status trùng lặp. Reservation detail trả stay id/status/actual timestamps cho từng phòng.

## Workflows và chính sách thời gian

Check-in:

1. Xác thực, phân quyền, Zod validation; bắt đầu transaction và khóa hotel.
2. Tìm reservation/room trong hotel, kiểm tra membership, booking state và chưa từng có Stay.
3. Chỉ nhận phòng **đúng ngày đến đã đặt**, bất kỳ giờ nào trong ngày đó theo `Hotel.timezone`. Default hiện có là `Asia/Ho_Chi_Minh`; timezone lỗi trả 503. Không có override nhận sớm/muộn.
4. Phòng cùng loại đã đặt, active, physical ACTIVE, housekeeping READY, không occupancy và không assigned reservation khác chồng lịch `[arrival, departure)`.
5. Tạo Stay, tạo occupancy, cập nhật assignment và aggregate reservation state; commit. Không tạo/thay đổi room nights, giá hoặc tổng tiền.

Check-out:

1. Khóa hotel rồi đọc Stay, occupancy và current room; chỉ chấp nhận active Stay với occupancy khớp.
2. Thời gian server phải bằng hoặc sau actual check-in. Cho phép trả sớm/muộn về mặt vật lý, không tự thay đổi ngày đặt.
3. Ghi CHECKED_OUT, actual checkout, staff/notes; xóa occupancy; đặt phòng DIRTY; tính lại aggregate state; commit.
4. Giữ Stay, assignments và transfer history. Checkout lặp trả 409, không ghi lại audit. Chỉ kết thúc lưu trú vật lý; không xác nhận đã thanh toán, không Payment/Invoice/Refund giả.

Transfer (gộp orchestration trong `StayService`; kiểm tra phòng dùng chung ở `RoomAssignmentService`):

1. Khóa hotel, kiểm tra Stay active và occupancy khớp. Phòng đích khác phòng hiện tại, cùng hotel và cùng loại đã đặt.
2. Kiểm tra điều kiện nhận khách như check-in; kiểm tra assigned reservations trong phần ngày còn lại. Từ chối transfer từ ngày checkout trở đi vì chưa có extension policy.
3. UPDATE occupancy sang room ID mới (unique key), cập nhật current room và ReservationRoom assignment, tạo lịch sử, đặt phòng cũ DIRTY; commit toàn bộ.
4. Giữ nguyên Stay ID, actual check-in, giá và inventory. Lỗi bất kỳ bước nào rollback cả occupancy, assignment và history. Cross-type transfer trả `CROSS_ROOM_TYPE_TRANSFER_NOT_SUPPORTED`.

## Aggregate Reservation và inventory

| Tình trạng các phòng                              | Reservation status   |
| ------------------------------------------------- | -------------------- |
| Chưa phòng nào bắt đầu                            | CONFIRMED            |
| Có phòng đã bắt đầu nhưng vẫn còn phòng chưa nhận | PARTIALLY_CHECKED_IN |
| Tất cả phòng đã bắt đầu, ít nhất một phòng còn ở  | CHECKED_IN           |
| Tất cả phòng đã trả                               | CHECKED_OUT          |

PARTIALLY_CHECKED_IN vẫn được giữ nếu phòng đã đến trả sớm trong khi các phòng khác chưa đến. Hủy đơn chỉ cho CONFIRMED; vì vậy không hủy được đơn có lịch sử lưu trú. Arrival và cancel dùng cùng khóa để không race.

Inventory tiếp tục tính từ `ReservationRoomNight`. Các trạng thái tiêu thụ inventory: CONFIRMED, PARTIALLY_CHECKED_IN, CHECKED_IN, CHECKED_OUT. Chỉ cancellation/no-show làm những bản ghi tương ứng không còn tiêu thụ theo policy hiện tại. **Checkout sớm toàn bộ đơn vẫn giữ các đêm còn lại**. Không thêm counter hoặc room nights lúc check-in, không giải phóng đêm đã qua hoặc tương lai lúc checkout, không đổi inventory lúc transfer cùng loại.

Lịch phân phòng đã kết thúc lưu trú không chặn tái sử dụng phòng vật lý sau khi được dọn READY; inventory booking của nó vẫn giữ nguyên. Hai khái niệm này độc lập. Module hiện chưa có scheduled maintenance/room blocks nên kiểm tra physical status hiện tại và lịch assignment đã có; không giả lập chức năng chưa tồn tại.

## Concurrent requests và rollback

- Mỗi mutation dùng Prisma transaction `ReadCommitted`, lấy `SELECT id FROM hotels WHERE id = ? FOR UPDATE` trước khi đọc điều kiện. Cùng protocol với Reservations, Rooms, RoomTypes và Guests; không có khóa đảo thứ tự giữa các loại phòng.
- Các instance/process khác nhau cùng hotel phải chờ khóa database, rồi đọc lại state mới nhất. Khác hotel có thể xử lý đồng thời. Protocol bảo vệ cả cancellation và thay đổi room operation trong lúc nhận phòng.
- Unique ReservationRoom→Stay chặn double check-in; occupancy room primary key chặn hai Stay cùng phòng; occupancy stay unique chặn một Stay đồng thời chiếm hai phòng. Constraints là lớp bảo vệ bổ sung độc lập với prechecks.
- Chỉ retry P2034 (transaction đã rollback) tối đa 2 lần sau lần đầu, delay 25/50ms. Không retry commit/network error chưa rõ kết quả. Unique/FK/pool timeout/transaction timeout/concurrency conflict trả STAY_CONFLICT 409; không lộ thông tin DB. `maxWait=5000`, transaction timeout 20000ms.
- Không hỗ trợ Idempotency-Key. Khi mạng mất response, client đọc lại Stay/Reservation trước khi thao tác tiếp; check-in/check-out lặp trả 409. Transfer lặp cùng phòng đích trả 409.
- Room đang có khách có thể thay housekeepingStatus phục vụ vệ sinh, nhưng không deactivate/maintenance/retype qua Room service trước khi chuyển hoặc checkout khách. Thao tác đó trả ROOM_OCCUPIED.

Tradeoff: khóa theo hotel giới hạn throughput write ở khách sạn đông. Mọi writer tương lai phải theo cùng protocol; unique/FK không tự thay thế các policy ngày/READY/assignment. Thay đổi hotel/type của phòng có references lịch sử bị RESTRICT; thay vì sửa mất lịch sử cần nghiệp vụ migration riêng.

## Chạy migration, test và Swagger/Postman

Chạy trong thư mục `backend`:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npm test
npm run test:mysql
```

`test:mysql` tạo `innvyra_pms_stays_phase5_test` mặc định bằng credentials local từ DATABASE_URL, hoặc dùng TEST_DATABASE_URL đã cấu hình. Chỉ cho host local, tên schema kết thúc `_test` và khác schema ứng dụng; từ chối NODE_ENV=production. Script chạy migrate deploy, kiểm tra schema diff rồi chạy toàn bộ Vitest/Supertest, bao gồm concurrency trên hai Prisma clients/API instances độc lập. Có thể truyền tên test file để chạy chọn lọc. Không reset/drop/truncate; mỗi test chỉ dọn fixtures mang hotel ID ngẫu nhiên của chính nó. `npm test` không có TEST_DATABASE_URL sẽ skip MySQL suites, không được xem là kiểm chứng concurrency.

Migration ứng dụng là bước vận hành riêng, sau khi kiểm tra DATABASE_URL và backup:

```powershell
npm run db:inspect
npm run db:migrate
npm run prisma:generate
npm run dev
```

Không dùng `migrate reset` hoặc drop table khi gặp conflict. Script migrate hiện có dừng nếu database có bảng nhưng chưa có Prisma migration history. Sau khi kiểm thử trên database riêng, đã áp dụng migration Reservation và Stay còn thiếu vào database local `innvyra_pms` theo yêu cầu người dùng.

Swagger UI: `/api-docs/`; JSON: `/api-docs/openapi.json` trên API host (PORT mặc định 3000). Postman có thể import trực tiếp URL JSON; không cần chỉnh các collection snapshot cũ để sử dụng API mới.

1. Login bằng staff của hotel rồi dùng access token trong Authorize/Bearer. Thêm CSRF header cho POST.
2. Tạo booking ngày hôm nay theo timezone hotel và lấy `reservationId`, `reservationRoomId`. Tạo/chọn phòng ACTIVE, READY cùng room type; lấy internal `room.id`.
3. POST check-in body `{"roomId":"<internal-room-id>","notes":"Guest arrived"}`. Kiểm tra 201, Stay ID và aggregate state.
4. GET `/stays?status=CHECKED_IN`; GET `/stays/:id` xem history.
5. POST `/stays/:id/transfers` body `{"toRoomId":"<another-room-id>","reason":"Air conditioner malfunction"}`. Phòng đích phải cùng loại và READY; phòng cũ thành DIRTY.
6. POST `/stays/:id/check-out` body `{"notes":"Key returned"}` hoặc `{}`. Kiểm tra CHECKED_OUT, actual time, DIRTY và không còn occupancy. POST lại trả 409.

## File manifest

Tạo mới:

- `prisma/migrations/20261014030000_stay_management/migration.sql`
- `src/modules/stays/stay.routes.ts`, `stay.controller.ts`, `stay.service.ts`, `stay.repository.ts`, `stay.schema.ts`, `stay.types.ts`, `stay.mapper.ts`, `stay.dates.ts`, `room-assignment.service.ts`
- `src/config/stays.openapi.ts`
- `scripts/test-mysql.ts`
- `tests/stays.unit.test.ts`, `tests/stays.mysql.integration.test.ts`
- `STAYS.md`

Chỉnh sửa:

- `prisma/schema.prisma`, `package.json`
- `src/app.ts`, `src/server.ts`, `src/routes/index.ts`
- `src/config/swagger.ts`, `src/config/reservations.openapi.ts`, `src/config/rooms.openapi.ts`
- `src/modules/reservations/inventory.repository.ts`, `reservation.repository.ts`, `reservation.mapper.ts`
- `src/modules/rooms/room.repository.ts`, `room.service.ts`, `room.types.ts`
- `tests/room-helpers.ts`, `tests/reservation-helpers.ts`, `tests/rooms.http.test.ts`, `tests/guests.http.test.ts`, `tests/reservations.http.test.ts`
- `README.md`, `RESERVATIONS.md`, `FRONTEND_PERMISSIONS.md`

Prisma Client đã generate lại trong `src/generated/prisma` (gitignored theo project). Không chỉnh frontend hoặc bốn migration cũ.

## Giới hạn

Chưa có Billing, settlement, refund, invoice, walk-in, extension, reservation amendments, cross-type upgrade/downgrade, scheduled maintenance hay housekeeping task workflow. Khách quá hạn vẫn giữ occupancy đến checkout; availability tương lai vẫn là inventory booking, không cam kết một phòng cụ thể đã sạch/trống khi khách tới. Không có API sửa/xóa Stay hoặc transfer history. Notes là văn bản vận hành; không đưa giấy tờ định danh vào notes.

## Kết quả kiểm chứng ngày 14/10/2026

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma validate / generate | Đạt |
| 5 migrations trên `innvyra_pms_stays_phase5_test` | Đạt, MySQL 8.0.41; Prisma schema diff không có khác biệt |
| TypeScript strict typecheck | Đạt |
| ESLint | Đạt, không warning |
| Build | Đạt |
| Toàn bộ unit, HTTP, integration và regression | **327 passed, 0 skipped, 14 suites** |
| Stay tests | 69 MySQL/HTTP tests và 17 unit tests |
| Concurrent requests | 5 tình huống bắt buộc, mỗi tình huống chạy 3 lần; thêm cross-reservation arrival và check-in/cancel race |
| Rollback | Lỗi sau ghi Stay/occupancy/assignment, sau checkout và sau transfer đều rollback dữ liệu |
| Swagger UI/JSON | HTTP 200, đủ 30 operations, mọi schema reference nội bộ tồn tại |

Sau khi suite kiểm thử đạt, đã áp dụng migration Reservation và Stay vào database local `innvyra_pms` theo yêu cầu người dùng; không reset/drop dữ liệu. Test vẫn chỉ chạy trên database test riêng. Kết nối MySQL được chạy ngoài sandbox sau khi được cấp quyền. Không tuyên bố đã kiểm thử tải production.
