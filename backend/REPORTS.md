# Phase 8 — Reporting & Analytics

Reports read the existing MySQL ledger and operational history. They do not post charges, confirm payments, reconcile rooms, write snapshots, or change business records. No new dependency, Prisma model, index, or migration was added in this phase.

Implementation branch: `feature/be-reports`. It was created from the existing dirty `feature/be-operations` checkout after the user's explicit branch instruction. Earlier uncommitted Billing/Operations changes were preserved. No commit, push, merge, database reset, or table drop was performed.

## API and permissions

All endpoints are `GET /api/v1/reports/...`, require Bearer JWT **and a valid current session**, and derive hotel/role from the principal. Even ADMIN remains scoped to the principal's hotel. Query-supplied `hotelId`, `role`, unknown filters, unsupported sorting, and arrays in scalar inputs are rejected. Foreign `roomTypeId` returns 404.

| Endpoint        | Parameters                                                                             | Roles                                                  |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/dashboard`    | Optional `date` (hotel-local today by default)                                         | ADMIN, MANAGER, RECEPTIONIST                           |
| `/revenue`      | `startDate`, `endDate`, optional `groupBy`                                             | ADMIN, MANAGER, ACCOUNTANT                             |
| `/payments`     | Period/grouping, optional `paymentMethod=CASH\|BANK_TRANSFER`                          | ADMIN, MANAGER, ACCOUNTANT                             |
| `/occupancy`    | Period/grouping, optional `roomTypeId`                                                 | ADMIN, MANAGER, RECEPTIONIST                           |
| `/reservations` | Period/grouping                                                                        | ADMIN, MANAGER, RECEPTIONIST                           |
| `/operations`   | Period/grouping                                                                        | ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING, TECHNICIAN |
| `/outstanding`  | Period, `page`, `limit`, `sortBy=folioId\|outstandingBalance`, `sortOrder=asc\|desc`   | ADMIN, MANAGER, ACCOUNTANT                             |
| `/export`       | `type=revenue\|occupancy\|reservations\|payments`, period/grouping, compatible filters | ADMIN/MANAGER: all four; ACCOUNTANT: revenue/payments  |

Receptionists receive no dashboard finance and no occupancy `roomSalesValue`, `operationalAdr`, or `operationalRevpar`. They cannot export. HOUSEKEEPING receives only the housekeeping operations section; TECHNICIAN only maintenance. No report selects guest identity, document numbers, credentials, or tokens. Responses use `Cache-Control: private, no-store`.

## Dates, grouping and limits

- Periods are **[startDate, endDate)** with real `YYYY-MM-DD` dates, including leap-year validation.
- `Hotel.timezone` is authoritative. Its existing schema default is `Asia/Ho_Chi_Minh`. Invalid configuration fails explicitly; there is no host-timezone fallback.
- Reservation dates, night dates and maintenance start/end dates are business DATEs. Payment/posting/Stay timestamps are UTC DATETIMEs. IANA boundaries are computed in Node with one formatter per report, including 23/25-hour days; MySQL timezone-table installation is unnecessary.
- `groupBy=day` is the default; `month` labels buckets with `YYYY-MM-01`, summing only the requested portion of a month. Empty activity buckets return zero. Unavailable measures remain null.
- `REPORT_MAX_DAYS=366`, configurable from 1 to 366. `REPORT_EXPORT_MAX_ROWS=366`, configurable from 1 to 1000; the period limit also applies. Outstanding pagination defaults to page 1, limit 20, maximum limit 100 and page 1,000,000. Time series have deterministic ascending dates and need no pagination/sorting.
- Financial activity is capped at report generation time, and `balance.cutoffExclusive` is `min(endDate local midnight, generatedAt)`. Historical balances include all entries strictly before that instant, including entries before startDate. Future dates do not claim future cash receipts.

## Financial definitions

`/revenue` is billed/cash activity, **not accounting recognized revenue**.

| Metric                                                          | Source / formula                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `roomCharges`                                                   | ROOM_NIGHT debits posted to Folio                                         |
| `serviceCharges`                                                | SERVICE_ORDER_ITEM debits posted to Folio                                 |
| `adjustmentDebits`, `adjustmentCredits`                         | Manual debit/credit entries                                               |
| `totalDebits`, `totalCredits`                                   | All ledger debit/credit sums                                              |
| `netBilledCharges`                                              | Total debits − total credits                                              |
| `successfulPayments`, `successfulDeposits`, `successfulRefunds` | Distinct persisted CONFIRMED Payment records, by type                     |
| `netCashCollected`                                              | Payments + deposits − refunds                                             |
| `balanceMovement`                                               | Period billed charges − period net cash; not a closing balance            |
| `balance.outstandingBalance`                                    | Cumulative debits − credits − payments − deposits + refunds before cutoff |
| `balance.accountsReceivable`                                    | Sum of positive cumulative folio balances                                 |
| `balance.customerCredits`                                       | Absolute sum of negative cumulative folio balances                        |

Charges group by `FolioItem.createdAt` (posting time), receipts by `Payment.processedAt` (confirmation time in the current Billing workflow). A multi-night room charge posted together remains one day's **billed activity**, never a claim that all nights were earned that day. Deposits are counted once in cash and never in room charges. FAILED/PENDING payments are excluded. Current Billing idempotency and unique source constraints prevent duplicate postings; Reports does not join through idempotency responses or service order items and multiply them.

`paymentCount` counts PAYMENT records only; deposits and refunds have separate counts. `cashPayments` and `bankTransferPayments` are gross receipts (PAYMENT + DEPOSIT), before refunds. A payment-method filter restricts activity only; outstanding balances always use **all methods**, explicitly labeled in the response. Closed folios are not assumed paid. `/outstanding` lists only nonzero folios, with string IDs and signed balances, without guest identity.

MySQL SUM operates on DECIMAL, and Node uses the existing isolated 40-digit `Money` Decimal context to combine daily/monthly aggregates. Money is always an exact two-decimal string. No JavaScript floating-point addition is used for financial totals. Ratios use Decimal and are rounded to two decimals only at serialization.

## Occupancy, ADR and RevPAR

The operational night policy is **occupancy immediately before the next hotel-local midnight**:

- A Stay must check in before that cutoff and have no checkout or a checkout at/after it.
- Checkout exactly at midnight counts the previous night; check-in exactly at midnight does not. Same-day use is excluded.
- The first transfer at/after the cutoff identifies the previous room; if none exists, use the Stay's current/last room. A Stay contributes once, regardless of transfers. Distinct physical rooms prevent duplicate room-night counts. Conflicting historical stays in one room produce null occupancy/value instead of hiding corruption.
- CANCELLED/NO_SHOW reservations are excluded. Early checkout removes subsequent actual nights even though Phase 4 still retains booked inventory/night prices.
- `roomSalesValue` sums nightly price snapshots for those **actual** overnight stays, by `ReservationRoomNight.stayDate`. Missing night prices or non-VND snapshot currency produce null room value/ADR/RevPAR. No currency conversion is attempted.
- Unclosed nights produce null actual occupancy and room-value KPIs. Monthly/period summaries propagate null if any included night is incomplete; they do not silently summarize a shorter period.

Formulas use the same room type/date scope:

```text
Occupancy Rate (%) = Occupied Room Nights / Estimated Sellable Room Nights × 100
Operational ADR = Actual occupied-night snapshot value / Occupied Room Nights
Operational RevPAR = Actual occupied-night snapshot value / Estimated Sellable Room Nights
                   = Unrounded Operational ADR × Unrounded Occupancy Fraction
