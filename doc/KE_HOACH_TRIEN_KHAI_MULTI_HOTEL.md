# Kế hoạch triển khai Innvyra PMS đa khách sạn

Ngày lập: 11/11/2026.
Cập nhật trạng thái: 12/11/2026.

## 1. Trạng thái và nguyên tắc thực hiện

- Nhánh làm việc: `feature/multi-hotel-saas`, tạo trực tiếp từ `develop` tại commit `48623cb`.
- Đã hoàn thành giai đoạn 1–6. Giai đoạn 4 được triển khai trước, sau đó hoàn thiện giai đoạn 3 vào 12/11/2026 với mật khẩu tạm và cách ly phiên/cache. Đợt này giữ đăng nhập nhân viên bằng username; hỗ trợ email để sau.
- Các lượt kiểm chứng của agent dùng database test riêng; không reset, seed hoặc tạo khách sạn trên database ứng dụng.
- Lộ trình này tập trung bổ sung và kiểm thử tính năng đa khách sạn. Phase 6 nghiệm thu tính năng trên môi trường phát triển/test; triển khai tổng dự án lên hosting/production sẽ có kế hoạch riêng sau khi dự án sẵn sàng.
- Không commit, push hoặc merge nếu chưa được người dùng yêu cầu.
- Thực hiện từng giai đoạn, kiểm tra đạt tiêu chí nghiệm thu trước khi chuyển sang giai đoạn tiếp theo.
- Ghi nhận lỗi có sẵn trước khi sửa để phân biệt với lỗi do tính năng mới.
- Giữ nguyên dữ liệu, ID và lịch sử nghiệp vụ hiện có; không reset database.

## 2. Các quyết định sản phẩm đã thống nhất

- Innvyra vận hành ứng dụng và database; khách sạn nhận tài khoản để sử dụng.
- Nhiều khách sạn độc lập dùng chung ứng dụng và database MySQL, cách ly dữ liệu bằng `hotelId`.
- Một tài khoản nhân viên thuộc một khách sạn. Username và email tiếp tục duy nhất toàn hệ thống.
- Phiên bản hiện tại đăng nhập khách sạn bằng username + mật khẩu; tài khoản cũ tiếp tục sử dụng được. Hỗ trợ thêm email cho nhân viên được để sau theo phạm vi triển khai đã trao đổi khi chốt phase 3. Quản trị Innvyra vẫn đăng nhập bằng email riêng.
- `PLATFORM_ADMIN` là quản trị Innvyra, thuộc hệ thống tài khoản riêng, không gắn với khách sạn.
- `ADMIN` hiện tại là quản trị khách sạn; giữ nguyên sáu vai trò nhân viên.
- Quản trị Innvyra quản lý thông tin khách sạn, cấp/reset admin, thuê bao và khóa/mở; không mặc định truy cập nghiệp vụ của khách sạn.
- Tạo khách sạn qua giao diện sau tư vấn/thỏa thuận. Không cần tạo database riêng hoặc deploy lại khi thêm khách sạn.
- Mật khẩu tạm chỉ hiển thị khi cấp/reset; người nhận phải đổi trước khi dùng PMS.
- Cập nhật 12/11/2026: chuyển từ một gói PMS sang **nhiều gói thuê bao, tính phí theo tháng**. Ghi nhận thanh toán và gia hạn thủ công. Phase 5 dùng cùng bộ nghiệp vụ PMS, khác hạn mức phòng/tài khoản hoạt động. Quản trị Innvyra tự cấu hình tên, giá và hạn mức; không seed các mức minh họa.
- Hợp đồng và thanh toán thực hiện bên ngoài ứng dụng; hệ thống lưu thông tin tham chiếu.
- Phí khách sạn trả cho Innvyra được quản lý riêng với thu ngân khách lưu trú.

## 3. Lộ trình thực hiện

