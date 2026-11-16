# Buồng phòng – Kho – Thanh toán nhà cung cấp

## Cập nhật dự án có dữ liệu sẵn

Chạy trong thư mục `backend` sau khi lấy code:

```powershell
npm ci
npm run db:update:local
```

Lệnh dành cho bộ dữ liệu local Lotus/Ocean/Pine đã có: sinh Prisma Client, chạy migration, chuẩn hóa phiếu nhập, bổ sung vật tư/định mức rồi kiểm chứng liên kết và sổ kho. Sau đó khởi động lại backend/frontend. Không tạo database khác hoặc reset dữ liệu. Giữ nguyên đơn đặt phòng, lưu trú, số lượng tồn và các khoản tiền đã ghi nhận.

Nếu máy chỉ có DB một khách sạn từ trước khi có bộ dữ liệu Lotus/Ocean/Pine, dùng phần tạo DB mới bên dưới để khởi tạo bộ đa khách sạn; không dùng lệnh cập nhật này để biến dữ liệu một khách sạn thành ba khách sạn.

### Chuẩn hóa phiếu nhập local

- Các phiếu `NHAP-1`, `NHAP-2`, `NHAP-CHUYENTIEP` khớp bộ seed được chuyển sang mã có ngày nhập `NHAP-VT-YYYYMMDD-01/02/03`.
- Phiếu còn **Chưa đối soát** và chưa có khoản chi được thay bằng phiếu theo dõi thanh toán, bắt đầu ở **Chưa thanh toán**. Đây là chuẩn hóa tình huống dữ liệu local theo yêu cầu, không xác minh hay suy diễn việc chi tiền thật.
- Phiếu đã được đối soát/theo dõi chỉ đổi mã, giữ ID, thông tin đối soát, các lần trả và đảo tiền. Phiếu bổ sung `NHAP-BP-…` không thay đổi.
- Các dòng hàng và sổ kho được chuyển sang liên kết phiếu mới; không tạo biến động nhập kho lần hai. Số lượng, đơn giá, giá trị hàng nhận và ngày nhập được giữ nguyên.
- Mỗi lần áp dụng có bản sao JSON đầy đủ các phiếu/dòng hàng/sổ kho liên quan ở `backend/.tmp/local-seed/`. Nếu dữ liệu thay đổi sau khi lập bản xem trước, toàn bộ chuyển đổi dừng và hoàn tác. Phiếu không khớp cấu trúc seed được từ chối; dữ liệu khách sạn khác không bị chọn.

Chỉ xem trước mà chưa cập nhật:

```powershell
npm run db:refresh:receipts
```

Áp dụng riêng phần phiếu: `npm run db:refresh:receipts -- --apply`. Không cần thao tác này riêng nếu đã chạy `db:update:local`.

Với bộ dữ liệu local Lotus/Ocean/Pine đã có, bổ sung cấu hình còn thiếu bằng:

```powershell
npm run db:backfill:supplies -- --apply
```

Lệnh có thể chạy lại: bổ sung mã vật tư và dòng định mức còn thiếu, giữ các giá trị đã chỉnh riêng. Hai dòng dầu gội/bàn chải mặc định cũ được chuyển sang 1 đơn vị/khách, giữ nguyên mức chuẩn bị tiêu chuẩn 2/2/3/4 khách. Bỏ `-- --apply` để xem trước. Vật tư mới có phiếu nhập, sổ biến động và công nợ chưa thanh toán tương ứng; không tự ghi tiền đã trả. Các chai cũ giữ nguyên đơn vị và tồn. Bản sao thay đổi và kết quả kiểm chứng ở `backend/.tmp/local-seed/`.

Quản lý cần phân loại vật tư trước khi cấu hình định mức. Đơn vị của vật tư đã có biến động kho không được sửa trực tiếp, để giữ ý nghĩa chứng từ cũ. Muốn chuyển hóa chất từ chai sang ml, tạo mã vật tư ml mới rồi kiểm kê/chuyển số lượng theo chứng từ đã đối chiếu; không thay nhãn đơn vị trên số tồn cũ.

