# Phase 4 — Tiếp nhận và thiết lập khách sạn

Ngày hoàn thành: 11/11/2026. Nhánh: `feature/multi-hotel-saas`, bắt đầu từ `99e8584` (Phase 2 đã được người dùng commit). Agent chưa commit hoặc push thay đổi Phase 4.

Cập nhật 12/11/2026: phần Phase 3 được nhắc là còn thiếu trong báo cáo lịch sử bên dưới đã được hoàn thiện về mật khẩu tạm và cách ly phiên/cache; giữ đăng nhập username, để email tùy chọn cho sau. Xem [báo cáo Phase 3](PHASE_3_HOTEL_SESSIONS.md) để biết trạng thái mới nhất. Phase 5–6 vẫn chưa triển khai.

Rà soát lại 12/11/2026 sau khi chốt Phase 3: đã đối chiếu toàn bộ các mục Phase 4 trong kế hoạch với route, service, schema, giao diện, bootstrap và test. Không phát hiện mục nghiệm thu Phase 4 còn thiếu. Chạy lại `hotel-onboarding.mysql.integration.test.ts` (18 test) cùng `hotel-accounts.mysql.integration.test.ts` (11 test): **29/29 đạt**, 2 file, 51.96 giây trên database test riêng. Lượt hồi quy toàn bộ gần nhất sau Phase 3 đạt **773/773 test backend**; frontend đạt **37/37 test**, build/lint/typecheck đã được kiểm chứng ở lượt đó. Log kiểm tra lại: `.tmp/multi-hotel-phase4/phase4-recheck-after-phase3.log` (Git ignore). Không sửa mã chức năng hoặc dữ liệu ứng dụng trong lần rà soát này; chưa commit/push/deploy.

## 1. Phạm vi và thứ tự triển khai

Người dùng yêu cầu thực hiện Phase 4 dù Phase 3 chưa được triển khai đầy đủ. Phase này hoàn thành quản lý khách sạn và bổ sung phần bắt buộc đổi mật khẩu tối thiểu cần thiết để bàn giao tài khoản mới an toàn. Không đánh dấu Phase 3 đã hoàn thành.

- Tạo khách sạn, admin đầu tiên, kỳ sử dụng ban đầu và ba nhật ký trong cùng transaction MySQL.
- Danh sách/tìm kiếm/phân trang, xem chi tiết, cập nhật thông tin, cấp thêm admin và reset mật khẩu admin của từng khách sạn.
- Admin khách sạn xem/cập nhật thông tin của chính khách sạn mình; sidebar hiển thị tên thật từ thông tin đăng nhập.
- Admin được nền tảng cấp/reset phải đổi mật khẩu trước khi gọi API nghiệp vụ. Đổi/reset thu hồi các phiên cũ; đổi thành công yêu cầu đăng nhập lại.
- Thêm liên kết “Đăng nhập quản trị Innvyra” tại trang đăng nhập khách sạn.

Chưa làm: đăng nhập nhân viên bằng email, chính sách cờ đổi mật khẩu cho các luồng tạo/reset nhân viên cũ, toàn bộ cách ly cache/response của PMS ở Phase 3; gia hạn, cảnh báo thuê bao, tạm ngừng/mở lại và bộ lọc thời hạn ở Phase 5. Cần hoàn tất Phase 3 và Phase 6 trước khi nghiệm thu sử dụng đa khách sạn trên production.

Không thay schema/migration, `.env`, dependency hoặc lockfile. Không tạo khách sạn hoặc sửa dữ liệu trên database ứng dụng. Các dữ liệu phát sinh khi kiểm thử/preview thuộc database test riêng.

## 2. Luồng tiếp nhận và bàn giao

1. Đăng nhập quản trị Innvyra tại `/platform/login`.
2. Chọn **Khách sạn → Thêm khách sạn** (`/platform/hotels/new`).
3. Nhập mã, tên, múi giờ IANA, thông tin liên hệ/địa chỉ và tham chiếu thỏa thuận nếu có.
4. Nhập họ tên, username và email quản trị khách sạn đầu tiên. Username/email duy nhất toàn bộ hệ thống nhân viên; không chọn role hoặc nhập mật khẩu tại form này.
5. Nhập tên gói, ngày bắt đầu/kết thúc và phí VND. Ngày kết thúc bao gồm ngày đó, không được trước ngày bắt đầu. Phí phải được nhập rõ ràng; cho phép kỳ một ngày hoặc phí bằng 0. Có thể ghi tham chiếu thỏa thuận/thanh toán và ghi chú.
6. Bấm **Tạo khách sạn và cấp tài khoản**. Hệ thống tạo mật khẩu tạm ngẫu nhiên và chỉ trả về ở response thành công này.
7. Lưu/bàn giao thông tin cho đúng người nhận rồi đóng hộp thoại. Trang chi tiết chỉ trả thông tin admin an toàn; không có API đọc lại mật khẩu tạm. Nếu mất response/mật khẩu tạm, tìm khách sạn đã tạo rồi reset để cấp mật khẩu mới.
8. Khách sạn đăng nhập tại `/login` bằng **username** và mật khẩu tạm. Giao diện chuyển tới `/change-password`; sau khi đổi thành công, đăng nhập lại bằng mật khẩu mới để sử dụng PMS.

