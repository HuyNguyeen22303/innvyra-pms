# Billing & Payment Management — Phase 6

Service Catalog, Service Orders, one primary Folio per reservation, immutable charges, staff-confirmed payments/deposits/refunds, adjustments and settlement are implemented in `src/modules/billing/`. These features share a transaction boundary and repository while retaining Route → Middleware → Controller → Service → Repository → Prisma → MySQL. No dependency or frontend change.

## Schema and migration

Added models: `Service`, `ServiceOrder`, `ServiceOrderItem`, `Folio`, `FolioItem`, `Payment`, `BillingIdempotency`, `BillingAuditLog`.

`prisma/migrations/20261015000000_billing_management/migration.sql` adds eight tables and a unique `(hotel_id,id)` index on `stays` for scoped references. It does not alter reservation/stay data or historical price snapshots. The inspected application database had no existing Service/Folio/Payment tables. Existing migrations remain unchanged.

- Composite hotel foreign keys use RESTRICT. Refunds reference an original payment in the same folio; related adjustments reference an item in the same folio.
- Unique reservation ID enforces one folio. Unique room-night/service-order-item references and source type/ID prevent duplicate posting.
- CHECK constraints enforce whole VND, money bounds/signs, quantity/line totals, source consistency, status timestamps and payment references. MySQL 8.0.16+ is required; verification used MySQL 8.0.41.
- Service items preserve price, name and unit snapshots from order creation. Completed payments, entries, snapshots and audit have no update/delete endpoint. Catalog DELETE deactivates. Privileged direct SQL access is outside application immutability; no triggers prevent a database administrator from editing rows.

