# Đặt phòng, nhận cọc và tự mở folio

## Luồng lễ tân

1. Vào **Đặt phòng**, chọn ngày, số người và hạng phòng.
2. Tìm khách theo họ tên hoặc điện thoại. Kết quả lấy từ server, có tải thêm.
   Nếu chưa có, chọn **Thêm khách mới**, điền form đầy đủ và **Lưu và chọn khách**.
   Hồ sơ được lưu riêng, giữ lại cả khi sau đó bỏ tạo đơn. Hồ sơ nghi trùng được
   cảnh báo và gợi ý để kiểm tra; không tự gộp hoặc xóa.
3. Không có cọc: xác nhận tạo đơn, hệ thống chưa tự mở folio.
4. Có cọc: bật **Nhận cọc ngay**, nhập tiền/phương thức/mã chuyển khoản thực nhận,
   xác nhận tiền đã nhận và bấm **Tạo đặt phòng & nhận cọc**. Một lần xác nhận lưu
   cả đơn, giá phòng, folio và cọc. Bấm **Xem folio** từ thông báo thành công.
5. Đến ngày nhận phòng, vào **Lưu trú**, chọn phòng vật lý phù hợp và check-in.
   Hệ thống tự mở folio nếu chưa có hoặc dùng lại folio cũ. Đơn nhiều phòng dùng
   chung một folio, ghi tiền phòng toàn đơn một lần theo cơ chế hiện tại.
6. Hủy/không đến tiếp tục dùng luồng quyết toán đã có. Checkout vẫn là trả phòng
   vật lý; thu/hoàn và đóng folio được thực hiện qua Thu ngân.

## Tính nhất quán và lỗi

- Đơn + mở folio + cọc + audit + idempotency dùng chung hotel lock và transaction.
  Lỗi một bước rollback cả nhóm. Tạo hồ sơ khách là bước riêng đã xác nhận.
- Cọc là số đồng nguyên, không vượt phí phòng trên folio. Snapshot cũ có phần lẻ
  được làm tròn half-up từng đêm theo chính sách billing hiện có; giao diện ước tính
  theo cùng quy tắc và backend kiểm tra lại mức thực tế.
- Khi chưa rõ kết quả do mạng/server, form giữ lần xác nhận và khóa chỉnh sửa;
  **Kiểm tra kết quả / Thử lại** gửi lại nguyên yêu cầu và khóa cũ. Không tạo cọc mới.
- Lỗi tạo hồ sơ chưa rõ kết quả yêu cầu tìm lại hồ sơ trước khi tạo tiếp.
- Check-in thất bại không để lại folio mới, lượt lưu trú hoặc chiếm phòng dở dang.
  Folio đã đóng chặn nhận phòng để kiểm tra; không tự mở lại.
- Mọi lookup, khóa yêu cầu, folio và giao dịch thuộc khách sạn từ phiên đăng nhập.
  Kế toán chỉ tìm tên khách; không thể suy ra điện thoại từ kết quả hoặc số lượng.

## API và tương thích

- `GET /guests?search=...`: tên hoặc điện thoại cho ADMIN/MANAGER/RECEPTIONIST;
  ACCOUNTANT giữ tìm tên. Cùng bộ lọc cho danh sách và tổng số.
- `POST /guests`: dùng hợp đồng hiện có, trả cảnh báo nghi trùng dạng object.
- `POST /reservations`: thêm `initialDeposit?` gồm `amount`, `paymentMethod`,
  `referenceNumber?`, `confirmedReceived:true`. Header `Idempotency-Key` bắt buộc
  khi có cọc; giao diện luôn gửi khóa cả khi không cọc. Khách tích hợp cũ không cọc,
  không khóa vẫn được hỗ trợ. Trả thêm `folioId`, `initialPaymentId` (null nếu không cọc).
- Check-in giữ body/URL hiện tại, trả thêm `folioId`. Gửi lại check-in vẫn dùng quy
  tắc chống trùng hiện có, không tạo thêm phí. Mở folio thủ công vẫn được giữ.

## Dữ liệu và kiểm thử

Không đổi schema, không có migration, không tạo DB mới và không chạy seed lại trên
DB đang dùng. Không tự chuyển đổi, suy đoán tiền cọc hoặc xóa folio của dữ liệu cũ.
Seed v5 cho ba khách sạn dùng luồng tạo đơn có cọc, chưa cọc và check-in tự mở/dùng
lại folio; phiên bản mới chỉ áp dụng khi chủ động tạo bộ dữ liệu seed mới.

Kiểm thử cần đối chiếu rollback, gửi lặp/đồng thời, cọc đủ/một phần, chuyển khoản,
rounding, privacy và pagination khách, check-in nhiều phòng, báo cáo tiền thu,
dịch vụ, checkout và quyết toán đơn hủy/không đến. Dùng DB `_test` riêng.

## Kết quả xác minh ngày 17/11/2026

- Backend/MySQL: **918/918 bài đạt**, 38 file, bao gồm seed ba khách sạn và báo cáo.
- Nhóm kiểm tra trực tiếp booking/billing/check-in/lookup: 211 bài đạt trước hồi quy tổng thể.
- Frontend: **62/62 bài đạt**; lint, TypeScript và build hai phía đạt.
- Đã kiểm tra UI tìm/chọn khách, hồ sơ đầy đủ, validation, giữ bản nháp và cọc
  chuyển khoản trên trình duyệt. Không tạo đơn/cọc vào DB ứng dụng trong lần kiểm tra UI.
- Diff check đạt. `pip check` không chạy được do WindowsApps Python alias; dự án dùng Node.js.