Phím Enter trong ô nhập của form tiếp nhận không gửi form; người dùng hoàn tất các mục rồi dùng nút tạo. Không tự chạy seed demo khi tiếp nhận khách sạn.

## 3. API

Tất cả route nền tảng chỉ nhận JWT nền tảng `PLATFORM_ADMIN`. POST/PATCH yêu cầu CSRF header và Origin tin cậy theo cấu hình hiện có; response nền tảng và profile khách sạn có `Cache-Control: no-store`.

| Method | URL | Quyền và hành vi |
| --- | --- | --- |
| GET | `/api/v1/platform/hotels` | Nền tảng; page/limit/search, lọc ACTIVE/SUSPENDED |
| POST | `/api/v1/platform/hotels` | Nền tảng; tiếp nhận khách sạn/admin/kỳ sử dụng/nhật ký nguyên vẹn, trả 201 và mật khẩu tạm một lần |
| GET | `/api/v1/platform/hotels/:id` | Nền tảng; thông tin khách sạn, admin, tối đa 50 kỳ sử dụng và 50 nhật ký gần nhất |
| PATCH | `/api/v1/platform/hotels/:id` | Nền tảng; cập nhật tên, múi giờ, liên hệ, địa chỉ, tham chiếu thỏa thuận; ghi nhật ký cùng transaction |
| POST | `/api/v1/platform/hotels/:id/admins` | Nền tảng; cấp thêm ADMIN thuộc đúng khách sạn, trả mật khẩu tạm một lần |
| POST | `/api/v1/platform/hotels/:id/admins/:staffId/reset-password` | Nền tảng; bắt buộc lý do, chỉ nhắm ADMIN thuộc khách sạn đó, đổi hash/cờ/thu hồi phiên/nhật ký trong cùng transaction |
| GET | `/api/v1/hotel` | Mọi role nhân viên sau khi hoàn tất đổi mật khẩu; chỉ đọc profile khách sạn của phiên hiện tại |
| PATCH | `/api/v1/hotel` | ADMIN khách sạn; chỉ đổi tên, liên hệ và địa chỉ của khách sạn hiện tại |
| POST | `/api/v1/auth/change-password` | Mọi role nhân viên đang đăng nhập, kể cả đang bắt buộc đổi mật khẩu; xác minh mật khẩu cũ, đổi hash, bỏ cờ và thu hồi mọi phiên của tài khoản |

Mã khách sạn được chuẩn hóa chữ hoa và giữ nguyên sau khi tạo trong phiên bản này. Username/email được chuẩn hóa theo quy tắc hiện có. ID là chuỗi unsigned BIGINT; query/body/params có danh sách trường cho phép, từ chối trường lạ và ID vượt giới hạn.

Không nhận `hotelId`, role, trạng thái hoặc dữ liệu thuê bao qua API tự cập nhật của khách sạn. Nền tảng không được dùng JWT của mình để đọc/ghi phòng, khách lưu trú hoặc nghiệp vụ PMS. Admin khách sạn cũng không dùng được API nền tảng.

Kỳ sử dụng trả ngày dưới dạng ISO UTC midnight để biểu diễn ngày lịch; giao diện hiển thị phần ngày, không đổi sang timezone của máy người dùng. Tiền đi qua API dưới dạng chuỗi decimal và lưu Prisma Decimal/MySQL DECIMAL, không dùng float khi ghi.

OpenAPI cập nhật đầy đủ 9 operation mới, tổng cộng 127 operation. Phần `CurrentUser` có `mustChangePassword` và tóm tắt `hotel` gồm ID/mã/tên/múi giờ khi repository đọc từ MySQL.

## 4. Transaction, mật khẩu và nhật ký

