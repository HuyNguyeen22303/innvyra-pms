# Phase 2 — Tài khoản và khu vực quản trị Innvyra

Ngày hoàn thành: 11/11/2026.

## 1. Phạm vi đã thực hiện

Tiếp tục trên nhánh `feature/multi-hotel-saas`, từ mốc phase 1 `30b931d`. Phase này bổ sung tài khoản quản trị Innvyra đầu tiên, hệ thống xác thực riêng và giao diện đăng nhập/tổng quan/tài khoản.

- `PlatformAdmin` độc lập với `StaffUser`; không có `hotelId`, không tạo khách sạn giả và không thêm `PLATFORM_ADMIN` vào sáu role nhân viên.
- Dùng các bảng nền tảng đã tạo ở phase 1; không thêm migration hoặc thay schema trong phase 2.
- Chưa triển khai tiếp nhận khách sạn, cấp/reset admin khách sạn, thuê bao hoặc khóa/mở khách sạn. Các phần đó thuộc phase 3–5 của kế hoạch.
- Không thay `.env`, không áp dụng migration hoặc tạo quản trị trên database ứng dụng. Không commit, push hoặc merge.

## 2. Bootstrap quản trị đầu tiên

Lệnh chạy từ thư mục `backend`:

```powershell
npm run create:platform-admin
```

Đầu vào qua biến môi trường:

| Biến | Quy tắc |
| --- | --- |
| `DATABASE_URL` | Database đích đã được cấu hình; phải có migration nền tảng của phase 1 |
| `PLATFORM_ADMIN_EMAIL` | Email hợp lệ, tối đa 191 ký tự; được trim và chuyển chữ thường |
| `PLATFORM_ADMIN_FULL_NAME` | Họ tên không rỗng, tối đa 191 ký tự |
| `PLATFORM_ADMIN_PASSWORD` | 15–128 ký tự, ít nhất 15 ký tự sau khi bỏ khoảng trắng đầu/cuối và ít nhất 8 ký tự khác nhau; mật khẩu được giữ nguyên khi hash |

Ví dụ nhập mật khẩu ẩn trên PowerShell sau khi chọn đúng môi trường và database đích:

```powershell
$env:PLATFORM_ADMIN_EMAIL = 'admin@your-domain.example'
$env:PLATFORM_ADMIN_FULL_NAME = 'Quản trị Innvyra'
$platformPassword = Read-Host 'Mật khẩu quản trị Innvyra' -AsSecureString
try {
    $env:PLATFORM_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $platformPassword).Password
    npm run create:platform-admin
} finally {
    Remove-Item Env:PLATFORM_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $platformPassword.Dispose()
}
```

Không đặt mật khẩu vào tham số command line, source code, seed hoặc file được commit. Script chỉ in ID tài khoản đã tạo hoặc lỗi đã lọc; không in mật khẩu/hash/token. Mật khẩu được hash bằng Argon2 theo cơ chế hiện có.

Bootstrap chỉ dành cho **tài khoản nền tảng đầu tiên**: nếu đã có bất kỳ quản trị nền tảng nào, kể cả tài khoản ngừng hoạt động, lệnh từ chối. Tài khoản đầu tiên dành riêng ID `1` để hai lần bootstrap đồng thời không thể tạo hai quản trị; trường hợp này đã được kiểm tra bằng hai tiến trình CLI thật trên MySQL. Script không phụ thuộc seed role hoặc khách sạn. Chưa có luồng tự đăng ký hay khôi phục quản trị nền tảng.

Trước khi dùng code mới với database ứng dụng, cần triển khai migration `20261111000000_multi_hotel_foundation` theo quy trình phase 1. Lần làm việc này chưa thực hiện bước đó trên database ứng dụng.

## 3. API và cách ly xác thực

| Method | URL | Hành vi |
| --- | --- | --- |
| POST | `/api/v1/platform/auth/login` | Đăng nhập bằng email/mật khẩu nền tảng |
| POST | `/api/v1/platform/auth/refresh` | Xoay refresh token nền tảng, trả access token và profile hiện tại |
| GET | `/api/v1/platform/auth/me` | Đọc profile an toàn của quản trị đang đăng nhập |
| POST | `/api/v1/platform/auth/logout` | Thu hồi phiên nền tảng hiện tại và xóa cookie nền tảng |
| POST | `/api/v1/platform/auth/change-password` | Xác minh mật khẩu hiện tại, đổi mật khẩu và thu hồi tất cả phiên của quản trị đó |