```

Zero denominator returns null. Empty available nights produce occupancy 0, ADR null and operational RevPAR `0.00`. Example validated in MySQL: 10 rooms × 5 nights = 50; five distinct maintenance-blocked nights → 45 sellable; 36 occupied → 80%; occupied-night value `32400000.00` → ADR `900000.00`, RevPAR `720000.00`. Independent formula test validates `36000000 / 40 = 900000`.

### Historical capacity limitations

There is no complete activation/deactivation, physical-status, or room-type-change history. Consequently:

- `totalRoomNights` is the count of retained room records created before each night cutoff, not audited historical operating capacity.
- `sellableRoomNights` subtracts distinct known maintenance blocks at that cutoff. No current ACTIVE/isActive flag is projected backwards. This can overestimate capacity when historical manual restrictions/deactivation are unknown.
- Maintenance blocks remain unavailable until an explicit safety release, including after their planned endDate, matching Operations' release policy. Early release before a night's cutoff stops that night's block. Overlapping blocks count once. Cancelled future blocks count zero. Future capacity remains an estimate, not a forecast of repair completion.
- `outOfServiceRoomNights=null` because historical manual physical-status changes cannot be reconstructed. The current dashboard/operations `outOfService` count is available separately.
- Every occupancy JSON/CSV carries `dataQuality.status=estimated` (or `incomplete`) and limitations. Rates are not clamped to 100%, which could hide incomplete capacity/history.
- ADR/RevPAR are **Operational**, not official accounting KPIs. Services, deposits/refunds and unallocated manual adjustments are not attributed to room nights. Tax/fee separation and recognized revenue cannot be reconstructed from current price snapshots.

For exact historical capacity later, introduce an effective-dated room capacity/status/type ledger or approved daily inventory snapshots alongside future write workflows. Record provenance and a coverage start date. Never backfill unsupported past capacity. No such migration or operational write change was added here.

## Dashboard, reservations and operations

Dashboard `rooms.total` includes all retained Room records; `active` is current `isActive`; `occupied` comes from RoomOccupancy joined to CHECKED_IN Stay. `vacant=total−occupied` does not mean sellable. Dirty/cleaning/inspection are independent housekeeping dimensions. `ready` additionally requires active, physically ACTIVE, vacant and no current block. Maintenance includes physical MAINTENANCE and effective blocks. These dimensions overlap and must not be added together.

Room snapshots are current only. When dashboard `date` differs from hotel-local today, `rooms` and `roomSnapshotAt` are null; finance/remaining scheduled movements still use the selected day. `currentGuestsCount=null`: booked adults/children are not an actual registration ledger.

Reservation creation uses reservation `createdAt`; room creation uses reservation-room `createdAt`; cancellation uses `cancelledAt`; actual movements use Stay timestamps. Multi-room bookings count one order and multiple rooms. Booking sources describe the creation cohort. `confirmedReservationsInCreatedCohort` and `noShowReservationsInCreatedCohort` describe current status because transition dates are absent. Expected arrivals are valid reservation rooms with no Stay; expected departures are valid rooms without actual checkout, including arrivals not yet checked in. These are **remaining scheduled movements as of generation**, not a reconstructed historical forecast.

Operations separates `snapshot` from `period`. Dirty/ready/cleaning/inspection rooms, active tasks, open/assigned and in-progress tickets, and effective maintenance blocks are current. Completed/inspected task totals count distinct task IDs with retained TASK_COMPLETE/INSPECTION_PASSED audit events in the interval. This preserves rework history when mutable completion fields are reset. Maintenance room-nights use a dedicated aggregate without querying Stay/pricing data.

## CSV, errors and query design

CSV exports the series using the same report service and role checks. It includes UTF-8 BOM, CRLF, quoted/escaped headers and values, exact Decimal strings, date bounds, timezone, currency, grouping and data-quality notes on each row. Formula prefixes after whitespace/control characters are neutralized. Null is blank, not zero. Files are bounded in memory and sent directly; no server temporary files. Large unbounded raw-record exports are outside this contract. CSV preserves exact text, but spreadsheet software may auto-convert large numbers when opened; import money columns as text if needed.

Errors follow existing `{success:false,message,error:{code,details?}}`: 401 UNAUTHORIZED, 403 FORBIDDEN/REPORT_ACCESS_DENIED, 404 scoped resource not found, 422 VALIDATION_ERROR/INVALID_REPORT_DATE_RANGE/REPORT_RANGE_TOO_LARGE, 503 HOTEL_TIMEZONE_INVALID. Internal SQL/stack traces are not returned. Unavailable KPI values use null plus data-quality reasons rather than an erroneous zero or a failed whole report.

Each report runs in one RepeatableRead transaction (20s timeout, 5s acquisition wait). Raw aggregate SELECTs carry MySQL `MAX_EXECUTION_TIME(10000)`. Date buckets are bound CTE rows, not user-interpolated SQL. Sorting uses static whitelisted identifiers. Hotel predicates are present in every root query and correlated subquery. There is no per-room/day client query loop or raw-ledger loading. Monthly aggregation combines at most 366 daily aggregate buckets in Node. Booking-source groups use the existing six-source allowlist; unsupported imported/legacy values fold into OTHER in SQL, so group cardinality is bounded independently of raw booking volume.

Existing indexes cover hotel scope, room creation/type, reservation creation/dates, nightly uniqueness, Stay checkout, transfer `(hotel_id,stay_id,transferred_at)`, and block room/status/start. A representative payment EXPLAIN is exercised on the test database. Existing payment and folio-item indexes begin with hotel but are folio-oriented; larger hotels may benefit from `(hotel_id,status,processed_at)` and `(hotel_id,created_at)` after representative EXPLAIN ANALYZE/load measurements. No index was added based only on tiny fixture timings. Production-scale latency targets remain unverified.

## Verification and manual usage

Run from `backend`:

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
npm run test:mysql
```