- `HotelManagementService` sử dụng transaction ReadCommitted. Cập nhật khách sạn/cấp/reset admin khóa hàng khách sạn, cùng thứ tự khóa với quản lý nhân viên hiện có. Unique constraint toàn cục giải quyết cả tranh chấp giữa hai khách sạn.
- Trùng mã, username hoặc email trả 409; thiếu role ADMIN trả 409. Hỏng bất kỳ bước nào khi tiếp nhận phải rollback cả khách sạn, tài khoản, kỳ sử dụng và nhật ký. Không tự tạo role hoặc khách sạn demo để chữa lỗi.
- Mật khẩu tạm ngẫu nhiên dùng generator hiện có (24 ký tự base64url, ít nhất 8 ký tự khác nhau), hash Argon2id. Không ghi mật khẩu rõ vào database, audit, cache React Query hoặc storage trình duyệt.
- Mật khẩu chỉ ở state cục bộ của hộp thoại bàn giao trong lần tạo/reset đó; đóng hộp thoại hoặc rời trang sẽ bỏ giá trị. Không tự hiển thị lại từ trang chi tiết.
- Reset chỉ thay mật khẩu/cờ và thu hồi phiên của admin được nhắm; giữ nguyên trạng thái hoạt động và role. Reset không tự kích hoạt tài khoản đã ngừng hoạt động.
- Nhật ký nền tảng ghi actor nền tảng thật, khách sạn, target admin/kỳ sử dụng và hành động. Cập nhật profile lưu before/after của các trường được phép. Không dùng actor nền tảng giả để ghi thao tác tự chỉnh profile của nhân viên.
- Password change của nhân viên kiểm tra lại hash cũ dưới khóa hàng nhân viên, cập nhật hash/cờ và thu hồi phiên trong một transaction. Login cũng kiểm tra lại hash sau xác minh để mật khẩu vừa reset không mở được phiên mới do tranh chấp.
- Middleware phân quyền đọc profile hiện tại từ database và chặn tài khoản có `mustChangePassword` bằng 403 `PASSWORD_CHANGE_REQUIRED` trên các API nghiệp vụ. Vẫn cho `/auth/me`, refresh, logout và change-password. Chỉ sửa giao diện không vượt qua được yêu cầu đổi mật khẩu.
- Bootstrap `create:admin` kiểm tra admin đầu tiên theo từng `hotelId`, thay vì kiểm tra toàn hệ thống. Luồng CLI này dùng mật khẩu người vận hành tự đặt, không phải mật khẩu tạm do nền tảng cấp.

## 5. Giao diện và phạm vi cache

- `/platform/hotels`: danh sách có tìm kiếm, phân trang, trạng thái, tải lại và nút tiếp nhận.
- `/platform/hotels/new`: form tiếp nhận và hộp thoại bàn giao một lần.
- `/platform/hotels/:id`: sửa thông tin, danh sách/cấp/reset admin, kỳ sử dụng đã ghi nhận và nhật ký nền tảng.
- `/hotel`: trang ADMIN khách sạn tự sửa thông tin; tên trên sidebar cập nhật theo kết quả thành công.
- `/change-password`: form đổi mật khẩu bắt buộc, xác nhận mật khẩu mới và yêu cầu đăng nhập lại.

Query mới của nền tảng có key chứa ID quản trị; query profile khách sạn chứa ID nhân viên và hotelId, dùng AbortSignal khi đọc. Mật khẩu tạm không vào query cache. Đây chỉ là phạm vi các trang mới; chưa thay thế việc cách ly toàn bộ cache, danh bạ nhân viên và response của phiên PMS cũ trong Phase 3.

Client không tự refresh/retry thao tác đổi mật khẩu nhân viên khi gặp 401, tránh gửi lại thay đổi credential sau khi danh tính cookie đã đổi. Trường hợp access token hết hạn tại form đổi mật khẩu sẽ yêu cầu đăng nhập lại/thử lại.

## 6. Kiểm chứng

Windows, Node.js 24.11.0, MySQL 9.0.0. Không coi kết quả này là đã thử trên MySQL 8 hoặc production hosting.

| Kiểm tra | Kết quả |
| --- | --- |
| Bộ test mục tiêu onboarding/auth/rooms/platform | 122/122 test, 4 file đạt |
| Test MySQL onboarding mới | 18/18 đạt, đã nằm trong các lượt test trên/dưới |
| Toàn bộ backend `npm run test:mysql` | **762/762 test, 28/28 file đạt**, không bỏ qua; 435.38 giây |
| Backend typecheck, lint, build | Đạt |
| Frontend build, lint | Đạt, không còn cảnh báo lint mới |
| Frontend test quản lý phiên nền tảng | **14/14 đạt**; không phải test render toàn bộ trang Phase 4 |
| Prisma migrate/diff trên database test | Không có migration chờ hoặc khác biệt schema |
| Git diff check | Đạt |

