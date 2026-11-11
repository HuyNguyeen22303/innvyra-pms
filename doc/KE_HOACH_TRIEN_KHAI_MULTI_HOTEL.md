# Kế hoạch triển khai Innvyra PMS đa khách sạn

Ngày lập: 11/11/2026.

## 1. Trạng thái và nguyên tắc thực hiện

- Nhánh làm việc: `feature/multi-hotel-saas`, tạo trực tiếp từ `develop` tại commit `48623cb`.
- Đã hoàn thành giai đoạn 1 và 2: nền dữ liệu, bootstrap, xác thực và giao diện quản trị Innvyra. Chỉ kiểm chứng trên database test riêng; chưa thay đổi database ứng dụng.
- Không commit, push hoặc merge nếu chưa được người dùng yêu cầu.
- Thực hiện từng giai đoạn, kiểm tra đạt tiêu chí nghiệm thu trước khi chuyển sang giai đoạn tiếp theo.
- Ghi nhận lỗi có sẵn trước khi sửa để phân biệt với lỗi do tính năng mới.
- Giữ nguyên dữ liệu, ID và lịch sử nghiệp vụ hiện có; không reset database.

## 2. Các quyết định sản phẩm đã thống nhất

- Innvyra vận hành ứng dụng và database; khách sạn nhận tài khoản để sử dụng.
- Nhiều khách sạn độc lập dùng chung ứng dụng và database MySQL, cách ly dữ liệu bằng `hotelId`.
- Một tài khoản nhân viên thuộc một khách sạn. Username và email tiếp tục duy nhất toàn hệ thống.
- Đăng nhập bằng username hoặc email; tài khoản cũ tiếp tục sử dụng được.
- `PLATFORM_ADMIN` là quản trị Innvyra, thuộc hệ thống tài khoản riêng, không gắn với khách sạn.
- `ADMIN` hiện tại là quản trị khách sạn; giữ nguyên sáu vai trò nhân viên.
- Quản trị Innvyra quản lý thông tin khách sạn, cấp/reset admin, thuê bao và khóa/mở; không mặc định truy cập nghiệp vụ của khách sạn.
- Tạo khách sạn qua giao diện sau tư vấn/thỏa thuận. Không cần tạo database riêng hoặc deploy lại khi thêm khách sạn.
- Mật khẩu tạm chỉ hiển thị khi cấp/reset; người nhận phải đổi trước khi dùng PMS.
- Bản đầu có một gói PMS đầy đủ, giá theo thỏa thuận. Ghi nhận thanh toán và gia hạn thủ công.
- Hợp đồng và thanh toán thực hiện bên ngoài ứng dụng; hệ thống lưu thông tin tham chiếu.
- Phí khách sạn trả cho Innvyra được quản lý riêng với thu ngân khách lưu trú.

## 3. Lộ trình thực hiện

| Giai đoạn | Kết quả cần có | Điều kiện chuyển bước |
| --- | --- | --- |
| 0. Chuẩn bị và lập kế hoạch | Nhánh từ `develop`, lộ trình và phạm vi rõ ràng | Chỉ có tài liệu kế hoạch; chưa thay đổi mã nguồn |
| 1. Xác lập hiện trạng và dữ liệu — hoàn thành | Schema, migration và báo cáo kiểm chứng | 713/713 test đạt; nâng cấp dữ liệu cũ và hồi quy PMS đã được kiểm chứng |
| 2. Quản trị Innvyra — hoàn thành | Bootstrap, xác thực riêng và giao diện nền tảng ban đầu | 744/744 test backend và 14/14 test frontend đạt; xác nhận hai hệ thống tài khoản không dùng chéo token hoặc quyền |
| 3. Tài khoản khách sạn và cache | Đăng nhập email, đổi mật khẩu bắt buộc, cache tách biệt | Tài khoản cũ hoạt động; không lộ dữ liệu giữa các phiên |
| 4. Tiếp nhận và thiết lập khách sạn | Tạo khách sạn/admin/kỳ sử dụng, quản lý thông tin | Tạo giao dịch nguyên vẹn; khách sạn A và B hoạt động độc lập |
| 5. Thuê bao và quyền sử dụng | Gia hạn, cảnh báo, khóa/mở và nhật ký | Đúng quy tắc hạn; khóa tác động cả phiên đang hoạt động |
| 6. Hồi quy và chuẩn bị triển khai | Bộ kiểm tra, tài liệu vận hành và bản thử nghiệm | Kiểm tra đạt; xác nhận khả năng sao lưu và khôi phục |

### Giai đoạn 0 — Chuẩn bị và lập kế hoạch

- [x] Kiểm tra trạng thái Git trước khi thay đổi nhánh.
- [x] Tạo nhánh mới trực tiếp từ `develop` theo yêu cầu.
- [x] Lưu kế hoạch triển khai từng bước.
- Giai đoạn 1 và 2 đã hoàn thành theo yêu cầu; các giai đoạn 3–6 vẫn là công việc dự kiến.

### Giai đoạn 1 — Xác lập hiện trạng và chuẩn bị dữ liệu

