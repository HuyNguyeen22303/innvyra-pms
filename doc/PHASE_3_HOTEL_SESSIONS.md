# Phase 3 — Tài khoản khách sạn và cách ly phiên

Ngày thực hiện: 12/11/2026. Nhánh: `feature/multi-hotel-saas`. Giữ nguyên phần Phase 4 đang có trong working tree; chưa commit/push hoặc thay database ứng dụng.

Trạng thái: **hoàn thành** trong phạm vi đăng nhập username, mật khẩu tạm và cách ly phiên/cache đã nêu bên dưới.

## 1. Phạm vi hiện tại

Giữ đăng nhập nhân viên bằng **username + mật khẩu** trong đợt này, theo hướng triển khai đã trao đổi trước khi bắt đầu. Hỗ trợ email là tùy chọn để sau, không phải nhập đồng thời username và email. Quản trị Innvyra vẫn đăng nhập bằng email tại `/platform/login`, độc lập với tài khoản khách sạn tại `/login`.

Phần đổi mật khẩu/chặn nghiệp vụ đã được bổ sung cho admin nền tảng cấp trong Phase 4. Phase 3 hoàn thiện chính sách cho nhân viên, quản lý phiên trình duyệt và cách ly dữ liệu khi đổi người dùng/khách sạn.

Không thêm dependency, migration hoặc biến môi trường. Không reset/seed, đặt lại mật khẩu hoặc thay cờ của tài khoản cũ trên database ứng dụng. Phase 5–6 chưa triển khai.

## 2. Cách ly cache và giao diện

- `hotelSession.ts` quản lý access token trong bộ nhớ, danh tính khách sạn/nhân viên và số phiên bản trạng thái. Danh tính bao gồm hotelId, staff ID, role và cờ bắt buộc đổi mật khẩu.
- Mỗi phiên bản dùng **một QueryClient riêng** cho toàn bộ nhánh route PMS. Các query key hiện có tiếp tục dùng được; cùng key `rooms`, `employees` hoặc `reports` của A và B nằm trong hai cache khác nhau.
- Khi bắt đầu login/logout, kết thúc phiên, nhận thay đổi từ tab khác hoặc phát hiện đổi danh tính/quyền khi refresh: hủy query cũ, xóa query/mutation cache, bỏ client cũ và tạo client mới. Đăng nhập lại cùng tài khoản cũng không tái sử dụng dữ liệu của phiên trước.
- `HotelSessionBoundary` tạo lại các trang/form/modal trong nhánh PMS theo phiên bản. Bộ lọc, dữ liệu chi tiết và form của A không tiếp tục nằm trên giao diện của B.
- Danh bạ nhân viên được xóa cùng thời điểm. Mọi nơi đăng ký nhân viên đã tải (danh bạ chung, nhân sự, buồng phòng, bảo trì) truyền phiên bản được giữ từ lúc component tạo; đăng ký từ component cũ bị bỏ qua.
- Cache của khu vực quản trị Innvyra và token/cookie nền tảng không bị xóa bởi logout nhân viên. QueryClient của PMS nằm trong boundary riêng, không dùng chung client nền tảng ở App.

## 3. Request, refresh và các tab