Review the SQL and back up the intended application database before deployment. From `backend/`:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run db:inspect
npm run db:migrate
npm run build
npm start
```

`db:migrate` deploys Prisma migrations and refuses existing tables without migration history. Never reset, use destructive db push, or edit an applied migration. **Application database migration is left for deployment; only the dedicated test database was migrated in this task.**

## Money and business policy

An isolated Prisma Decimal context uses precision 40. Stored amounts use `DECIMAL(18,2)` and API amounts are strings. VND input must be whole dong: `"1000"`, `"1000.0"`, `"1000.00"` normalize to `"1000.00"`. Fractional dong, JS numbers, exponents, negative inputs and values beyond `9999999999999999.00` are rejected. Payments/refunds/adjustments must be positive; free room/service sources retain zero debit entries for traceability.

Historical `ReservationRoomNight.nightlyRate` permits fractional prices. Billing rounds **each original nightly snapshot half-up to whole dong** (900000.50 → 900001.00), never reads today's RoomType basePrice and never rewrites snapshots. All booked nights are posted on opening as contractual debt, not daily revenue recognition.

```text
Net Charges = Total Charges (DEBIT) - Total Credits
Net Paid = confirmed PAYMENT + confirmed DEPOSIT - confirmed REFUND
Outstanding Balance = Net Charges - Net Paid
```

Reads aggregate entries and payments in a RepeatableRead snapshot. Pending/failed money is excluded. Deposits have a separate total and never create a duplicate credit. Imported/admin-created negative balances are exposed, never clamped to zero.

- Folio opening is explicit and idempotent, including retrieving an existing CLOSED folio. GET returns `404 FOLIO_NOT_FOUND` if unopened. A new folio cannot open for CANCELLED/NO_SHOW.
- New orders require an active stay. Supplied stayId must be active and belong to the same reservation/hotel, with live occupancy. Without stayId the order is reservation-level during an active stay. Prices snapshot when the order is created. Completion and charges commit atomically. Previously requested services may complete after physical checkout. Only REQUESTED orders can cancel.
- Physical checkout performs no billing mutation. Cancellation creates no automatic refund/credit and deletes no charges. Folios may remain OPEN with debt after checkout.
- Receipts require `confirmedReceived:true`; BANK_TRANSFER also requires an actual transfer reference. This is the authorized employee's attestation, not a bank integration. Payment/deposit cannot exceed current outstanding. Deposits are allowed only for CONFIRMED/CHECKED_IN/PARTIALLY_CHECKED_IN reservations.
- ADMIN/MANAGER/ACCOUNTANT may approve and record manual refunds with a mandatory reason and `confirmedRefunded:true`; bank refunds require the outgoing reference. The recording employee is the approver under this MVP policy; two-person approval is not implemented. Cumulative refunds cannot exceed the original confirmed receipt or folio net money received. Refunds cannot themselves be refunded.
- Refund returns money and **increases outstanding**; it does not reduce charges. For a paid concession or cancellation settlement, record the approved actual refund first, then a CREDIT adjustment. This avoids creating unsupported credit balances. No cancellation event triggers automatic refund.
- Adjustments append a DEBIT/CREDIT with staff/reason and optional same-folio original item reference. CREDIT cannot create a negative balance. Old entries and payment amounts are never changed.
- Close requires exactly zero balance, no REQUESTED orders or PENDING payments, and all booked rooms checked out with reservation CHECKED_OUT, or a valid cancelled reservation. Closing is idempotent. CLOSED rejects new postings; replay of an already committed request still succeeds.
- Phase 6 creates only staff-confirmed payment rows. Imported/future PENDING rows block receipts/refunds and closure until resolved through an audited operational process. No pending-payment resolution API is introduced here.

## Idempotency, locks and audit

Payment, deposit, refund and adjustment POSTs require `Idempotency-Key`: 8–128 ASCII letters/digits or `. _ : -`, starting with a letter/digit. Keep the **same key and payload after a timeout**; use a new key only for a new financial operation. Different keys identify separate receipts; the server cannot infer whether two separately attested cash receipts represent the same cash.

SHA-256 hashes the case-sensitive key and canonical validated payload plus operation and target. Keys are unique across financial operations within one hotel. Equivalent money formats normalize; absent/null receipt references are equivalent. Same key/payload returns the original response/status; a changed payload/target/operation returns `409 IDEMPOTENCY_CONFLICT`. Authentication/current permissions are enforced before replay. Keys have no automatic expiry. Hashes are never exposed through the API.

Every Billing write starts a ReadCommitted Prisma transaction and locks the hotel's row using parameterized `SELECT ... FOR UPDATE`. Reservation, Stay, Room and Guest already take that same first lock, covering cross-module races as well as orders created before a folio exists. Checks and writes remain atomic across checkout, cancellation, order creation/completion, payment, refund, adjustment and closure. Different hotels proceed independently. Unique database constraints provide a second duplicate-source/key guard.

The ledger row, status transition, audit and idempotency response commit together. Failures roll everything back. Only database-confirmed rollback conflicts (`P2034`) retry the entire transaction, at most twice with short backoff. Ambiguous commit/network errors never retry automatically; clients retry the original key. Known conflicts become sanitized `FINANCIAL_CONFLICT` errors. Audit captures hotel, actor, action, target, timestamp and adjustment/refund/cancellation reason without credentials, card data or raw request bodies.

Hotel-level serialization may limit a busy property's throughput. Measure contention before introducing a finer lock protocol across all dependent modules. Audit/idempotency retention, reopening and post-close corrections need future explicit policies. No gateway, taxes, general ledger, revenue recognition, split folios or currency conversion is implemented.

## API and RBAC

All paths are under `/api/v1`, use Bearer authentication and `success/message/data`. Mutations require `X-CSRF-Protection: 1`; browser origin must be allowlisted. Responses have `Cache-Control: no-store`. IDs are BIGINT strings. Unknown fields, including client-supplied hotel/actor/role/status, are rejected.

| Method/path                                  | Behavior                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET /services                                | page, limit, search name/code, isActive, sortBy name/code/price/createdAt, sortOrder |
| GET /services/:id                            | Catalog detail                                                                       |
| POST /services                               | Create catalog entry                                                                 |
| PATCH /services/:id                          | Current catalog changes; preserve old snapshots                                      |
| DELETE /services/:id                         | Deactivate                                                                           |
| POST /service-orders                         | reservationId, optional stayId, items, notes                                         |
| GET /service-orders                          | page, limit, reservationId, stayId, status, sortBy createdAt/id, sortOrder           |
| GET /service-orders/:id                      | Order and item snapshots                                                             |
| POST /service-orders/:id/complete            | Complete and post charges atomically                                                 |
| POST /service-orders/:id/cancel              | Cancel REQUESTED order with reason                                                   |
| POST /reservations/:reservationId/folio/open | Open once and post nightly snapshots                                                 |
| GET /reservations/:reservationId/folio       | Existing folio                                                                       |
| GET /folios/:id                              | Folio and financial totals                                                           |
| GET /folios/:id/items                        | Paginated immutable entries                                                          |
| POST /folios/:id/adjustments                 | DEBIT/CREDIT; Idempotency-Key required                                               |
| POST /folios/:id/close                       | Close settled eligible folio                                                         |
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

## Swagger / Postman walkthrough

1. After migration, open `/api-docs/` or import `/api-docs/openapi.json`. All prior documentation remains; there are 49 operations.
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

## Verification and files

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
npm run test:mysql
```

