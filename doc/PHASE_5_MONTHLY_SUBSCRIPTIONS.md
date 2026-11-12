# Phase 5 — Gói thuê bao theo tháng

Ngày thực hiện: 12/11/2026. Nhánh: `feature/multi-hotel-saas`.

## Phạm vi đã triển khai

- Quản trị Innvyra tạo/sửa danh mục tại `/platform/plans`: mã, tên, mô tả, giá tháng VND, hạn mức phòng/tài khoản hoạt động và trạng thái nhận đăng ký. Mã gói giữ nguyên sau khi tạo. Ngừng nhận đăng ký không ảnh hưởng các kỳ đã bán.
- Các gói dùng cùng nghiệp vụ PMS hiện có. Giá, tên, số gói và hạn mức do quản trị cấu hình; migration không seed bảng giá hoặc các mức minh họa.
- Chọn gói và số tháng khi tiếp nhận khách sạn. Khách sạn đã có dùng nút **Đăng ký / gia hạn / đổi gói** trong trang chi tiết.
- Mỗi kỳ lưu riêng tên gói, đơn giá, số tháng, hạn mức, thành tiền, ngày hiệu lực, tham chiếu thỏa thuận/thanh toán, ghi chú và người ghi nhận. Phí bằng đơn giá tháng × số tháng, tính bằng decimal tại backend. Sửa danh mục không thay đổi lịch sử hoặc hạn mức kỳ cũ.
- Đổi gói áp dụng từ một kỳ mới, có ngày hiệu lực và lý do trong nhật ký. Không ghi đè, sửa hoặc xóa kỳ đã ghi nhận; chưa hỗ trợ đổi giữa kỳ, phân bổ phí hoặc hoàn tiền.
- Thêm lọc khách sạn theo trạng thái hoạt động và thời hạn: còn hạn trên 14 ngày, sắp hết hạn, quá hạn, chưa bắt đầu, chưa ghi nhận kỳ.
- ADMIN/MANAGER khách sạn đọc gói, số lượng đang dùng và lịch sử tại `/subscription`. PMS hiển thị cảnh báo thời hạn; nhân viên không được sửa giá/gói/kỳ hoặc tự mở khóa.
- Tạm ngừng/mở lại bằng thao tác riêng của quản trị Innvyra, bắt buộc lý do và ghi nhật ký. Gia hạn không tự mở khách sạn đang tạm ngừng.
- Khi tạm ngừng, chặn các API nghiệp vụ bằng trạng thái mới nhất từ database, kể cả token cấp trước đó. Vẫn cho đăng nhập, refresh, đổi mật khẩu, đăng xuất và đọc thuê bao theo vai trò. Frontend xóa cache nghiệp vụ và chuyển sang thông báo khi nhận lỗi tạm ngừng.

## Quy tắc thời hạn và hạn mức