Trạng thái: **hoàn thành**. Chi tiết được ghi trong [báo cáo phase 1](PHASE_1_MULTI_HOTEL.md).

- Chạy các kiểm tra hiện có để lấy mốc đối chiếu: test, kiểm tra kiểu, lint và build của backend/frontend.
- Chạy kiểm thử MySQL trên database test riêng khi có môi trường phù hợp; ghi rõ phần không chạy được.
- Rà soát xác thực, phân quyền, truy vấn theo `hotelId`, cache và các script bootstrap hiện có.
- Thiết kế dữ liệu tài khoản/phiên nền tảng riêng, trạng thái khách sạn, cờ bắt buộc đổi mật khẩu, kỳ sử dụng và nhật ký quản trị.
- Tạo migration bổ sung, không đổi ID, không xóa dữ liệu hoặc đặt lại mật khẩu tài khoản cũ.
- Khách sạn hiện tại mặc định `ACTIVE`; tài khoản cũ mặc định không phải đổi mật khẩu.
- Khách sạn chưa có kỳ sử dụng được đánh dấu chưa thiết lập, không tự động bị khóa.
- Nghiệm thu: migration trên dữ liệu thử không làm mất dữ liệu và các luồng hiện tại vẫn chạy.

### Giai đoạn 2 — Tài khoản và khu vực quản trị Innvyra

Trạng thái: **hoàn thành**. Chi tiết, hướng dẫn bootstrap và kết quả kiểm tra được ghi trong [báo cáo phase 2](PHASE_2_PLATFORM_ADMIN.md). Các giai đoạn 3–6 chưa triển khai.

- Thêm lệnh `npm run create:platform-admin` để bootstrap quản trị Innvyra đầu tiên; không đưa mật khẩu cố định vào code hoặc seed.
- Tách tài khoản, session, refresh token, cookie và JWT audience của nền tảng với nhân viên khách sạn.
- Bổ sung đăng nhập, refresh, xem tài khoản, đổi mật khẩu và đăng xuất tại `/api/v1/platform/auth/*`.
- Dùng cơ chế kiểm tra quyền, giới hạn đăng nhập và CSRF tương ứng với hệ thống hiện có.
- Tạo trang `/platform/login`, layout và route bảo vệ riêng; có trạng thái tải, lỗi và hết phiên.
- Giữ nguyên phạm vi sáu role nhân viên; không cấp quyền nền tảng thông qua quản lý nhân viên.
- Nghiệm thu: token nền tảng không dùng được cho API PMS và token PMS không dùng được cho API nền tảng; tài khoản nền tảng không cần một khách sạn giả.

### Giai đoạn 3 — Tài khoản khách sạn và cách ly dữ liệu trên trình duyệt

- Mở rộng `/auth/login` nhận `identifier` là username hoặc email; giữ tương thích request `username` cũ, không nhận đồng thời hai trường.
- Bổ sung `mustChangePassword` trong thông tin người dùng và API `/api/v1/auth/change-password`.
- Chặn nghiệp vụ PMS tại backend cho đến khi tài khoản dùng mật khẩu tạm hoàn tất đổi mật khẩu.
- Đổi/reset mật khẩu thu hồi các phiên hiện có; thay đổi thành công yêu cầu đăng nhập lại.
- Áp dụng cờ đổi mật khẩu cho tài khoản được cấp mật khẩu tạm, gồm cả khi reset.
- Tách cache theo tài khoản/khách sạn; xóa cache và danh bạ nhân viên khi kết thúc phiên.
- Ngăn request của phiên cũ ghi kết quả vào giao diện hoặc danh bạ của phiên mới.
- Nghiệm thu: đăng nhập cũ và đăng nhập email đều hoạt động; đăng xuất A rồi đăng nhập B không thấy dữ liệu A; sửa giao diện không thể vượt yêu cầu đổi mật khẩu.

### Giai đoạn 4 — Tiếp nhận khách sạn và quản trị thông tin

- Tạo danh sách/tìm kiếm khách sạn và trang chi tiết trong khu vực quản trị Innvyra.
- Tạo khách sạn, admin đầu tiên và kỳ sử dụng trong một transaction; lỗi ở bất kỳ phần nào phải hoàn tác toàn bộ.
- Admin mới có họ tên, username và email bắt buộc; mật khẩu tạm do backend sinh, chỉ trả về khi tạo/reset và không lưu dạng rõ.
- Nhập mã, tên, múi giờ, địa chỉ, thông tin liên hệ và tham chiếu thỏa thuận của khách sạn.
- Không chạy seed demo để tiếp nhận khách sạn thương mại. Mất mật khẩu tạm thì reset, không có API đọc lại mật khẩu.
- Bổ sung `/api/v1/platform/hotels/*` cho quản lý khách sạn, cấp/reset admin và các thao tác nền tảng liên quan.
- Bổ sung `GET/PATCH /api/v1/hotel`; admin khách sạn chỉnh tên hiển thị, địa chỉ và thông tin liên hệ, không chỉnh mã hoặc quyền sử dụng.
- Bổ sung tóm tắt khách sạn vào thông tin người dùng; giao diện dùng tên thật thay cho tên cố định.
- Script bootstrap admin khách sạn hiện có kiểm tra theo từng `hotelId`, phân biệt với bootstrap nền tảng.
- Ghi nhật ký tạo/cập nhật khách sạn và reset admin ngay khi các thao tác này được triển khai.
- Nghiệm thu: tạo được A và B, mỗi bên có admin riêng; trùng mã/email/username được xử lý và không tạo dữ liệu dở dang; admin khách sạn chỉ tạo nhân viên của mình.

