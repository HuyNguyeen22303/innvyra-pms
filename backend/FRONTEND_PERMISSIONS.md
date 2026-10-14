# Innvyra PMS — Bảng phân quyền dành cho Frontend

Đối chiếu backend ngày 14/10/2026. Phạm vi đã triển khai: Authentication/RBAC, Room Types, Rooms và Guests (Phase 1–3).

✅ Được phép. ❌ Không được phép. ✅* Được đọc dữ liệu tối thiểu. Quyền trong bảng vẫn chịu điều kiện tài khoản/phiên hợp lệ, phạm vi khách sạn, validation và quy tắc nghiệp vụ.

| Role dùng trong API | Tên hiển thị          |
| ------------------- | --------------------- |
| `ADMIN`             | Quản trị viên         |
| `MANAGER`           | Quản lý khách sạn     |
| `RECEPTIONIST`      | Lễ tân                |
| `ACCOUNTANT`        | Kế toán               |
| `HOUSEKEEPING`      | Nhân viên buồng phòng |
| `TECHNICIAN`        | Nhân viên kỹ thuật    |

## Ma trận quyền

| Chức năng / thao tác                                                  | ADMIN | MANAGER | RECEPTIONIST | ACCOUNTANT | HOUSEKEEPING | TECHNICIAN |
| --------------------------------------------------------------------- | :---: | :-----: | :----------: | :--------: | :----------: | :--------: |
| Đăng nhập / refresh token / đăng xuất                                 |  ✅   |   ✅    |      ✅      |     ✅     |      ✅      |     ✅     |
| Xem thông tin tài khoản đang đăng nhập                                |  ✅   |   ✅    |      ✅      |     ✅     |      ✅      |     ✅     |
| Xem danh sách / chi tiết loại phòng                                   |  ✅   |   ✅    |      ✅      |     ✅     |      ✅      |     ✅     |
| Tạo loại phòng                                                        |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Sửa loại phòng, giá cơ bản và sức chứa                                |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Vô hiệu hóa / kích hoạt lại loại phòng                                |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Xem danh sách / chi tiết phòng                                        |  ✅   |   ✅    |      ✅      |     ✅     |      ✅      |     ✅     |
| Tạo phòng                                                             |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Sửa thông tin phòng                                                   |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Đổi trạng thái vận hành / dọn phòng                                   |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Vô hiệu hóa / kích hoạt lại phòng                                     |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Xem danh sách / chi tiết Guest                                        |  ✅   |   ✅    |      ✅      |    ✅*     |      ❌      |     ❌     |
| Tìm kiếm theo tên / phân trang / sắp xếp Guest                        |  ✅   |   ✅    |      ✅      |    ✅*     |      ❌      |     ❌     |
| Lọc Guest theo quốc tịch                                              |  ✅   |   ✅    |      ✅      |     ❌     |      ❌      |     ❌     |
| Xem điện thoại / email / quốc tịch Guest                              |  ✅   |   ✅    |      ✅      |     ❌     |      ❌      |     ❌     |
| Xem ngày sinh / giấy tờ / địa chỉ / ghi chú Guest ở màn hình chi tiết |  ✅   |   ✅    |      ✅      |     ❌     |      ❌      |     ❌     |
| Tạo Guest                                                             |  ✅   |   ✅    |      ✅      |     ❌     |      ❌      |     ❌     |
| Sửa Guest                                                             |  ✅   |   ✅    |      ✅      |     ❌     |      ❌      |     ❌     |
| Xóa mềm Guest                                                         |  ✅   |   ✅    |      ❌      |     ❌     |      ❌      |     ❌     |
| Gọi endpoint kiểm tra quyền `/auth/admin-check`                       |  ✅   |   ❌    |      ❌      |     ❌     |      ❌      |     ❌     |

_*✅* ACCOUNTANT chỉ nhận `id` và `fullName` của Guest_*, cả ở danh sách lẫn chi tiết. Các field còn lại không được trả về, không phải chuỗi bị che. Kế toán vẫn tìm kiếm theo tên, phân trang và sắp xếp được, nhưng không được gửi filter `nationality`.

**HOUSEKEEPING và TECHNICIAN hiện chỉ đọc Rooms/Room Types.** Chưa cấp quyền PATCH trạng thái dọn phòng hay bảo trì cho hai role này. RECEPTIONIST cũng chưa được sửa Rooms/Room Types.

## API để FE đối chiếu

Prefix chung: `/api/v1`.

