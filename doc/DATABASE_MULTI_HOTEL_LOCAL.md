# Database local đa khách sạn mới

Ngày tạo: 12/11/2026.

## Database sử dụng

- Database mới: **`innvyra_pms_multi_hotel`**, MySQL local hiện có.
- Database cũ **`innvyra_pms` được giữ nguyên**, không dùng seed cũ để reset/chỉnh sửa.
- Database mới được giữ lại khi dừng backend, frontend hoặc máy tính; không phải database demo tạm của Phase 6.
- Sau khi kiểm chứng, chỉ `DATABASE_URL` trong `backend/.env` được chuyển sang database mới. Giữ nguyên thông tin kết nối, JWT và các khóa mã hóa giấy tờ khách.
- Backend chạy bằng nodemon có theo dõi `.env` sẽ tự tải lại. Nếu chưa chạy, dùng `npm run dev` như bình thường tại backend và frontend.
- Mở giao diện bằng `http://localhost:5173` để khớp cấu hình CORS local hiện tại.

## Tài khoản local

Mật khẩu mẫu chung cho các tài khoản đã kích hoạt: **`Innvyra@Demo2026!`**.

Quản trị Innvyra đăng nhập tại `/platform/login`: **`admin@innvyra.test`**.

Tài khoản khách sạn đăng nhập tại `/login`:

| Vai trò | Lotus Riverside (TP.HCM) | Ocean Breeze (Đà Nẵng) | Pine Valley (Đà Lạt) |
| --- | --- | --- | --- |
| ADMIN | lotus_admin_minhan | ocean_admin_haidang | pine_admin_minhkhanh |
| MANAGER | lotus_quanly_ngoclinh | ocean_quanly_baongoc | pine_quanly_hoangphuc |
| RECEPTIONIST | lotus_letan_hoangnam | ocean_letan_minhkhoa | pine_letan_thaonhi |
| HOUSEKEEPING | lotus_buongphong_thanhha | ocean_buongphong_thuhuong | pine_buongphong_ngocmai |
| ACCOUNTANT | lotus_ketoan_giahuy | ocean_ketoan_ngoctram | pine_ketoan_quynhnhu |
| TECHNICIAN | lotus_kythuat_quocbao | ocean_kythuat_quochung | pine_kythuat_tuananh |

Các nút điền nhanh tài khoản ở màn hình đăng nhập dev dùng tài khoản Lotus và mật khẩu trên.

Username thống nhất theo `khachsan_chucvu_tenngan`: `lotus` / `ocean` / `pine`, chức vụ không dấu (`admin`, `quanly`, `letan`, `buongphong`, `ketoan`, `kythuat`) và hai từ cuối trong họ tên, viết liền không dấu. Tên hiển thị là họ tên đầy đủ, không ghép chức vụ hoặc ca làm việc. Nhân viên đã nghỉ vẫn có username theo cùng quy tắc; trạng thái tài khoản được quản lý riêng. Nhân viên mới dùng `Innvyra@Setup2026!` lần đầu và phải đổi mật khẩu. Các tài khoản chính trong bảng đã kích hoạt, dùng mật khẩu chung phía trên.

Đây là tài khoản/dữ liệu mẫu local, không phải tài khoản vận hành production.

## Bộ dữ liệu

| Thành phần | Lotus HCM | Ocean Đà Nẵng | Pine Đà Lạt |
| --- | ---: | ---: | ---: |
| Phòng hoạt động | 24 | 18 | 12 |
| Số phòng chuyển đổi công năng (inactive) | 309 | 307 | 207 |
| Hạng phòng | 4 | 4 | 4 |
| Nhân viên, gồm inactive/tạm | 14 | 12 | 10 |
| Khách hàng | 36 | 24 | 18 |
| Đơn đặt phòng | 25 | 24 | 23 |
| Lịch sử đã trả phòng | 8 | 8 | 8 |
| Khách đang ở | 4 | 3 | 2 |

Tổng: **3 khách sạn, 3 gói mẫu, 57 phòng (54 active), 36 nhân viên, 78 khách, 72 đơn đặt phòng**. Các khách sạn được phép trùng số phòng/mã hạng/mã dịch vụ/mã vật tư/số phiếu, nhưng có ID và dữ liệu riêng.

