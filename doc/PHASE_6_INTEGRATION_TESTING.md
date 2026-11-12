# Phase 6 — Kiểm thử tích hợp đa khách sạn

Ngày hoàn thành: 12/11/2026. Nhánh: `feature/multi-hotel-saas`.

## 1. Phạm vi và kết quả

Đã bổ sung một bộ seed dùng lại được, chạy các luồng thật qua HTTP với toàn bộ Prisma repository và middleware của PMS. Không mock database trong kịch bản tích hợp này. Các fixture được tạo trong schema MySQL riêng, kiểm tra dữ liệu và tự dọn sau khi chạy.

- Toàn bộ backend: **836/836 test, 33 file đạt**, MySQL 9.0.0; 539.59 giây.
- Kiểm tra Phase 6 cuối cùng sau khi hoàn thiện seed/đối chiếu: **33/33 test đạt**, 2 file; 57.21 giây. Gồm 22 trường hợp tích hợp và 11 trường hợp chặn seed sai môi trường/đích.
- Kiểm tra riêng kho sau rà soát cuối: **36/36 test đạt**, 2 file; 5.91 giây. Typecheck, lint, build backend/frontend và kiểm tra định dạng/diff đều đạt.
- Frontend: **39/39 test đạt**, kiểm tra cách ly query/mutation/cache, phản hồi muộn, nhiều tab, refresh/logout, yêu cầu đổi mật khẩu và tạm ngừng.
- Kiểm tra trình duyệt: đăng nhập A, đối chiếu thu/dư nợ/tồn kho, đăng xuất rồi đăng nhập B trên cùng trình duyệt. B hiển thị số liệu và vật tư của B, không giữ cache A.
- Đã tái hiện và sửa hai lỗi kho, bổ sung kiểm tra rollback khi vượt giới hạn số tiền/tồn kho.

Đây là nghiệm thu tính năng trên local/test. Hosting, vận hành production và deploy tổng dự án vẫn thuộc kế hoạch riêng. Không tự commit/push, đổi `.env`, migration hoặc dữ liệu database ứng dụng.

## 2. Bộ dữ liệu chuẩn

Seed gồm **11 khách sạn, 3 gói mẫu**, hoàn toàn là dữ liệu giả. Không phải bảng giá kinh doanh mặc định của Innvyra.

Hai khách sạn chính:

| Thành phần | P6_A | P6_B |
| --- | --- | --- |
| Múi giờ | Asia/Ho_Chi_Minh | America/Los_Angeles |
| Tài khoản | Đủ 6 vai trò, 1 vô hiệu hóa, 1 cần đổi mật khẩu | Tương tự A, tài khoản riêng |
| Hạng phòng | STANDARD, SUITE | Trùng mã với A, ID riêng |
| Phòng | 101–104, 201–202 | Trùng số với A, ID riêng |
| Khách hàng | 2 khách giả có giấy tờ được mã hóa | 2 khách khác, được phép trùng số giấy tờ giữa hai khách sạn |
| Đặt phòng | Một đã trả phòng, một đang ở, một đặt trước, một đã hủy | Cùng cấu trúc, dữ liệu riêng |
| Thu ngân | Folio đã đóng/đủ tiền, folio mở/còn nợ; tiền mặt, chuyển khoản, đặt cọc | Số tiền khác để phát hiện cộng nhầm A/B |
| Dịch vụ | Một đơn hoàn tất, một đơn đang chờ | Cùng mã LAUNDRY, đơn và giá riêng |
| Buồng phòng | Lịch sử dọn/kiểm tra, nhiệm vụ PENDING, IN_PROGRESS, AWAITING_INSPECTION | Nhân viên và nhiệm vụ riêng |
| Bảo trì | Phiếu đang xử lý và block an toàn phòng 104 | Phiếu/block riêng |
| Kho | Danh mục, nhà cung cấp, nhập/xuất/kiểm kê và 3 biến động | Trùng mã vật tư/số phiếu, tồn kho riêng |

Các khách sạn phụ có kỳ còn 14/7/1/0 ngày, quá hạn 1/8 ngày, kỳ tương lai, đang tạm ngừng và khách sạn cũ chưa ghi nhận thuê bao.

Ngày được tính tương đối từ ngày local của từng khách sạn khi chạy; manifest demo ghi ngày mốc. Số tiền và số lượng đối chiếu được cố định. Kỳ lịch sử phục vụ cảnh báo được dựng riêng trong schema test, với ngày cộng tháng/số tháng/phí nhất quán; dữ liệu legacy chưa có kỳ cũng là fixture riêng. Các nghiệp vụ còn lại ưu tiên tạo qua API, gồm cả bàn giao/đổi mật khẩu, dọn phòng, nhận/trả phòng, thu tiền và nhập/xuất kho.

### Số liệu đối chiếu ngay sau seed