| Giai đoạn | Kết quả cần có | Điều kiện chuyển bước |
| --- | --- | --- |
| 0. Chuẩn bị và lập kế hoạch | Nhánh từ `develop`, lộ trình và phạm vi rõ ràng | Chỉ có tài liệu kế hoạch; chưa thay đổi mã nguồn |
| 1. Xác lập hiện trạng và dữ liệu — hoàn thành | Schema, migration và báo cáo kiểm chứng | 713/713 test đạt; nâng cấp dữ liệu cũ và hồi quy PMS đã được kiểm chứng |
| 2. Quản trị Innvyra — hoàn thành | Bootstrap, xác thực riêng và giao diện nền tảng ban đầu | 744/744 test backend và 14/14 test frontend đạt; xác nhận hai hệ thống tài khoản không dùng chéo token hoặc quyền |
| 3. Tài khoản khách sạn và cache — hoàn thành | Giữ username, hoàn thiện mật khẩu tạm và cache/phiên tách biệt | 773/773 test backend, 37/37 test frontend đạt; kiểm chứng chuyển A/B và nhiều tab bằng trình duyệt |
| 4. Tiếp nhận và thiết lập khách sạn — hoàn thành | Tạo khách sạn/admin/kỳ sử dụng, quản lý thông tin | 762/762 test backend và 14/14 test frontend đạt; kiểm chứng giao diện và A/B trên database test riêng |
| 5. Gói thuê bao theo tháng và quyền sử dụng — hoàn thành | Danh mục nhiều gói, chọn/gia hạn theo tháng, cảnh báo, khóa/mở và nhật ký | 803/803 test backend, 39/39 test frontend đạt; giữ lịch sử, hạn mức và khóa cả phiên đang hoạt động |
| 6. Kiểm thử và hoàn thiện tính năng đa khách sạn — hoàn thành | Luồng tích hợp, bộ hồi quy, sửa lỗi và hướng dẫn test local | 836/836 test backend, 39/39 test frontend đạt; seed/demo riêng, đối chiếu A/B và sửa lỗi kho; chưa deploy tổng dự án |

### Giai đoạn 0 — Chuẩn bị và lập kế hoạch

- [x] Kiểm tra trạng thái Git trước khi thay đổi nhánh.
- [x] Tạo nhánh mới trực tiếp từ `develop` theo yêu cầu.
- [x] Lưu kế hoạch triển khai từng bước.
- Giai đoạn 1–6 đã hoàn thành theo yêu cầu; kiểm thử Phase 6 trên local/test, chưa deploy tổng dự án.

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

Trạng thái: **hoàn thành**. Chi tiết, hướng dẫn bootstrap và kết quả kiểm tra được ghi trong [báo cáo phase 2](PHASE_2_PLATFORM_ADMIN.md).

- Thêm lệnh `npm run create:platform-admin` để bootstrap quản trị Innvyra đầu tiên; không đưa mật khẩu cố định vào code hoặc seed.
- Tách tài khoản, session, refresh token, cookie và JWT audience của nền tảng với nhân viên khách sạn.
- Bổ sung đăng nhập, refresh, xem tài khoản, đổi mật khẩu và đăng xuất tại `/api/v1/platform/auth/*`.
- Dùng cơ chế kiểm tra quyền, giới hạn đăng nhập và CSRF tương ứng với hệ thống hiện có.
- Tạo trang `/platform/login`, layout và route bảo vệ riêng; có trạng thái tải, lỗi và hết phiên.
- Giữ nguyên phạm vi sáu role nhân viên; không cấp quyền nền tảng thông qua quản lý nhân viên.
- Nghiệm thu: token nền tảng không dùng được cho API PMS và token PMS không dùng được cho API nền tảng; tài khoản nền tảng không cần một khách sạn giả.

### Giai đoạn 3 — Tài khoản khách sạn và cách ly dữ liệu trên trình duyệt

Trạng thái: **hoàn thành** ngày 12/11/2026. Chi tiết ở [báo cáo phase 3](PHASE_3_HOTEL_SESSIONS.md). Giữ username + mật khẩu cho nhân viên trong đợt này; tính năng email tùy chọn được để sau.

- Giữ `/auth/login` nhận `username` + mật khẩu; không thêm `identifier`/email trong phạm vi nghiệm thu lần này. Không thay đổi tài khoản hoặc mật khẩu cũ chỉ vì nâng cấp code.
- Bổ sung `mustChangePassword` trong thông tin người dùng và API `/api/v1/auth/change-password`.
- Chặn nghiệp vụ PMS tại backend cho đến khi tài khoản dùng mật khẩu tạm hoàn tất đổi mật khẩu.
- Đổi/reset mật khẩu thu hồi các phiên hiện có; thay đổi thành công yêu cầu đăng nhập lại.
- Áp dụng cờ đổi mật khẩu cho tài khoản được cấp mật khẩu tạm, gồm cả khi reset.
- Tách cache theo tài khoản/khách sạn; xóa cache và danh bạ nhân viên khi kết thúc phiên.
- Ngăn request của phiên cũ ghi kết quả vào giao diện hoặc danh bạ của phiên mới.
- Nghiệm thu: đăng nhập username cũ hoạt động; đăng xuất A rồi đăng nhập B không thấy dữ liệu/cache/form/danh bạ A; phản hồi phiên cũ không tác động phiên mới; sửa giao diện không vượt được yêu cầu đổi mật khẩu. Login/logout/đổi mật khẩu ở một tab làm các tab PMS khác bỏ phiên và dữ liệu cũ.

### Giai đoạn 4 — Tiếp nhận khách sạn và quản trị thông tin

