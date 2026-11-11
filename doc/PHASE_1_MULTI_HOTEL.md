# Phase 1 — Nền dữ liệu PMS đa khách sạn

Ngày thực hiện: 11/11/2026. Nhánh: `feature/multi-hotel-saas`, từ `develop` tại `48623cb`.

Trạng thái: **hoàn thành phase 1**. Chưa triển khai phase 2, chưa commit hoặc push.

## 1. Phạm vi thực hiện

Phase này bổ sung nền dữ liệu cho các giai đoạn tiếp theo, kiểm chứng nâng cấp dữ liệu cũ và lấy mốc kiểm tra nghiệp vụ hiện tại.

Chưa có trang/API quản trị Innvyra, bootstrap tài khoản nền tảng, đăng nhập email, bắt buộc đổi mật khẩu hay chặn khách sạn theo trạng thái. Những hành vi đó sẽ được thực hiện ở phase 2–5 theo kế hoạch. Các API hiện có giữ nguyên hợp đồng và hành vi.

## 2. Kết quả kiểm tra trước thay đổi

Môi trường kiểm chứng: Node.js 24.11.0, Prisma 7.10.0 và MySQL local 9.0.0. Các dependency đang cài đặt được giữ nguyên.

Kết quả rà soát hiện trạng:

- Xác thực đọc lại session và nhân viên ở server; `hotelId` được suy ra từ nhân viên, không lấy từ request đăng nhập.
- Repository phòng/nhân viên có scope khách sạn và cơ chế khóa hàng khách sạn; username/email hiện kiểm tra duy nhất toàn hệ thống.
- Script `create:admin` hiện chỉ bootstrap admin đầu tiên trên toàn hệ thống; việc giới hạn theo khách sạn sẽ sửa ở phase 4, không thay đổi trong phase này.
- Cache React Query và danh bạ nhân viên hiện có trạng thái dùng chung trong trình duyệt; việc tách/xóa theo phiên thuộc phase 3.
- Fixture nhân viên dùng kiểu được sinh bởi Prisma đã được thêm `mustChangePassword: false` để giữ tương thích với schema mới.

| Kiểm tra | Kết quả ban đầu |
| --- | --- |
| Backend typecheck | Đạt |
| Backend lint | Đạt |
| Backend build | Đạt |
| Frontend build, bao gồm kiểm tra TypeScript | Đạt |
| Frontend lint | Đạt |
| Toàn bộ test với database MySQL riêng | 704 đạt, 2 lỗi assertion Swagger có sẵn |

Hai lỗi nền đã được đối chiếu với routes và OpenAPI:

- Test billing đếm 83 API toàn hệ thống trong khi hiện có 113. Đổi sang kiểm tra xác thực của endpoint thanh toán thuộc đúng module; giữ kiểm tra Idempotency-Key và CORS.
- Test operations đếm 22 API trong khi thực tế có 23, gồm `GET /maintenance/tickets/stats`. Cập nhật số lượng và kiểm tra riêng endpoint này; giữ kiểm tra quyền, schema lỗi và mô tả của mọi operation.

Trong các lượt hồi quy sau đó phát hiện thêm test kho có sẵn không ổn định: test cộng dồn dòng nhập trùng item chọn movement bằng vị trí `[1]`, phụ thuộc timestamp và thứ tự khi trùng mili giây. Đổi sang tìm bằng `referenceId` của phiếu nhập và `itemId`, giữ nguyên các assertion tồn kho/số lượng. Không thay xử lý kho hoặc sắp xếp ở production.

Ban đầu sandbox Windows chặn cache tạm và kết nối loopback. Chuyển cache vào `.tmp` và chạy kiểm tra cần loopback với quyền phù hợp đã cho phép kiểm chứng trên MySQL thật. Lỗi sandbox không được coi là lỗi nghiệp vụ hoặc kết quả đạt.

## 3. Thiết kế dữ liệu đã bổ sung