| Chỉ tiêu | P6_A | P6_B |
| --- | ---: | ---: |
| Phòng đang ở | 1 | 1 |
| Phí phòng đã ghi folio | 2.000.000,00 | 1.200.004,00 |
| Dịch vụ đã ghi folio | 50.000,00 | 30.000,00 |
| Đã thu, gồm đặt cọc | 1.150.000,00 | 680.002,00 |
| Dư nợ còn lại | 900.000,00 | 550.002,00 |
| Folio đã đóng, dư nợ 0 | 1.050.000,00 | 630.002,00 |
| Tồn vật tư TOWEL | 85,00 | 34,00 |

Giá đêm lưu snapshot lần lượt 500.000,25 và 300.000,50. Thu ngân hiện có quy tắc làm tròn từng đêm sang đồng VND trước khi ghi folio, nên phí phòng trên bảng khác tổng snapshot chưa làm tròn. Phí thuê bao Innvyra được kiểm tra riêng và không cộng vào doanh thu/thu tiền khách lưu trú. Đơn dịch vụ đang chờ chưa phát sinh phí.

## 3. Chạy kiểm thử tự động

Tại thư mục `backend`, với MySQL local và dependencies đã cài:

```powershell
npm run test:phase6
```

Lệnh dùng `DATABASE_URL` local hiện có để lấy thông tin kết nối, hoặc dùng `TEST_DATABASE_URL` nếu đã cấu hình. Nó tạo/migrate database kiểm thử riêng và tạo thêm schema có UUID cho kịch bản. Không reset hay seed database ứng dụng. Không cần thêm biến `.env` cho Phase 6 khi đã có kết nối local như các phase trước.

Chạy hồi quy toàn bộ:

```powershell
npm run test:mysql
npm run typecheck
npm run lint
npm run build
```

Ở `frontend`:

```powershell
npm test
npm run lint
npm run build
```

Các kiểm tra tích hợp bao gồm:

- Bootstrap nền tảng → tạo gói → onboarding A/B → cấp nhân viên → đổi mật khẩu → các nghiệp vụ PMS.
- Cách ly đọc theo ID, danh sách, tìm kiếm và CSV; chặn tham chiếu/sửa ID thuộc khách sạn khác tại các module, kể cả phân công buồng phòng và chứng từ kho.
- Phân quyền đủ sáu vai trò; token khác realm, CSRF, tài khoản inactive/tạm; admin khách sạn không tự sửa thuê bao/trạng thái nền tảng.
- Đối chiếu folio/thu tiền/báo cáo/tồn kho với số cố định; mã phòng/hạng/dịch vụ/vật tư/số phiếu trùng giữa A/B.
- Cảnh báo thời hạn, kỳ tương lai/legacy, gia hạn và snapshot giá/hạn mức; sửa danh mục không sửa kỳ cũ.
- Tạm ngừng chặn phiên cũ ở các module; account/refresh/thuê bao vẫn dùng theo quyền. Gia hạn không tự mở lại, mở lại không đổi kỳ hoặc ảnh hưởng B.
- Reset/đổi mật khẩu thu hồi access/refresh cũ; logout sau refresh; không ảnh hưởng phiên khách sạn khác.
- Tạo phòng/nhân viên đồng thời vượt hạn mức, hạ gói dưới mức đang dùng; giữ nguyên dữ liệu.
- Tranh chấp phòng cuối, retry thanh toán cùng idempotency key, xuất kho đồng thời; không bán vượt phòng, thu tiền hai lần hoặc âm kho.
- Độ chính xác số lượng/giá, làm tròn dòng chứng từ, giới hạn tổng phí/tồn kho và rollback nguyên transaction.

## 4. Chạy demo có giao diện và database mới

Đã có dependencies ở cả `backend` và `frontend`, chạy tại `backend`:

```powershell
npm run demo:phase6
```

Chờ seed hoàn tất và terminal hiển thị địa chỉ:

- PMS: `http://127.0.0.1:5176/login`.
- Nền tảng: `http://127.0.0.1:5176/platform/login`.
- API/Swagger: `http://127.0.0.1:3136/api-docs`.

Demo tự tạo schema `innvyra_phase_six_<UUID>_test`, seed, mở API và Vite bằng cấu hình tạm trong tiến trình. Không phải database đang dùng ở cổng ứng dụng của bạn; không cần đổi `.env`. Nếu cổng 3136/5176 đang bị chiếm, demo sẽ báo lỗi và dọn schema của chính nó.

Các tài khoản giả đã kích hoạt dùng mật khẩu **`Phase6 verified hotel access 2026!`**:

| Vai trò | Khách sạn A | Khách sạn B |
| --- | --- | --- |
| ADMIN | p6_a_admin | p6_b_admin |
| MANAGER | p6_a_manager | p6_b_manager |
| RECEPTIONIST | p6_a_receptionist | p6_b_receptionist |
| HOUSEKEEPING | p6_a_housekeeping | p6_b_housekeeping |
| ACCOUNTANT | p6_a_accountant | p6_b_accountant |
| TECHNICIAN | p6_a_technician | p6_b_technician |

Nền tảng: `phase6.owner@example.test`, cùng mật khẩu demo ở trên.

Tài khoản `p6_a_temporary` / `p6_b_temporary` dùng **`Phase6 initial varied password 2026!`**, phải đổi mật khẩu trước khi vận hành. Tài khoản `p6_a_inactive` / `p6_b_inactive` cố ý không đăng nhập được. Đây đều là thông tin đăng nhập giả dành riêng demo, không dùng cho tài khoản thật.

