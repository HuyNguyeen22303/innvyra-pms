# Vận hành Innvyra PMS đa khách sạn

Tài liệu này mô tả luồng đang dùng để tiếp nhận khách sạn, quản lý tài khoản và thuê bao, rồi kiểm tra cách ly dữ liệu.

## Dữ liệu và phạm vi khách sạn

- Các khách sạn dùng chung backend và schema MySQL. Bản ghi nghiệp vụ được phân phạm vi theo `hotelId`; phiên nhân viên xác định khách sạn và quyền cho từng request.
- Mã khách sạn định danh cơ sở. Các trường dùng lại giữa nhiều khách sạn, chẳng hạn số phòng và mã danh mục, được kiểm tra theo phạm vi tương ứng của schema. Tra khóa và quan hệ trong [Prisma schema](../backend/prisma/schema.prisma).
- Ngày vận hành, ngày đến/đi, kỳ báo cáo và thời hạn thuê bao lấy theo múi giờ IANA của từng khách sạn. Khi thử dữ liệu chéo, dùng khách sạn A và B có dữ liệu riêng.

## Hai khu vực đăng nhập

| Khu vực | Đường dẫn FE | Tài khoản |
| --- | --- | --- |
| PMS khách sạn | `/login` | Nhân viên đăng nhập bằng username và mật khẩu. |
| Quản trị Innvyra | `/platform/login` | Quản trị Platform đăng nhập bằng email và mật khẩu. |

Hai khu vực có phiên, refresh và phạm vi API riêng. Khi phiên khách sạn đổi hoặc bị thu hồi, frontend làm sạch cache theo phiên. Tài khoản được cấp hoặc reset mật khẩu tạm phải hoàn thành đổi mật khẩu trước khi mở nghiệp vụ.

## Tiếp nhận và bàn giao

1. Cấp quản trị Platform đầu tiên theo [hướng dẫn cấp tài khoản quản trị](CAI_DAT_VA_CHAY.md#cấp-tài-khoản-quản-trị). Bộ demo đã có tài khoản mẫu.
2. Mở **Gói dịch vụ** để tạo gói với đơn giá tháng và hạn mức phòng, tài khoản đang hoạt động.
3. Mở **Khách sạn → Thêm khách sạn**, nhập thông tin cơ sở, múi giờ, quản trị viên khách sạn và kỳ thuê bao. Backend tạo các bản ghi liên quan trong một transaction.
4. Bàn giao username và mật khẩu tạm cho quản trị viên khách sạn. Quản trị viên vào PMS, đổi mật khẩu và cấu hình cơ sở bằng các màn hình được cấp quyền.

## Thuê bao và trạng thái cơ sở

- Platform tạo gói, đăng ký, gia hạn và đổi gói trên hồ sơ khách sạn. Kỳ đã ghi nhận lưu snapshot đơn giá, số tháng, hạn mức và thành tiền tại thời điểm ghi. Sửa danh mục gói chỉ ảnh hưởng kỳ đăng ký sau đó.
- Ngày kết thúc được tính trọn ngày theo múi giờ của cơ sở. Kỳ mới không được giao với kỳ đã ghi nhận. Hạn mức dùng số phòng và nhân viên đang hoạt động; các thao tác tăng số lượng được backend kiểm tra trong cùng phạm vi khách sạn.
- ADMIN và MANAGER của cơ sở xem gói, mức sử dụng và lịch sử tại `/subscription`. Platform tạm ngừng và mở lại cơ sở bằng hai thao tác riêng có lý do. Khi cơ sở bị tạm ngừng, đường dẫn thuê bao vẫn dùng được cho các vai trò được cấp quyền.
- Các trường hợp gói cũ, kỳ tương lai và ngày quá hạn được mô tả trong [OpenAPI thuê bao](../backend/src/config/subscriptions.openapi.ts) và [module khách sạn](../backend/src/modules/hotels/).

## Demo và kiểm thử

Chuẩn bị dependencies ở cả `backend` và `frontend`, cùng cấu hình MySQL local theo [hướng dẫn database](DATABASE_MULTI_HOTEL_LOCAL.md). Chạy `npm run prisma:generate` nếu vừa clone. Các lệnh sau chạy từ `backend`.

| Lệnh | Mục đích |
| --- | --- |
| `npm run demo:phase6` | Tạo schema test tạm và chạy bộ demo A/B. Mở PMS hoặc Platform ở `http://127.0.0.1:5176`; API và Swagger dùng cổng `3136`. Lấy tài khoản giả từ manifest mà script báo ra. Dừng bằng `Ctrl+C` để script dọn schema do lượt demo tạo. |
| `npm run test:phase6` | Chạy nhóm test tích hợp đa khách sạn và kiểm tra an toàn trên MySQL local riêng. |
| `npm run test:mysql` | Chạy toàn bộ suite backend qua schema `_test` riêng. |

Khi nghiệm thu, thử thêm khách sạn và đổi mật khẩu, đổi gói và kiểm tra hạn mức, tạm ngừng rồi mở lại cơ sở. Dùng phiên khách sạn A thử truy cập bản ghi của B và đối chiếu giao diện sau khi đổi phiên. Dùng hồi quy một luồng đặt phòng hoặc báo cáo để kiểm tra dữ liệu còn nằm trong đúng cơ sở.

Tra hợp đồng API trong [OpenAPI Platform](../backend/src/config/platform.openapi.ts), [khách sạn](../backend/src/config/hotels.openapi.ts) và [thuê bao](../backend/src/config/subscriptions.openapi.ts).