`test:mysql` refuses production mode, non-loopback hosts, non-`_test` schema names and the application database. The existing runner creates the separate test schema if necessary, applies existing migrations without reset, checks schema drift, then runs all Vitest suites. Fixtures are synthetic and are removed by their own hotel IDs. The runner's existing default schema name remains `innvyra_pms_operations_phase7_test`; set TEST_DATABASE_URL to another separate local `_test` database if preferred. Plain `npm test` skips integration suites unless a guarded TEST_DATABASE_URL is supplied.

Open `/api-docs`, login using the existing Authentication endpoint and `X-CSRF-Protection: 1`, copy the access token into Swagger **Authorize**, then open **Reports**. Report GETs do not require a CSRF header. Example paths for Swagger/Postman:

```text
/api/v1/reports/dashboard
/api/v1/reports/revenue?startDate=2026-10-01&endDate=2026-11-01&groupBy=day
/api/v1/reports/occupancy?startDate=2026-09-01&endDate=2026-10-01&groupBy=month
/api/v1/reports/payments?startDate=2026-10-01&endDate=2026-11-01&paymentMethod=CASH
/api/v1/reports/outstanding?startDate=2026-10-01&endDate=2026-11-01&limit=20&sortOrder=desc
/api/v1/reports/export?type=revenue&startDate=2026-10-01&endDate=2026-11-01
```

