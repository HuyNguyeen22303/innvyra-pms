# Đặt phòng, nhận cọc và lưu trú

Hướng dẫn theo luồng từ đặt phòng đến checkout. Phần hợp đồng API ghi các quy tắc tồn phòng, giá, trạng thái và dữ liệu để đối chiếu khi tích hợp.

- [Quy trình lễ tân](#quy-trình-lễ-tân).
- [Hợp đồng đặt phòng](#hợp-đồng-đặt-phòng).
- [Hợp đồng lưu trú](#hợp-đồng-lưu-trú).

## Quy trình lễ tân

### Các bước trên giao diện

1. Vào **Đặt phòng**, chọn ngày, số người và hạng phòng.
2. Tìm khách theo họ tên hoặc điện thoại. Kết quả lấy từ server, có tải thêm.
   Nếu chưa có, chọn **Thêm khách mới**, điền form đầy đủ và **Lưu và chọn khách**.
   Hồ sơ được lưu riêng, giữ lại cả khi sau đó bỏ tạo đơn. Hồ sơ nghi trùng được
   cảnh báo và gợi ý để kiểm tra; không tự gộp hoặc xóa.
3. Không có cọc: xác nhận tạo đơn, hệ thống chưa tự mở folio.
4. Khi nhận cọc thủ công, bật **Nhận cọc ngay**, nhập tiền/phương thức/mã chuyển khoản thực nhận,
   xác nhận tiền đã nhận và bấm **Tạo đặt phòng & nhận cọc**. Một lần xác nhận lưu
   cả đơn, giá phòng, folio và cọc. Bấm **Xem folio** từ thông báo thành công. Với
   chuyển khoản qua QR, dùng [quy trình QR nhận cọc](THU_NGAN_VA_THANH_TOAN.md#đặt-phòng-và-nhận-cọc).
5. Đến ngày nhận phòng, vào **Lưu trú**, chọn phòng vật lý phù hợp và check-in.
   Hệ thống tự mở folio nếu chưa có hoặc dùng lại folio cũ. Đơn nhiều phòng dùng
   chung một folio, ghi tiền phòng toàn đơn một lần theo cơ chế hiện tại.
6. Hủy/không đến tiếp tục dùng luồng quyết toán đã có. Checkout vẫn là trả phòng
   vật lý; thu/hoàn và đóng folio được thực hiện qua Thu ngân.

### Tính nhất quán và lỗi

- Đơn + mở folio + cọc + audit + idempotency dùng chung hotel lock và transaction.
  Lỗi một bước rollback cả nhóm. Tạo hồ sơ khách là bước riêng đã xác nhận.
- Cọc là số đồng nguyên, không vượt phí phòng trên folio. Snapshot cũ có phần lẻ
  được làm tròn half-up từng đêm theo chính sách billing hiện có; giao diện ước tính
  theo cùng quy tắc và backend kiểm tra lại mức thực tế.
- Khi chưa rõ kết quả do mạng/server, form giữ lần xác nhận và khóa chỉnh sửa;
  **Kiểm tra kết quả / Thử lại** gửi lại nguyên yêu cầu và khóa cũ. Không tạo cọc mới.
- Lỗi tạo hồ sơ chưa rõ kết quả yêu cầu tìm lại hồ sơ trước khi tạo tiếp.
- Check-in thất bại không để lại folio mới, lượt lưu trú hoặc chiếm phòng dở dang.
  Folio đã đóng chặn nhận phòng để kiểm tra; không tự mở lại.
- Mọi lookup, khóa yêu cầu, folio và giao dịch thuộc khách sạn từ phiên đăng nhập.
  Kế toán chỉ tìm tên khách; không thể suy ra điện thoại từ kết quả hoặc số lượng.

### API và tương thích

- `GET /guests?search=...`: tên hoặc điện thoại cho ADMIN/MANAGER/RECEPTIONIST;
  ACCOUNTANT giữ tìm tên. Cùng bộ lọc cho danh sách và tổng số.
- `POST /guests`: dùng hợp đồng hiện có, trả cảnh báo nghi trùng dạng object.
- `POST /reservations`: thêm `initialDeposit?` gồm `amount`, `paymentMethod`,
  `referenceNumber?`, `confirmedReceived:true`. Header `Idempotency-Key` bắt buộc
  khi có cọc; giao diện luôn gửi khóa cả khi không cọc. Khách tích hợp cũ không cọc,
  không khóa vẫn được hỗ trợ. Trả thêm `folioId`, `initialPaymentId` (null nếu không cọc).
- Check-in giữ body/URL hiện tại, trả thêm `folioId`. Gửi lại check-in vẫn dùng quy
  tắc chống trùng hiện có, không tạo thêm phí. Mở folio thủ công vẫn được giữ.

### Dữ liệu và kiểm thử

Dữ liệu cũ được giữ theo folio và khoản thu đã ghi nhận. Bộ [demo đa khách sạn](DATABASE_MULTI_HOTEL_LOCAL.md)
tạo cả đơn có cọc, chưa cọc và các lượt check-in để kiểm tra mở hoặc dùng lại folio.

Kiểm thử cần đối chiếu rollback, gửi lặp/đồng thời, cọc đủ/một phần, chuyển khoản,
rounding, privacy và pagination khách, check-in nhiều phòng, báo cáo tiền thu,
dịch vụ, checkout và quyết toán đơn hủy/không đến. Xem lệnh và cách chuẩn bị DB
`_test` trong [hướng dẫn kiểm thử backend](CAI_DAT_VA_CHAY.md#kiểm-thử-backend).

## Hợp đồng đặt phòng

Module đặt phòng quản lý tra cứu tồn, giá chốt theo đêm, nhận cọc khi tạo đơn, hủy và đánh dấu khách không đến.

### Dữ liệu và migration

Migration: `prisma/migrations/20261014020000_reservation_management/migration.sql`.

- `Reservation`: hotel, mã xác nhận unique, booker Guest, DATE nhận/trả, status, booking source, Decimal tổng tiền, currency, notes, người tạo và thông tin hủy.
- `ReservationRoom` lưu từng phòng trong đơn, loại phòng và số người. `roomId` được gán khi nhận hoặc đổi phòng.
- `ReservationRoomNight`: một bản ghi mỗi đêm, DATE và Decimal giá snapshot; unique `(reservationRoomId, stayDate)`.
- Ngày nghiệp vụ lấy từ múi giờ IANA trong `Hotel.timezone`, mặc định `Asia/Ho_Chi_Minh`. Múi giờ được cấu hình khi quản lý khách sạn trên Platform và không lấy từ request đặt phòng. Giá trị không hợp lệ trả 503.
- Thêm unique `(hotelId,id)` cho StaffUser và `(hotelId,roomTypeId,id)` cho Room để hỗ trợ FK ghép. FK ghép chặn booker/staff/type/room khác hotel; phòng gán trong tương lai phải cùng type. Các references giao dịch dùng RESTRICT.
- CHECK constraints trên bảng mới: checkout > checkin, total/nightly rate không âm, adults > 0, audit hủy nhất quán với status. Cần MySQL **8.0.16+** để CHECK được thực thi.

Xem quy trình áp dụng migration trong [hướng dẫn chuẩn bị database](CAI_DAT_VA_CHAY.md#chuẩn-bị-database).

### Tồn phòng và chống overbooking

Các `ReservationRoomNight` của đơn `CONFIRMED`, `PARTIALLY_CHECKED_IN`, `CHECKED_IN`, `CHECKED_OUT` là nguồn tính số phòng đã giữ theo từng đêm. Checkout vật lý vẫn giữ số đêm đã đặt, kể cả khi trả sớm. Xem [lưu trú](#hợp-đồng-lưu-trú).

Tồn lấy theo khách sạn và hạng phòng. Với từng đêm trong `[checkInDate,checkOutDate)`, hệ thống trừ cả đêm đã giữ và phòng bị chặn bảo trì khỏi sức chứa. `availableRooms` là số nhỏ nhất trong các đêm, giới hạn thấp nhất là 0. Trạng thái dọn phòng được kiểm tra khi gán phòng vật lý. Xem [tác động của bảo trì lên tồn phòng](VAN_HANH_BUONG_PHONG_BAO_TRI_VA_KHO.md#availability-and-concurrency).

Tạo đơn, hủy và no-show dùng transaction và khóa hàng khách sạn trước khi kiểm tra điều kiện nghiệp vụ. Room, RoomType và Guest dùng cùng cơ chế khóa.

1. Request A lấy khóa, đọc sức chứa/giá/Guest/tồn mới nhất, tạo Reservation + toàn bộ room units + night snapshots, rồi commit.
2. Request B cùng hotel phải chờ A nhả khóa. Sau đó B đọc tồn đã gồm A; nếu phòng cuối cùng đã hết, B trả 409 và rollback.
3. Cùng hotel chỉ có một thứ tự khóa, kể cả đơn có nhiều room types; không có thứ tự khóa type/ngày đảo chiều. Khách sạn khác có thể ghi đồng thời.
4. Với lỗi Prisma P2034 hoặc unique collision P2002, retry toàn bộ transaction tối đa 2 lần (tổng 3 attempts), có delay ngắn. Không retry phần đã commit. Xung đột cuối cùng trả 409. Mã confirmation mới dùng 48 bit ngẫu nhiên (12 ký tự hex in hoa), thêm tiền tố `INN-` thành 16 ký tự; có unique DB index toàn hệ thống, không dùng COUNT. Cột vẫn giữ `VARCHAR(32)` để đọc mã cũ. Seed lịch sử dùng chung bộ sinh mã; lệnh chuyển đổi database local được mô tả trong `doc/DATABASE_MULTI_HOTEL_LOCAL.md`.
5. Thao tác giảm capacity trong Rooms (inactive, physical unavailable, chuyển type) kiểm tra peak reserved của tất cả đêm từ hôm nay theo timezone hotel trong cùng khóa. Nếu capacity mới thiếu so với booking đã giữ, trả `ROOM_INVENTORY_CONFLICT`.

Đây là khóa cơ sở dữ liệu, hoạt động giữa nhiều process/API instance, không dựa vào mutex JavaScript. Guarantee phụ thuộc mọi writer thay đổi booking/capacity tham gia protocol này. Không cho script quản trị hoặc module tương lai ghi thẳng bỏ qua service. Đổi sang khóa theo type/ngày sau này phải chuyển **toàn bộ** writer cùng lúc.

Availability GET dùng transaction snapshot `RepeatableRead`, không giữ chỗ. Create luôn kiểm tra lại trong transaction có khóa. Snapshot giá và tồn phòng được ghi nguyên tử; lỗi ở bất cứ bước nào rollback cả đơn, units và nights. Không có counter để giảm âm hoặc mất đồng bộ.

### State machine, giá và bảo mật

- Create xác nhận ngay: `CONFIRMED`. Không có PENDING giữ phòng vô hạn.
- Hủy và no-show chuyển đơn `CONFIRMED` thành `CANCELLED` hoặc `NO_SHOW`. Gọi lại cùng hành động trả 200, giữ lần ghi nhận đầu. Chuyển trạng thái giải phóng đêm đã giữ đúng một lần và giữ snapshot giá.
- Các trạng thái `PARTIALLY_CHECKED_IN`, `CHECKED_IN` và `CHECKED_OUT` được suy ra từ từng Stay. Đơn đã vào luồng lưu trú không thể hủy hoặc đánh dấu no-show.
- Dùng [quyết toán đơn hủy hoặc khách không đến](THU_NGAN_VA_THANH_TOAN.md#quyết-toán-đơn-hủy-và-khách-không-đến) để ghi nhận phí giữ lại, thu thêm hoặc hoàn tiền theo thực tế.
- Giá MVP dùng `RoomType.basePrice` tại thời điểm xác nhận. Mỗi unit/đêm lưu Decimal(14,2); tổng chỉ tính bằng Prisma.Decimal. Giá hiện tại thay đổi không ảnh hưởng đơn cũ. Không tính VAT/phụ thu/giảm giá. Giới hạn tổng tiền `999999999999.99`.
- DATE nhập/xuất dạng `YYYY-MM-DD`, lưu `@db.Date` qua UTC midnight để không dịch ngày. Ngày check-out không phải một đêm. Kiểm tra quá khứ dựa trên hotel.timezone.
- Cấu hình `RESERVATION_MAX_NIGHTS=30`, `RESERVATION_MAX_ROOMS=20`; giới hạn cứng cấu hình lần lượt 366 và 100. `rooms` không rỗng, mỗi roomTypeId chỉ xuất hiện một lần; quantity nguyên dương. Adults/children là **số người cho mỗi phòng** và phải nằm trong maxAdults/maxChildren.
- Zod strict từ chối unknown fields, hotelId/createdBy/cancelledBy/status/price/currency/roomId. Hotel và actor lấy từ principal được middleware xác thực lại qua session hiện hành.
- Guest phải tồn tại, chưa soft delete và cùng hotel. Soft delete về sau không phá lịch sử đặt phòng. Booker response chỉ có id/fullName, không query giấy tờ/contact. ACCOUNTANT không nhận notes/reason và không được guestSearch qua Reservation.
- IDs BigInt được serialize thành string; tiền thành decimal string. Responses không cache. Không log request body, giấy tờ, SQL hoặc raw errors.

### API đặt phòng và quyền

Prefix `/api/v1`. Mọi endpoint cần Bearer token. Các POST cần `X-CSRF-Protection: 1`.

| Method | Path                       | Quyền                                    |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/rooms/availability`      | ADMIN, MANAGER, RECEPTIONIST             |
| POST   | `/reservations`            | ADMIN, MANAGER, RECEPTIONIST             |
| GET    | `/reservations`            | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT |
| GET    | `/reservations/:id`        | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT |
| POST   | `/reservations/:id/cancel` | ADMIN, MANAGER, RECEPTIONIST             |
| POST   | `/reservations/:id/no-show` | ADMIN, MANAGER, RECEPTIONIST            |

Availability query: checkInDate/checkOutDate bắt buộc; adults mặc định 1, children mặc định 0; roomTypeId optional. Chỉ trả type active đủ sức chứa, kể cả type hết phòng với `availableRooms=0`. Lọc type thiếu/khác hotel trả 404; type inactive trả 409.

List query: page/limit; search theo confirmation code; guestId; guestSearch theo tên cho front desk; status; checkInDate/checkOutDate **exact date**; bookingSource; sortBy createdAt/checkInDate/checkOutDate/totalAmount/confirmationCode; sortOrder asc/desc. Dùng format hiện có `data.items` và `data.pagination.{total,page,limit,totalPages}`. Không lấy/trả nightly records cho list.

Booking sources: DIRECT, PHONE, EMAIL, WALK_IN, AGENT, OTHER. Đây là nhãn ghi nhận nội bộ, không tích hợp OTA.

Tra lỗi, payload và danh sách endpoint trong [OpenAPI đặt phòng](../backend/src/config/reservations.openapi.ts).

### Thử Swagger/Postman

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

### Kiểm thử đặt phòng

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
```

MySQL integration chỉ chạy khi có `TEST_DATABASE_URL`, `NODE_ENV=test`, host local, tên DB kết thúc `_test` và khác database ứng dụng. Tạo database test riêng rồi áp dụng đủ migration bằng Prisma Migrate với DATABASE_URL tạm trỏ test; trước khi chạy Vitest khôi phục DATABASE_URL ứng dụng và đặt TEST_DATABASE_URL trỏ test. Không dùng production DB. Cleanup chỉ xóa fixture có hotel IDs riêng của suite; không reset/drop/truncate. Khi không có TEST_DATABASE_URL, các MySQL tests được skip rõ ràng.

Test gồm Zod/DATE/timezone/DST/Decimal, HTTP JWT/session/CSRF/RBAC/projection, SQL filters/FK/CHECK/unique, multi-room snapshots, ranh giới checkout, thiếu phòng giữa kỳ, giá không đổi, giảm capacity đồng thời, rollback sau khi đã ghi create/cancel, idempotent cancellation và hai HTTP request trên **hai Prisma clients/pools độc lập** tranh phòng cuối (lặp 5 lần). Auth/Rooms/Guests regression và OpenAPI references chạy cùng suite.

### Giới hạn vận hành

- Khóa hotel nối tiếp mọi mutation của một hotel, phù hợp MVP; chưa benchmark throughput/load. Availability hiện query theo type; cần đo tải trước khi mở rộng số lượng type/horizon.
- Khi tạo đơn chỉ chọn hạng phòng. [Luồng lưu trú](#hợp-đồng-lưu-trú) gán phòng vật lý trong transaction và kiểm tra trùng lịch, trạng thái phòng và chặn bảo trì.
- POST create nhận `initialDeposit?` để lưu đơn, mở folio và ghi cọc nguyên tử. `Idempotency-Key` bắt buộc khi có cọc; giao diện gửi khóa cho mọi lần tạo đơn. Cùng khóa/nội dung trả kết quả đã lưu, nội dung khác trả 409. Client cũ không cọc/không khóa vẫn được hỗ trợ và không được đảm bảo chống trùng khi gửi lại. Phản hồi tạo đơn thêm `folioId` và `initialPaymentId` (null khi không có cọc). Xem [luồng lễ tân](#quy-trình-lễ-tân).
- API hiện hỗ trợ ghi nhận hủy, no-show và trạng thái lưu trú theo từng phòng. Thay đổi tồn đi qua các workflow dùng chung khóa khách sạn.

## Hợp đồng lưu trú

Module lưu trú xử lý nhận phòng, trả phòng vật lý, đổi phòng cùng hạng và lịch sử sử dụng phòng. Luồng nhận phòng cũng mở hoặc dùng lại folio của đơn trong cùng transaction.

### API lưu trú và quyền

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

### Dữ liệu

Schema lưu trú bắt đầu từ migration `20261014030000_stay_management`.

- `Stay` → `stays`: unique `reservation_room_id`, hotel/type/current room, CHECKED_IN/CHECKED_OUT, actual check-in/out UTC, staff vào/ra, notes vào/ra, timestamps. Current room giữ lại sau checkout để tra cứu phòng cuối cùng.
- `RoomOccupancy` → `room_occupancies`: `room_id` primary key, `stay_id` unique, hotel/type và thời điểm bắt đầu chiếm phòng hiện tại. Không có cột `isOccupied`. `Room.occupancyStatus` được suy ra từ bảng này.
- `RoomTransfer` → `room_transfers`: Stay ID, phòng nguồn/đích, UTC timestamp, nhân viên, lý do. Bản ghi append-only qua API và giữ sau checkout. Không nhân bản guest PII.
- Foreign keys ghép hotel/type/id chặn reference khác hotel hoặc khác loại phòng; staff phải cùng hotel. Dùng RESTRICT để bảo vệ references và lịch sử. Thêm composite unique/index cho ReservationRoom để hỗ trợ FK và tra cứu lịch gán phòng.
- Thêm `PARTIALLY_CHECKED_IN` vào cuối enum ReservationStatus, giữ nguyên các giá trị cũ. Migration không drop bảng/cột hoặc sửa dữ liệu nghiệp vụ cũ.

`ReservationRoom.roomId` được tái sử dụng làm current/last assignment. Trạng thái từng ReservationRoom suy ra từ quan hệ `stay` (null = chưa nhận); không thêm cột status trùng lặp. Reservation detail trả stay id/status/actual timestamps cho từng phòng.

### Workflows và chính sách thời gian

Check-in:

1. Xác thực, phân quyền, Zod validation; bắt đầu transaction và khóa hotel.
2. Tìm reservation/room trong hotel, kiểm tra membership, booking state và chưa từng có Stay.
3. Chỉ nhận phòng **đúng ngày đến đã đặt**, bất kỳ giờ nào trong ngày đó theo `Hotel.timezone`. Default hiện có là `Asia/Ho_Chi_Minh`; timezone lỗi trả 503. Không có override nhận sớm/muộn.
4. Phòng phải cùng hạng đã đặt, active, physical ACTIVE và housekeeping READY. Hệ thống kiểm tra occupancy, lịch gán của đơn khác và các khoảng chặn bảo trì trên `[arrival, departure)`.
5. Bảo đảm có folio OPEN của đơn trong cùng transaction: tạo và ghi phí phòng một lần nếu chưa có, dùng lại folio đã cọc, chặn folio đã đóng. Tạo Stay, occupancy, assignment và trạng thái đơn rồi commit; trả thêm `folioId`. Lỗi bất kỳ bước nào rollback cả nhận phòng và folio mới. Không thay đổi room nights, giá đặt phòng hoặc tổng tiền hợp đồng.

Check-out:

1. Khóa hotel rồi đọc Stay, occupancy và current room; chỉ chấp nhận active Stay với occupancy khớp.
2. Thời gian server phải bằng hoặc sau actual check-in. Cho phép trả sớm/muộn về mặt vật lý, không tự thay đổi ngày đặt.
3. Ghi CHECKED_OUT, thời điểm và nhân viên xử lý, xóa occupancy, đặt phòng DIRTY và tạo việc dọn phòng. Trạng thái của đơn được tính lại trong cùng transaction.
4. Giữ Stay, assignments và transfer history. Checkout lặp trả 409, không ghi lại audit. Chỉ kết thúc lưu trú vật lý; không xác nhận đã thanh toán, không Payment/Invoice/Refund giả.

Transfer (gộp orchestration trong `StayService`; kiểm tra phòng dùng chung ở `RoomAssignmentService`):

1. Khóa hotel, kiểm tra Stay active và occupancy khớp. Phòng đích khác phòng hiện tại, cùng hotel và cùng loại đã đặt.
2. Kiểm tra điều kiện nhận khách như check-in; kiểm tra assigned reservations trong phần ngày còn lại. Từ chối transfer từ ngày checkout trở đi vì chưa có extension policy.
3. Chuyển occupancy và assignment sang phòng mới, ghi lịch sử, đặt phòng cũ DIRTY và tạo việc dọn cho phòng cũ trong cùng transaction.
4. Giữ nguyên Stay ID, actual check-in, giá và inventory. Lỗi bất kỳ bước nào rollback cả occupancy, assignment và history. Cross-type transfer trả `CROSS_ROOM_TYPE_TRANSFER_NOT_SUPPORTED`.

### Aggregate Reservation và inventory

| Tình trạng các phòng                              | Reservation status   |
| ------------------------------------------------- | -------------------- |
| Chưa phòng nào bắt đầu                            | CONFIRMED            |
| Có phòng đã bắt đầu nhưng vẫn còn phòng chưa nhận | PARTIALLY_CHECKED_IN |
| Tất cả phòng đã bắt đầu, ít nhất một phòng còn ở  | CHECKED_IN           |
| Tất cả phòng đã trả                               | CHECKED_OUT          |

PARTIALLY_CHECKED_IN vẫn được giữ nếu phòng đã đến trả sớm trong khi các phòng khác chưa đến. Hủy đơn chỉ cho CONFIRMED; vì vậy không hủy được đơn có lịch sử lưu trú. Arrival và cancel dùng cùng khóa để không race.

Inventory tiếp tục tính từ `ReservationRoomNight`. Các trạng thái tiêu thụ inventory: CONFIRMED, PARTIALLY_CHECKED_IN, CHECKED_IN, CHECKED_OUT. Chỉ cancellation/no-show làm những bản ghi tương ứng không còn tiêu thụ theo policy hiện tại. **Checkout sớm toàn bộ đơn vẫn giữ các đêm còn lại**. Không thêm counter hoặc room nights lúc check-in, không giải phóng đêm đã qua hoặc tương lai lúc checkout, không đổi inventory lúc transfer cùng loại.

Phòng đã trả có thể nhận khách mới khi đã dọn và nghiệm thu READY, với điều kiện vượt qua kiểm tra lịch gán và [chặn bảo trì](VAN_HANH_BUONG_PHONG_BAO_TRI_VA_KHO.md#maintenance-blocks). Các đêm đã giữ của đơn cũ tiếp tục được tính trong tồn đặt phòng.

### Concurrent requests và rollback

- Mỗi mutation dùng Prisma transaction `ReadCommitted`, lấy `SELECT id FROM hotels WHERE id = ? FOR UPDATE` trước khi đọc điều kiện. Cùng protocol với Reservations, Rooms, RoomTypes và Guests; không có khóa đảo thứ tự giữa các loại phòng.
- Các instance/process khác nhau cùng hotel phải chờ khóa database, rồi đọc lại state mới nhất. Khác hotel có thể xử lý đồng thời. Protocol bảo vệ cả cancellation và thay đổi room operation trong lúc nhận phòng.
- Unique ReservationRoom→Stay chặn double check-in; occupancy room primary key chặn hai Stay cùng phòng; occupancy stay unique chặn một Stay đồng thời chiếm hai phòng. Constraints là lớp bảo vệ bổ sung độc lập với prechecks.
- Chỉ retry P2034 (transaction đã rollback) tối đa 2 lần sau lần đầu, delay 25/50ms. Không retry commit/network error chưa rõ kết quả. Unique/FK/pool timeout/transaction timeout/concurrency conflict trả STAY_CONFLICT 409; không lộ thông tin DB. `maxWait=5000`, transaction timeout 20000ms.
- Không hỗ trợ Idempotency-Key. Khi mạng mất response, client đọc lại Stay/Reservation trước khi thao tác tiếp; check-in/check-out lặp trả 409. Transfer lặp cùng phòng đích trả 409.
- Room đang có khách có thể thay housekeepingStatus phục vụ vệ sinh, nhưng không deactivate/maintenance/retype qua Room service trước khi chuyển hoặc checkout khách. Thao tác đó trả ROOM_OCCUPIED.

Tradeoff: khóa theo hotel giới hạn throughput write ở khách sạn đông. Mọi writer tương lai phải theo cùng protocol; unique/FK không tự thay thế các policy ngày/READY/assignment. Thay đổi hotel/type của phòng có references lịch sử bị RESTRICT; thay vì sửa mất lịch sử cần nghiệp vụ migration riêng.

### Kiểm thử lưu trú bằng Swagger hoặc Postman

Làm theo hướng dẫn [chuẩn bị database](CAI_DAT_VA_CHAY.md#chuẩn-bị-database), [chạy API](CAI_DAT_VA_CHAY.md#chạy-api) và [kiểm thử backend](CAI_DAT_VA_CHAY.md#kiểm-thử-backend). Suite MySQL kiểm tra transaction, tính nhất quán và các thao tác đồng thời.

1. Login bằng staff của hotel rồi dùng access token trong Authorize/Bearer. Thêm CSRF header cho POST.
2. Tạo booking ngày hôm nay theo timezone hotel và lấy `reservationId`, `reservationRoomId`. Tạo/chọn phòng ACTIVE, READY cùng room type; lấy internal `room.id`.
3. POST check-in body `{"roomId":"<internal-room-id>","notes":"Guest arrived"}`. Kiểm tra 201, Stay ID và aggregate state.
4. GET `/stays?status=CHECKED_IN`; GET `/stays/:id` xem history.
5. POST `/stays/:id/transfers` body `{"toRoomId":"<another-room-id>","reason":"Air conditioner malfunction"}`. Phòng đích phải cùng loại và READY; phòng cũ thành DIRTY.
6. POST `/stays/:id/check-out` body `{"notes":"Key returned"}` hoặc `{}`. Kiểm tra CHECKED_OUT, actual time, DIRTY và không còn occupancy. POST lại trả 409.

### Giới hạn

Đổi phòng hỗ trợ cùng hạng. Khách quá hạn vẫn giữ occupancy đến khi checkout. Quyết toán và hoàn tiền thực hiện tại [thu ngân](THU_NGAN_VA_THANH_TOAN.md#hợp-đồng-thu-ngân). Trạng thái READY, việc dọn và điều kiện chặn bảo trì được quản lý trong [vận hành buồng phòng](VAN_HANH_BUONG_PHONG_BAO_TRI_VA_KHO.md#buồng-phòng-bảo-trì-và-tồn-phòng).