| Thành phần | Mục đích và tương thích |
| --- | --- |
| `Hotel.status` | `ACTIVE` hoặc `SUSPENDED`, mặc định `ACTIVE` cho cả dữ liệu cũ |
| Thông tin khách sạn | Email/điện thoại liên hệ, địa chỉ, tham chiếu thỏa thuận; các cột mới cho phép null |
| Thông tin tạm ngừng | Thời điểm và lý do, mặc định null |
| `StaffUser.mustChangePassword` | Mặc định false, không thay mật khẩu, role, trạng thái hoặc phiên của tài khoản cũ |
| `PlatformAdmin` | Danh tính quản trị Innvyra có email duy nhất, password hash, trạng thái và ngày tạo; không có `hotelId` hoặc quan hệ với bảng role nhân viên |
| `PlatformAuthSession`, `PlatformRefreshToken` | Session và refresh token riêng, cùng cơ chế hash/rotation để triển khai ở phase 2 |
| `HotelSubscriptionPeriod` | Kỳ sử dụng theo ngày, tên gói, phí Decimal, VND, tham chiếu thỏa thuận/thanh toán, ghi chú và người ghi nhận thuộc nền tảng |
| `PlatformAuditLog` | Khách sạn, người thực hiện thuộc nền tảng, hành động, lý do, metadata và tham chiếu nhân viên/kỳ sử dụng khi có |

Mọi `PlatformAdmin` thuộc quyền `PLATFORM_ADMIN`. Không chèn quyền này vào bảng `roles` của nhân viên; không tự tạo tài khoản hoặc khách sạn giả.

Các hành động nhật ký được chuẩn bị: tạo/cập nhật khách sạn, tạm ngừng/mở lại, cấp/reset admin và ghi nhận kỳ sử dụng. Metadata sau này chỉ chứa các trường được cho phép; không ghi mật khẩu, token hoặc dữ liệu khách lưu trú.

## 4. Ràng buộc và chính sách dữ liệu

- Khách sạn `ACTIVE` không có thời điểm/lý do tạm ngừng; `SUSPENDED` phải có thời điểm và lý do không rỗng.
- Kỳ sử dụng có ngày bắt đầu không sau ngày kết thúc, phí không âm và tiền tệ VND. Cho phép kỳ một ngày hoặc phí bằng 0.
- Ngày kết thúc được hiểu là ngày cuối cùng còn sử dụng, theo múi giờ khách sạn; việc tính cảnh báo sẽ triển khai ở phase 5.
- Nhật ký tạm ngừng/mở lại phải có lý do không rỗng.
- Foreign key của actor/phiên nền tảng trỏ tới `platform_admins`, không tới `staff_users`.
- Tham chiếu nhân viên và kỳ sử dụng trong nhật ký dùng foreign key ghép với `hotel_id`, chặn tham chiếu chéo khách sạn ngay trong database.
- Giữ quan hệ lịch sử bằng `RESTRICT`. Xóa một session nền tảng chỉ cascade refresh token của chính session đó.
- Không tự tạo kỳ sử dụng cho khách sạn cũ. Chưa có kỳ nghĩa là chưa thiết lập, không phải đã hết hạn.
- Khóa theo hàng khách sạn đã có sẵn sẽ được tái sử dụng khi ghi kỳ/gia hạn ở phase sau để kiểm tra trùng kỳ trong transaction.

Các `CHECK` được ghi trực tiếp trong migration SQL vì Prisma chưa biểu diễn chúng trong schema. Bài kiểm thử MySQL xác nhận các ràng buộc này thực sự được thực thi.

## 5. Migration và kiểm chứng dữ liệu cũ

Migration mới: `20261111000000_multi_hotel_foundation`.

