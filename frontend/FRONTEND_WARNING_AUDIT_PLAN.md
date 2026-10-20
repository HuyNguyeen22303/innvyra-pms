# Kế hoạch rà soát và xử lý warning toàn frontend

## Mục tiêu

Rà soát có hệ thống toàn bộ frontend để xác định và xử lý warning do mã ứng dụng hoặc dependency trực tiếp tạo ra; bảo đảm luồng nghiệp vụ không đổi sau mỗi đợt sửa. Không nâng phiên bản thư viện theo kiểu đồng loạt và không xem mọi dòng trong Console là warning thư viện.

## Phạm vi hiện tại

Frontend có các module/thư mục chính:

1. `auth` — đăng nhập và xác thực.
2. `dashboard` — trang tổng quan.
3. `calendar` — lịch vận hành.
4. `reservations` — đặt phòng.
5. `stays` — lưu trú, nhận phòng, trả phòng và đổi phòng.
6. `rooms` — phòng vật lý.
7. `room-types` — hạng phòng.
8. `housekeeping` — buồng phòng.
9. `maintenance` — bảo trì và khóa phòng.
10. `services` — danh mục dịch vụ và yêu cầu dịch vụ.
11. `billing` — hóa đơn/Folio.
12. `guests` — hồ sơ khách.
13. `employees` — nhân viên và tài khoản.
14. `inventory` — vật tư, nhà cung cấp, nhập/xuất và kiểm kê.
15. `reports` — báo cáo.
16. `common` — thành phần dùng chung; ngoài ra cần rà shell/providers trong `App.tsx`, router, layout và các API/hooks dùng chung.

Các phiên bản khai báo trong `frontend/package.json` tại thời điểm lập kế hoạch: Ant Design `^6.6.6`, React/React DOM `^19.2.8`, React Router `^7.18.4`, TanStack Query `^5.104.3`, Vite `^8.3.0`, TypeScript `~6.0.2`, Oxlint `^1.81.0`. Đây là thông tin để kiểm kê; tự nó không chứng minh thư viện cũ hoặc có lỗi.

## Quy ước phân loại log

Mỗi log phải được xếp vào một nhóm trước khi sửa:

| Nhóm | Ví dụ | Hướng xử lý |
|---|---|---|
| API deprecated của thư viện | Ant Design báo `direction` deprecated | Đổi sang API được khuyến nghị tương thích với phiên bản đang cài; rà toàn repository để tìm các chỗ cùng mẫu. |
| Cách dùng context/API sai | Gọi `message.*` tĩnh khi ứng dụng cần theme/context | Dùng API theo context/provider hiện có; kiểm tra mọi đường gọi thông báo. |
| React/runtime | Key thiếu, cập nhật state sai thời điểm, hook sai quy tắc | Sửa nguyên nhân tại component/hook; không che log bằng filter. |
| Dependency/toolchain | Peer dependency không khớp, warning từ Vite/TypeScript/Oxlint | Xác định package phát ra log, kiểm tra tương thích và changelog trước khi nâng phiên bản. |
| Lỗi request/authorization | `401`, `403`, `404`, `5xx`, request lặp hoặc thất bại | Phân loại là lỗi API/luồng quyền, không phải warning thư viện; lần theo route, role và request key. |
| Thông báo môi trường | React DevTools, extension Chrome, browser issue | Ghi nhận là ngoài mã ứng dụng nếu chứng minh được nguồn; không thay đổi dependency để loại bỏ. |

Không dùng `console.warn` override, bộ lọc Console, suppression comment hoặc cấu hình ẩn warning để đạt tiêu chí sạch.

## Phase 0 — Lập baseline và truy nguồn log

### Việc cần làm

- Ghi lại branch, commit, phiên bản Node/npm, lockfile và phiên bản dependency thực tế (`npm ls`), không chỉ dựa vào version range trong `package.json`.
- Chạy các lệnh kiểm tra đã có của frontend: `npm run lint` và `npm run build`; lưu toàn bộ output, kể cả cảnh báo.
- Mở app bằng profile trình duyệt sạch hoặc cửa sổ ẩn danh, tắt extension có thể can thiệp; bật hiển thị tất cả mức log trong Console.
- Ghi nhận log lúc khởi động, đăng nhập, chuyển module và thao tác; mỗi bản ghi có module, bước tái hiện, role, URL/API nếu có, stack trace và nguồn file/dòng.
- Phân biệt log chỉ xuất hiện trong development với log xuất hiện trong build/preview.
- Tạo danh sách warning ban đầu; nhóm theo cùng một nguyên nhân để sửa theo pattern thay vì chỉ sửa nơi đầu tiên nhìn thấy.

### Tiêu chí hoàn tất

- Mỗi log có nguồn phát rõ ràng hoặc được đánh dấu cần điều tra thêm.
- Có baseline để so sánh sau mỗi phase; không sửa code nghiệp vụ trong bước đo baseline.

## Phase 1 — Shell, provider và thành phần dùng chung

