# Kế hoạch Responsive toàn hệ thống Innvyra PMS

## 1. Mục tiêu

Hoàn thiện giao diện responsive cho toàn bộ frontend Innvyra PMS để các luồng chính có thể sử dụng thuận tiện trên điện thoại, máy tính bảng và máy tính để bàn.

Kế hoạch này tập trung vào bố cục và trải nghiệm giao diện. Không thay đổi API, schema cơ sở dữ liệu, quyền truy cập hoặc quy tắc nghiệp vụ. Nếu phát hiện vấn đề nghiệp vụ, ghi nhận riêng để thống nhất trước khi sửa.

## 2. Phạm vi màn hình

Kế hoạch bao gồm tất cả route hiện có trong frontend:

- Đăng nhập, trang 403 và 404.
- Dashboard.
- Lịch ma trận phòng.
- Phòng và hạng phòng.
- Đặt phòng và lưu trú.
- Khách hàng và nhân viên.
- Buồng phòng và bảo trì.
- Dịch vụ và đơn dịch vụ.
- Folio, thanh toán và biên nhận.
- Báo cáo.
- Quản lý vật tư và kho: tổng quan, vật tư, danh mục, nhà cung cấp, phiếu nhập, phiếu xuất, sổ kho và các modal chi tiết/điều chỉnh.

## 3. Nguyên tắc triển khai

1. Làm responsive từ layout và thành phần dùng chung trước, sau đó mới xử lý từng module.
2. Giữ nguyên luồng nghiệp vụ, dữ liệu gửi lên API và quyền theo vai trò.
3. Không thu nhỏ toàn bộ giao diện desktop một cách máy móc; sắp xếp lại nội dung theo mức độ ưu tiên trên màn hình nhỏ.
4. Chỉ cho phép cuộn ngang trong vùng dữ liệu cần thiết như bảng nhiều cột hoặc ma trận phòng; tránh cuộn ngang toàn trang.
5. Không ẩn hành động quan trọng chỉ để vừa màn hình. Ưu tiên menu thao tác, nút rõ ràng hoặc bố cục thẻ.
6. Giữ bộ lọc, phân trang, trạng thái tải/lỗi/rỗng và thông báo thao tác dễ dùng trên cảm ứng.
7. Mỗi phase giữ thay đổi trong phạm vi giao diện; nếu phát hiện cần đổi nghiệp vụ thì tạo ghi chú riêng.

## 4. Kích thước mục tiêu

Dùng breakpoint nhất quán với hệ thống giao diện hiện tại và kiểm tra tối thiểu tại các kích thước sau:

| Nhóm | Kích thước kiểm tra | Kỳ vọng |
| --- | --- | --- |
| Điện thoại nhỏ | 360 × 800 | Nội dung chính vừa màn hình; không tràn ngang toàn trang |
| Điện thoại phổ biến | 390 × 844 | Luồng thao tác thường dùng hoàn chỉnh |
| Máy tính bảng | 768 × 1024 | Bố cục tận dụng được chiều rộng; điều hướng thuận tiện |
| Laptop nhỏ | 1024 × 768 | Bảng và bộ lọc không chồng lấn |
| Desktop | 1440 × 900 | Giữ được bố cục desktop hiện tại |

Nếu có thời gian, kiểm tra thêm 320 × 700 để phát hiện các trường hợp hẹp đặc biệt. Có thể dùng vùng cuộn ngang cục bộ cho bảng hoặc ma trận có nhiều cột.

## 5. Quy ước responsive chung

### Điều hướng và khung trang

- Desktop: giữ sidebar và header theo thiết kế hiện có; bảo đảm vùng nội dung không bị co hoặc tràn khi sidebar thay đổi.
- Mobile: chuyển sidebar thành drawer/menu có thể mở và đóng; menu phải đóng sau khi chọn route.
- Tiêu đề trang, mô tả, nút chính và breadcrumb phải xếp lại gọn trên màn nhỏ.
- Các vùng flex/grid phải cho phép co đúng cách; tránh phần tử con có chiều rộng tối thiểu làm tràn viewport.
- Giữ trạng thái route và quyền truy cập hiện hành khi đổi cách hiển thị menu.