- Axios ghi phiên bản vào request một cách đồng bộ trước khi gửi. Response thành công và lỗi đều kiểm tra phiên bản. Nếu phiên đã đổi, response trở thành cancellation trước khi đến callback của trang hoặc được retry.
- Retry giữ nguyên phiên bản request gốc. Refresh nhận tài khoản/khách sạn/quyền khác sẽ xóa cache và cập nhật profile; thao tác ghi của danh tính cũ không được gửi lại dưới danh tính mới.
- Trong thời điểm thay danh tính, token cũ được bỏ trước khi thông báo reset cache. Component cũ không thể gửi token A nhưng bị đánh dấu nhầm là request mới của B. Request nghiệp vụ khi chưa có phiên bị hủy cục bộ; login/refresh vẫn hoạt động.
- Refresh trong cùng phiên/tab dùng chung một promise, kể cả StrictMode gọi khôi phục hai lần. Refresh đang chờ của phiên cũ không được dùng cho phiên mới. Phản hồi login/refresh/logout trễ không khôi phục hoặc điều hướng thay tài khoản mới.
- Web Locks tuần tự hóa login, refresh, logout và đổi mật khẩu giữa các tab cùng origin. Retry sau 401 thả lock trước khi refresh, tránh lock lồng nhau gây treo.
- BroadcastChannel `innvyra-hotel-session` chỉ gửi chuỗi `session-changed`, không gửi token, mật khẩu hoặc danh tính. Sau login thành công/logout/đổi mật khẩu, các tab PMS khác bỏ dữ liệu và quay về đăng nhập. Điều này tránh hai tab dùng hai danh tính khác nhau nhưng chia sẻ cookie refresh.
- Trình duyệt không hỗ trợ Web Locks vẫn gộp refresh trong từng tab; refresh đồng thời giữa các tab có thể dẫn đến yêu cầu đăng nhập lại do cơ chế phát hiện token cũ. Không bỏ cơ chế thu hồi phiên khi refresh token bị tái sử dụng.
- Lỗi mạng khi khôi phục có trạng thái thử lại, không giả lập đăng xuất thành công. Logout xóa cache ngay; nếu mạng lỗi thì giữ danh tính để người dùng thử lại, và tải dữ liệu lại từ server khi cần.
- 403 `PASSWORD_CHANGE_REQUIRED` cập nhật cờ, bỏ cache nghiệp vụ và đưa về form đổi mật khẩu. Đổi mật khẩu dùng cùng cơ chế kiểm tra phiên/lock/refresh; không retry credential dưới danh tính khác.

Không dùng localStorage hoặc sessionStorage cho token/dữ liệu phiên. Hủy request/cache không hoàn tác transaction đã được server chấp nhận; cơ chế này bảo vệ kết quả trên trình duyệt và ngăn retry chéo danh tính.

## 4. Chính sách mật khẩu nhân viên

- Tạo nhân viên qua API luôn đặt `mustChangePassword=true`, dù quản trị nhập hoặc giao diện sinh mật khẩu để bàn giao.
- Reset mật khẩu nhân viên, cả mật khẩu được cung cấp và mật khẩu do server sinh, đều đặt lại cờ và thu hồi mọi phiên của nhân viên đó trong transaction hiện có.
- Profile/list/reset response có cờ an toàn, không trả hash hoặc token. Request tạo/sửa không được tự đặt `mustChangePassword=false`.
- Nhân viên thuộc bất kỳ sáu role đều có thể đăng nhập bằng mật khẩu tạm, đọc tài khoản, refresh, logout và đổi mật khẩu; API nghiệp vụ vẫn chặn cho đến khi đổi thành công.
- Đổi mật khẩu kiểm tra mật khẩu hiện tại và chính sách mật khẩu mới, bỏ cờ và thu hồi phiên. Sau đó phải đăng nhập lại. Hash vừa bị reset không thể mở phiên login mới do tranh chấp xác minh/ghi session.
- Tài khoản đã có trước đây không bị ép đổi mật khẩu chỉ vì nâng cấp code. Không thay hash/cờ dữ liệu cũ trong đợt làm việc này. Bootstrap CLI dùng mật khẩu riêng do người vận hành tự đặt vẫn giữ chính sách trước đó.
- Thông báo trong form tạo/reset nhân viên nêu rõ người nhận phải đổi mật khẩu được cấp. Luồng reset từ nền tảng của Phase 4 tiếp tục hoạt động.

## 5. Kiểm chứng

Môi trường Windows, Node.js 24.11.0, MySQL 9.0.0. Dùng database test local riêng và database fixture tên ngẫu nhiên, không kiểm thử ghi trên database ứng dụng.

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend `npm test` | **37/37 đạt**: 23 test phiên/cache PMS mới và 14 test phiên nền tảng |
| Test mục tiêu nhân viên/unit/MySQL account lifecycle | **107/107 đạt**, 3 file |
| MySQL account lifecycle mới | **11/11 đạt**, gồm cả sáu role |
| Toàn bộ backend `npm run test:mysql` | **773/773 test, 29/29 file đạt**, không bỏ qua; 307.45 giây |
| Backend typecheck/lint/build | Đạt |
| Frontend build/lint | Đạt, không có cảnh báo lint mới |
| Prisma trên database test | Không có migration chờ hoặc khác biệt schema |