### Phạm vi

`App.tsx`, router, layout/header/sidebar, `common`, API client, React Query provider, theme/provider, modal/toast/error boundary và các hook dùng chung.

### Kiểm tra

- Provider có bao phủ mọi route và modal portal cần context hay không.
- Các API thông báo, confirm, theme, locale và component Ant Design có dùng đúng context không.
- Component dùng chung có prop deprecated, `defaultProps`, key thiếu, effect thiếu dependency hoặc đăng ký listener/timer không cleanup không.
- API client có log lỗi trùng lặp, retry ngoài ý muốn, hoặc biến lỗi request thành warning chung chung không.
- Kiểm tra phiên đăng nhập, refresh trang ở route con và điều hướng trực tiếp để phát hiện log chỉ xuất hiện sau hydration/route load.

### Tiêu chí hoàn tất

- Không còn warning phát sinh từ shell/common trong luồng khởi động, đăng nhập và điều hướng.
- Lỗi API vẫn hiển thị đúng thông báo; không bị nuốt hoặc chuyển thành thành công giả.

## Phase 2 — Xác thực và trang nền

### Module

`auth`, `dashboard`, `calendar`.

### Luồng rà soát

- Auth: đăng nhập hợp lệ/sai, hết phiên, đăng xuất, refresh trang sâu-link, role khác nhau.
- Dashboard: tải widget/KPI, refresh, trường hợp dữ liệu rỗng và request thất bại.
- Calendar: chuyển ngày/tháng, lọc, mở chi tiết, dữ liệu không có và tải lại.
- Với mỗi luồng, kiểm tra warning sau render đầu tiên, sau tương tác, khi đóng/mở modal và sau refresh.

### Tiêu chí hoàn tất

- Không có warning React/Ant Design từ ba module; request lỗi được phân loại riêng và có hành vi hiển thị đúng.

## Phase 3 — Đặt phòng và lưu trú

### Module

`reservations`, `stays`.

### Luồng rà soát

- Reservations: danh sách, tìm kiếm/lọc, tra cứu phòng trống, tạo đơn, chỉnh sửa, hủy, đổi trạng thái, phân trang.
- Stays: danh sách đang ở/lịch sử, check-in, check-out, đổi phòng, modal ghi chú, refresh và tải lại route.
- Kiểm tra form validation, date picker, select có tìm kiếm, table columns, tabs, modal lifecycle, thông báo và mutation cache invalidation.
- Thử dữ liệu dài, rỗng, Unicode và danh sách lớn để tìm warning chỉ lộ ra ở một nhánh render.

### Tiêu chí hoàn tất

- Các hành động nghiệp vụ/API payload không đổi; không còn warning lặp khi nhập form hoặc mở modal.

## Phase 4 — Phòng, hạng phòng và buồng phòng

### Module

`rooms`, `room-types`, `housekeeping`.

### Luồng rà soát

- Rooms/Room Types: CRUD theo quyền, lọc, form, xác nhận xóa/khóa và dữ liệu không hợp lệ.
- Housekeeping: Kanban, danh sách/hàng đợi, bắt đầu/hoàn thành/nghiệm thu/hủy việc, ghi chú và role được phép truy cập từng tab/API.
- Xác minh từng endpoint với các role có quyền và không có quyền; phân biệt 403 do quyền đúng với request thừa từ UI.
- Kiểm tra riêng Ant Design Table, Tag, Space, Modal, message/notification và các component responsive.

### Tiêu chí hoàn tất

- Không phát request trái quyền; thao tác bị cấm vẫn được backend bảo vệ.
- Các cột/badge/modal không tạo warning và không che nội dung khi dữ liệu dài.

## Phase 5 — Bảo trì và dịch vụ

### Module

`maintenance`, `services`.

### Luồng rà soát

- Maintenance: tạo phiếu, phân công, bắt đầu sửa, báo hoàn tất, nghiệm thu/đóng, hủy, tạo/mở/hủy lệnh khóa phòng.
- Services: danh mục, tạo/sửa/tắt dịch vụ, tạo yêu cầu, hoàn tất/hủy đơn và quyền quản lý.
- Kiểm tra warning trong bảng, drawer, modal lồng nhau, thông báo mutation, ghi chú và tên nhân viên/chức danh dài.
- Mỗi endpoint bị lỗi cần kiểm tra role, URL, payload, trạng thái dữ liệu và chính sách retry trước khi kết luận là warning frontend.

### Tiêu chí hoàn tất

- Không còn log Ant Design/React từ các luồng thao tác; không làm thay đổi quy tắc trạng thái nghiệp vụ.

## Phase 6 — Hóa đơn và vật tư/kho

### Module

`billing`, `inventory`.

### Luồng rà soát