### Bảng, bộ lọc và danh sách

- Bộ lọc xếp thành một hoặc hai cột phù hợp với chiều rộng; nút tìm kiếm/xóa lọc phải dễ chạm.
- Bảng nhiều cột cuộn ngang bên trong vùng bảng, không kéo cả trang theo.
- Giữ các cột nhận diện và thao tác quan trọng; có thể gom thao tác phụ vào menu.
- Với danh sách phù hợp, dùng dạng thẻ trên mobile nếu giúp xem thông tin và thao tác rõ hơn.
- Phân trang, tổng số bản ghi và trạng thái không có dữ liệu phải hiển thị rõ.

### Form, modal và drawer

- Form chuyển thành một cột trên mobile; nhãn và lỗi validation không bị cắt.
- Modal dài chuyển sang gần toàn màn hình hoặc drawer; phần nội dung cuộn riêng, nút xác nhận/hủy luôn dễ tìm.
- Tránh đặt nhiều trường số hoặc ngày trên cùng một hàng khi màn hình hẹp.
- Nút cảm ứng nên có vùng bấm khoảng 44 × 44 px khi không ảnh hưởng bố cục.

### Biểu đồ và dữ liệu chuyên biệt

- Biểu đồ đổi kích thước theo container; legend và tooltip vẫn đọc được.
- Ma trận phòng giữ ý nghĩa cấu trúc; dùng cuộn ngang cục bộ, giữ nhận diện phòng/ngày dễ theo dõi.
- Nội dung tiền tệ, mã phiếu, mã phòng và email dài phải xuống dòng hoặc có cách xem đầy đủ.

## 6. Kế hoạch theo phase

### Phase 0 — Khảo sát và lập danh sách vấn đề

**Phạm vi**

- Rà toàn bộ route, layout, bảng, biểu đồ, modal và thao tác chính.
- Mở từng module ở kích thước điện thoại, tablet và desktop.
- Ghi nhận lỗi theo mức độ: chặn thao tác, khó thao tác, lỗi trình bày.
- Chụp/ghi lại trạng thái ban đầu để so sánh sau khi sửa.

**Đầu ra**

- Danh sách vấn đề theo module và mức ưu tiên.
- Xác định các thành phần đang dùng chung để xử lý một lần.
- Xác nhận phạm vi có bao gồm giao diện inventory đang nằm trên nhánh feature inventory.

**Điều kiện hoàn tất**

- Mọi route trong phạm vi đã được kiểm tra ít nhất ở điện thoại và desktop.
- Các lỗi gây tràn trang hoặc không thể thao tác được đã được xếp ưu tiên.

### Phase 1 — Nền tảng dùng chung

**Phạm vi**

- MainLayout: sidebar, header, vùng nội dung, khoảng cách và chiều rộng.
- Điều hướng mobile dạng drawer/menu.
- CSS toàn cục và các quy tắc responsive dùng chung.
- Tiêu đề trang, thanh công cụ, hàng bộ lọc, nhóm nút.
- Kiểu hiển thị chung cho bảng, vùng cuộn, modal/drawer.
- Đăng nhập, 403 và 404.

**Đầu ra**

- Khung trang dùng được trên điện thoại, tablet và desktop.
- Quy ước responsive nhất quán để các phase sau áp dụng.

**Điều kiện hoàn tất**

- Có thể mở và chuyển route trên mobile mà không bị menu che nội dung hoặc tràn ngang.
- Header, sidebar, tiêu đề và nút chính không chồng lấn.
- Các thay đổi không làm mất khả năng truy cập theo vai trò.

### Phase 2 — Dashboard và luồng phòng/tiền sảnh

**Module**

- Dashboard.
- Lịch ma trận phòng.
- Phòng và hạng phòng.
- Đặt phòng.
- Lưu trú/check-in/check-out.

**Công việc trọng tâm**

