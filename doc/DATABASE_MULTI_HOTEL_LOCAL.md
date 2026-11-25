# Database local và dữ liệu demo đa khách sạn

Dùng hướng dẫn này để tạo hoặc kiểm tra bộ dữ liệu mẫu Lotus Riverside, Ocean Breeze và Pine Valley. Chuẩn bị Node.js, MySQL local và `.env` theo [hướng dẫn cài đặt backend](CAI_DAT_VA_CHAY.md#chuẩn-bị).

## Tạo bộ demo trong schema riêng

Chọn tên schema chưa tồn tại, rồi chạy các lệnh sau trong `backend`.

```powershell
npm run prisma:generate
npm run db:seed:multi -- --database innvyra_demo --activate
```

Seed tạo schema mới, áp dụng migration và kiểm chứng quan hệ, tồn kho, các luồng đặt phòng, lưu trú và thanh toán. `--activate` chuyển `DATABASE_URL` trong `.env` sang schema mới sau khi đã đối chiếu thành công. Bỏ `--activate` để dùng schema mới độc lập trong khi ứng dụng tiếp tục kết nối như trước.

`npm run db:seed` gọi cùng script tạo demo. Dùng `db:seed:multi` khi muốn chỉ định rõ schema. Script từ chối tạo đè schema đã tồn tại, kể cả schema rỗng.

## Đăng nhập và đối chiếu

- Đọc tài khoản mẫu trong `backend/.tmp/local-seed/<tên-schema>.manifest.json` hoặc kết quả terminal khi seed. Manifest mô tả bộ dữ liệu của lần chạy. Đăng nhập khách sạn bằng username tại `/login`, quản trị Platform bằng email tại `/platform/login`.
- Tùy vai trò, bộ mẫu có đặt phòng, lưu trú, folio, công việc buồng phòng, bảo trì, vật tư, phiếu nhập và lịch sử thanh toán. Dùng dữ liệu hai khách sạn để đối chiếu phạm vi tài khoản.
- Chạy `npm run db:check:multi` tại `backend` để kiểm tra schema đang cấu hình. Để đọc schema khác cùng máy MySQL, dùng `npm run db:check:multi -- --database innvyra_demo`. Kết quả được lưu tại `backend/.tmp/local-seed/<tên-schema>.verification.json`.

## Nâng cấp bộ demo đã có

`npm run db:update:local` dành cho bộ seed local tương thích. Lệnh sinh Prisma Client, áp dụng migration, chuẩn hóa phiếu nhập mẫu, bổ sung bảng danh mục và định mức còn thiếu, rồi kiểm chứng. Áp dụng cho đúng schema đã kiểm tra. Các bản sao và báo cáo của lệnh nằm trong `backend/.tmp/local-seed/`.

Chạy `npm run db:refresh:receipts` hoặc `npm run db:backfill:supplies` để xem trước từng phần. Thêm `-- --apply` khi đã kiểm tra phần cần áp dụng. Các phiếu đã được ghi nhận thanh toán giữ lịch sử trả và đảo tiền. Xem [buồng phòng và kho](VAN_HANH_BUONG_PHONG_BAO_TRI_VA_KHO.md#vật-tư-và-thanh-toán-nhà-cung-cấp) để đối chiếu các trường hợp nghiệp vụ.

Với bộ seed local còn mã đặt phòng cũ, chạy `npm run db:shorten:reservation-codes` để xem số bản ghi cần đổi. Sau khi kiểm tra, chạy `npm run db:shorten:reservation-codes -- --apply` để chuyển sang mã `INN-` cùng 12 ký tự hex. Script lưu bản sao dữ liệu trước khi đổi mã và giữ ID cùng các liên kết nghiệp vụ.

## Kiểm thử đa khách sạn

Dùng [demo A/B và kiểm thử tích hợp](MULTI_HOTEL.md#demo-và-kiểm-thử) trên schema test riêng. Kết quả xác minh của từng lượt seed phụ thuộc dữ liệu và ngày tạo.
