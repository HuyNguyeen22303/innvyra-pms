# QR nhận cọc và thanh toán

QR được tạo trên backend bằng `vietqr@1.2.0`, không cần API key, không gọi dịch vụ tạo ảnh. Mỗi khách sạn có một tài khoản nhận tiền. Chưa có webhook hoặc tự xác nhận tiền về.

## Cấu hình

Đăng nhập **ADMIN khách sạn → Thông tin khách sạn → Tài khoản nhận chuyển khoản**. Chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản, bật nhận QR rồi lưu. Tên được chuẩn hóa in hoa không dấu; hệ thống chưa xác minh tên với ngân hàng. Kiểm tra người thụ hưởng trên ứng dụng ngân hàng trước khi sử dụng thực tế.

Các khách sạn trong seed mặc định chưa cấu hình tài khoản. Không dùng tài khoản ngân hàng bịa trong seed để nhận tiền. ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT có quyền sử dụng QR; chỉ ADMIN khách sạn được sửa tài khoản. Platform admin không cấu hình tài khoản thay khách sạn trong đợt này.

Thay đổi hoặc tắt cấu hình hủy các yêu cầu QR đang chờ. QR đã tải/chụp vẫn có thể dùng chuyển khoản ngoài hệ thống; nếu khách đã chuyển theo QR cũ, phải kiểm tra tiền thực nhận và ghi nhận/hoàn tiền bằng nghiệp vụ hiện có.

## Đặt phòng và nhận cọc

1. Chọn khách và phòng như hiện tại.
2. Bật **Nhận cọc ngay**, nhập số tiền, chọn **Chuyển khoản → Hiển thị QR để khách chuyển**.
3. Bấm **Tạo đặt phòng & hiển thị QR**. Đơn được lưu và giữ phòng trước. Tạo QR chưa mở folio, chưa ghi thu tiền.
4. Khách quét QR; ngân hàng điền tài khoản, số tiền và nội dung dạng `INN` + 16 ký tự.
5. Nhân viên kiểm tra tiền vào tài khoản, nhập **mã giao dịch ngân hàng thực tế**, xác nhận đã nhận đủ tiền rồi bấm **Xác nhận nhận cọc**.
6. Hệ thống mở hoặc dùng lại folio và ghi một khoản cọc. Check-in tiếp tục dùng folio đó.

**Nội dung chuyển khoản trên QR khác mã giao dịch ngân hàng.** Không lấy nội dung QR điền vào ô mã giao dịch chỉ để vượt validation.

Xác nhận QR từ chối mã giao dịch ngân hàng đã được ghi nhận trong khách sạn, kể cả đã thu qua thao tác thủ công. Kiểm tra lịch sử thay vì tạo thêm khoản thu cho cùng giao dịch.

Không cọc: chỉ tạo đơn. Cọc tiền mặt hoặc chuyển khoản đã nhận: giữ luồng xác nhận hiện có. Một đơn nhiều phòng vẫn dùng một folio.

Đóng cửa sổ QR không hủy đơn. Mở **Chi tiết đơn → Nhận chuyển khoản QR / Lịch sử QR** để tiếp tục. Nếu đơn đã tạo nhưng tạo ảnh QR lỗi, thử lại QR trên đơn đó; không tạo đơn khác. Không có tác vụ tự hủy đơn chỉ vì khách chưa chuyển tiền.

## Thu tiền trong folio

Mở folio, chọn **Nhận chuyển khoản QR**, nhập loại thu và số tiền. Xác nhận khi tiền thực tế đã về. Các thao tác tiền mặt, chuyển khoản thủ công, điều chỉnh và hoàn tiền tiếp tục sử dụng như trước.

Mỗi đơn chỉ có một yêu cầu đang chờ. Cùng loại/số tiền dùng lại yêu cầu đó; muốn thay đổi phải hủy có lý do rồi tạo mới. Số tiền thực nhận khác QR hoặc khách dùng QR đã hủy: đối soát và ghi nhận số tiền thực tế qua luồng thủ công, không tự sửa yêu cầu QR cũ.

QR hỗ trợ số đồng nguyên từ 1 đến 9.999.999.999.999đ. Không có bộ đếm hết hạn. Trước khi ghi tiền, backend kiểm tra lại công nợ và trạng thái. Đơn hủy/NO_SHOW hủy yêu cầu cọc; đóng folio hủy yêu cầu còn chờ. Báo cáo chỉ tính khoản thu đã xác nhận.

## Khi pull code về

Với DB `innvyra` đã có lịch sử migration (bao gồm bản multi-hotel):

```powershell
cd backend
npm ci
npm run prisma:generate
npm run db:migrate
npm run dev
```

Frontend chạy theo cách hiện tại (`cd frontend`, `npm ci` nếu chưa cài, `npm run dev`). Restart backend sau khi cài dependency, generate và migrate. Không cần thêm biến môi trường cho VietQR.

Migration chỉ thêm hai bảng cấu hình và yêu cầu thu, không sửa khoản tiền, folio hoặc đơn cũ. Không tạo DB ứng dụng mới, không chạy lại seed và không dùng `migrate reset`. DB đời cũ chưa multi-hotel phải làm quy trình chuyển sang multi-hotel trong README trước.

## Kiểm thử

Test backend dùng DB `_test` riêng qua `npm run test:mysql`. Có kiểm thử giải mã ảnh PNG thật, CRC, số tiền lớn, phân quyền, tenant, idempotency, hai kết nối đồng thời, rollback khi ghi tiền/audit/idempotency lỗi, đổi tài khoản, hủy đơn và đóng folio. Seed checker kiểm tra liên kết yêu cầu QR với khoản thu và mỗi đơn chỉ có một yêu cầu chờ.

Kết quả ngày 17/11/2026:

- Toàn bộ backend: 935/935 bài trong 39 file, DB `innvyra_pms_operations_phase7_test`.
- Sau bổ sung chặn mã ngân hàng trùng: chạy lại nhóm billing/QR, 101/101 bài.
- Frontend: 63/63 bài; backend typecheck/lint/build và frontend lint/build đều đạt; Git diff check đạt.
- DB `innvyra` đã áp dụng migration; kiểm tra 112 khóa ngoại và 28 quy tắc nghiệp vụ không có vi phạm. Không chạy seed lại hoặc sửa dữ liệu giao dịch đang dùng.
- Kiểm tra giao diện cấu hình, validation bắt buộc, lựa chọn QR khi đặt phòng và cửa sổ QR trên desktop/mobile. Chưa cấu hình tài khoản ngân hàng thật hoặc thử chuyển tiền thật.
- `pip check` không chạy được do Python WindowsApps alias trên máy; dự án sử dụng Node.js.