- Sắp xếp lại thẻ chỉ số và biểu đồ dashboard.
- Làm ma trận phòng có vùng cuộn ngang riêng và giữ nhãn nhận diện.
- Cải thiện bảng, bộ lọc, chi tiết đặt phòng và form tạo/sửa.
- Làm các drawer/modal thông tin lưu trú và thao tác check-in/check-out phù hợp màn nhỏ.

**Điều kiện hoàn tất**

- Có thể tìm, xem chi tiết và thực hiện các thao tác chính trên điện thoại.
- Cuộn ma trận không làm cuộn ngang toàn trang.
- Trạng thái, ngày giờ, giá và hành động không bị che hoặc cắt.

### Phase 3 — Vận hành khách sạn và dịch vụ

**Module**

- Buồng phòng.
- Bảo trì.
- Dịch vụ/danh mục dịch vụ/đơn dịch vụ.

**Công việc trọng tâm**

- Điều chỉnh Kanban buồng phòng: có thể chuyển thành các cột cuộn ngang cục bộ hoặc danh sách theo trạng thái.
- Làm danh sách phiếu bảo trì, form tạo/cập nhật và phần chi tiết.
- Xếp lại danh mục dịch vụ và đơn dịch vụ; giữ rõ trạng thái và thao tác.
- Kiểm tra các ghi chú dài, thông tin người phụ trách và nhãn ưu tiên.

**Điều kiện hoàn tất**

- Nhân viên có thể xem trạng thái và cập nhật công việc trên điện thoại.
- Các thao tác bắt đầu/hoàn tất/kiểm tra vẫn dễ tìm.
- Form và modal dài có thể cuộn và lưu/hủy rõ ràng.

### Phase 4 — Khách hàng, nhân viên, thanh toán và báo cáo

**Module**

- Khách hàng.
- Nhân viên và modal tạo/sửa/reset mật khẩu.
- Folio, thanh toán và biên nhận.
- Báo cáo và xuất dữ liệu.

**Công việc trọng tâm**

- Tối ưu bảng dữ liệu cá nhân, tìm kiếm, lọc và khu vực hành động.
- Làm các modal nhân viên và khách hàng dùng được trên mobile.
- Đảm bảo chi tiết folio, dòng phí, thanh toán và biên nhận hiển thị đủ thông tin.
- Xếp lại các tab báo cáo, bộ lọc ngày, bảng và biểu đồ.

**Điều kiện hoàn tất**

- Không cắt mất số tiền, trạng thái thanh toán, ngày, mã và thông tin khách.
- Bộ lọc báo cáo và thao tác xuất vẫn có thể dùng trên mobile.
- Dữ liệu nhiều cột có cách xem rõ ràng, không gây tràn cả trang.

### Phase 5 — Quản lý vật tư và kho

**Module**

- Tổng quan kho.
- Vật tư và chi tiết vật tư.
- Danh mục.
- Nhà cung cấp.
- Phiếu nhập và chi tiết phiếu.
- Phiếu xuất và chi tiết phiếu.
- Điều chỉnh tồn kho.
- Sổ kho/biến động.

**Công việc trọng tâm**

- Tối ưu hàng tab trên màn nhỏ, tránh tab bị nén hoặc mất nhãn.
- Điều chỉnh thẻ chỉ số, bảng tồn kho, bộ lọc và chi tiết vật tư.
- Làm form nhập/xuất nhiều dòng dễ thao tác; cho phép xem từng dòng rõ ràng.
- Làm modal điều chỉnh và chi tiết phiếu phù hợp với chiều cao màn hình.
- Giữ rõ số lượng, đơn vị, đơn giá, tổng tiền, tồn trước và tồn sau.

**Điều kiện hoàn tất**

- Người dùng có thể xem tồn kho và thao tác nhập/xuất/điều chỉnh trên mobile.
- Không nhầm lẫn số lượng và đơn vị ở biểu mẫu nhiều dòng.
- Bảng biến động có cách xem trên màn nhỏ mà không mất thông tin quan trọng.

### Phase 6 — Kiểm thử responsive toàn hệ thống và hoàn thiện