Trạng thái: **hoàn thành** theo yêu cầu triển khai trước phần còn lại của phase 3. Chi tiết và cách test trong [báo cáo phase 4](PHASE_4_HOTEL_ONBOARDING.md). Phase 3 đã được hoàn thiện sau đó vào 12/11/2026; kiểm thử tích hợp tính năng ở phase 6 chưa thực hiện. Deploy tổng dự án nằm ngoài lộ trình hiện tại.

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

### Giai đoạn 5 — Gói thuê bao theo tháng, cảnh báo và tạm ngừng

Đã thống nhất hướng **nhiều gói khác nhau và tính theo tháng**, thay cho phạm vi một gói trước đó. Đã triển khai ngày 12/11/2026. Chi tiết, giới hạn và cách test: [PHASE_5_MONTHLY_SUBSCRIPTIONS.md](./PHASE_5_MONTHLY_SUBSCRIPTIONS.md).

Các gói dùng cùng bộ nghiệp vụ PMS hiện có, khác hạn mức phòng/tài khoản hoạt động. Danh mục do quản trị Innvyra cấu hình, không cố định số gói hoặc seed các mức giá/hạn mức minh họa. Chưa phân quyền module theo gói.

- Bổ sung danh mục gói do quản trị Innvyra tạo/cập nhật: mã, tên, mô tả, giá tháng VND và trạng thái cho phép đăng ký. Mỗi gói có hạn mức phòng và tài khoản hoạt động. Gói đã được dùng giữ lịch sử, không xóa làm mất tham chiếu kỳ cũ.
- Chọn gói khi tiếp nhận khách sạn hoặc thiết lập thuê bao cho khách sạn đã có; gia hạn theo số tháng. Quản trị Innvyra ghi nhận số tiền và tham chiếu thanh toán đã thỏa thuận.
- Mỗi kỳ lưu ngày bắt đầu/kết thúc, gói được chọn, tên gói/giá tháng tại thời điểm ghi nhận, số tháng, phí VND, tham chiếu thỏa thuận/thanh toán và người xác nhận. Thay giá/tên gói trong danh mục không sửa các kỳ đã ghi nhận.
- Thiết kế và kiểm thử quy tắc cộng tháng, tháng ngắn, năm nhuận, ngày bắt đầu/kết thúc trước khi nghiệm thu. Giữ tiền bằng decimal và hiển thị rõ số tháng/đơn giá/thành tiền.
- Khi thay đổi gói phải xác định thời điểm áp dụng và ghi nhật ký; không âm thầm áp giá/quyền mới lên kỳ cũ. Kiểm tra hạn mức theo số lượng đang sử dụng khi chuyển gói và tại các API tạo/kích hoạt tương ứng; không tự xóa dữ liệu để ép về hạn mức.
- Giữ dữ liệu kỳ sử dụng tự nhập ở phase 4; khách sạn cũ chưa chọn gói không tự bị khóa hoặc mất dữ liệu do nâng cấp schema.
- Ngày kết thúc bao gồm cả ngày đó, tính theo múi giờ khách sạn; ngày sử dụng được quản trị nhập theo thỏa thuận.
- Bổ sung `GET /api/v1/hotel/subscription` cho admin/quản lý xem gói, thời hạn và lịch sử.
- Hiện cảnh báo khi còn tối đa 14 ngày, tăng mức cảnh báo tại 7 và 1 ngày; quá hạn vẫn vận hành.
- Sau 7 ngày quá hạn, đánh dấu cần xử lý trên trang nền tảng; không tự khóa hoặc tự phát sinh công nợ.
- Quản trị Innvyra có thao tác tạm ngừng/mở lại riêng, bắt buộc lý do và có nhật ký; gia hạn không tự mở khách sạn đang tạm ngừng.
- Kiểm tra trạng thái khách sạn trên mọi API nghiệp vụ, kể cả token đã được cấp trước lúc khóa.
- Khi tạm ngừng, vẫn cho đăng nhập/xử lý tài khoản và xem thông báo, tình trạng thuê bao; chặn truy cập nghiệp vụ PMS, giữ nguyên dữ liệu.
- Bổ sung bộ lọc hoạt động/tạm ngừng/sắp hết hạn/quá hạn/chưa thiết lập và hoàn thiện lịch sử quản trị trên giao diện nền tảng.
- Nghiệm thu: chọn/gia hạn đúng gói, đơn giá, số tháng và thành tiền; lịch sử không đổi khi sửa danh mục. Đúng ranh giới tháng/ngày và quyền; admin khách sạn không tự đổi gói, thời hạn hoặc mở khóa; khóa/mở không làm thay đổi dữ liệu nghiệp vụ. Đã kiểm tra hạn mức phòng/tài khoản; lịch sử kỳ cũ không đổi và không tự áp hạn mức cho kỳ chưa gán gói.