- Chỉ thêm cột vào `hotels`, `staff_users` và tạo các bảng/index/foreign key/ràng buộc mới.
- Không sửa migration đã có; không xóa cột/bảng, không seed và không đặt lại mật khẩu.
- Yêu cầu MySQL 8.0.16+ để `CHECK` được thực thi. Lần kiểm chứng này chạy trên MySQL 9.0.0; chưa chạy riêng trên MySQL 8.
- Chỉ áp dụng trên database test local; chưa áp dụng vào database ứng dụng.
- Trước khi chạy phiên bản code/Prisma client mới với database ứng dụng, cần áp dụng migration này theo quy trình triển khai đã kiểm tra. Không dùng client mới với schema ứng dụng còn thiếu các cột mới.

Bài kiểm chứng nâng cấp thực hiện:

1. Kiểm tra `TEST_DATABASE_URL` là database local riêng, có hậu tố `_test` và khác database ứng dụng.
2. Tạo database tạm tên ngẫu nhiên do riêng bài test sở hữu; áp dụng các migration trước phase 1.
3. Tạo dữ liệu theo schema cũ: hai khách sạn, sáu role, nhân viên hoạt động/ngừng hoạt động, hash mật khẩu, session, refresh token, phòng, khách, đặt phòng, giá theo đêm, folio và thanh toán.
4. Chụp tất cả cột/hàng của các bảng nghiệp vụ cũ; nâng cấp bằng migration mới, chạy deploy lần hai để xác nhận không áp dụng lại.
5. So sánh toàn bộ dữ liệu cũ trước/sau, xác nhận giá trị mặc định mới và đăng nhập/refresh cũ vẫn hoạt động.
6. Kiểm tra foreign key tách danh tính, cascade refresh token, tiền/ngày, nhật ký chéo khách sạn và lý do tạm ngừng.
7. Đóng kết nối và xóa đúng database/thư mục tạm do bài test vừa tạo; không reset hoặc xóa database ứng dụng.

Fixtures dùng ID lớn hơn giới hạn số nguyên an toàn JavaScript và giá đặt phòng có phần thập phân để phát hiện mất chính xác. Tiền trên folio/thu ngân tuân thủ quy tắc làm tròn VND sẵn có.

## 6. Kiểm tra sau thay đổi

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma validate và generate | Đạt |
| Prisma diff sau migrate trên database test | Không có khác biệt |
| Bài kiểm chứng nâng cấp schema cũ → mới | 7/7 đạt |
| Backend typecheck, lint và build | Đạt |
| Frontend build và lint | Đạt ở mốc ban đầu; không thay mã frontend trong phase này |
| Toàn bộ test backend với MySQL | 713/713 test, 25/25 suite đạt; bao gồm 7 test nâng cấp và các test MySQL, không có test bị bỏ qua |
| Git diff check | Đạt |

Lệnh kiểm tra phụ `python -m pip check` theo hướng dẫn thư mục cha không chạy được do Windows alias `python.exe` không khả dụng. Repo này dùng Node.js và không có manifest dependency Python; không thay đổi môi trường Python để xử lý việc này.

Các lệnh chạy từ thư mục `backend`:

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm run test:mysql -- tests/multi-hotel-migration.mysql.integration.test.ts
npm run test:mysql
```

Frontend được kiểm tra bằng `npm run build` và `npm run lint`. Repo không có bộ test frontend riêng.

Log kiểm chứng được lưu tại `.tmp/multi-hotel-phase1/` và được Git ignore. Không thay `.env`, không commit log, generated client hoặc database runtime.

Lượt hồi quy cuối đạt trong 323.68 giây; log: `.tmp/multi-hotel-phase1/final-mysql-pass.log`. Prisma xác nhận không có migration chờ áp dụng hoặc khác biệt schema trên database test sau khi nâng cấp.

## 7. Bước tiếp theo

Sau khi phase 1 được nghiệm thu, phase 2 sẽ triển khai bootstrap `create:platform-admin`, phiên/JWT/cookie riêng và trang đăng nhập nền tảng. Chưa mở rộng sang phase 2 trong lần thực hiện này.