Profile chỉ gồm `id`, `email`, `fullName`, `role: PLATFORM_ADMIN` và `isActive`. Không trả hash, refresh token, `hotelId` hoặc quyền nghiệp vụ PMS. Request không được tự chọn role/hotel.

- JWT nền tảng có audience `${JWT_AUDIENCE}:platform`; JWT nhân viên vẫn dùng audience hiện tại. Hai bên dùng cùng hạ tầng ký JWT nhưng kiểm tra audience độc lập, kể cả khi ID tài khoản và ID phiên trùng nhau.
- Middleware dùng `platformPrincipal` riêng và đọc lại trạng thái tài khoản/phiên trên mỗi request được bảo vệ. Tài khoản bị ngừng hoạt động, phiên hết hạn hoặc đã thu hồi không tiếp tục truy cập được.
- Cookie nền tảng tên `innvyra_platform_refresh`, `HttpOnly`, host-only, path `/api/v1/platform/auth`. Cookie nhân viên `innvyra_refresh` giữ nguyên path `/api/v1/auth`; đăng xuất/đổi mật khẩu nền tảng không xóa cookie hoặc thu hồi phiên khách sạn.
- Refresh token được hash trong database. Mỗi lần refresh xoay token, giữ hạn tuyệt đối của phiên; dùng lại token cũ thu hồi cả phiên đó.
- `PLATFORM_REFRESH_TOKEN_EXPIRES_IN_DAYS` mặc định `1`, cho phép từ `1` đến `7`. Access token dùng `JWT_ACCESS_EXPIRES_IN`, mặc định `15m`.
- Các POST yêu cầu `X-CSRF-Protection: 1`; Origin nếu có phải nằm trong danh sách tin cậy. Cookie tuân theo `COOKIE_SAME_SITE` và `COOKIE_SECURE`; cấu hình production yêu cầu HTTPS/Secure như xác thực hiện có.
- Giới hạn đăng nhập, refresh và đổi mật khẩu dùng các bộ đếm nền tảng riêng. Namespace nền tảng trả `Cache-Control: no-store` và không rơi xuống middleware nhân viên.
- Đổi mật khẩu kiểm tra hash cũ và cập nhật hash/thu hồi phiên trong cùng transaction. Login kiểm tra lại hash dưới khóa tài khoản để không mở phiên bằng mật khẩu vừa bị thay đổi. Refresh, logout và đổi mật khẩu đã được kiểm tra khi chạy đồng thời.

OpenAPI có tag, schemas và security schemes nền tảng riêng; tổng số operation hiện là 118.

## 4. Giao diện và trạng thái phiên trên trình duyệt

- `/platform/login`: đăng nhập quản trị Innvyra, có thông báo lỗi và liên kết về đăng nhập khách sạn.
- `/platform`: layout nền tảng, tổng quan tài khoản hiện tại và liên kết quản lý tài khoản.
- `/platform/account`: profile và form đổi mật khẩu hiện tại/mới/xác nhận. Đổi thành công yêu cầu đăng nhập lại trên mọi thiết bị.
- Có sidebar desktop, menu Drawer mobile, route bảo vệ, trạng thái tải, phục hồi phiên, lỗi kết nối có nút thử lại và trang không tìm thấy.

Nhánh route nền tảng được tải riêng và khởi tạo auth riêng; không tự refresh phiên nhân viên khi mở `/platform/*`. Axios client, Zustand store và access token trong bộ nhớ độc lập với PMS. Không lưu access token vào localStorage.

Các request refresh trong cùng tab dùng chung một promise. Trình duyệt có Web Locks tuần tự hóa các thao tác cookie nền tảng giữa các tab; BroadcastChannel chỉ truyền tín hiệu đăng xuất, không truyền token. Khi trình duyệt thiếu Web Locks, vẫn gộp refresh trong từng tab; nhiều tab có thể cần đăng nhập lại nếu refresh đụng cơ chế phát hiện token cũ. Production HTTPS hỗ trợ điều kiện dùng Web Locks.

