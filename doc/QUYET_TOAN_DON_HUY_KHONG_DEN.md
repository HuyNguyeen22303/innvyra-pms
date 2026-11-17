# Quyết toán đơn hủy và khách không đến

## Kế hoạch triển khai

1. Bổ sung đối soát folio `CANCELLED` / `NO_SHOW`: đọc toàn bộ số dư, khoản thu/hoàn,
   giao dịch chờ và lượt lưu trú; trả phiên bản đối soát để phát hiện dữ liệu thay đổi.
2. Người có quyền quyết toán nhập **tổng phí cuối cùng của toàn folio**, gồm phí
   hủy/không đến và mọi khoản khác đã thỏa thuận, cùng lý do và xác nhận đối soát.
   Không tự áp phí phạt hoặc tự miễn khoản phí dịch vụ.
3. Trong một transaction có khóa khách sạn, ghi thêm DEBIT/CREDIT bằng phần chênh
   lệch với phí hiện tại; giữ nguyên sổ cũ. Cho phép số dư âm thể hiện tiền cần hoàn.
   Không tạo giao dịch tiền giả. Lưu người thực hiện và lý do trong sổ/audit.
4. Nếu phí bằng tiền thực giữ thì đóng ngay. Nếu còn phải hoàn/thu, giữ folio mở,
   hướng nhân viên ghi nhận tiền thực tế rồi đóng. Refund vẫn liên kết phiếu thu gốc,
   giữ phương thức gốc, bắt buộc xác nhận và mã chuyển khoản đi khi cần.
5. Sửa điều kiện đóng: chấp nhận cả `CANCELLED` và `NO_SHOW`, số dư đúng 0,
   không có lưu trú đang hoạt động, dịch vụ REQUESTED hay payment PENDING.
6. Thêm giao diện đối soát, chỉ rõ số tiền cần hoàn/thu và quyền xử lý. Giữ khóa
   idempotency khi gửi lại; từ chối xác nhận dựa trên bản đối soát đã cũ.
7. Kiểm thử HTTP/MySQL: miễn phí, giữ cọc, hoàn một/nhiều phiếu, thu phần thiếu,
   số tiền lớn, thiếu quyền, khác khách sạn, giao dịch chờ, dữ liệu cũ và gửi đồng thời.
   Đối chiếu báo cáo thu/hoàn và tổng phí sau điều chỉnh.

## Phạm vi và dữ liệu

- Dùng sổ folio, payment, audit và idempotency hiện có; không cần đổi schema hay seed.
- Các folio đang mắc kẹt được quyết toán từ giao diện, không tự sửa lịch sử hoặc tiền cũ.
- ADMIN, MANAGER, ACCOUNTANT quyết toán/hoàn/đóng. RECEPTIONIST xem và thu tiền
  theo quyền hiện tại; việc miễn/giữ phí cần người có quyền quyết toán xác nhận.
- Folio mới cho đơn hủy/không đến bắt đầu không có phí phòng; người có quyền nhập
  phí thực tế qua đối soát. Folio đã mở trước đó vẫn giữ nguyên các dòng tiền phòng.
- Phí dự kiến của đơn đang xác nhận/lưu trú vẫn theo cơ chế hiện tại. Tách dự kiến
  khỏi ghi nhận phí lưu trú theo ngày là thay đổi tiếp theo, không nằm trong đợt này.
- Báo cáo tổng phí dùng DEBIT trừ CREDIT; tiền mặt/chuyển khoản chỉ thay đổi khi có
  payment/refund CONFIRMED. Điều chỉnh không được tính như một khoản thu/chi tiền.

## Cách sử dụng

1. Mở folio của đơn đã hủy/không đến, chọn **Quyết toán đơn hủy / Không đến**.
2. Kiểm tra phí và tiền đã thu/hoàn, nhập tổng phí giữ lại, lý do, xác nhận đối soát.
3. Lưu. Số dư 0 thì folio đóng; số dư âm là cần hoàn, số dư dương là còn phải thu.
4. Ghi nhận hoàn tiền từ từng phiếu thu hoặc thu thêm đúng tiền thực tế, sau đó đóng.

Chỉ cần cập nhật code và khởi động lại backend/frontend; không cần tạo DB mới.

## Kết quả kiểm tra ngày 17/11/2026

- Hồi quy toàn bộ backend/MySQL: 895 bài đạt trên DB `_test` riêng.
- Lượt xác minh cuối cho billing sau bổ sung quyền và xác nhận đối soát: 111 bài đạt,
  gồm 64 bài HTTP/MySQL và 47 bài validation/tiền tệ/hợp đồng API.
- Frontend: 57 bài đạt; lint, TypeScript và build đạt ở cả hai phía.
- Kiểm tra UI trên folio NO_SHOW hiện có: phí 0 hiển thị đóng sổ; phí 300.000đ
  hiển thị khoản còn phải thu. Chỉ xem bản đối soát, không xác nhận thay đổi đơn này.
- Kiểm tra diff đạt, không đổi schema, `.env`, seed hay dữ liệu tài chính đang dùng.
- `pip check` không thực thi được do WindowsApps Python alias; dự án dùng Node.js.