### Giai đoạn 5 — Thuê bao, cảnh báo và tạm ngừng

- Mỗi kỳ lưu ngày bắt đầu/kết thúc, tên gói, phí VND, tham chiếu thỏa thuận/thanh toán và người xác nhận; giữ lịch sử các kỳ.
- Ngày kết thúc bao gồm cả ngày đó, tính theo múi giờ khách sạn; ngày sử dụng được quản trị nhập theo thỏa thuận.
- Bổ sung `GET /api/v1/hotel/subscription` cho admin/quản lý xem gói, thời hạn và lịch sử.
- Hiện cảnh báo khi còn tối đa 14 ngày, tăng mức cảnh báo tại 7 và 1 ngày; quá hạn vẫn vận hành.
- Sau 7 ngày quá hạn, đánh dấu cần xử lý trên trang nền tảng; không tự khóa hoặc tự phát sinh công nợ.
- Quản trị Innvyra có thao tác tạm ngừng/mở lại riêng, bắt buộc lý do và có nhật ký; gia hạn không tự mở khách sạn đang tạm ngừng.
- Kiểm tra trạng thái khách sạn trên mọi API nghiệp vụ, kể cả token đã được cấp trước lúc khóa.
- Khi tạm ngừng, vẫn cho đăng nhập/xử lý tài khoản và xem thông báo, tình trạng thuê bao; chặn truy cập nghiệp vụ PMS, giữ nguyên dữ liệu.
- Bổ sung bộ lọc hoạt động/tạm ngừng/sắp hết hạn/quá hạn/chưa thiết lập và hoàn thiện lịch sử quản trị trên giao diện nền tảng.
- Nghiệm thu: đúng ranh giới ngày và quyền; admin khách sạn không tự đổi gói, thời hạn hoặc mở khóa; khóa/mở không làm thay đổi dữ liệu nghiệp vụ.

### Giai đoạn 6 — Hồi quy và chuẩn bị triển khai

- Kiểm tra xuyên suốt: bootstrap nền tảng → tạo A/B → bàn giao tài khoản → đổi mật khẩu → thiết lập → vận hành → gia hạn → khóa/mở.
- Kiểm tra cách ly dữ liệu đọc/ghi/xuất báo cáo ở mọi module; A/B được trùng số phòng hoặc mã loại phòng.
- Kiểm tra token dùng chéo, sửa ID, refresh/logout, phiên cũ sau reset và cache khi đổi tài khoản.
- Chạy toàn bộ test backend; kiểm thử MySQL trên database test riêng; kiểm tra kiểu, lint và build backend/frontend.
- Rà soát các luồng đặt phòng, nhận/trả phòng, thu ngân, nhân viên, buồng phòng, bảo trì, kho và báo cáo.
- Cập nhật OpenAPI, hướng dẫn bootstrap, bàn giao tài khoản, gia hạn, khóa/mở và xử lý lỗi.
- Chuẩn bị cấu hình production, sao lưu, thử khôi phục và quy trình triển khai migration trên môi trường thử nghiệm trước.
- Không tự áp dụng migration lên database vận hành hoặc deploy production trong giai đoạn lập kế hoạch này.

## 4. Quy tắc kiểm tra sau mỗi giai đoạn

- Báo phạm vi đã làm, phần chưa làm, file thay đổi và kết quả kiểm tra thực tế.
- Chạy kiểm tra phù hợp khi phát triển; cuối mỗi giai đoạn chạy bộ hồi quy bắt buộc của giai đoạn đó.
- Không coi kiểm thử MySQL bị bỏ qua là đã đạt; ghi rõ điều kiện cần bổ sung.
- Nếu có lỗi ảnh hưởng dữ liệu hoặc nghiệp vụ cũ, sửa và kiểm chứng trước khi chuyển bước.
- Việc nghiệm thu giai đoạn không tự động tạo commit hoặc cho phép push; chỉ thực hiện khi người dùng yêu cầu.

## 5. Chưa thực hiện trong phiên bản đầu

- Tự đăng ký khách sạn và thanh toán thuê bao trực tuyến.
- Email mời kích hoạt, ký hợp đồng điện tử và tự động xuất hóa đơn thuê bao.
- Phân quyền tính năng theo gói, tự thu phí hoặc tự gia hạn.
- Một tài khoản quản lý nhiều khách sạn, chuỗi và báo cáo tổng hợp nhiều cơ sở.
- Mỗi khách sạn một database hoặc hạ tầng riêng.
- Đăng nhập thay khách sạn hoặc cấp mặc định quyền xem dữ liệu nghiệp vụ cho quản trị Innvyra.
- Xóa dữ liệu tự động khi quá hạn hoặc tạm ngừng.