Mỗi lần thay phiên tăng số phiên bản trạng thái để response cũ không khôi phục tài khoản đã đăng xuất hoặc ghi vào phiên mới. Nếu refresh nhận danh tính khác do một tab khác đăng nhập, giao diện cập nhật danh tính và không gửi lại thao tác ghi của tài khoản trước. Các form được tạo lại khi đổi danh tính. Logout lỗi mạng giữ phiên hiển thị để người dùng thử lại, không báo đăng xuất thành công khi chưa thu hồi được phiên.

## 5. Kiểm chứng

Môi trường kiểm tra: Windows, Node.js 24.11.0, MySQL 9.0.0. Chưa kiểm tra riêng trên MySQL 8 hoặc hosting production.

| Kiểm tra | Kết quả |
| --- | --- |
| Toàn bộ backend qua `npm run test:mysql` | **744/744 test, 27/27 file đạt**, không bỏ qua; 341.80 giây |
| Test mới xác thực HTTP | 21/21 đạt, đã nằm trong bộ hồi quy trên |
| Test mới MySQL nền tảng | 10/10 đạt, đã nằm trong bộ hồi quy trên |
| Frontend `npm test` | **14/14 đạt** |
| Backend typecheck, lint, build | Đạt |
| Frontend lint, build | Đạt |
| Prisma kiểm tra sau migrate trên database test | Không có migration chờ hoặc khác biệt schema |
| Git diff check | Đạt |

Test HTTP dùng Argon2/JWT/Express thật với repository bộ nhớ; test MySQL kiểm tra transaction và tranh chấp thật, bao gồm bootstrap CLI đồng thời. Fixtures cố tình cho hai hệ thống trùng ID để phát hiện chấp nhận token sai hệ thống. Các test cũng kiểm tra CSRF, cookie, rate limit, token replay, mật khẩu sai, tài khoản ngừng hoạt động, thu hồi phiên và không ảnh hưởng phiên khách sạn.

Test frontend chạy bằng Node test runner và Axios mock adapter, không thêm dependency. Kiểm tra gộp refresh, phản hồi trễ, StrictMode gọi khôi phục hai lần, lỗi mạng, retry, access token hết hạn khi logout, thay đổi danh tính và đổi mật khẩu. Đây là test quản lý phiên, không thay thế kiểm tra render trình duyệt.

Kiểm tra trình duyệt dùng ứng dụng thật với dữ liệu tổng hợp trên database tạm riêng:

1. Đăng nhập nền tảng, mở tổng quan/tài khoản; kiểm tra desktop 1280×800 và mobile khoảng 378 px, không tràn ngang.
2. Submit form đổi mật khẩu rỗng cho thông báo thiếu từng trường. Luồng đổi mật khẩu thành công được kiểm tra bằng API và test frontend; không đổi mật khẩu qua trình duyệt trong lần kiểm tra này.
3. Reload trang được bảo vệ khôi phục đúng phiên; mở menu mobile và điều hướng được.
4. Đăng nhập khách sạn ở tab khác, reload nền tảng vẫn đăng nhập được. Đăng xuất nền tảng rồi reload PMS vẫn còn phiên khách sạn.
5. Khi chỉ còn phiên khách sạn, truy cập `/platform/account` bị đưa về `/platform/login`.
6. Đăng nhập lại từ URL được bảo vệ quay về đúng trang tài khoản. Đã sửa cảnh báo Drawer dùng prop cũ và kiểm tra lại menu mobile.

Database cho bootstrap/concurrency/UI được tạo tên ngẫu nhiên, áp dụng migration rồi xóa đúng database do fixture sở hữu. Database ứng dụng không bị thay đổi. Preview API/Vite đã dừng và database preview đã được dọn. Ảnh kiểm chứng dùng dữ liệu tổng hợp, không phải tài khoản quản trị vận hành.

Log và ảnh nằm trong `.tmp/multi-hotel-phase2/`, được Git ignore. Lệnh `python -m pip check` theo hướng dẫn thư mục cha không chạy được vì Windows alias `python.exe` không khả dụng; repo dùng Node.js, không thêm hoặc sửa môi trường Python.

## 6. Bước tiếp theo

Phase 3: tài khoản nhân viên đăng nhập bằng username/email, bắt buộc đổi mật khẩu tạm ở backend và frontend, thu hồi phiên khi đổi/reset mật khẩu, cách ly cache và phản hồi giữa tài khoản/khách sạn. Chưa thực hiện phase 3 trong lần làm việc này. Việc hoàn thành phase 2 không tự tạo commit hoặc cho phép push.
