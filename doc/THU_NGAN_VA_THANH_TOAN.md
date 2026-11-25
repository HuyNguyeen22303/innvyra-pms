# Thu ngân, QR và quyết toán folio

Hướng dẫn nhận cọc và thanh toán bằng QR, quyết toán đơn hủy hoặc khách không đến, cùng hợp đồng API thu ngân.

- [QR nhận cọc và thanh toán](#qr-nhận-cọc-và-thanh-toán).
- [Quyết toán đơn hủy và khách không đến](#quyết-toán-đơn-hủy-và-khách-không-đến).
- [Hợp đồng thu ngân](#hợp-đồng-thu-ngân).

## QR nhận cọc và thanh toán

QR được tạo trên backend bằng `vietqr@1.2.0`, không cần API key, không gọi dịch vụ tạo ảnh. Mỗi khách sạn có một tài khoản nhận tiền. Chưa có webhook hoặc tự xác nhận tiền về.

### Cấu hình

Đăng nhập **ADMIN khách sạn → Thông tin khách sạn → Tài khoản nhận chuyển khoản**. Chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản, bật nhận QR rồi lưu. Tên được chuẩn hóa in hoa không dấu; hệ thống chưa xác minh tên với ngân hàng. Kiểm tra người thụ hưởng trên ứng dụng ngân hàng trước khi sử dụng thực tế.

Các khách sạn trong seed mặc định chưa cấu hình tài khoản. Không dùng tài khoản ngân hàng bịa trong seed để nhận tiền. ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT có quyền sử dụng QR; chỉ ADMIN khách sạn được sửa tài khoản. Platform admin không cấu hình tài khoản thay khách sạn trong đợt này.

Thay đổi hoặc tắt cấu hình hủy các yêu cầu QR đang chờ. QR đã tải/chụp vẫn có thể dùng chuyển khoản ngoài hệ thống; nếu khách đã chuyển theo QR cũ, phải kiểm tra tiền thực nhận và ghi nhận/hoàn tiền bằng nghiệp vụ hiện có.

### Đặt phòng và nhận cọc

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

### Thu tiền trong folio

Mở folio, chọn **Nhận chuyển khoản QR**, nhập loại thu và số tiền. Xác nhận khi tiền thực tế đã về. Các thao tác tiền mặt, chuyển khoản thủ công, điều chỉnh và hoàn tiền tiếp tục sử dụng như trước.

Mỗi đơn chỉ có một yêu cầu đang chờ. Cùng loại/số tiền dùng lại yêu cầu đó; muốn thay đổi phải hủy có lý do rồi tạo mới. Số tiền thực nhận khác QR hoặc khách dùng QR đã hủy: đối soát và ghi nhận số tiền thực tế qua luồng thủ công, không tự sửa yêu cầu QR cũ.

QR hỗ trợ số đồng nguyên từ 1 đến 9.999.999.999.999đ. Không có bộ đếm hết hạn. Trước khi ghi tiền, backend kiểm tra lại công nợ và trạng thái. Đơn hủy/NO_SHOW hủy yêu cầu cọc; đóng folio hủy yêu cầu còn chờ. Báo cáo chỉ tính khoản thu đã xác nhận.

### Cập nhật ứng dụng

Làm theo [hướng dẫn chuẩn bị database](CAI_DAT_VA_CHAY.md#chuẩn-bị-database) để áp dụng migration, rồi chạy API và [frontend](CAI_DAT_VA_CHAY.md#frontend). VietQR dùng cấu hình tài khoản nhận chuyển khoản của từng khách sạn trong PMS.

### Kiểm thử QR

Test backend dùng DB `_test` riêng qua `npm run test:mysql`. Có kiểm thử giải mã ảnh PNG thật, CRC, số tiền lớn, phân quyền, tenant, idempotency, hai kết nối đồng thời, rollback khi ghi tiền/audit/idempotency lỗi, đổi tài khoản, hủy đơn và đóng folio. Seed checker kiểm tra liên kết yêu cầu QR với khoản thu và mỗi đơn chỉ có một yêu cầu chờ.

## Quyết toán đơn hủy và khách không đến

### Phạm vi và dữ liệu

- ADMIN, MANAGER và ACCOUNTANT quyết toán, hoàn tiền hoặc đóng folio. RECEPTIONIST xem và thu tiền theo quyền được cấp. Người có quyền quyết toán xác nhận việc miễn hoặc giữ phí.
- Folio mới của đơn hủy hoặc khách không đến mở ở mức phí phòng 0. Người có quyền ghi nhận phí thực tế qua đối soát. Folio đã mở trước đó giữ các dòng tiền phòng cho đến khi được rà soát.
- Tổng phí lấy DEBIT trừ CREDIT. Dòng tiền chỉ thay đổi khi khoản thu hoặc hoàn tiền được xác nhận. Xem [hợp đồng quyết toán](#cancellation--no-show-review).

### Cách sử dụng

1. Mở folio của đơn đã hủy/không đến, chọn **Quyết toán đơn hủy / Không đến**.
2. Kiểm tra phí và tiền đã thu/hoàn, nhập tổng phí giữ lại, lý do, xác nhận đối soát.
3. Lưu. Số dư 0 thì folio đóng; số dư âm là cần hoàn, số dư dương là còn phải thu.
4. Ghi nhận hoàn tiền từ từng phiếu thu hoặc thu thêm đúng tiền thực tế, sau đó đóng.

### Kiểm thử quyết toán

Thử một đơn đã hủy và một đơn không đến. Đối chiếu trường hợp miễn phí, giữ lại một phần tiền cọc, thu thiếu và hoàn tiền từ phiếu gốc. Sau mỗi thao tác, so sánh số dư folio với báo cáo thu và hoàn. Xem [các lệnh kiểm thử backend](CAI_DAT_VA_CHAY.md#kiểm-thử-backend).

## Hợp đồng thu ngân

The billing module handles the service catalog, service orders, one primary folio per reservation, charges, receipts, refunds, adjustments and settlement. The corresponding PMS screens are covered in [QR deposits and payments](#qr-nhận-cọc-và-thanh-toán) and [cancellation and no-show settlement](#quyết-toán-đơn-hủy-và-khách-không-đến).

### Schema and migration

Added models: `Service`, `ServiceOrder`, `ServiceOrderItem`, `Folio`, `FolioItem`, `Payment`, `BillingIdempotency`, `BillingAuditLog`.

The core billing tables and scoped Stay reference were introduced in migration `20261015000000_billing_management`. See the [Prisma schema](../backend/prisma/schema.prisma) for the current models and constraints.

- Composite hotel foreign keys use RESTRICT. Refunds reference an original payment in the same folio; related adjustments reference an item in the same folio.
- Unique reservation ID enforces one folio. Unique room-night/service-order-item references and source type/ID prevent duplicate posting.
- CHECK constraints enforce whole VND, money bounds/signs, quantity/line totals, source consistency, status timestamps and payment references. MySQL 8.0.16+ is required; verification used MySQL 8.0.41.
- Service items preserve price, name and unit snapshots from order creation. Completed payments, entries, snapshots and audit have no update/delete endpoint. Catalog DELETE deactivates. Privileged direct SQL access is outside application immutability; no triggers prevent a database administrator from editing rows.

### Money and business policy

An isolated Prisma Decimal context uses precision 40. Stored amounts use `DECIMAL(18,2)` and API amounts are strings. VND input must be whole dong: `"1000"`, `"1000.0"`, `"1000.00"` normalize to `"1000.00"`. Fractional dong, JS numbers, exponents, negative inputs and values beyond `9999999999999999.00` are rejected. Payments/refunds/adjustments must be positive; free room/service sources retain zero debit entries for traceability.

Historical `ReservationRoomNight.nightlyRate` permits fractional prices. Billing rounds **each original nightly snapshot half-up to whole dong** (900000.50 → 900001.00), never reads today's RoomType basePrice and never rewrites snapshots. All booked nights are posted on opening as contractual debt, not daily revenue recognition.

```text
Net Charges = Total Charges (DEBIT) - Total Credits
Net Paid = confirmed PAYMENT + confirmed DEPOSIT - confirmed REFUND
Outstanding Balance = Net Charges - Net Paid
```

Reads aggregate entries and payments in a RepeatableRead snapshot. Pending/failed money is excluded. Deposits have a separate total and never create a duplicate credit. Imported/admin-created negative balances are exposed, never clamped to zero.

- Folio opening is idempotent: manual opening remains available, reservation creation with initialDeposit opens it atomically, and check-in ensures an OPEN folio in its arrival transaction. Check-in reuses prepaid folios and rejects CLOSED ones. GET never opens a folio. A new CANCELLED/NO_SHOW folio starts empty for explicit terminal settlement. Existing pre-arrival room charges remain intact until reviewed.

The reservation deposit and arrival workflows share the hotel lock and transaction with billing. See [reservation deposits and folio opening](DAT_PHONG_VA_LUU_TRU.md#quy-trình-lễ-tân).
- New orders require an active stay. Supplied stayId must be active and belong to the same reservation/hotel, with live occupancy. Without stayId the order is reservation-level during an active stay. Prices snapshot when the order is created. Completion and charges commit atomically. Previously requested services may complete after physical checkout. Only REQUESTED orders can cancel.
- `GET /service-orders?search=` uses one term: numeric input matches a physical room-number prefix (for example `2` finds 201/202 but not 102); text matches guest name, confirmation code or room number (case/diacritic-insensitive via the database collation). Internal order/reservation/stay IDs are not searchable. Guest-name matching is excluded for ACCOUNTANT; room/code search still works.
- Physical checkout performs no billing mutation. Cancellation creates no automatic refund/credit and deletes no charges. Folios may remain OPEN with debt after checkout.
- Receipts require `confirmedReceived:true`; BANK_TRANSFER also requires an actual transfer reference. This is the authorized employee's attestation, not a bank integration. Payment/deposit cannot exceed current outstanding. Deposits are allowed only for CONFIRMED/CHECKED_IN/PARTIALLY_CHECKED_IN reservations.
- ADMIN/MANAGER/ACCOUNTANT may approve and record manual refunds with a mandatory reason and `confirmedRefunded:true`; bank refunds require the outgoing reference. The recording employee is the approver under this MVP policy; two-person approval is not implemented. Cumulative refunds cannot exceed the original confirmed receipt or folio net money received. Refunds cannot themselves be refunded.
- Refund returns money and **increases outstanding**; it does not reduce charges. For a paid concession or cancellation settlement, record the approved actual refund first, then a CREDIT adjustment. This avoids creating unsupported credit balances. No cancellation event triggers automatic refund.
- Adjustments append a DEBIT/CREDIT with staff/reason and optional same-folio original item reference. CREDIT cannot create a negative balance. Old entries and payment amounts are never changed.
- Close requires exactly zero balance, no REQUESTED orders or PENDING payments, no active stays, and reservation CHECKED_OUT, CANCELLED or NO_SHOW. Closing is idempotent. CLOSED rejects new postings; replay of an already committed request still succeeds.
- Staff confirmation records receipts, including bank transfers requested through the [QR workflow](#qr-nhận-cọc-và-thanh-toán). A waiting QR request is tracked separately from a confirmed receipt. Existing PENDING payment rows block receipts, refunds and closure.

### Cancellation / no-show review

`GET /folios/:id/terminal-settlement` reads a snapshot of the open terminal folio,
money totals, blockers and a revision. `POST` to the same path requires settle
permission, an Idempotency-Key, `expectedRevision`, `finalChargeAmount`, `reason`
and `confirmedReviewed:true`. The amount is the **final total for the whole folio**,
including retained cancellation/no-show fees and every other agreed charge. Zero
explicitly waives all charges; no policy or deposit forfeiture is inferred.

Within the existing hotel lock/transaction, the difference from net charges is
appended as MANUAL_ADJUSTMENT. Original room/service rows remain immutable.
Unlike a general CREDIT adjustment, this explicit review may make outstanding
negative to show the actual refund due. No payment/refund is fabricated. If the
result is zero, close/audit/idempotency commit atomically; otherwise the folio
remains open for actual receipts/refunds, then explicit closure. Stale reviews
return `SETTLEMENT_STALE` without writing. Pending activity or active stays block.

After explicit terminal review, refunds are also limited by the remaining
customer credit. Legacy refund-then-credit API workflows remain supported on
folios without a terminal review. Receipt-list rows expose `refundableAmount`
after confirmed/pending refunds to guide partial/multiple-receipt returns.
Reports already include these immutable adjustment credits/debits in net billed
charges; cash totals change only for actual confirmed payment/refund records.

No schema migration, new database, seed rerun or automatic historical adjustment
is needed for settlement. See the [operator workflow](#quyết-toán-đơn-hủy-và-khách-không-đến).

### Idempotency, locks and audit

Payment, deposit, refund and adjustment POSTs require `Idempotency-Key`: 8–128 ASCII letters/digits or `. _ : -`, starting with a letter/digit. Keep the **same key and payload after a timeout**; use a new key only for a new financial operation. Different keys identify separate receipts; the server cannot infer whether two separately attested cash receipts represent the same cash.

SHA-256 hashes the case-sensitive key and canonical validated payload plus operation and target. Keys are unique across financial operations within one hotel. Equivalent money formats normalize; absent/null receipt references are equivalent. Same key/payload returns the original response/status; a changed payload/target/operation returns `409 IDEMPOTENCY_CONFLICT`. Authentication/current permissions are enforced before replay. Keys have no automatic expiry. Hashes are never exposed through the API.

Every Billing write starts a ReadCommitted Prisma transaction and locks the hotel's row using parameterized `SELECT ... FOR UPDATE`. Reservation, Stay, Room and Guest already take that same first lock, covering cross-module races as well as orders created before a folio exists. Checks and writes remain atomic across checkout, cancellation, order creation/completion, payment, refund, adjustment and closure. Different hotels proceed independently. Unique database constraints provide a second duplicate-source/key guard.

The ledger row, status transition, audit and idempotency response commit together. Failures roll everything back. Only database-confirmed rollback conflicts (`P2034`) retry the entire transaction, at most twice with short backoff. Ambiguous commit/network errors never retry automatically; clients retry the original key. Known conflicts become sanitized `FINANCIAL_CONFLICT` errors. Audit captures hotel, actor, action, target, timestamp and adjustment/refund/cancellation reason without credentials, card data or raw request bodies.

Hotel-level serialization may limit a busy property's throughput. Measure contention before introducing a finer lock protocol across all dependent modules. Audit/idempotency retention, reopening and post-close corrections need future explicit policies. No gateway, taxes, general ledger, revenue recognition, split folios or currency conversion is implemented.

### API and RBAC

All paths are under `/api/v1`, use Bearer authentication and `success/message/data`. Mutations require `X-CSRF-Protection: 1`; browser origin must be allowlisted. Responses have `Cache-Control: no-store`. IDs are BIGINT strings. Unknown fields, including client-supplied hotel/actor/role/status, are rejected.

| Method/path                                  | Behavior                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET /services                                | page, limit, search name/code, isActive, sortBy name/code/price/createdAt, sortOrder |
| GET /services/:id                            | Catalog detail                                                                       |
| POST /services                               | Create catalog entry                                                                 |
| PATCH /services/:id                          | Current catalog changes; preserve old snapshots                                      |
| DELETE /services/:id                         | Deactivate                                                                           |
| POST /service-orders                         | reservationId, optional stayId, items, notes                                         |
| GET /service-orders                          | page, limit, reservationId, stayId, status, search, sortBy createdAt/id, sortOrder   |
| GET /service-orders/:id                      | Order and item snapshots                                                             |
| POST /service-orders/:id/complete            | Complete and post charges atomically                                                 |
| POST /service-orders/:id/cancel              | Cancel REQUESTED order with reason                                                   |
| POST /reservations/:reservationId/folio/open | Open once and post nightly snapshots                                                 |
| GET /reservations/:reservationId/folio       | Existing folio                                                                       |
| GET /folios/:id                              | Folio and financial totals                                                           |
| GET /folios/:id/items                        | Paginated immutable entries                                                          |
| POST /folios/:id/adjustments                 | DEBIT/CREDIT; Idempotency-Key required                                               |
| POST /folios/:id/close                       | Close settled eligible folio                                                         |
| GET /folios/:id/terminal-settlement          | Read terminal folio balances, blockers and review revision                            |
| POST /folios/:id/terminal-settlement         | Approve final total charges with reason/revision; Idempotency-Key required              |
| POST /folios/:folioId/payments               | PAYMENT/DEPOSIT; Idempotency-Key required                                            |
| GET /folios/:folioId/payments                | Paginated receipts/refunds                                                           |
| POST /payments/:id/refunds                   | Linked REFUND; Idempotency-Key required                                              |

Lists default to page 1, limit 20, maximum limit 100; stable ID tie-breakers. Ledger/payment lists are chronological by ID.

| Role                     | Read Billing | Catalog write | Order write | Open / receipt | Adjustment / refund / close |
| ------------------------ | ------------ | ------------- | ----------- | -------------- | --------------------------- |
| ADMIN, MANAGER           | Yes          | Yes           | Yes         | Yes            | Yes                         |
| RECEPTIONIST             | Yes          | No            | Yes         | Yes            | No                          |
| ACCOUNTANT               | Yes          | No            | No          | Yes            | Yes                         |
| HOUSEKEEPING, TECHNICIAN | No           | No            | No          | No             | No                          |

Server authentication supplies current roles and hotel/actor IDs. ADMIN is hotel-scoped too. Foreign IDs return the same 404 as absent IDs. Middleware and service both check permission.

### Swagger / Postman walkthrough

1. After migration, open `/api-docs/` or import `/api-docs/openapi.json`. Use the Billing and Payment QR sections for the current contract.
2. Login with provisioned staff credentials and CSRF header, then set Bearer authorization. Use real IDs from responses.
3. Create a confirmed reservation for one 900000 VND room for two nights using the existing API. POST `/reservations/<id>/folio/open` with `{}`. Charges: `1800000.00`.
4. POST `/folios/<id>/payments` with a fresh key and:

```json
{
  "paymentType": "DEPOSIT",
  "paymentMethod": "CASH",
  "amount": "500000.00",
  "confirmedReceived": true
}
```

5. Physically check in through Stay API. ADMIN creates `{"code":"LAUNDRY","name":"Laundry","unit":"item","price":"50000.00"}` and an analogous MINIBAR at 50000. Prices are synthetic examples.
6. POST `/service-orders` with reservationId, stayId and items for two Laundry units and one Minibar unit. POST `/service-orders/<id>/complete` with `{}`. Total charges: `1950000.00`.
7. Record PAYMENT `1000000.00` with actual-receipt confirmation and a new key. GET folio: deposits `500000.00`, payments `1000000.00`, outstanding `450000.00`. Same key/body returns same receipt; changed amount with same key returns 409.
8. Record PAYMENT `450000.00`, check out physically, then ADMIN/MANAGER/ACCOUNTANT POST `/folios/<id>/close` with `{}`. Expect CLOSED/zero. Check-out alone leaves OPEN.
9. Test refunds on a separate OPEN folio: POST `/payments/<id>/refunds` with a fresh key and `{"amount":"200000.00","reason":"Approved manual return of receipt","confirmedRefunded":true}`. A separate REFUND row appears and outstanding increases. Bank operations also require incoming/outgoing referenceNumber.

### Kiểm thử thu ngân

Chạy `npm test` để kiểm tra validation, phân quyền và hợp đồng HTTP. Dùng `npm run test:mysql` để kiểm tra transaction, idempotency và thao tác đồng thời trên database test riêng. Xem [hướng dẫn kiểm thử backend](CAI_DAT_VA_CHAY.md#kiểm-thử-backend).
