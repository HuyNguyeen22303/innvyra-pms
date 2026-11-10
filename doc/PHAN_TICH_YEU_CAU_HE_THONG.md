# 7.1. Phân tích yêu cầu hệ thống Innvyra PMS

## 7.1.1. Giới thiệu hệ thống

Innvyra PMS là ứng dụng web hỗ trợ vận hành nội bộ khách sạn. Nhân viên sử dụng hệ thống để tiếp nhận đặt phòng, quản lý phòng và hồ sơ khách, thực hiện nhận/trả phòng, cung cấp dịch vụ, theo dõi folio và phối hợp buồng phòng, bảo trì, vật tư.

Dữ liệu được tổ chức theo khách sạn và quyền của nhân viên. Phần phân tích trình bày 13 UC chính theo giao diện và xử lý FE/BE hiện có. Các thao tác nhỏ được gom trong từng UC để sơ đồ thể hiện rõ nghiệp vụ.

## 7.1.2. Phạm vi xây dựng

Phạm vi gồm các chức năng nội bộ đã có màn hình và đường xử lý tương ứng: tài khoản nhân viên, hạng/phòng/lịch phòng, khách hàng, đặt phòng, lưu trú, dịch vụ, Folio / Thu ngân, buồng phòng, bảo trì, kho, tổng quan và báo cáo.

Khách và nhà cung cấp được nhân viên ghi nhận thông tin; chưa có cổng tự đặt phòng, kết nối OTA, thanh toán trực tuyến hoặc quy trình chi trả nhà cung cấp. Folio là sổ theo dõi phí và khoản thu, không được mặc định là hóa đơn điện tử.

## 7.1.3. Các tác nhân hệ thống

| Tác nhân | Vai trò trong hệ thống |
|---|---|
| Quản trị viên | Quản trị tài khoản, danh mục và nghiệp vụ trong khách sạn. |
| Quản lý | Điều phối vận hành, nhân viên, kho, kiểm tra kết quả và theo dõi báo cáo. |
| Lễ tân | Khách hàng, đặt phòng, lưu trú, yêu cầu dịch vụ và ghi nhận thu/cọc theo quyền. |
| Kế toán | Theo dõi folio, thu/hoàn, điều chỉnh phí, quyết toán và báo cáo tài chính. |
| Nhân viên buồng phòng | Thực hiện việc dọn được giao, báo sự cố và sử dụng vật tư theo quyền. |
| Kỹ thuật viên | Thực hiện sửa chữa được giao, báo sự cố và sử dụng vật tư theo quyền. |

Quyền xem và quyền xử lý được phân biệt trong sơ đồ phân rã. Mọi thao tác còn chịu điều kiện trạng thái, khách sạn và người được giao; quyền quản lý không mặc định cho phép làm thay công việc được giao cho người khác.

## 7.1.4. Yêu cầu chức năng

| Mã | UC chính | Phạm vi |
|---|---|---|
| UC-01 | Đăng nhập và đăng xuất | Đăng nhập; Đăng xuất |
| UC-02 | Quản lý nhân viên và tài khoản | Tra cứu hồ sơ / danh bạ; Cấp tài khoản và gán vai trò; Cập nhật / khóa / mở tài khoản; Đặt lại mật khẩu |
| UC-03 | Quản lý phòng | Quản lý hạng phòng và giá; Quản lý phòng vật lý; Xem lịch / sơ đồ phòng |
| UC-04 | Quản lý khách hàng | Tra cứu hồ sơ khách; Thêm / cập nhật hồ sơ; Xóa mềm hồ sơ |
| UC-05 | Quản lý đặt phòng | Tra phòng trống / tạo đặt phòng; Tra cứu đơn đặt phòng; Hủy đơn / ghi nhận không đến |
| UC-06 | Quản lý lưu trú | Nhận phòng; Tra cứu lưu trú và lịch sử; Chuyển phòng / trả phòng |
| UC-07 | Quản lý dịch vụ | Quản lý danh mục dịch vụ; Tạo yêu cầu sử dụng dịch vụ; Hoàn tất / hủy yêu cầu |
| UC-08 | Quản lý Folio / Thu ngân | Mở / xem folio và công nợ; Ghi nhận thu tiền / đặt cọc; Hoàn tiền / điều chỉnh phí; Quyết toán và đóng folio |
| UC-09 | Quản lý buồng phòng | Theo dõi việc dọn / phòng bẩn; Tạo / phân công / hủy việc dọn; Thực hiện việc được giao; Kiểm tra / yêu cầu làm lại |
| UC-10 | Quản lý bảo trì | Báo / theo dõi sự cố; Phân công / nghiệm thu / hủy phiếu; Thực hiện sửa chữa được giao; Quản lý khóa phòng bảo trì |
| UC-11 | Quản lý vật tư và kho | Quản lý danh mục vật tư và NCC; Nhập kho; Xuất kho; Kiểm kê tồn kho; Theo dõi tồn và biến động |
| UC-12 | Xem tổng quan vận hành | Xem chỉ số vận hành ngày; Xem khách đến / đang ở; Xem tổng quan theo bộ phận |
| UC-13 | Xem báo cáo điều hành | Xem báo cáo tài chính / công nợ; Xem công suất / đặt phòng; Xem báo cáo vận hành; Xuất CSV theo loại được hỗ trợ |