| Method | Path                                                             | Quyền                                                                      |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| POST   | `/auth/login`                                                    | Tài khoản được cấp sẵn, còn active, đúng thông tin đăng nhập; cả 6 role    |
| POST   | `/auth/refresh`                                                  | Refresh cookie/session hợp lệ; cả 6 role                                   |
| POST   | `/auth/logout`                                                   | Đã xác thực; cả 6 role                                                     |
| GET    | `/auth/me`                                                       | Đã xác thực; cả 6 role                                                     |
| GET    | `/auth/admin-check`                                              | ADMIN; endpoint kiểm tra quyền, không phải API quản lý nhân viên           |
| GET    | `/room-types`, `/room-types/:id`                                 | Cả 6 role                                                                  |
| POST   | `/room-types`                                                    | ADMIN, MANAGER                                                             |
| PATCH  | `/room-types/:id`                                                | ADMIN, MANAGER                                                             |
| DELETE | `/room-types/:id`                                                | ADMIN, MANAGER; vô hiệu hóa                                                |
| GET    | `/rooms`, `/rooms/:id`                                           | Cả 6 role                                                                  |
| POST   | `/rooms`                                                         | ADMIN, MANAGER                                                             |
| PATCH  | `/rooms/:id`                                                     | ADMIN, MANAGER                                                             |
| DELETE | `/rooms/:id`                                                     | ADMIN, MANAGER; vô hiệu hóa                                                |
| GET    | `/guests`, `/guests/:id`                                         | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT; dữ liệu theo role                |
| POST   | `/guests`                                                        | ADMIN, MANAGER, RECEPTIONIST                                               |
| PATCH  | `/guests/:id`                                                    | ADMIN, MANAGER, RECEPTIONIST                                               |
| DELETE | `/guests/:id`                                                    | ADMIN, MANAGER; xóa mềm                                                    |
| GET    | `/rooms/availability`                                            | ADMIN, MANAGER, RECEPTIONIST                                               |
| GET    | `/reservations`, `/reservations/:id`                             | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT                                   |
| POST   | `/reservations`                                                  | ADMIN, MANAGER, RECEPTIONIST                                               |
| POST   | `/reservations/:id/cancel`                                       | ADMIN, MANAGER, RECEPTIONIST                                               |
| GET    | `/stays`, `/stays/:id`                                           | ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT; projection tối thiểu cho kế toán |
| POST   | `/reservations/:reservationId/rooms/:reservationRoomId/check-in` | ADMIN, MANAGER, RECEPTIONIST                                               |
| POST   | `/stays/:id/check-out`, `/stays/:id/transfers`                   | ADMIN, MANAGER, RECEPTIONIST                                               |

## Quy tắc hiển thị và thao tác dành cho FE

1. Lấy role từ response backend: `data.user.role` khi login/refresh, hoặc `data.role` khi gọi `/auth/me`. Dùng đúng mã viết hoa ở bảng role. Role và hotel hiện hành được backend đọc lại từ tài khoản/session; không giả định JWT chứa role/hotel và không chỉ dựa vào role lưu cũ ở FE.
2. Mọi role, kể cả ADMIN, chỉ truy cập dữ liệu thuộc khách sạn hiện hành. Không gửi `hotelId`, `actorId`, `role` hoặc primary key trong body tạo/sửa Guest để tự xác định quyền/ownership. Backend xác định hotel và nhân viên thao tác từ Auth.
3. Không có phân quyền “hồ sơ do mình tạo” và “hồ sơ do người khác tạo”. Người có quyền sửa được sửa hồ sơ của khách sạn mình dù nhân viên khác tạo. Tương tự, ADMIN/MANAGER được xóa mềm Guest do lễ tân khác tạo trong cùng hotel. `actor_id` trong audit dùng truy vết người thao tác, không xác định quyền sở hữu Guest.
4. Ẩn hoặc vô hiệu hóa nút thêm/sửa/xóa theo bảng. HOUSEKEEPING/TECHNICIAN không có màn hình Guest; ACCOUNTANT chỉ có danh sách/chi tiết Guest tối thiểu, không có các nút ghi và bộ lọc quốc tịch. Menu Rooms/Room Types được mở cho cả 6 role, còn nút quản lý chỉ dành cho ADMIN/MANAGER.
5. Danh sách Guest của ADMIN/MANAGER/RECEPTIONIST trả `id`, `fullName`, `phone`, `email`, `nationality`, `createdAt`, `updatedAt`. Ngày sinh, giới tính, giấy tờ, địa chỉ và notes chỉ có ở response chi tiết/tạo/sửa. Không dựa vào việc thiếu field trong danh sách để kết luận role bị cấm xem chi tiết.
6. POST/PATCH/DELETE Guest và Rooms/Room Types cần Bearer Access Token cùng `X-CSRF-Protection: 1`. Login/refresh/logout cũng cần header CSRF. Browser Origin phải được backend cho phép; bật gửi credentials để nhận/gửi refresh cookie HttpOnly.
7. Có quyền không đồng nghĩa mọi request đều thành công. Ví dụ vô hiệu hóa loại phòng còn phòng active trả 409; tạo/kích hoạt phòng yêu cầu loại phòng active cùng hotel. FE cần hiển thị lỗi nghiệp vụ do backend trả về.
8. Xóa Room/Room Type là đặt `isActive=false`, vẫn đọc được bản ghi; ADMIN/MANAGER có thể kích hoạt lại qua PATCH `{"isActive":true}` khi thỏa điều kiện nghiệp vụ. Xóa Guest là đặt `deletedAt`; bản ghi không còn xuất hiện trong list, GET/PATCH/DELETE lại đều trả 404. Các thao tác DELETE thành công hiện trả HTTP 200.
9. Trùng số phòng/mã loại phòng có thể trả 409. Guest có khả năng trùng vẫn được tạo với 201 và `warnings` chứa `POSSIBLE_DUPLICATE`; PATCH thành công có thể trả cảnh báo tương tự với 200. FE nên hiển thị cảnh báo để nhân viên kiểm tra, không tự gộp hoặc sửa Guest khác.
10. Backend là nơi quyết định quyền cuối cùng. Với 401, xử lý phiên/token; với 403, thông báo thao tác không được phép và đọc `error.code` để phân biệt quyền với CSRF/Origin; với 404, hiển thị không tìm thấy. ID thuộc hotel khác được trả cùng lỗi 404 để tránh lộ dữ liệu.