- Phòng có trạng thái sẵn sàng, đang có khách, bẩn, đang dọn, chờ kiểm tra, bảo trì, ngừng phục vụ và inactive.
- Đặt phòng gồm lịch sử trong hơn một tháng, đang ở, chờ nhận hôm nay, đặt trước, đã hủy, không đến. Ngày được tính từ ngày tạo seed, không tự thay đổi dữ liệu về sau.
- Mỗi đơn có phân bổ phòng và giá từng đêm; lịch sử có check-in/check-out, người thực hiện và dọn phòng sau checkout. Snapshot giá không bị đổi theo giá danh mục sau này.
- Thu ngân có folio đóng đủ tiền, folio mở/còn nợ, tiền mặt, chuyển khoản, đặt cọc, hoàn tiền có liên kết phiếu gốc và bồi hoàn tương ứng. Folio đã đóng có dư nợ 0.
- Dịch vụ có đơn hoàn tất và đang chờ; số tiền đã ghi sổ khớp chi tiết dịch vụ.
- Buồng phòng có nhiệm vụ được phân công ở trạng thái chờ làm, đang làm và chờ kiểm tra, cùng lịch sử đã hoàn tất.
- Bảo trì có phiếu kỹ thuật đang xử lý và block an toàn phòng 104.
- Kho mỗi khách sạn có ba nhóm, hai nhà cung cấp, sáu vật tư, hai phiếu nhập, ba phiếu xuất và một phiếu kiểm kê. Có vật tư dưới định mức và hết hàng để kiểm tra cảnh báo.
- Giấy tờ khách là dữ liệu giả, được mã hóa bằng khóa hiện có của local. Không sao chép khách/đơn/phòng từ database cũ.
- Các gói và giá thuê bao là ví dụ local, mỗi khách sạn có kỳ sáu tháng và hạn mức đủ dùng; có thể chỉnh danh mục từ quản trị Innvyra.
- Tên gói, nhân viên, nhà cung cấp, địa chỉ và ghi chú được trình bày tự nhiên, không gắn nhãn “mẫu”/“mô phỏng” trong dữ liệu hiển thị. Đây vẫn là dữ liệu hư cấu phục vụ kiểm thử.

Vật tư `ITEM_1` ngay sau seed có tồn **244,00** ở từng khách sạn; `ITEM_5` còn **15,00**, dưới định mức 20; `ITEM_6` có tồn **0,00**. Ba khách sạn độc lập nên thử xuất/nhập ở một nơi không đổi nơi khác.

## Kiểm tra lại database đang dùng

Tại thư mục `backend`:

```powershell
npm run db:check:multi
```

Lệnh chỉ đọc database đa khách sạn đang cấu hình trong `.env`, không reset hoặc seed lại. Kết quả chi tiết được lưu ở `backend/.tmp/local-seed/<tên-db>.verification.json` (Git ignore). Có thể chỉ định database khác bằng `-- --database innvyra_pms_multi_hotel_2`.

Nội dung kiểm tra:

- Tất cả khóa ngoại thực tế lấy từ MySQL, gồm khóa ghép để bảo vệ `hotelId`.
- Số đêm và tổng snapshot giá khớp ngày/giá đặt phòng; không vượt tồn phòng tương lai.
- Phòng đã gán, stay và occupancy khớp nhau; không trùng lượt ở trên một phòng hoặc sai ngày check-in.
- Nguồn khoản thu phòng/dịch vụ đúng đơn và khách sạn; folio đã đóng cân bằng; hoàn tiền không vượt khoản gốc.
- Tổng phiếu nhập khớp tổng dòng đã làm tròn; tồn kho khớp tổng biến động, chuỗi số dư và tham chiếu chứng từ.
- Liên kết nhiệm vụ buồng phòng, trạng thái phòng và block bảo trì hợp lệ.
- Kỳ thuê bao không trùng, số phòng/tài khoản hoạt động nằm trong hạn mức.
- Giấy tờ giải mã được với khóa cấu hình đang dùng và khớp fingerprint.

Nếu sau này chủ động chỉnh dữ liệu bằng SQL, chạy lại lệnh để phát hiện các sai lệch nghiệp vụ mà khóa ngoại đơn thuần không bắt được. Các thống kê trên là trạng thái ngay sau seed; dùng phần mềm sẽ làm số liệu thay đổi bình thường.

## Tạo lại một database khác mà không xóa database đang dùng

Seed mới từ chối tên database đã tồn tại và từ chối chạy lại trên dữ liệu đã có. Không có chế độ reset/truncate và không tự xóa database khi lỗi.

```powershell
npm run db:seed:multi -- --database innvyra_pms_multi_hotel_2 --activate
```

Lệnh tạo database tên mới, áp dụng migration, seed và kiểm chứng rồi mới chuyển `.env`. Bỏ `--activate` nếu chỉ muốn tạo mà chưa chuyển ứng dụng. Cần tài khoản MySQL local có quyền tạo database.

`npm run db:seed` và `prisma db seed` hiện dùng seed đa khách sạn an toàn này. Seed một khách sạn cũ ở `prisma/seed.ts` được giữ làm tham chiếu, tên lệnh `db:seed:legacy`; không dùng nó trên database đang sử dụng vì script cũ có thao tác xóa/tạo lại nghiệp vụ mẫu.