Test frontend dùng QueryClient thật và Axios adapter giả lập độ trễ/lỗi; kiểm tra cache query/mutation, danh bạ, đăng nhập lại cùng tài khoản, phản hồi/read/write/401/login/refresh/logout trễ, nhiều request hết phiên, mất mạng, thay danh tính/quyền, cập nhật yêu cầu đổi mật khẩu và tín hiệu giữa các tab. Bao gồm trường hợp thông báo reset cache đồng bộ làm component cũ cố gửi request và trường hợp logout trễ cố điều hướng sau khi B đăng nhập.

Test MySQL mới kiểm tra tài khoản cũ, cờ ở mọi role mới cấp, hoàn tất đổi mật khẩu, reset thủ công/tự sinh, thu hồi tất cả access/refresh, cấm sửa cờ qua body, chặn reset chéo khách sạn và từ chối login bằng hash cũ. Hai test RBAC nhân viên hiện có trước đó thất bại do fixture MANAGER mới tạo chưa đổi mật khẩu; fixture đã được định nghĩa rõ là nhân viên cũ đã kích hoạt, giữ nguyên kiểm tra quyền. Không bỏ qua kiểm tra mật khẩu trong production để làm test đạt.

Kiểm tra trình duyệt trên preview riêng:

1. Login A, vào trang nhân sự, thấy “Nhân viên riêng A”. Logout rồi login B trên cùng tab, mở nhân sự và chỉ thấy “Nhân viên riêng B”; tên A không có trên trang.
2. Reload trang nhân sự vẫn giữ đúng B và danh sách B.
3. Mở tab khác, đăng nhập tài khoản cần đổi mật khẩu: tab mới tới `/change-password`; tab B trước đó tự quay về `/login`, không tiếp tục hiển thị dữ liệu B.
4. Không có cảnh báo/lỗi console ở lượt kiểm tra danh sách B. Mô phỏng race/network và thay credential thành công được kiểm tra bằng native tests/API/MySQL; không đổi credential bằng thao tác trình duyệt trong lượt này.

Preview API/Vite dùng cổng riêng 3127/5177, đã dừng và dọn đúng database preview do fixture sở hữu. Ảnh `hotel-b-session.jpg` và log nằm trong `.tmp/multi-hotel-phase3/`, được Git ignore; dữ liệu tổng hợp, không phải nhân viên/khách sạn thật.

`python -m pip check` theo AGENTS ở thư mục cha không chạy được vì Windows alias `python.exe` không khả dụng; repo dùng Node.js, không thêm hoặc sửa môi trường Python.

## 6. Test thủ công và bước tiếp

Khởi động lại backend/frontend để dùng code mới. Không cần migration, seed hoặc cấu hình `.env` mới nếu database đã có schema Phase 1.

- Dùng hai tài khoản A/B của hai khách sạn local: mở phòng/nhân sự ở A, logout, login B, kiểm tra không còn dữ liệu/bộ lọc/form A; reload vẫn đúng B.
- Mở thêm tab và đăng nhập tài khoản khác: tab cũ phải bỏ dữ liệu và về login.
- Cấp/reset tài khoản nhân viên, bàn giao mật khẩu tạm; nhân viên phải đổi trước khi dùng PMS. Mật khẩu/phiên cũ mất hiệu lực sau reset.
- Đăng nhập tài khoản cũ không vừa bị cấp/reset: tiếp tục dùng username bình thường.

Sau nghiệm thu Phase 3, phần kế tiếp theo kế hoạch là Phase 5 (thuê bao/cảnh báo/tạm ngừng) và Phase 6 (kiểm thử tích hợp, hồi quy và hoàn thiện tính năng trên local/test). Theo cập nhật phạm vi ngày 12/11/2026, deploy tổng dự án và công việc production/sao lưu/khôi phục sẽ lập kế hoạch riêng sau. Không tự triển khai production, commit hoặc push khi chốt phase.