Use completed dates for fully observed overnight values. In Postman add `Authorization: Bearer <accessToken>`; use Save Response for CSV. Repeat with department roles to verify omitted sections and 403s. Unknown hotel filters must fail; foreign room types must return 404. OpenAPI contains query/role/error definitions, response schemas, formulas and illustrative examples for all eight endpoints.

## Phase 8 file inventory

New files:

- `src/modules/reports/report.routes.ts`, `report.controller.ts`, `report.service.ts`, `report.repository.ts`
- `src/modules/reports/report.schema.ts`, `report.types.ts`, `report.mapper.ts`, `report.dates.ts`, `export.service.ts`
- `src/config/reports.openapi.ts`
- `tests/reports.unit.test.ts`, `tests/reports.mysql.integration.test.ts`
- `REPORTS.md`

Updated integration/configuration files: `src/app.ts`, `src/routes/index.ts`, `src/server.ts`, `src/config/env.ts`, `src/config/swagger.ts`, `.env.example`, and `README.md`. Existing Swagger-count assertions in `tests/rooms.http.test.ts`, `tests/guests.http.test.ts`, `tests/reservations.http.test.ts` and `tests/billing.mysql.integration.test.ts` were updated from 71 to 79 operations. Reports is injected as an optional final repository argument, preserving existing test/application factory call sites. No earlier business module is rewritten. Pre-existing modifications in the checkout belong to earlier phases and are not Phase 8 changes.