Test MySQL mới dùng database ngẫu nhiên riêng, kiểm tra:

- Tạo nguyên vẹn, tiền decimal, hash thật, mật khẩu tạm, actor/target nhật ký và không trả secret trong list/detail.
- Trùng mã/username/email và lỗi ghi kỳ sử dụng rollback toàn bộ; hai create tranh chấp chỉ một transaction thành công.
- Ngày/múi giờ/tiền không hợp lệ, ID/query/body injection, CSRF và JWT sai hệ thống.
- Cấp thêm admin, reset phải có lý do, không reset admin của khách sạn khác hoặc nhân viên không còn role ADMIN.
- Chặn nghiệp vụ bằng mật khẩu tạm; đổi mật khẩu sai/yếu/trùng bị từ chối; đổi thành công thu hồi tất cả access/refresh cũ và không ảnh hưởng phiên nền tảng.
- Reset và đổi mật khẩu chạy đồng thời, login bằng hash đã bị reset; không để phiên cũ tiếp tục hoạt động.
- Profile cập nhật theo hotelId từ phiên; MANAGER không tự sửa; admin không đổi mã/trạng thái/thuê bao. A/B có thể trùng mã hạng phòng nhưng không đọc/ghi hạng phòng của nhau.
- CLI bootstrap admin theo từng khách sạn trong môi trường test.

Kiểm tra trình duyệt trên preview/database tạm:

1. Đăng nhập nền tảng, mở danh sách và form, submit thiếu trường cho thông báo đúng.
2. Tạo hai khách sạn mẫu, xem hộp thoại bàn giao và trang chi tiết có kỳ sử dụng/nhật ký. Kiểm tra lại thao tác Enter chọn ngày sau khi sửa lỗi gửi form sớm; lần tạo B chỉ ghi sau nút tạo và hiển thị đúng phí 12.000.000 VND.
3. Cập nhật địa chỉ từ nền tảng, thấy thông báo thành công. Desktop 1365×900 và mobile 390×844 không tràn ngang toàn trang; bảng có vùng cuộn riêng, menu mobile mở được.
4. Tài khoản B đăng nhập bằng mật khẩu tạm được chuyển tới `/change-password`; nhập URL `/dashboard` vẫn quay lại form. Submit form rỗng hiển thị lỗi. Luồng đổi mật khẩu/reset thành công được kiểm chứng qua API/MySQL, không thay credential qua trình duyệt trong lượt kiểm tra này.
5. Tài khoản khách sạn cũ mở `/hotel`, tự sửa tên và sidebar cập nhật đúng tên. Có liên kết rõ ràng từ login khách sạn sang login quản trị Innvyra.

Preview API/Vite dùng cổng riêng 3126/5175; đã dừng và dọn đúng database preview do fixture sở hữu. Không tác động server/database ứng dụng của người dùng. Ảnh/log kiểm chứng trong `.tmp/multi-hotel-phase4/`, được Git ignore. Ảnh dùng dữ liệu tổng hợp, không phải tài khoản/khách sạn thật.

Lệnh phụ `python -m pip check` theo AGENTS ở thư mục cha không chạy được do Windows alias `python.exe` không khả dụng. Repo dùng Node.js; không cài hoặc thay môi trường Python.

## 7. Test thủ công trên môi trường local của người dùng

Không cần migration mới cho Phase 4 nếu database đã có schema Phase 1. Khởi động lại backend/frontend đang chạy để dùng code mới.

1. Mở `/platform/login`, đăng nhập admin Innvyra đã tạo, chọn **Khách sạn → Thêm khách sạn**.
2. Tạo dữ liệu local bạn muốn dùng thử theo luồng ở mục 2; ghi lại mật khẩu tạm trước khi đóng hộp thoại.
3. Mở `/login` bằng tab/profile riêng, nhập **username** của admin khách sạn và mật khẩu tạm. Đổi mật khẩu rồi đăng nhập lại, kiểm tra tên khách sạn và trang **Thông tin khách sạn**.
4. Từ nền tảng reset admin với lý do; phiên khách sạn cũ phải mất hiệu lực, mật khẩu tạm mới yêu cầu đổi lại. Dùng hai khách sạn để kiểm tra độc lập dữ liệu backend.

Trước khi chuyển sang nghiệm thu production, hoàn tất phần Phase 3 còn lại và Phase 5–6. Không xem cache/phiên PMS cũ là đã đạt chỉ vì các trang/API mới ở Phase 4 đã được kiểm chứng.