1. Ngày tính theo múi giờ của từng khách sạn. Ngày kết thúc được sử dụng trọn ngày; ngày hôm sau mới quá hạn. Ngày bắt đầu kỳ mới từ hôm nay trở đi và không được trùng bất kỳ kỳ đã ghi nhận nào.
2. Cộng số tháng vào ngày bắt đầu; nếu ngày đó không có trong tháng đích thì lấy ngày cuối tháng đích. Ngày kết thúc bao gồm bằng kết quả đó trừ một ngày. Ví dụ: `12/11/2026 + 1 tháng` sử dụng đến hết `11/12/2026`; `31/01/2026 + 1 tháng` đến hết `27/02/2026`; năm nhuận 2028 đến hết `28/02/2028`.
3. Gia hạn bắt đầu ngày sau ngày kết thúc kỳ trước; nếu đã quá hạn thì mặc định từ hôm nay. Mỗi kỳ cộng tháng từ chính ngày bắt đầu của kỳ đó, không giữ ngày neo thanh toán của hợp đồng đầu tiên. Cho phép khoảng trống giữa các kỳ; không tự tính nợ cho các ngày trống.
4. Tối đa 120 tháng mỗi kỳ. Tổng phí phải nằm trong giới hạn decimal của database. Không nhập trực tiếp đơn giá, thành tiền hoặc hạn mức qua API ghi kỳ tháng.
5. Cảnh báo tại các mốc còn tối đa 14, 7 và 1 ngày; ngày cuối cùng còn 0 ngày vẫn dùng được. Quá hạn trên 7 ngày có nhãn cần theo dõi trên chi tiết thuê bao. Không có job tự khóa, thu tiền, gia hạn hoặc tạo công nợ.
6. Chỉ đếm phòng `isActive=true` và nhân viên `isActive=true`, gồm cả ADMIN khách sạn. Không dựa vào trạng thái có khách, dọn phòng hay bảo trì để tính hạn mức.
7. Kiểm tra khi tạo/kích hoạt lại phòng, tạo/kích hoạt lại nhân viên, cấp thêm ADMIN và bootstrap ADMIN bằng CLI. Ghi kỳ mới kiểm tra hạn mức so với số đang sử dụng. Các thay đổi tăng số lượng và ghi kỳ cùng giữ khóa hàng khách sạn để tránh vượt hạn mức do thao tác đồng thời.
8. Hạn mức lấy từ kỳ đã bắt đầu gần nhất, kể cả khi kỳ đó đã hết hạn; gói tương lai chưa áp sớm. Nếu số lượng tăng trước ngày một gói nhỏ hơn có hiệu lực, giữ nguyên dữ liệu và chặn tăng thêm khi vượt hạn mức; giao diện cảnh báo để quản trị xử lý.
9. Kỳ tự nhập từ Phase 4 được giữ nguyên, các cột snapshot mới là `NULL` và không tự áp hạn mức. Khách sạn chưa có kỳ cũng tiếp tục dùng như trước. Để chuyển khách sạn có kỳ cũ còn hạn sang gói tháng, ghi một kỳ mới sau ngày kết thúc kỳ cũ.

## Cách tự kiểm tra trên local

Không cần thêm biến `.env` cho Phase 5. Dùng cấu hình database và tài khoản nền tảng hiện có.

Agent chỉ áp migration và ghi dữ liệu trên database test riêng. Trước khi dùng bản code mới trên database local của bạn, chạy tại thư mục `backend`:

```powershell
npm run db:migrate
```

Sau đó khởi động lại backend/frontend bằng cách đang dùng của dự án.

1. Đăng nhập `/platform/login` bằng tài khoản Innvyra hiện có; mở **Gói dịch vụ**, tạo ít nhất một gói với giá và hạn mức bạn muốn. Tạo gói khác để thử đổi gói. Không cần sửa database trực tiếp.
2. **Khách sạn → Thêm khách sạn**: chọn gói, ngày bắt đầu và số tháng. Kiểm tra phí/kỳ trong chi tiết sau khi tạo. Bàn giao mật khẩu tạm và đổi mật khẩu bằng luồng Phase 3 trước khi vào PMS.
3. Tạo phòng/nhân viên đến hạn mức. Lượt tạo hoặc kích hoạt lại tiếp theo phải báo đạt hạn mức. Ngừng một đối tượng rồi thử lại; không xóa dữ liệu để giảm số lượng.
4. Trong chi tiết khách sạn, **Đăng ký / gia hạn / đổi gói**: chọn ngày sau kỳ đang có, số tháng và lý do. Kiểm tra kỳ tiếp theo, đơn giá/thành tiền và nhật ký. Chọn ngày bị trùng phải báo lỗi.
5. Sửa giá/tên/hạn mức trong danh mục. Kỳ đã ghi nhận vẫn giữ thông tin cũ; kỳ đăng ký tiếp theo dùng cấu hình mới. Gói ngừng nhận đăng ký không còn trong lựa chọn kỳ mới.
6. Mở PMS của khách sạn ở tab khác. Từ nền tảng, **Tạm ngừng khách sạn**, nhập lý do. Gọi/làm mới nghiệp vụ trên tab PMS: phải chuyển về trang thông báo. ADMIN/MANAGER vẫn đọc được thuê bao; vai trò khác chỉ xem thông báo và thao tác tài khoản.
7. Ghi gia hạn khi đang tạm ngừng: nghiệp vụ vẫn bị chặn. **Mở lại khách sạn** với lý do; ở tab PMS chọn **Kiểm tra lại trạng thái**, sau đó **Về PMS**. Ngày thuê bao không bị thay đổi bởi thao tác mở lại.
8. Kiểm tra khách sạn B vẫn dùng dữ liệu/phiên riêng khi A bị tạm ngừng. Để thử các mốc thời hạn đã qua, dùng fixtures hoặc database test riêng; không sửa ngày/dữ liệu vận hành để tạo tình huống test.