## Chức năng chưa có API

Các chức năng dưới đây chưa triển khai cho bất kỳ role nào, kể cả ADMIN. FE chưa nên hiển thị như chức năng sử dụng được:

- Khôi phục Guest đã xóa mềm, xem danh sách Guest đã xóa hoặc xóa vĩnh viễn Guest.
- Xem/quản lý audit log. Backend tự ghi audit khi tạo, sửa và xóa mềm Guest; chưa có endpoint đọc log.
- Quản lý nhân viên/role qua CRUD API, đổi mật khẩu, đăng ký tài khoản công khai.
- Sửa ngày/số lượng/loại phòng của Reservation, khôi phục đơn đã hủy, Payment, loyalty và báo cáo nghiệp vụ tương ứng.

Tên role ACCOUNTANT/HOUSEKEEPING/TECHNICIAN không đồng nghĩa các module thanh toán, công việc buồng phòng hoặc lệnh bảo trì đã có API. Tài liệu này mô tả quyền thực tế của Phase 1–5.

Stay: HOUSEKEEPING/TECHNICIAN không xem hoặc ghi Stay; chỉ xem occupancyStatus ở Rooms theo quyền hiện có. ACCOUNTANT không nhận guest/staff/notes/transfer history của Stay. POST Stay cần CSRF; timestamps và nhân viên do server ghi. Check-in dùng room ID nội bộ, đúng ngày đến theo hotel timezone. Checkout là kết thúc lưu trú vật lý, không thể hiển thị “đã thanh toán”. Xem [STAYS.md](STAYS.md).

Reservation luôn dùng hotel/actor từ Auth; `adults` và `children` áp dụng cho từng phòng, `quantity` là số phòng. Frontend không gửi giá, hotelId, status hay roomId. Availability chỉ tham khảo; POST có thể trả 409 nếu phòng đã được người khác đặt. POST tạo/hủy cần header CSRF. Hủy lặp lại trả 200, giữ lý do/người hủy/thời gian đầu tiên. ACCOUNTANT chỉ đọc: booker có id/fullName, không nhận private notes/cancellation reason, không được dùng `guestSearch` của Reservation. HOUSEKEEPING/TECHNICIAN không truy cập Reservation. Xem [RESERVATIONS.md](RESERVATIONS.md).

Nguồn đối chiếu: `src/modules/auth/auth.routes.ts`, `src/modules/room-types/room-type.routes.ts`, `src/modules/rooms/room.routes.ts`, `src/modules/guests/guest.routes.ts`, `guest.types.ts`, `guest.mapper.ts`, `guest.service.ts` và `src/routes/index.ts`. Tài liệu đầy đủ endpoint/schema tại `/api-docs/` và `/api-docs/openapi.json`.