Manifest tại `backend/.tmp/local-seed/<tên-db>.manifest.json` ghi ngày tạo, tài khoản mẫu, khách sạn và database trước đó; không lưu token phiên hoặc thông tin kết nối MySQL.

## Quay lại database cũ

Trong `backend/.env`, đổi **phần tên database cuối `DATABASE_URL`** từ `innvyra_pms_multi_hotel` về `innvyra_pms`, giữ nguyên các phần khác. Khởi động lại backend nếu không dùng nodemon. Database mới vẫn còn và có thể chuyển lại bất cứ lúc nào.

Không thay/xóa khóa `GUEST_ENCRYPTION_KEY` hoặc `GUEST_HASH_KEY` khi đổi database, vì chúng cần để đọc giấy tờ đã mã hóa. Seed giữ nguyên hai khóa này.

## Kết quả kiểm chứng ngày 12/11/2026

- Đã tạo và chuyển ứng dụng sang database mới thực tế; chạy lại kiểm tra bằng tiến trình riêng sau khi seed kết thúc vẫn đọc được đầy đủ dữ liệu.
- **95 khóa ngoại và 23 điều kiện nghiệp vụ đạt**, không phát hiện bản ghi mồ côi hoặc sai lệch sổ tiền/tồn kho trong bộ dữ liệu mới.
- Đối chiếu số bản ghi trước/sau của chín bảng nghiệp vụ chính ở database cũ: không thay đổi. Báo cáo local: `backend/.tmp/local-seed/old-database-comparison.json`.
- Bộ kiểm thử backend: **852/852 bài, 35 file**, chạy với MySQL riêng. Có 16 bài mới cho seed local, gồm từ chối seed lại database có dữ liệu và phát hiện sai tổng phiếu nhập.
- Frontend: **39/39 bài**. Backend typecheck/lint/build và frontend lint/build đều đạt.
- Kiểm tra giao diện với database mới: đăng nhập Lotus/Ocean hiển thị riêng 24/18 phòng active; quản trị Innvyra hiển thị đủ ba khách sạn hoạt động.
- `python -m pip check` không thực thi được vì máy chỉ có WindowsApps Python alias; dự án dùng Node.js, các kiểm tra Node/MySQL ở trên đã chạy.

### Cập nhật nội dung hiển thị ngày 12/11/2026

Đã thay 291 ô văn bản trong database đang sử dụng, gồm cả tên gói trong kỳ thuê bao và nội dung ghi nhận liên quan. Các tên gói đã được chỉnh trực tiếp trước đó được giữ nguyên. Code seed đã được cập nhật tương ứng cho lần tạo database mới trên máy khác.

Rà lại các cột văn bản/JSON: không còn nhãn “mẫu”, “mô phỏng”, “minh họa” hoặc “tình huống mẫu”. Số bản ghi ở tất cả bảng giữ nguyên; 95 khóa ngoại và 23 điều kiện nghiệp vụ tiếp tục đạt. Bản sao các ô trước/sau chỉ lưu local tại `backend/.tmp/local-seed/text-cleanup-backup-*.json`; kết quả kiểm chứng tại `text-cleanup-verification.json` cùng thư mục. Không cần seed lại database hiện tại.

Kiểm chứng sau cập nhật: backend **852/852 bài trong 35 file**, frontend **39/39 bài**; backend typecheck/lint/build và frontend lint/build đều đạt. Đã xác nhận trên giao diện tên gói và nhà cung cấp/người liên hệ mới hiển thị đúng.


## Danh sách nhân viên theo khách sạn

