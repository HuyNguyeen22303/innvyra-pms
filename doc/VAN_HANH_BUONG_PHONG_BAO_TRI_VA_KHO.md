# Vận hành buồng phòng, bảo trì và kho

Hướng dẫn vòng đời phòng, chặn bảo trì, định mức vật tư, phiếu nhập và thanh toán nhà cung cấp.

- [Buồng phòng, bảo trì và tồn phòng](#buồng-phòng-bảo-trì-và-tồn-phòng).
- [Vật tư và thanh toán nhà cung cấp](#vật-tư-và-thanh-toán-nhà-cung-cấp).

## Buồng phòng, bảo trì và tồn phòng

Operations tracks room turnover, housekeeping inspections, maintenance tickets and date-based maintenance blocks. The [housekeeping and inventory guide](#vật-tư-và-thanh-toán-nhà-cung-cấp) covers material usage and supplier receipt workflows.

### Database

The core Operations models were introduced in migration `20261015010000_operations_management`.

- `HousekeepingTask`: turnover workflow, assignment, actor/timestamps, nullable unique `activeRoomId` slot.
- `MaintenanceTicket`: report, assignment, resolution and closure.
- `MaintenanceBlock`: hotel-local half-open date interval and release/cancellation history.
- `OperationsAuditLog`: ordered history, actor, old/new state and reason; exactly one referenced task/ticket/block.
- `Room.maintenanceManaged`: internal ownership marker for physical MAINTENANCE caused by a block. Not client writable and not exposed by the Room serializer.
- Composite foreign keys bind staff, room, ticket, task, block and audit records to the same hotel. A block's linked ticket must also reference the same room.
- MySQL unique index plus CHECK constraint allows exactly one active turnover task per room; terminal tasks release the nullable slot. CHECK constraints validate maintenance intervals and audit entity references.
- Existing room/stay/reservation/billing rows and prices remain intact. Existing legacy physical restrictions have `maintenanceManaged=false` and retain their meaning.

### HTTP contract

Base URL: `/api/v1`. All endpoints require Bearer JWT. Writes also require `X-CSRF-Protection: 1`; browser Origin must be allowed in CORS.

Responses retain `{ success, message, data }`; failures retain the existing global error envelope. IDs are unsigned BIGINT decimal strings. Lists contain `data.items` and `data.pagination`. Detail/mutation responses include ordered audit history. No guest records, documents, contact details, password hashes or session secrets are joined into Operations responses.

| Method | Path                             | Action                                |
| ------ | -------------------------------- | ------------------------------------- |
| GET    | /housekeeping/tasks              | List/filter/paginate tasks            |
| GET    | /housekeeping/tasks/:id          | Task with history                     |
| POST   | /housekeeping/tasks              | Create turnover task                  |
| PATCH  | /housekeeping/tasks/:id/assign   | Assign active staff                   |
| POST   | /housekeeping/tasks/:id/start    | Start assigned cleaning               |
| POST   | /housekeeping/tasks/:id/complete | Submit for inspection                 |
| POST   | /housekeeping/tasks/:id/inspect  | Pass or reject inspection             |
| POST   | /housekeeping/tasks/:id/cancel   | Cancel nonterminal task               |
| GET    | /housekeeping/dirty-rooms        | Dirty room list without guest data    |
| GET    | /maintenance/tickets             | List/filter/search tickets            |
| GET    | /maintenance/tickets/:id         | Ticket with history                   |
| POST   | /maintenance/tickets             | Report issue                          |
| PATCH  | /maintenance/tickets/:id/assign  | Assign technician                     |
| POST   | /maintenance/tickets/:id/start   | Start assigned repair                 |
| POST   | /maintenance/tickets/:id/resolve | Record repair outcome                 |
| POST   | /maintenance/tickets/:id/close   | Verify and close                      |
| POST   | /maintenance/tickets/:id/cancel  | Cancel open/assigned ticket           |
| GET    | /maintenance/blocks              | List/filter intervals                 |
| GET    | /maintenance/blocks/:id          | Block with history                    |
| POST   | /maintenance/blocks              | Validate inventory and block room     |
| POST   | /maintenance/blocks/:id/release  | Verify safety and reopen for cleaning |
| POST   | /maintenance/blocks/:id/cancel   | Cancel future scheduled work          |

Pagination: page 1–1,000,000, limit 1–100, sortOrder asc/desc. Sort fields are allowlisted. Task filters: status, priority, roomId, assignedTo, taskType, floorNumber. Ticket filters: search, status, priority, roomId, assignedTo, inclusive hotel-local reported fromDate/toDate. Block filters: status, roomId, maintenanceTicketId, interval overlap fromDate/toDate (exclusive end).

### Workflows and room state

#### Housekeeping

`PENDING → IN_PROGRESS → AWAITING_INSPECTION → COMPLETED` updates the room `DIRTY → CLEANING → INSPECTION → READY` in the same transaction.

- Only vacant, active rooms without current/unreleased maintenance are eligible for cleaning actions.
- Assignment is restricted to PENDING tasks and active HOUSEKEEPING/ADMIN/MANAGER staff in the current hotel.
- Only the assigned staff member starts or completes a task, including when the caller is a manager.
- Failed inspection requires notes, records inspector/time/reason, returns task to PENDING and room to DIRTY. Restart resets current-attempt timestamps; all prior attempts remain in audit history.
- Only ADMIN/MANAGER can inspect. Completed tasks cannot be cancelled. Cancellation of a nonterminal task keeps room DIRTY and releases the unique active-task slot.
- MVP supports TURNOVER_CLEANING only. STAYOVER_CLEANING is rejected until its occupied-room policy is implemented.
- Checkout and transfer create the source room's turnover task in their existing transaction. An audit/task persistence failure rolls back checkout/transfer. Retried checkout is rejected by the existing stay state machine and creates no duplicate.
- Room POST requires DIRTY. Room PATCH cannot set CLEANING, INSPECTION or READY. Direct DIRTY is allowed only for a vacant room without an active task, so existing legacy rooms can enter the workflow.
- Active tasks/blocks prevent Room PATCH from changing operational state, type or deactivating the room. Metadata edits remain possible.

#### Maintenance tickets

`OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.

Only the assignee starts/resolves. ADMIN/MANAGER assign and close. OPEN/ASSIGNED can be cancelled with a reason. Close/cancel requires all linked blocks to be ended. Reporting and resolving never automatically release a block.

#### Maintenance blocks

`SCHEDULED → ACTIVE → RELEASED`; a future SCHEDULED block may instead become CANCELLED.

- Dates use the hotel's configured timezone and `[startDate,endDate)`, matching reservation nights. Duration is 1–365 nights and startDate cannot be in the past.
- Current blocks set physical MAINTENANCE and housekeeping DIRTY. An in-progress/inspection cleaning task is returned to PENDING with a maintenance-rework audit.
- Future blocks leave current physical/readiness state unchanged. A worker scans every 30 seconds and at server startup, activating due work inside the same hotel lock. Multiple processes are safe.
- Current/unreleased and date-overlap guards are checked independently of the worker in check-in/transfer/inspection. Worker downtime cannot permit a conflicting new stay.
- Existing occupants must be transferred or checked out before block creation, including future scheduled blocks (conservative MVP policy).
- If an occupant overstays into scheduled work, activation is deferred; the block remains SCHEDULED and date guards prevent additional occupancy. Staff must handle the occupant before maintenance. No automatic guest movement/cancellation.
- Planned endDate defines inventory exclusion; it does not attest technical safety or automatically reopen a room. Due work discovered after downtime still requires review/release. Room readiness remains separate from future sellability.
- Release requires ADMIN/MANAGER, safety notes, no occupant, and a RESOLVED/CLOSED linked ticket. Unlinked blocks require the manager's safety attestation.
- Physical ACTIVE is restored only for a block-owned physical restriction and only when no other current/unreleased block remains. Independent OUT_OF_SERVICE/legacy restrictions are preserved.
- Release always leaves DIRTY and ensures one turnover task. The room still cannot receive a guest until inspection passes.
- Repeated release returns 409 MAINTENANCE_ALREADY_RELEASED; repeated cancellation also returns 409. History remains and inventory is never incremented twice.

### Availability and concurrency

All capacity/occupancy/Operations writes acquire `SELECT id FROM hotels WHERE id = ? FOR UPDATE` first, using parameterized Prisma SQL. Operations uses READ COMMITTED and retries only database-confirmed deadlock rollback (P2034), at most twice. Ambiguous connection/commit failures are not automatically retried.

Reservation nightly rows remain the booking ledger. The shared inventory helper adds the number of distinct blocked rooms per night to existing reserved-night counts. Both GET availability and transactional POST reservation creation use this helper. The maximum combined nightly demand determines availability; no stock counter is separately decremented/incremented.

Base capacity includes physical ACTIVE rooms and MAINTENANCE rooms explicitly owned by blocks. The latter are subtracted by their intervals once. Independently restricted/inactive rooms are excluded from base capacity and their intervals are not subtracted again. Room capacity-reduction guards use the same combined demand.

Block creation rechecks overlapping intervals, active occupancy, explicit room assignments, and each-night capacity inside the shared lock. Date intervals on different nights do not accumulate into an incorrect whole-stay sum. Cancellation/release atomically removes a block from consuming states. Reservation prices, nights and assignment/transfer history are retained.

This is intentionally a coarse lock per hotel, matching the existing architecture. Different hotels can write concurrently. At larger scale, per-type/night locks would require a coordinated redesign across all modules.

### RBAC

| Role            | Housekeeping                                                   | Tickets                                    | Blocks                     |
| --------------- | -------------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| ADMIN / MANAGER | Read/create/assign/cancel/inspect; execute only own assignment | Manage; execute only own assignment        | Read/create/release/cancel |
| RECEPTIONIST    | Read/create/dirty-room list                                    | Read/report                                | Read                       |
| HOUSEKEEPING    | Read own assignments; start/complete                           | Read/report                                | Read only                  |
| TECHNICIAN      | No access                                                      | Read own assignments; report/start/resolve | Read only                  |
| ACCOUNTANT      | No access                                                      | No access                                  | No access                  |

All scope and actor IDs come from the authenticated server principal. Role changes/inactivation remain enforced by existing authentication. STAFF ID in assignment is validated against hotel, activity and operational role.

### Swagger / Postman verification

Start the API after migrations, then open `/api-docs/` or import `/api-docs/openapi.json` into Postman.

1. Login with an existing seeded/provisioned staff account using the auth API and CSRF header. Authorize with its access token.
2. Create a DIRTY room or use a vacant DIRTY room; create its turnover task.
3. Assign a HOUSEKEEPING user, then use that user's JWT to start and complete.
4. Use ADMIN/MANAGER to inspect with `{"passed":false,"notes":"Bathroom requires rework"}`; repeat cleaning and inspect with `{"passed":true}`. Confirm room READY and both inspections in history.
5. Report a maintenance ticket and create a current/future block. Use actual room/staff/ticket IDs and dates relative to the hotel's current day.
6. Compare GET availability before/after. Attempt to reserve more than remaining capacity, check in, or transfer into a blocked room; expect 409.
7. Assign technician, start and resolve with `{"resolutionNotes":"Replaced and tested component"}`.
8. Release with `{"notes":"Repair verified safe; cleaning required"}`; confirm DIRTY and one turnover task. Repeating release returns 409.
9. Check ticket/block details for retained history and inspect with a foreign hotel's token to verify 404.

### Kiểm thử

Chạy `npm test` và `npm run test:mysql` theo [hướng dẫn kiểm thử backend](CAI_DAT_VA_CHAY.md#kiểm-thử-backend). Kiểm tra chặn bảo trì theo lịch, mở lại phòng sau xác nhận an toàn, tồn theo từng đêm và việc dọn phòng được tạo sau checkout hoặc đổi phòng.

## Vật tư và thanh toán nhà cung cấp

### Cập nhật dự án có dữ liệu sẵn

Chạy trong thư mục `backend` sau khi lấy code:

```powershell
npm ci
npm run db:update:local
```

Lệnh dành cho bộ dữ liệu local Lotus/Ocean/Pine đã có: sinh Prisma Client, chạy migration, chuẩn hóa phiếu nhập, bổ sung vật tư/định mức rồi kiểm chứng liên kết và sổ kho. Sau đó khởi động lại backend/frontend. Không tạo database khác hoặc reset dữ liệu. Giữ nguyên đơn đặt phòng, lưu trú, số lượng tồn và các khoản tiền đã ghi nhận.

Nếu máy chỉ có database một khách sạn, làm theo [hướng dẫn tạo bộ demo trong schema riêng](DATABASE_MULTI_HOTEL_LOCAL.md#tạo-bộ-demo-trong-schema-riêng).

#### Chuẩn hóa phiếu nhập local

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

### Dữ liệu dùng thử

Dùng [hướng dẫn database local](DATABASE_MULTI_HOTEL_LOCAL.md) để tạo bộ Lotus, Ocean và Pine. Dữ liệu có vật tư và định mức buồng phòng, phiếu nhập chưa trả, trả đủ hoặc trả nhiều lần. Đối chiếu tồn và trạng thái phiếu trên từng khách sạn.

### Dọn phòng và xuất kho

1. Admin/Quản lý vào **Kho → Vật tư**, phân loại **Tiêu hao** cho bàn chải, dầu gội, hóa chất. Khăn/ga chọn **Tái sử dụng**.
2. Vào **Kho → Định mức dọn phòng**, chọn hạng phòng và lượng tiêu hao gợi ý. Định mức này khác với ngưỡng cảnh báo tồn tối thiểu.
3. Phân công và bắt đầu nhiệm vụ dọn. Khi hoàn thành, chọn số người lớn/trẻ em cần chuẩn bị cho khách sắp đón. Hệ thống nhân định mức theo khách với tổng số người đã chọn, giữ nguyên lượng tính theo phòng và từ chối số người vượt sức chứa. Đây là số khách cần chuẩn bị do nhân viên xác nhận, không tự lấy số khách đã checkout.
4. Lượng thực xuất ban đầu là 0; nhập phần thật sự lấy từ kho. Có nút **Điền lượng gợi ý khi cấp mới toàn bộ** cho lượt đầu; vật tư còn nguyên hoặc đủ trong phòng không cần xuất thêm. Nếu không dùng, chọn xác nhận và ghi lý do. Dọn lại bắt đầu từ 0 và chỉ ghi phần bổ sung.
5. Xác nhận thành công đồng thời tạo lịch sử lượt dọn (kèm số người chuẩn bị), phiếu xuất, sổ biến động kho và chuyển phòng sang chờ nghiệm thu. Có thể mở phiếu xuất từ lịch sử nhiệm vụ hoặc danh sách xuất kho.
6. Nếu thiếu tồn, toàn bộ thao tác được hoàn tác, nhiệm vụ vẫn đang dọn. Thông báo nêu vật tư, số có sẵn và số yêu cầu.
7. Nghiệm thu không đạt giữ nguyên vật tư đã dùng. Gửi lại cùng lượt, cùng dữ liệu không xuất thêm; đổi dữ liệu của lượt đã ghi bị từ chối.

Không lập thêm phiếu xuất thủ công cho lượng vật tư đã ghi qua nhiệm vụ. Luồng đồ vải, minibar, dịch vụ và bảo trì chưa tự động xuất kho trong đợt này.

### Danh mục và định mức buồng phòng

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

### Phiếu nhập và trả tiền

- Admin/Quản lý tạo phiếu nhập, có thể chọn **Thanh toán ngay** và nhập số thực trả, phương thức, ngày giờ. Sai số tiền hoặc vượt giá trị phiếu khiến cả việc nhận hàng và khoản chi không được lưu.
- Admin/Quản lý/Kế toán mở chi tiết phiếu để xem tiền đã trả, số còn phải trả và ghi tiếp các lần trả tiền. Mỗi lần có người xác nhận; chuyển khoản cần mã tham chiếu.
- Phiếu cũ phải **Đối soát phiếu** với nội dung kiểm tra. Có thể ghi khoản đã trả theo chứng từ và đúng ngày cũ, hoặc xác nhận chưa thanh toán. Không tự coi phiếu cũ là đã trả hoặc còn nợ toàn bộ.
- Ghi nhầm khoản chi: chọn **Đảo khoản chi**, nhập lý do. Không xóa chứng từ gốc. Khoản đảo được tính ở ngày đảo, công nợ được tính lại; muốn sửa khoản chi thì ghi giao dịch đúng sau khi đảo.

### Đọc báo cáo

**Báo cáo → Mua vật tư & Công nợ NCC** phân biệt:

| Chỉ số | Ngày ghi nhận / phạm vi |
|---|---|
| Giá trị hàng nhập | Ngày nhận hàng; lọc cùng lúc theo NCC và nhóm vật tư ở mọi bảng/biểu đồ |
| Chi vật tư thuần | Tiền trả trong kỳ trừ khoản đảo trong kỳ; toàn bộ NCC |
| Công nợ đã xác minh | Lũy kế phiếu nhập và khoản trả/đảo đến hết kỳ, tối đa thời điểm hiện tại |
| Phiếu chưa đối soát | Số phiếu và giá trị hàng tách riêng, chưa cộng vào công nợ đã xác minh |

Số lượng lẻ giữ hai chữ số thập phân ở API, hiển thị theo tiếng Việt. Không cộng chung số lượng khác đơn vị; báo cáo tổng dùng số mã vật tư riêng biệt.

Tab **Dòng tiền & Thu chi** hiển thị **Chi mua vật tư thuần** và **Dòng tiền sau chi vật tư**. Chỉ số sau bằng thu khách sau hoàn trả trừ chi vật tư thuần và chỉ phản ánh hai nhóm dòng tiền này. Xem [định nghĩa báo cáo](BAO_CAO_DIEU_HANH.md#procurement-and-supplier-finance).

### Kiểm thử tự động

Trong `backend`:

```powershell
npm run typecheck
npm run lint
npm run test:mysql
```

`test:mysql` chỉ dùng database local riêng có hậu tố `_test`, không reset hoặc seed database ứng dụng. Bộ `supply-workflows.mysql.integration.test.ts` kiểm tra tiêu hao, thiếu tồn/rollback, tranh chấp tồn, gửi lại, dọn lại, tenant và vai trò, trả từng phần, tranh chấp/trả vượt, đảo tiền, đối soát phiếu cũ, số lượng lẻ và bộ lọc báo cáo.

Trong `frontend`: `npm test`, `npm run lint`, `npm run build`.

API chi tiết có trong Swagger. Client hoàn thành dọn phải gửi `workToken`, `materials` và lý do nếu không dùng; client thanh toán phải giữ nguyên `requestKey` khi gửi lại cùng giao dịch.