Quản lý phòng có ba nhánh: hạng phòng và giá cơ bản, phòng vật lý, lịch/sơ đồ phòng. Điều chỉnh giá nằm trong form hạng phòng. Nhận, chuyển và trả phòng thuộc Quản lý lưu trú. Tổng quan vận hành và Báo cáo điều hành là hai UC riêng theo màn hình và luồng dữ liệu hiện tại.

## 7.1.5. Yêu cầu phi chức năng

Bảo mật: xác thực nhân viên, kiểm tra phiên và quyền ở server; bảo vệ mật khẩu và giới hạn dữ liệu khách theo vai trò.

Toàn vẹn dữ liệu: kiểm tra trạng thái và ràng buộc trước khi ghi; các nghiệp vụ tồn phòng, kho và tài chính cần tránh ghi dở hoặc ghi trùng.

Khả năng sử dụng: tên chức năng rõ, bộ lọc phù hợp, trạng thái và kết quả thao tác dễ nhận biết.

Hiệu năng: danh sách có phân trang và báo cáo có bộ lọc kỳ; cần đo bằng kiểm thử riêng trước khi cam kết số người dùng đồng thời hoặc thời gian phản hồi.

Khả năng bảo trì: tổ chức FE/BE theo các nhóm chức năng; thống nhất cách kiểm tra quyền và điều kiện nghiệp vụ.

Khả năng phục hồi: cần quy trình sao lưu, khôi phục và giám sát khi triển khai. Tài liệu này không khẳng định đã đạt một mức uptime hoặc năng lực tải cụ thể.

## 7.1.6. Luồng nghiệp vụ chính

Chu trình chính bắt đầu từ tiếp nhận đặt phòng, nhận từng phòng phù hợp, phục vụ trong kỳ ở, trả phòng và đối chiếu folio. Buồng phòng, bảo trì và kho phối hợp khi phát sinh. Trả phòng vật lý và quyết toán tài chính có điều kiện kết thúc riêng.

[Xem sơ đồ trong draw.io — tab ACT-TONG](Innvyra_13UC.drawio)
Hình 7.1.6-1. Hoạt động tổng quát phục vụ khách

Các hình sau chia làn nhân viên và hệ thống. Nhân viên chọn một thao tác; hệ thống kiểm tra quyền, điều kiện, thực hiện nhánh phù hợp và trả kết quả. Những lần bắt đầu và báo hoàn tất dọn/sửa là các yêu cầu riêng, cách nhau bởi công việc thực tế.

[Xem sơ đồ trong draw.io — tab ACT-01](Innvyra_13UC.drawio)
Hình 7.1.6-2. Hoạt động đăng nhập và đăng xuất

[Xem sơ đồ trong draw.io — tab ACT-02](Innvyra_13UC.drawio)
Hình 7.1.6-3. Hoạt động quản lý nhân viên và tài khoản

[Xem sơ đồ trong draw.io — tab ACT-03](Innvyra_13UC.drawio)
Hình 7.1.6-4. Hoạt động quản lý phòng

[Xem sơ đồ trong draw.io — tab ACT-04](Innvyra_13UC.drawio)
Hình 7.1.6-5. Hoạt động quản lý khách hàng

[Xem sơ đồ trong draw.io — tab ACT-05](Innvyra_13UC.drawio)
Hình 7.1.6-6. Hoạt động quản lý đặt phòng