`test:mysql` creates/migrates `innvyra_pms_billing_phase6_test` using local configured credentials or accepts an explicit separate local `TEST_DATABASE_URL` ending `_test`. It refuses the application database and production environment, checks schema drift, then runs all suites. Concurrency tests use independent Prisma clients. Cleanup removes only synthetic fixtures created by each test; roles and test schema remain. There is no reset/truncate/drop. Plain `npm test` skips MySQL suites when TEST_DATABASE_URL is absent.

The bootstrap connection allows RSA public-key retrieval only after the loopback/test-schema guards, so local MySQL can authenticate after a restart with an empty authentication cache. Application/TLS connection configuration is unchanged.

New files:

- `prisma/migrations/20261015000000_billing_management/migration.sql`
- `src/modules/billing/billing.{routes,controller,service,repository,schema,types,mapper,money}.ts`
- `src/config/billing.openapi.ts`
- `tests/billing.unit.test.ts`, `tests/billing.mysql.integration.test.ts`
- `BILLING.md`

Modified: `prisma/schema.prisma`, `src/app.ts`, `src/routes/index.ts`, `src/server.ts`, `src/config/cors.ts`, `src/config/swagger.ts`, `scripts/test-mysql.ts`, `tests/guests.http.test.ts`, `tests/rooms.http.test.ts`, `tests/reservations.http.test.ts`, `README.md`. Prior tests only change expected OpenAPI operation count. Generated Prisma Client is refreshed in the existing gitignored directory. Branch: `feature/be-billing`, from updated `develop` at `e330688`. No commit, push or merge.

Verified on **15/10/2026**, Node **22.13.0**, MySQL **8.0.41**:

| Check                                                            | Result                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Prisma validate and generate                                     | Passed                                                                               |
| TypeScript strict typecheck                                      | Passed                                                                               |
| ESLint, zero warnings                                            | Passed                                                                               |
| Build                                                            | Passed                                                                               |
| Full Vitest suite on dedicated real MySQL                        | **420 passed, 0 failed, 0 skipped; 16 suites**                                       |
| Unit, HTTP, integration, concurrency and prior-phase regressions | Included in the passing full suite                                                   |
| Six migrations on fresh test schema, then deploy again           | Passed; second deploy had no pending migrations                                      |
| Prisma database-to-schema diff                                   | No difference                                                                        |
| Compiled ESM smoke                                               | Swagger UI/JSON 200; 49 operations; all 19 Billing operations return 401 without JWT |
| Prettier for changed TypeScript and Billing documentation        | Passed                                                                               |
| Git diff whitespace check                                        | Passed                                                                               |

The tests cover the 1,950,000 / 500,000 / 1,000,000 / 450,000 financial example, legacy rounding, missing-night rejection, snapshot preservation, multi-room charges, cancellation/checkout separation, duplicates, same-key replay/conflict, actual-money confirmations, partial/full refunds, negative-balance prevention, pending/closed folios, server-side RBAC, foreign hotel/service/stay rejection, SQL constraints, independent-client races, and rollback of folio/service/payment/refund/adjustment with audit/idempotency failures.

Windows sandbox initially blocked local MySQL/HTTP and Vitest file access, so verification ran with approved local execution permissions. A later cold MySQL authentication failure was resolved in the guarded local test bootstrap and the full suite then passed. No application migration, production load test or production deployment was performed.