`backend/.tmp/phase6-demo/manifest.json` ghi tên schema, ngày mốc, tài khoản và kết quả mong đợi. Không ghi access/refresh token, mật khẩu tạm ngẫu nhiên hoặc thông tin kết nối database.

**Demo là dữ liệu dùng thử:** nhấn Ctrl+C để dừng và xóa schema do lần chạy này tạo, gồm cả những thay đổi bạn tự thử trong demo. Có thể dùng stop file mà terminal in ra để dừng có dọn dẹp. Chạy lại lệnh sẽ tạo bộ dữ liệu mới. Nếu dừng trong lúc seed, tiến trình sẽ hoàn tất bước đang khởi tạo rồi dọn schema. Schema ứng dụng không nằm trong danh sách dọn.

Luồng kiểm tra thủ công gợi ý:

1. Đăng nhập A, kiểm tra dashboard theo bảng số liệu; mở Kho → Vật tư, xác nhận TOWEL = 85.
2. Đăng xuất, đăng nhập B trên cùng trình duyệt: dashboard và kho đổi sang số liệu B, TOWEL = 34, không còn tên khách/nhân viên A.
3. Đăng nhập HOUSEKEEPING, mở nhiệm vụ được phân công; MANAGER kiểm tra các nhiệm vụ chờ duyệt. TECHNICIAN chỉ dùng nghiệp vụ được cấp quyền.
4. Đăng nhập nền tảng, xem các khách sạn có thời hạn khác nhau, thử bộ lọc và trạng thái chưa thiết lập.
5. Mở PMS A ở tab khác; từ nền tảng tạm ngừng A, ghi lý do. Làm mới nghiệp vụ A phải bị chặn; B vẫn dùng được. Thử gia hạn rồi mở lại riêng.
6. Dùng khách sạn mới trong demo để thử gói/hạn mức hoặc thanh toán; đối chiếu lại số dư sau thao tác. Các số trong bảng chỉ là trạng thái ban đầu của seed.

## 5. Lỗi đã sửa

### Số lượng kho có độ chính xác cao hơn database

Trước sửa, nhập số lượng `0.001` được trả 201; database làm tròn về `0.00` nhưng service đã tính bằng giá trị khác. Hiện input số lượng, đơn giá, tồn kiểm kê và định mức phải nằm trong giới hạn 12 chữ số nguyên, tối đa 2 chữ số thập phân. Số lượng giao dịch phải lớn hơn 0. Giá trị không hợp lệ trả 422 trước khi ghi chứng từ/biến động.

### Tổng phiếu nhập lệch tổng dòng đã lưu

Hai dòng `1.25 × 0.10` trước đây lưu từng dòng `0.13` nhưng tổng phiếu `0.25`. Hiện làm tròn từng dòng theo half up tại hai chữ số trước khi cộng tổng, nên tổng phiếu là `0.26`, khớp các dòng đã lưu. Có kiểm tra giới hạn từng dòng, tổng phiếu và tồn sau nhập; vượt giới hạn trả 422, rollback cả chứng từ và biến động.

Các dữ liệu đã có không bị tính lại hoặc sửa tự động. Không thay quy tắc thu ngân VND của khách lưu trú. OpenAPI đã cập nhật hợp đồng input kho.

## 6. An toàn và bằng chứng

- Helper tạo schema UUID phải có `NODE_ENV=test`, kết nối loopback, database nguồn có hậu tố `_test`, khác database ứng dụng. Chỉ dọn schema có UUID mà chính lời gọi đã tạo thành công.
- Seed kiểm tra thêm pattern `phase_six`, xác minh `SELECT DATABASE()` khớp đích thực tế và từ chối database có khách sạn/tài khoản nền tảng; không có reset/delete dữ liệu để seed lại.
- Log lỗi seed chỉ có route, status và mã lỗi, không dump response đăng nhập chứa token/mật khẩu.
- Helper dùng chung tại `scripts/testing/isolated-mysql.ts`; file `tests/isolated-mysql.ts` giữ export tương thích cho các bộ test cũ.
- Log `.tmp/multi-hotel-phase6/before-inventory-fix.log` ghi hai lỗi đã tái hiện; `full-mysql.log` và `final-scenario.log` ghi kết quả đạt (đều Git ignore).
- Ảnh trình duyệt: `.tmp/multi-hotel-phase6/hotel-a-dashboard.jpg`, `hotel-b-dashboard.jpg` (Git ignore).
- Agent đã dừng demo sau kiểm tra và xác minh bằng metadata MySQL rằng schema demo không còn tồn tại. Manifest demo đã chuyển sang trạng thái disposed; có thể chạy lại lệnh để xem dữ liệu mới.
- Đã thử `python -m pip check` theo AGENTS.md: Windows Python alias không chạy được. Dự án dùng Node; không thay môi trường Python.

Không commit/push/deploy, không thay `.env`, dependency/lockfile hoặc migration trong Phase 6 này.