[Xem sơ đồ trong draw.io — tab ACT-06](Innvyra_13UC.drawio)
Hình 7.1.6-7. Hoạt động quản lý lưu trú

[Xem sơ đồ trong draw.io — tab ACT-07](Innvyra_13UC.drawio)
Hình 7.1.6-8. Hoạt động quản lý dịch vụ

[Xem sơ đồ trong draw.io — tab ACT-08](Innvyra_13UC.drawio)
Hình 7.1.6-9. Hoạt động quản lý folio / thu ngân

[Xem sơ đồ trong draw.io — tab ACT-09](Innvyra_13UC.drawio)
Hình 7.1.6-10. Hoạt động quản lý buồng phòng

[Xem sơ đồ trong draw.io — tab ACT-10](Innvyra_13UC.drawio)
Hình 7.1.6-11. Hoạt động quản lý bảo trì

[Xem sơ đồ trong draw.io — tab ACT-11](Innvyra_13UC.drawio)
Hình 7.1.6-12. Hoạt động quản lý vật tư và kho

[Xem sơ đồ trong draw.io — tab ACT-12](Innvyra_13UC.drawio)
Hình 7.1.6-13. Hoạt động xem tổng quan vận hành

[Xem sơ đồ trong draw.io — tab ACT-13](Innvyra_13UC.drawio)
Hình 7.1.6-14. Hoạt động xem báo cáo điều hành

## 7.1.7. Biểu đồ Use Case

Sơ đồ tổng quát gồm 13 UC chính và sáu tác nhân. Liên kết thể hiện tham gia nghiệp vụ; phạm vi xem hoặc xử lý được ghi rõ ở từng hình phân rã. Không sử dụng include/extend để biểu diễn việc chia nhóm chức năng.

[Xem sơ đồ trong draw.io — tab UC-TONG](Innvyra_13UC.drawio)
Hình 7.1.7-1. Use Case tổng quát Innvyra PMS

UC-01 Đăng nhập và đăng xuất. Truy cập và kết thúc phiên làm việc bằng tài khoản nhân viên. Đăng nhập sai thông tin bị từ chối. Đăng xuất kết thúc phiên hiện tại; không tạo UC riêng cho refresh token.

[Xem sơ đồ trong draw.io — tab UC-01](Innvyra_13UC.drawio)
Hình 7.1.7-2. Use Case phân rã đăng nhập và đăng xuất

UC-02 Quản lý nhân viên và tài khoản. Quản lý hồ sơ, tài khoản và vai trò nhân viên trong khách sạn. Quản lý chỉ quản trị vai trò cấp dưới theo backend; không có UC chỉnh tùy ý hệ thống quyền hoặc tính lương.

[Xem sơ đồ trong draw.io — tab UC-02](Innvyra_13UC.drawio)
Hình 7.1.7-3. Use Case phân rã quản lý nhân viên và tài khoản

UC-03 Quản lý phòng. Quản lý cấu hình hạng, phòng vật lý và quan sát tình trạng phòng. Đọc và sửa có quyền riêng. Nhận/chuyển/trả phòng thuộc UC-06; lịch chỉ là một đường truy cập đến nghiệp vụ đó.

[Xem sơ đồ trong draw.io — tab UC-03](Innvyra_13UC.drawio)
Hình 7.1.7-4. Use Case phân rã quản lý phòng

UC-04 Quản lý khách hàng. Lưu và tra cứu hồ sơ khách phục vụ đặt phòng và vận hành. Khách là đối tượng được nhân viên nhập thông tin, chưa có tài khoản hoặc cổng khách trực tiếp.

[Xem sơ đồ trong draw.io — tab UC-04](Innvyra_13UC.drawio)
Hình 7.1.7-5. Use Case phân rã quản lý khách hàng

UC-05 Quản lý đặt phòng. Tiếp nhận nhu cầu và quản lý cam kết đặt phòng theo kỳ ở. Không thêm đổi ngày, gia hạn hoặc hủy một phần vào mô hình hiện trạng. Hủy/no-show không tự quyết toán tiền.

[Xem sơ đồ trong draw.io — tab UC-05](Innvyra_13UC.drawio)
Hình 7.1.7-6. Use Case phân rã quản lý đặt phòng