## Database seed mới để thử đủ ba khách sạn

Chạy trong `backend`; chọn một tên database chưa tồn tại:

```powershell
npm run db:seed:multi -- --database innvyra --activate
```

Lệnh tạo database riêng trong MySQL hiện được cấu hình, chạy migration, tạo dữ liệu qua nghiệp vụ và kiểm tra quan hệ trước khi chuyển `DATABASE_URL` trong `.env`. Không xóa database cũ. Bỏ `--activate` nếu chỉ muốn tạo và kiểm tra, chưa đổi database ứng dụng. Không dùng `migrate reset` hoặc seed cũ trên database đang giữ dữ liệu. Mỗi máy tự tạo database; `.env` và dữ liệu MySQL không được đưa lên Git.

`innvyra` là tên mặc định cho một môi trường mới. Nếu tên đó đã tồn tại, dùng lệnh backfill ở trên để cập nhật dữ liệu hiện có; chỉ chọn tên khác (ví dụ `innvyra_sandbox`) khi chủ động cần môi trường thử riêng.

Kiểm tra lại database đang dùng:

```powershell
npm run db:check:multi
```

Seed v4 gồm Lotus Riverside, Ocean Breeze và Pine Valley: mỗi khách sạn có 40 mã vật tư, định mức từng hạng phòng, hóa chất sẵn dùng theo ml, lịch sử dọn lại với lượng sử dụng bổ sung và các phiếu trả đủ/chưa trả/trả nhiều lần. Mọi phiếu seed đều dùng luồng theo dõi thanh toán mới; không tạo sẵn phiếu **Chưa đối soát**. Lịch chứng từ thay đổi theo ngày chạy seed.

Tài khoản quản lý khách sạn:

| Khách sạn | Username |
|---|---|
| Lotus | `lotus_admin_minhan` |
| Ocean | `ocean_admin_haidang` |
| Pine | `pine_admin_minhkhanh` |

Mật khẩu dữ liệu seed: `Innvyra@Demo2026!`. Danh sách nhân viên và báo cáo kiểm chứng được xuất vào `backend/.tmp/local-seed/` trên máy chạy. Đây là dữ liệu dùng thử; không dùng mật khẩu này cho tài khoản thật.

## Dọn phòng và xuất kho

1. Admin/Quản lý vào **Kho → Vật tư**, phân loại **Tiêu hao** cho bàn chải, dầu gội, hóa chất. Khăn/ga chọn **Tái sử dụng**.
2. Vào **Kho → Định mức dọn phòng**, chọn hạng phòng và lượng tiêu hao gợi ý. Định mức này khác với ngưỡng cảnh báo tồn tối thiểu.
3. Phân công và bắt đầu nhiệm vụ dọn. Khi hoàn thành, chọn số người lớn/trẻ em cần chuẩn bị cho khách sắp đón. Hệ thống nhân định mức theo khách với tổng số người đã chọn, giữ nguyên lượng tính theo phòng và từ chối số người vượt sức chứa. Đây là số khách cần chuẩn bị do nhân viên xác nhận, không tự lấy số khách đã checkout.
4. Lượng thực xuất ban đầu là 0; nhập phần thật sự lấy từ kho. Có nút **Điền lượng gợi ý khi cấp mới toàn bộ** cho lượt đầu; vật tư còn nguyên hoặc đủ trong phòng không cần xuất thêm. Nếu không dùng, chọn xác nhận và ghi lý do. Dọn lại bắt đầu từ 0 và chỉ ghi phần bổ sung.
5. Xác nhận thành công đồng thời tạo lịch sử lượt dọn (kèm số người chuẩn bị), phiếu xuất, sổ biến động kho và chuyển phòng sang chờ nghiệm thu. Có thể mở phiếu xuất từ lịch sử nhiệm vụ hoặc danh sách xuất kho.
6. Nếu thiếu tồn, toàn bộ thao tác được hoàn tác, nhiệm vụ vẫn đang dọn. Thông báo nêu vật tư, số có sẵn và số yêu cầu.
7. Nghiệm thu không đạt giữ nguyên vật tư đã dùng. Gửi lại cùng lượt, cùng dữ liệu không xuất thêm; đổi dữ liệu của lượt đã ghi bị từ chối.