| Khách sạn | Nhân viên | Vai trò | Username | Trạng thái |
| --- | --- | --- | --- | --- |
| Lotus Riverside · TP. Hồ Chí Minh | Nguyễn Minh An | ADMIN | lotus_admin_minhan | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Trần Ngọc Linh | MANAGER | lotus_quanly_ngoclinh | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Lê Hoàng Nam | RECEPTIONIST | lotus_letan_hoangnam | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Phạm Thanh Hà | HOUSEKEEPING | lotus_buongphong_thanhha | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Võ Gia Huy | ACCOUNTANT | lotus_ketoan_giahuy | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Đỗ Quốc Bảo | TECHNICIAN | lotus_kythuat_quocbao | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Bùi Quỳnh Anh | RECEPTIONIST | lotus_letan_quynhanh | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Hoàng Thảo Vy | HOUSEKEEPING | lotus_buongphong_thaovy | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Ngô Ngọc Ánh | HOUSEKEEPING | lotus_buongphong_ngocanh | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Dương Tuấn Kiệt | MANAGER | lotus_quanly_tuankiet | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Phan Khánh Chi | ACCOUNTANT | lotus_ketoan_khanhchi | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Huỳnh Đức Long | TECHNICIAN | lotus_kythuat_duclong | Đang làm việc |
| Lotus Riverside · TP. Hồ Chí Minh | Đinh Hữu Phúc | RECEPTIONIST | lotus_letan_huuphuc | Đã nghỉ việc |
| Lotus Riverside · TP. Hồ Chí Minh | Mai Hải Yến | RECEPTIONIST | lotus_letan_haiyen | Mới tiếp nhận, cần đổi mật khẩu |
| Ocean Breeze · Đà Nẵng | Nguyễn Hải Đăng | ADMIN | ocean_admin_haidang | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Trần Bảo Ngọc | MANAGER | ocean_quanly_baongoc | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Lê Minh Khoa | RECEPTIONIST | ocean_letan_minhkhoa | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Võ Thu Hương | HOUSEKEEPING | ocean_buongphong_thuhuong | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Phạm Ngọc Trâm | ACCOUNTANT | ocean_ketoan_ngoctram | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Đặng Quốc Hưng | TECHNICIAN | ocean_kythuat_quochung | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Nguyễn Thùy Dung | RECEPTIONIST | ocean_letan_thuydung | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Trần Thanh Tâm | HOUSEKEEPING | ocean_buongphong_thanhtam | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Lê Hoài An | HOUSEKEEPING | ocean_buongphong_hoaian | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Huỳnh Anh Tuấn | MANAGER | ocean_quanly_anhtuan | Đang làm việc |
| Ocean Breeze · Đà Nẵng | Đỗ Thành Đạt | RECEPTIONIST | ocean_letan_thanhdat | Đã nghỉ việc |
| Ocean Breeze · Đà Nẵng | Bùi Phương Anh | RECEPTIONIST | ocean_letan_phuonganh | Mới tiếp nhận, cần đổi mật khẩu |
| Pine Valley · Đà Lạt | Vũ Minh Khánh | ADMIN | pine_admin_minhkhanh | Đang làm việc |
| Pine Valley · Đà Lạt | Nguyễn Hoàng Phúc | MANAGER | pine_quanly_hoangphuc | Đang làm việc |
| Pine Valley · Đà Lạt | Trần Thảo Nhi | RECEPTIONIST | pine_letan_thaonhi | Đang làm việc |
| Pine Valley · Đà Lạt | Lê Ngọc Mai | HOUSEKEEPING | pine_buongphong_ngocmai | Đang làm việc |
| Pine Valley · Đà Lạt | Phạm Quỳnh Như | ACCOUNTANT | pine_ketoan_quynhnhu | Đang làm việc |
| Pine Valley · Đà Lạt | Đỗ Tuấn Anh | TECHNICIAN | pine_kythuat_tuananh | Đang làm việc |
| Pine Valley · Đà Lạt | Võ Gia Bảo | RECEPTIONIST | pine_letan_giabao | Đang làm việc |
| Pine Valley · Đà Lạt | Hoàng Tú Uyên | HOUSEKEEPING | pine_buongphong_tuuyen | Đang làm việc |
| Pine Valley · Đà Lạt | Trần Minh Quân | RECEPTIONIST | pine_letan_minhquan | Đã nghỉ việc |
| Pine Valley · Đà Lạt | Nguyễn Thanh Vân | RECEPTIONIST | pine_letan_thanhvan | Mới tiếp nhận, cần đổi mật khẩu |

Đã cập nhật trực tiếp 36 nhân viên, ba số phòng và 24 tên khách bị nối tên; giữ nguyên ID, mật khẩu, vai trò, trạng thái, đơn đặt phòng và sổ tiền/kho. Đã xác minh đăng nhập 33 tài khoản hoạt động bằng username mới, ba tài khoản đã nghỉ bị từ chối đăng nhập. Các nút điền nhanh ở trang đăng nhập dev cũng dùng username mới. Không cần seed lại; đăng nhập bằng username mới và mật khẩu hiện có.

Kiểm chứng sau chuẩn hóa: **853/853 bài backend (35 file)**, **39/39 bài frontend**; riêng seed/cấu hình **17/17 bài**. Typecheck/lint/build đều đạt. Database thực tế giữ nguyên số bản ghi, ID và dấu kiểm chứng mật khẩu/vai trò/trạng thái; 95 khóa ngoại và 23 điều kiện nghiệp vụ đạt. Báo cáo và bản sao thay đổi chỉ lưu local tại `backend/.tmp/local-seed/professional-verification.json` và `professional-backup-*.json`.