UC-06 Quản lý lưu trú. Ghi nhận sử dụng phòng thực tế từ nhận phòng đến trả phòng. Nhận/chuyển/trả là các thao tác độc lập. Trả phòng vật lý không yêu cầu dư nợ bằng 0 và không tự đóng sổ.

[Xem sơ đồ trong draw.io — tab UC-06](Innvyra_13UC.drawio)
Hình 7.1.7-7. Use Case phân rã quản lý lưu trú

UC-07 Quản lý dịch vụ. Quản lý danh mục và sử dụng dịch vụ trong thời gian khách đang ở. Danh mục và yêu cầu là hai tab trong cùng UC chính. Không tự trừ vật tư kho khi hoàn tất dịch vụ.

[Xem sơ đồ trong draw.io — tab UC-07](Innvyra_13UC.drawio)
Hình 7.1.7-8. Use Case phân rã quản lý dịch vụ

UC-08 Quản lý Folio / Thu ngân. Theo dõi khoản phí, khoản thu và công nợ của từng đơn đặt phòng. Chỉ ghi nhận tiền nhân viên đã nhận/đã hoàn; không có chuyển tiền ngân hàng tự động. Trả phòng khác đóng folio.

[Xem sơ đồ trong draw.io — tab UC-08](Innvyra_13UC.drawio)
Hình 7.1.7-9. Use Case phân rã quản lý folio / thu ngân

UC-09 Quản lý buồng phòng. Điều phối và kiểm tra vệ sinh để chuẩn bị phòng đón khách. Báo dọn xong chưa phải READY. Kiểm tra không đạt đưa task về PENDING và phòng DIRTY.

[Xem sơ đồ trong draw.io — tab UC-09](Innvyra_13UC.drawio)
Hình 7.1.7-10. Use Case phân rã quản lý buồng phòng

UC-10 Quản lý bảo trì. Tiếp nhận sự cố, điều phối sửa chữa và kiểm soát khóa phòng. Sửa xong không tự giải phóng block. Giải phóng khóa và hủy lịch khóa tương lai có điều kiện riêng.

[Xem sơ đồ trong draw.io — tab UC-10](Innvyra_13UC.drawio)
Hình 7.1.7-11. Use Case phân rã quản lý bảo trì

UC-11 Quản lý vật tư và kho. Quản lý danh mục, chứng từ và số lượng vật tư phục vụ khách sạn. Nhập/xuất/kiểm kê có kiểm tra và cập nhật tồn trong giao dịch; không sửa currentStock qua form danh mục vật tư.

[Xem sơ đồ trong draw.io — tab UC-11](Innvyra_13UC.drawio)
Hình 7.1.7-12. Use Case phân rã quản lý vật tư và kho

UC-12 Xem tổng quan vận hành. Theo dõi tình hình phục vụ và công việc theo vai trò trên trang chủ. Tổng quan là màn hình theo dõi nhanh. Quyền và nguồn dữ liệu của từng vai trò khác nhau.

[Xem sơ đồ trong draw.io — tab UC-12](Innvyra_13UC.drawio)
Hình 7.1.7-13. Use Case phân rã xem tổng quan vận hành

UC-13 Xem báo cáo điều hành. Phân tích hoạt động theo kỳ, loại báo cáo và quyền được cấp. Báo cáo khác màn hình tổng quan. Không thêm giao diện procurement hoặc báo cáo chi trả NCC khi frontend chưa có.

[Xem sơ đồ trong draw.io — tab UC-13](Innvyra_13UC.drawio)
Hình 7.1.7-14. Use Case phân rã xem báo cáo điều hành

## 7.1.8. Biểu đồ Sequence

Sequence sử dụng bốn đối tượng Nhân viên, Giao diện, Hệ thống và Cơ sở dữ liệu. Thông điệp được đánh số; lời gọi dùng nét liền, phản hồi dùng nét đứt. Khung alt thể hiện lựa chọn chức năng, loop thể hiện người dùng có thể tiếp tục yêu cầu thao tác; các nhánh không được hiểu là thực hiện lần lượt trong cùng giao dịch.

Sơ đồ dùng mức nghiệp vụ: một bước đọc/ghi có thể gồm nhiều truy vấn. Các phản hồi bao gồm kết quả thành công hoặc lý do từ chối. Quyền và điều kiện của từng chức năng vẫn áp dụng theo sơ đồ UC và mô tả tương ứng.