**Phạm vi**

- Chạy lại toàn bộ route tại các kích thước mục tiêu.
- Kiểm tra các vai trò có quyền truy cập khác nhau.
- Kiểm tra trạng thái tải, lỗi, rỗng, phân trang và nội dung dài.
- Rà lỗi chồng lấn, chữ bị cắt, vùng bấm khó chạm và cuộn ngang ngoài ý muốn.
- Kiểm tra các luồng desktop trước/sau để tránh hồi quy.

**Điều kiện hoàn tất**

- Mọi route trong phạm vi có thể xem và thao tác tại điện thoại, tablet và desktop.
- Không có cuộn ngang toàn trang ngoài chủ ý.
- Bảng và ma trận chỉ cuộn trong vùng của chúng khi cần.
- Các luồng nghiệp vụ hiện có vẫn hoạt động giống trước khi làm responsive.
- Frontend build/lint và checklist kiểm tra thủ công đều đạt.

## 7. Checklist kiểm tra theo module

- [ ] Login: form, thông báo lỗi và nút đăng nhập.
- [ ] Dashboard: thẻ KPI, biểu đồ, bảng và điều hướng nhanh.
- [ ] Lịch phòng: chọn ngày, đổi chế độ xem, cuộn ma trận.
- [ ] Phòng/hạng phòng: tìm kiếm, lọc, danh sách, chi tiết và form.
- [ ] Đặt phòng: bộ lọc, bảng, chi tiết, tạo/sửa/hủy.
- [ ] Lưu trú: danh sách, chi tiết, check-in/check-out và trạng thái.
- [ ] Khách hàng: tìm kiếm, danh sách, chi tiết và hồ sơ.
- [ ] Buồng phòng: Kanban/danh sách, cập nhật trạng thái và ghi chú.
- [ ] Bảo trì: phiếu, ưu tiên, khóa phòng và biểu mẫu.
- [ ] Dịch vụ: danh mục và đơn dịch vụ.
- [ ] Folio/thanh toán: bảng dòng phí, số tiền, thanh toán và biên nhận.
- [ ] Nhân viên: tìm kiếm, tạo/sửa, phân quyền và modal mật khẩu.
- [ ] Báo cáo: tab, bộ lọc ngày, bảng, biểu đồ và xuất dữ liệu.
- [ ] Inventory: mọi tab, bộ lọc, form nhập/xuất, điều chỉnh và chi tiết phiếu.
- [ ] 403/404: nội dung, nút quay lại và điều hướng.

## 8. Quy trình làm việc và kiểm soát phạm vi

1. Làm trên một nhánh responsive riêng, được tạo từ phiên bản có đủ các module cần xử lý.
2. Hoàn thành và rà lại từng phase trước khi chuyển sang phase kế tiếp.
3. Commit theo phase hoặc nhóm module; ghi rõ phạm vi responsive đã thay đổi.
4. Nếu phát hiện lỗi nghiệp vụ, ghi lại route, vai trò, bước tái hiện và kết quả mong muốn; không tự thay đổi quy tắc nghiệp vụ trong phase responsive.
5. Không chạy seed trên database đang dùng chỉ để kiểm tra giao diện. Dùng dữ liệu hiện có hoặc database kiểm thử riêng theo quy trình của nhóm.
6. Sau mỗi phase, kiểm tra lại ít nhất một luồng desktop và một luồng mobile của module vừa sửa.

## 9. Tiêu chí hoàn thành toàn dự án

- Tất cả route hiện có đã được rà soát.
- Menu và luồng điều hướng hoạt động trên màn hình nhỏ.
- Màn hình không có lỗi tràn, chồng lấn hoặc mất thao tác quan trọng.
- Bảng, ma trận, form, modal và biểu đồ có cách hiển thị phù hợp theo kích thước.
- Không phát sinh thay đổi API, database hoặc nghiệp vụ ngoài phạm vi đã thống nhất.
- Frontend build/lint và kiểm tra thủ công trên các viewport mục tiêu hoàn tất.