## API và dữ liệu

- `GET/POST /api/v1/platform/plans`, `PATCH /api/v1/platform/plans/:id`.
- `GET /api/v1/platform/hotels/:id/subscription`.
- `POST /api/v1/platform/hotels/:id/subscription-periods`.
- `PATCH /api/v1/platform/hotels/:id/status`.
- `GET /api/v1/hotel/subscription` — ADMIN/MANAGER, hotelId lấy từ phiên đăng nhập.
- `POST /api/v1/platform/hotels` nhận kỳ tháng bằng `{ planId, startsOn, monthCount, reason, ...thamChiếu }`. Input kỳ tự nhập Phase 4 được giữ để tương thích; giao diện tiếp nhận mới dùng danh mục gói.
- Migration bổ sung `subscription_plans`, `subscription_plan_audits` và các cột snapshot nullable trên `hotel_subscription_periods`. Không backfill, thay ID, sửa kỳ cũ hoặc tạo tài khoản/gói mặc định. Có FK/CHECK bảo vệ tham chiếu, giá và snapshot.
- API thuê bao trả tối đa 100 kỳ gần nhất; nhật ký khách sạn tối đa 50 bản ghi gần nhất. Database giữ toàn bộ lịch sử; chưa có trang phân trang cho các kỳ cũ hơn.
- OpenAPI mô tả 134 thao tác, giữ hai realm tài khoản riêng. Nhật ký catalog không gắn một hotelId giả; nhật ký thuê bao/tạm ngừng vẫn thuộc đúng khách sạn.

## Kiểm chứng

- Toàn bộ backend: **803/803 test, 31 file đạt** trên MySQL 9.0.0, 473.56 giây. Migration trên database test khớp schema Prisma.
- Rà soát cuối: **176/176 test đạt**, 6 file, 97.30 giây; kiểm chứng lại nâng cấp có kỳ Phase 4, hạn mức khi quá hạn, bộ lọc và hợp đồng OpenAPI.
- Frontend: **39/39 test đạt**, gồm nhận lỗi tạm ngừng/xóa cache và bỏ qua phản hồi cũ sau khi mở lại phiên.
- Typecheck, lint và build backend/frontend đạt. `git diff --check` đạt.
- Kiểm tra trình duyệt trên API/Vite và schema tổng hợp riêng: sửa giá danh mục, giữ phí kỳ cũ, gia hạn/đổi gói hai tháng, lịch sử và audit, cảnh báo trong PMS, tạm ngừng phiên đang mở, xem thuê bao khi bị tạm ngừng. Bố cục 390px không tràn ngang toàn trang; bảng lịch sử cuộn trong vùng riêng.
- Ảnh dữ liệu mẫu: `.tmp/multi-hotel-phase5/plans.jpg`, `.tmp/multi-hotel-phase5/subscription.jpg` (Git ignore). Server xem thử đã dừng và schema tạm đã được dọn.
- Đã thử `python -m pip check` theo AGENTS.md; Windows Python alias không chạy được. Dự án dùng Node; không cài hay thay môi trường Python.
- Log hồi quy: `.tmp/multi-hotel-phase5/full-mysql.log`; log kiểm tra phần rà soát cuối: `.tmp/multi-hotel-phase5/final-targeted.log` (Git ignore).

Chưa commit/push/deploy; không thay `.env`, dependency/lockfile hoặc database ứng dụng. Phase 6 tiếp tục nghiệm thu tích hợp trên local/test; hosting và triển khai tổng dự án vẫn nằm trong kế hoạch riêng sau.