Không lập thêm phiếu xuất thủ công cho lượng vật tư đã ghi qua nhiệm vụ. Luồng đồ vải, minibar, dịch vụ và bảo trì chưa tự động xuất kho trong đợt này.

## Danh mục và định mức buồng phòng

Đây là cấu hình vận hành gợi ý của bộ dữ liệu Innvyra, có thể chỉnh theo chính sách khách sạn, loại sản phẩm và diện tích thực tế; không phải chứng nhận hoặc tiêu chuẩn xếp hạng sao. Luồng hiện tại phục vụ dọn phòng trống sau trả phòng (turnover).

| Hạng phòng | Chuẩn bị tiêu chuẩn | Sức chứa đã cấu hình | Số dòng tiêu hao |
|---|---:|---|---:|
| Standard Double | 2 khách | 2 người lớn + 1 trẻ em | 17 |
| Superior Twin | 2 khách | 2 người lớn + 1 trẻ em | 17 |
| Deluxe Balcony | 3 khách | 3 người lớn + 1 trẻ em | 19 |
| Family Suite | 4 khách | 4 người lớn + 2 trẻ em | 19 |

- **Theo khách:** mỗi người 1 bàn chải, 1 tuýp kem đánh răng mini, 1 dầu gội mini, 1 sữa tắm mini, 1 mũ tắm, 1 lược, 1 đôi dép dùng một lần. Deluxe/Suite thêm 1 dầu xả và 1 sữa dưỡng thể mỗi khách. Đồ dùng cho trẻ em cần chọn loại/cỡ phù hợp; số khách không thay thế việc kiểm tra độ tuổi và nhu cầu.
- **Theo phòng:** 1 xà phòng rửa tay, 1 bộ tăm bông/bông tẩy trang, 2 cuộn giấy vệ sinh, 1 hộp khăn giấy, 1 túi đồ giặt, 1 túi vệ sinh cá nhân. Túi rác 2 chiếc, Suite 3, chỉnh theo số thùng thực tế. Đây là mức chuẩn bị, không phải mặc định bỏ đồ chưa dùng và xuất mới toàn bộ.
- **Hóa chất sẵn dùng, theo phòng:** lau sàn 50/50/75/100 ml; phòng tắm 40/40/60/80 ml; lau kính 20/20/30/40 ml theo thứ tự bốn hạng trên. Các số này chỉ dự trù xuất kho; điều chỉnh theo diện tích, tình trạng phòng và nhãn sản phẩm. Dùng mã riêng `HK_*_RTU`, không quy đổi các chai cũ hoặc coi sản phẩm đậm đặc là dung dịch sẵn dùng.
- **Theo yêu cầu:** bộ dao cạo và bộ kim chỉ có trong kho, không được tự đưa vào mọi lượt dọn. Nhân viên thêm dòng thực dùng khi cần.
- **Đồ vải:** khăn tắm, khăn mặt, khăn tay, thảm chân, ga giường, vỏ chăn, vỏ gối, áo choàng. Danh sách tham chiếu có trong màn hình định mức và hoàn thành dọn; ga/chăn/gối theo giường, kích thước và số lượng thực tế. Không suy ra số giường từ số người tối đa.
- **Dụng cụ:** khăn microfiber phân khu, cây lau/đầu lau, bàn chải toilet, bình xịt có nhãn, găng tay tái sử dụng, xe đẩy, máy hút bụi. Cấp phát ban đầu/thay hỏng bằng phiếu xuất; không trừ một máy hoặc một cây lau trong mỗi phòng.

Danh mục bổ sung được nhập bằng 3 phiếu riêng trong DB hiện tại, giá và lượng nhập là dữ liệu local để kiểm thử. Không ghi khoản chi nhà cung cấp. Seed tạo từ đầu dùng cùng catalogue/cách tính; dữ liệu lịch sử của DB hiện tại được giữ nguyên.