### Giai đoạn 6 — Kiểm thử và hoàn thiện tính năng đa khách sạn

Trạng thái: **hoàn thành ngày 12/11/2026**. Bộ seed, kết quả nghiệm thu, lỗi đã sửa và cách chạy lại: [PHASE_6_INTEGRATION_TESTING.md](./PHASE_6_INTEGRATION_TESTING.md).

Thực hiện trên môi trường phát triển/test. Mục tiêu là nghiệm thu phần tính năng đa khách sạn, thuê bao và quyền sử dụng đã bổ sung; không đánh dấu toàn bộ dự án đã sẵn sàng vận hành production.

- Kiểm tra xuyên suốt: bootstrap nền tảng → tạo gói tháng → tạo A/B/chọn gói → bàn giao tài khoản → đổi mật khẩu → vận hành → gia hạn/đổi gói → khóa/mở.
- Kiểm tra cách ly dữ liệu đọc/ghi/xuất báo cáo ở mọi module; A/B được trùng số phòng hoặc mã loại phòng.
- Kiểm tra token dùng chéo, sửa ID, refresh/logout, phiên cũ sau reset và cache khi đổi tài khoản.
- Kiểm tra danh mục gói, giá theo tháng, các trường hợp ranh giới tháng, lịch sử giá/gói và hạn mức hoặc quyền theo gói đã được chốt.
- Chạy toàn bộ test backend; kiểm thử MySQL trên database test riêng; kiểm tra kiểu, lint và build backend/frontend.
- Rà soát các luồng đặt phòng, nhận/trả phòng, thu ngân, nhân viên, buồng phòng, bảo trì, kho và báo cáo.
- Sửa các lỗi phát hiện trong phạm vi tính năng và kiểm tra lại các trường hợp lỗi, tranh chấp, dữ liệu trùng hoặc thiếu thiết lập.
- Cập nhật OpenAPI, hướng dẫn bootstrap, bàn giao tài khoản, gia hạn, khóa/mở, xử lý lỗi và các bước test thủ công trên local.
- Chuẩn bị dữ liệu mẫu riêng cho demo/test A/B; không dùng dữ liệu vận hành để kiểm thử ghi.
- Nghiệm thu: luồng tích hợp hoạt động đúng, dữ liệu/quyền/cache A/B được cách ly, các kiểm tra bắt buộc đạt và nghiệp vụ cũ không bị ảnh hưởng.
- Cấu hình hosting/production, triển khai migration production, sao lưu/khôi phục phục vụ vận hành và deploy tổng dự án sẽ được lập kế hoạch riêng sau; không phải điều kiện hoàn tất phase 6 hiện tại.

## 4. Quy tắc kiểm tra sau mỗi giai đoạn

- Báo phạm vi đã làm, phần chưa làm, file thay đổi và kết quả kiểm tra thực tế.
- Chạy kiểm tra phù hợp khi phát triển; cuối mỗi giai đoạn chạy bộ hồi quy bắt buộc của giai đoạn đó.
- Không coi kiểm thử MySQL bị bỏ qua là đã đạt; ghi rõ điều kiện cần bổ sung.
- Nếu có lỗi ảnh hưởng dữ liệu hoặc nghiệp vụ cũ, sửa và kiểm chứng trước khi chuyển bước.
- Việc nghiệm thu giai đoạn không tự động tạo commit hoặc cho phép push; chỉ thực hiện khi người dùng yêu cầu.

## 5. Chưa thực hiện trong phiên bản đầu

- Tự đăng ký khách sạn và thanh toán thuê bao trực tuyến.
- Email mời kích hoạt, ký hợp đồng điện tử và tự động xuất hóa đơn thuê bao.
- Tự thu phí hoặc tự gia hạn. Phân quyền module theo gói nằm ngoài Phase 5 hiện tại.
- Một tài khoản quản lý nhiều khách sạn, chuỗi và báo cáo tổng hợp nhiều cơ sở.
- Mỗi khách sạn một database hoặc hạ tầng riêng.
- Đăng nhập thay khách sạn hoặc cấp mặc định quyền xem dữ liệu nghiệp vụ cho quản trị Innvyra.
- Xóa dữ liệu tự động khi quá hạn hoặc tạm ngừng.

## 6. Triển khai tổng dự án — lập kế hoạch riêng sau

Khi người dùng xác định toàn bộ dự án đã sẵn sàng, sẽ lập kế hoạch riêng cho hosting/database production, cấu hình môi trường và tên miền/HTTPS, migration, sao lưu/khôi phục và quy trình phát hành. Hoàn thành lộ trình tính năng phase 0–6 hiện tại không tự cho phép deploy hoặc áp dụng thay đổi lên database production.