[Xem sơ đồ trong draw.io — tab SEQ-01](Innvyra_13UC.drawio)
Hình 7.1.8-1. Sequence đăng nhập và đăng xuất

[Xem sơ đồ trong draw.io — tab SEQ-02](Innvyra_13UC.drawio)
Hình 7.1.8-2. Sequence quản lý nhân viên và tài khoản

[Xem sơ đồ trong draw.io — tab SEQ-03](Innvyra_13UC.drawio)
Hình 7.1.8-3. Sequence quản lý phòng

[Xem sơ đồ trong draw.io — tab SEQ-04](Innvyra_13UC.drawio)
Hình 7.1.8-4. Sequence quản lý khách hàng

[Xem sơ đồ trong draw.io — tab SEQ-05](Innvyra_13UC.drawio)
Hình 7.1.8-5. Sequence quản lý đặt phòng

[Xem sơ đồ trong draw.io — tab SEQ-06](Innvyra_13UC.drawio)
Hình 7.1.8-6. Sequence quản lý lưu trú

[Xem sơ đồ trong draw.io — tab SEQ-07](Innvyra_13UC.drawio)
Hình 7.1.8-7. Sequence quản lý dịch vụ

[Xem sơ đồ trong draw.io — tab SEQ-08](Innvyra_13UC.drawio)
Hình 7.1.8-8. Sequence quản lý folio / thu ngân

[Xem sơ đồ trong draw.io — tab SEQ-09](Innvyra_13UC.drawio)
Hình 7.1.8-9. Sequence quản lý buồng phòng

[Xem sơ đồ trong draw.io — tab SEQ-10](Innvyra_13UC.drawio)
Hình 7.1.8-10. Sequence quản lý bảo trì

[Xem sơ đồ trong draw.io — tab SEQ-11](Innvyra_13UC.drawio)
Hình 7.1.8-11. Sequence quản lý vật tư và kho

[Xem sơ đồ trong draw.io — tab SEQ-12](Innvyra_13UC.drawio)
Hình 7.1.8-12. Sequence xem tổng quan vận hành

[Xem sơ đồ trong draw.io — tab SEQ-13](Innvyra_13UC.drawio)
Hình 7.1.8-13. Sequence xem báo cáo điều hành

## 7.1.9. Rủi ro và giải pháp

| Rủi ro hoặc giới hạn hiện tại | Hướng xử lý |
|---|---|
| Lịch phòng còn giới hạn phân trang và nguồn dữ liệu, không thay thế kiểm tra tồn bán/điều kiện nhận phòng. | Bổ sung nguồn/phân trang phù hợp và đối chiếu trạng thái trước khi xác nhận nghiệp vụ. |
| No-show còn thiếu kiểm tra ngày đến tại service; đường đóng folio hiện chưa chấp nhận NO_SHOW. | Thống nhất chính sách xử lý khách không đến và quyết toán; cập nhật kiểm tra và các trường hợp thử tương ứng. |
| Gửi lại thao tác tài chính bằng khóa mới có thể nằm ngoài cơ chế chống ghi trùng của server. | Giữ khóa theo đúng ý định giao dịch và đối chiếu trạng thái khi mất phản hồi. |
| Dọn/sửa xong, giải phóng khóa và READY là các trạng thái khác nhau; block quá ngày còn cần thống nhất cách xử lý. | Giữ bước kiểm tra, xác nhận mở khóa; thống nhất điều kiện sử dụng phòng giữa các nghiệp vụ. |
| Hiệu năng, sao lưu/khôi phục và độ sẵn sàng chưa được chứng minh chỉ bằng sơ đồ hoặc việc đọc mã. | Đo, kiểm thử và ghi nhận kết quả riêng trước nghiệm thu hoặc triển khai. |

## 7.1.10. Kết luận

Phạm vi phân tích được tổ chức thành 13 UC chính, bám các màn hình và xử lý hiện có của Innvyra PMS. Bộ Use Case, Activity và Sequence dùng chung tên chức năng, tác nhân và ranh giới nghiệp vụ; các thao tác nhỏ được gộp để tài liệu dễ theo dõi.

Các giới hạn đã xác định được giữ trong phần phân tích. Bộ tài liệu phục vụ mô tả và đối chiếu hệ thống, không thay thế kết quả kiểm thử hoặc biên bản nghiệm thu.