Tham khảo nhóm đồ vệ sinh cá nhân và các vật dụng theo yêu cầu trong [Hotelstars Union 2025–2030](https://www.hotelstars.eu/fileadmin/PORTAL/dokumente_downloads/HSU_classification_criteria_2025-2030_EN.pdf). Cấu hình hóa chất giữ nguyên yêu cầu dùng đúng nhãn sản phẩm và không trộn sản phẩm, theo [hướng dẫn làm sạch cơ sở của CDC](https://www.cdc.gov/hygiene/about/when-and-how-to-clean-and-disinfect-a-facility.html); các mức ml trong ứng dụng không phải công thức pha.

## Phiếu nhập và trả tiền

- Admin/Quản lý tạo phiếu nhập, có thể chọn **Thanh toán ngay** và nhập số thực trả, phương thức, ngày giờ. Sai số tiền hoặc vượt giá trị phiếu khiến cả việc nhận hàng và khoản chi không được lưu.
- Admin/Quản lý/Kế toán mở chi tiết phiếu để xem tiền đã trả, số còn phải trả và ghi tiếp các lần trả tiền. Mỗi lần có người xác nhận; chuyển khoản cần mã tham chiếu.
- Phiếu cũ phải **Đối soát phiếu** với nội dung kiểm tra. Có thể ghi khoản đã trả theo chứng từ và đúng ngày cũ, hoặc xác nhận chưa thanh toán. Không tự coi phiếu cũ là đã trả hoặc còn nợ toàn bộ.
- Ghi nhầm khoản chi: chọn **Đảo khoản chi**, nhập lý do. Không xóa chứng từ gốc. Khoản đảo được tính ở ngày đảo, công nợ được tính lại; muốn sửa khoản chi thì ghi giao dịch đúng sau khi đảo.

## Đọc báo cáo

**Báo cáo → Mua vật tư & Công nợ NCC** phân biệt:

| Chỉ số | Ngày ghi nhận / phạm vi |
|---|---|
| Giá trị hàng nhập | Ngày nhận hàng; lọc cùng lúc theo NCC và nhóm vật tư ở mọi bảng/biểu đồ |
| Chi vật tư thuần | Tiền trả trong kỳ trừ khoản đảo trong kỳ; toàn bộ NCC |
| Công nợ đã xác minh | Lũy kế phiếu nhập và khoản trả/đảo đến hết kỳ, tối đa thời điểm hiện tại |
| Phiếu chưa đối soát | Số phiếu và giá trị hàng tách riêng, chưa cộng vào công nợ đã xác minh |

Số lượng lẻ giữ hai chữ số thập phân ở API, hiển thị theo tiếng Việt. Không cộng chung số lượng khác đơn vị; báo cáo tổng dùng số mã vật tư riêng biệt.

Tổng quan và **Dòng tiền & Thu chi** có **Chi mua vật tư thuần** và **Dòng tiền sau chi vật tư**. Chỉ số sau bằng thu khách sau hoàn trả trừ chi vật tư thuần; chưa gồm các khoản chi vận hành khác và không phải lợi nhuận. Doanh thu phòng, tiền thu khách và công nợ khách giữ nguyên ý nghĩa.

## Kiểm thử tự động

Trong `backend`:

```powershell
npm run typecheck
npm run lint
npm run test:mysql
```

`test:mysql` chỉ dùng database local riêng có hậu tố `_test`, không reset hoặc seed database ứng dụng. Bộ `supply-workflows.mysql.integration.test.ts` kiểm tra tiêu hao, thiếu tồn/rollback, tranh chấp tồn, gửi lại, dọn lại, tenant và vai trò, trả từng phần, tranh chấp/trả vượt, đảo tiền, đối soát phiếu cũ, số lượng lẻ và bộ lọc báo cáo.

Trong `frontend`: `npm test`, `npm run lint`, `npm run build`.

API chi tiết có trong Swagger. Client hoàn thành dọn phải gửi `workToken`, `materials` và lý do nếu không dùng; client thanh toán phải giữ nguyên `requestKey` khi gửi lại cùng giao dịch.