- Billing: mở Folio, thêm khoản, thanh toán/điều chỉnh theo quyền, xem lịch sử và dữ liệu trống.
- Inventory: danh mục, mặt hàng, nhà cung cấp, phiếu nhập, phiếu xuất, kiểm kê/điều chỉnh và chi tiết chứng từ.
- Không chạy thao tác ghi dữ liệu trên DB dùng chung trong lúc audit; dùng DB local/demo và xác nhận trước các thao tác không thể hoàn tác.
- Rà số lượng/tiền định dạng, bảng có nhiều cột, form động, xác nhận hành động và lỗi API.
- Theo dõi warning thư viện song song với lỗi tính toán/validation; không gộp hai loại lỗi thành một.

### Tiêu chí hoàn tất

- Không có warning phát sinh trong thao tác module; dữ liệu mẫu/DB giữ nguyên ngoài các thao tác test được chủ động xác nhận.

## Phase 7 — Hồ sơ, nhân sự và báo cáo

### Module

`guests`, `employees`, `reports`.

### Luồng rà soát

- Guests: tìm kiếm, tạo/sửa, xem chi tiết, dữ liệu cá nhân/mã hóa và quyền truy cập.
- Employees: danh sách, tạo/sửa, đổi/reset mật khẩu, phân quyền và trạng thái nhân viên.
- Reports: bộ lọc ngày, tải dữ liệu, bảng/biểu đồ, dữ liệu rỗng và lỗi API.
- Kiểm tra các cảnh báo phát sinh khi render theo role, khi form validation thất bại và khi request hoàn tất.

### Tiêu chí hoàn tất

- Không còn warning từ module; không lộ dữ liệu nhạy cảm vào Console.

## Phase 8 — Kiểm tra dependency và nâng phiên bản có kiểm soát

### Việc cần làm

- Tổng hợp package thực sự phát warning từ baseline; không nâng tất cả package chỉ vì `npm outdated` báo có bản mới.
- Với mỗi package liên quan, kiểm tra release notes/changelog chính thức, breaking changes, peer dependencies và mức hỗ trợ React/Vite/TypeScript hiện tại.
- Ưu tiên nâng patch/minor tương thích; nâng major trong commit/PR riêng, một nhóm package liên quan mỗi lần.
- Cập nhật lockfile bằng package manager của dự án; không xóa lockfile, không dùng cờ bỏ qua peer dependency để ép cài.
- Sau mỗi đợt nâng, chạy lint/build và smoke-test các module chịu ảnh hưởng; nếu regressions xuất hiện, rollback riêng đợt đó.

### Tiêu chí hoàn tất

- Không có peer dependency conflict mới; package được nâng có lý do và có bằng chứng warning được xử lý.

## Phase 9 — Kiểm tra hồi quy và nghiệm thu

### Bộ kiểm tra

- Chạy lint và build trên frontend.
- Chạy app trong dev và build preview, dùng profile trình duyệt sạch, bật tất cả mức Console.
- Smoke-test ít nhất một luồng chính của từng module, kiểm tra desktop và mobile, các role chính và route refresh.
- Ghi lại toàn bộ warning/error mới so với baseline; xác nhận từng dòng đã xử lý, phân loại ngoài ứng dụng, hoặc ghi rõ còn tồn tại và lý do.
- Kiểm tra lại Network: lỗi HTTP không được tính là warning thư viện nhưng phải được xác định là quyền, dữ liệu, server hay frontend.

### Tiêu chí nghiệm thu cuối

- Không còn warning do mã ứng dụng trực tiếp tạo ra trong các luồng đã kiểm tra.
- Không có warning mới trong lint/build; mọi lỗi HTTP còn lại đều có phân loại và nguyên nhân.
- Không che warning bằng filter/suppression; không thay đổi nghiệp vụ ngoài phạm vi được duyệt.
- Có bảng kết quả theo module: trạng thái, warning đã xử lý, kiểm tra đã chạy, vấn đề còn lại và file/commit liên quan.

## Mẫu ghi nhận từng warning

| Trường | Nội dung cần ghi |
|---|---|
| Module/luồng | Trang và thao tác làm log xuất hiện |
| Log nguyên văn | Nội dung Console/build/lint, không diễn giải thay cho log |
| Nguồn | File/dòng hoặc package/endpoint phát sinh |
| Phân loại | Deprecated API, React/runtime, dependency, HTTP/auth, môi trường |
| Tái hiện | Role, dữ liệu, các bước tối thiểu |
| Nguyên nhân gốc | Vì sao warning xuất hiện |
| Cách xử lý | Sửa API, sửa logic, nâng package, hoặc đánh dấu ngoài phạm vi |
| Xác nhận | Lint/build/luồng thủ công và kết quả sau sửa |

## Trình tự triển khai đề xuất

Thực hiện lần lượt: **Phase 0 → Phase 1 → Phases 2–7 theo module → Phase 8 nếu baseline chứng minh cần nâng thư viện → Phase 9**. Mỗi phase nên có commit riêng, báo cáo ngắn và kiểm tra hồi quy trước khi chuyển phase tiếp theo. Không bắt đầu nâng major dependency trước khi hoàn thành baseline và xác định đúng package gây warning.
