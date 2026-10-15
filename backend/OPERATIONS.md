# Phase 7 — Operations Management

Implemented in `backend/` on `feature/be-operations`. Existing uncommitted Billing changes were retained. No commit, push, merge, database reset or application-database migration was performed.

## Database

Additive migration: `prisma/migrations/20261015010000_operations_management/migration.sql`.

- `HousekeepingTask`: turnover workflow, assignment, actor/timestamps, nullable unique `activeRoomId` slot.
- `MaintenanceTicket`: report, assignment, resolution and closure.
- `MaintenanceBlock`: hotel-local half-open date interval and release/cancellation history.
- `OperationsAuditLog`: ordered history, actor, old/new state and reason; exactly one referenced task/ticket/block.
- `Room.maintenanceManaged`: internal ownership marker for physical MAINTENANCE caused by a block. Not client writable and not exposed by the Room serializer.
- Composite foreign keys bind staff, room, ticket, task, block and audit records to the same hotel. A block's linked ticket must also reference the same room.
- MySQL unique index plus CHECK constraint allows exactly one active turnover task per room; terminal tasks release the nullable slot. CHECK constraints validate maintenance intervals and audit entity references.
- Existing room/stay/reservation/billing rows and prices remain intact. Existing legacy physical restrictions have `maintenanceManaged=false` and retain their meaning.

### Apply migrations

Run from `backend/`, after configuring the intended DATABASE_URL and taking the normal deployment backup:

```powershell
npm run prisma:validate
npm run db:migrate
npm run prisma:generate
npm run typecheck
npm run build
npm start
```

`db:migrate` uses migration deploy after checking migration history. Never use reset or db push on existing hotel data. Deploy all existing Phase 1–6 migrations before Phase 7. Restart API processes after applying the migration, because room reads and inventory now use the new tables/column.

Migration was applied only to the dedicated local MySQL test schema during this task. Production/application deployment remains a separate action.

## HTTP contract

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

## Workflows and room state

### Housekeeping

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

### Maintenance tickets

`OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.

Only the assignee starts/resolves. ADMIN/MANAGER assign and close. OPEN/ASSIGNED can be cancelled with a reason. Close/cancel requires all linked blocks to be ended. Reporting and resolving never automatically release a block.

### Maintenance blocks

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

## Availability and concurrency

All capacity/occupancy/Operations writes acquire `SELECT id FROM hotels WHERE id = ? FOR UPDATE` first, using parameterized Prisma SQL. Operations uses READ COMMITTED and retries only database-confirmed deadlock rollback (P2034), at most twice. Ambiguous connection/commit failures are not automatically retried.

Reservation nightly rows remain the booking ledger. The shared inventory helper adds the number of distinct blocked rooms per night to existing reserved-night counts. Both GET availability and transactional POST reservation creation use this helper. The maximum combined nightly demand determines availability; no stock counter is separately decremented/incremented.

Base capacity includes physical ACTIVE rooms and MAINTENANCE rooms explicitly owned by blocks. The latter are subtracted by their intervals once. Independently restricted/inactive rooms are excluded from base capacity and their intervals are not subtracted again. Room capacity-reduction guards use the same combined demand.

Block creation rechecks overlapping intervals, active occupancy, explicit room assignments, and each-night capacity inside the shared lock. Date intervals on different nights do not accumulate into an incorrect whole-stay sum. Cancellation/release atomically removes a block from consuming states. Reservation prices, nights and assignment/transfer history are retained.

This is intentionally a coarse lock per hotel, matching the existing architecture. Different hotels can write concurrently. At larger scale, per-type/night locks would require a coordinated redesign across all modules.

## RBAC

| Role            | Housekeeping                                                   | Tickets                                    | Blocks                     |
| --------------- | -------------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| ADMIN / MANAGER | Read/create/assign/cancel/inspect; execute only own assignment | Manage; execute only own assignment        | Read/create/release/cancel |
| RECEPTIONIST    | Read/create/dirty-room list                                    | Read/report                                | Read                       |
| HOUSEKEEPING    | Read own assignments; start/complete                           | Read/report                                | Read only                  |
| TECHNICIAN      | No access                                                      | Read own assignments; report/start/resolve | Read only                  |
| ACCOUNTANT      | No access                                                      | No access                                  | No access                  |

All scope and actor IDs come from the authenticated server principal. Role changes/inactivation remain enforced by existing authentication. STAFF ID in assignment is validated against hotel, activity and operational role.

## Swagger / Postman verification

Start the API after migrations, open `/api-docs/`, or import `/api-docs/openapi.json` into Postman. There are 71 total operations, including 22 new Operations APIs; all previous tags remain.

1. Login with an existing seeded/provisioned staff account using the auth API and CSRF header. Authorize with its access token.
2. Create a DIRTY room or use a vacant DIRTY room; create its turnover task.
3. Assign a HOUSEKEEPING user, then use that user's JWT to start and complete.
4. Use ADMIN/MANAGER to inspect with `{"passed":false,"notes":"Bathroom requires rework"}`; repeat cleaning and inspect with `{"passed":true}`. Confirm room READY and both inspections in history.
5. Report a maintenance ticket and create a current/future block. Use actual room/staff/ticket IDs and dates relative to the hotel's current day.
6. Compare GET availability before/after. Attempt to reserve more than remaining capacity, check in, or transfer into a blocked room; expect 409.
7. Assign technician, start and resolve with `{"resolutionNotes":"Replaced and tested component"}`.
8. Release with `{"notes":"Repair verified safe; cleaning required"}`; confirm DIRTY and one turnover task. Repeating release returns 409.
9. Check ticket/block details for retained history and inspect with a foreign hotel's token to verify 404.

## Verification

`npm run test:mysql` creates/uses a separate loopback schema whose name ends in `_test`; default `innvyra_pms_operations_phase7_test`. It refuses production mode, nonlocal hosts and the application database, applies migrations, checks schema drift, and runs Vitest/Supertest. Tests remove only their own synthetic fixtures; they never reset or drop schemas/tables.

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
npm run test:mysql
# Focused Operations:
npm run test:mysql -- tests/operations.mysql.integration.test.ts tests/operations.unit.test.ts
```

MySQL suite uses two independent Prisma clients and two HTTP app instances for real competing transactions, and covers duplicate cleaning, repeated transitions, inspection vs blocking, overlapping blocks, reservation vs blocking, check-in vs blocking, release vs booking, checkout auto task vs manual task, activation, rollback and DB constraints. Unit tests validate boundaries and OpenAPI contracts. Other module suites remain regression coverage.

Verified on 2026-10-15 using MySQL 8.0.41:

| Check                                                      | Result                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Prisma validate and generate                               | Passed                                                                                        |
| Seven migrations on separate test schema                   | Applied; schema diff reported no differences                                                  |
| TypeScript typecheck                                       | Passed                                                                                        |
| ESLint                                                     | Passed with zero warnings                                                                     |
| Build                                                      | Passed                                                                                        |
| Full Vitest + Supertest + MySQL regression/concurrency run | **491 passed, 18 suites, zero failures/skips**                                                |
| Operations-specific coverage                               | 50 MySQL integration/concurrency cases and 21 unit cases included above                       |
| Compiled ESM HTTP smoke                                    | Swagger UI/JSON 200; 71 documented operations; Operations route groups return 401 without JWT |
| Git whitespace check                                       | Passed                                                                                        |

The first regression run identified an old Stay test that set READY directly; it now completes the actual cleaning/inspection workflow before reuse. Windows sandbox restrictions blocked Vitest cache rename and local HTTP/MySQL connections; affected verification commands were rerun successfully outside the sandbox with approval. No production/application database was used or modified.

## File inventory

New:

- `prisma/migrations/20261015010000_operations_management/migration.sql`
- `src/modules/housekeeping/housekeeping.{routes,controller,service,repository,schema,types}.ts`
- `src/modules/maintenance/maintenance.{routes,controller,service,repository,schema,types}.ts`
- `src/modules/maintenance/maintenance-block.service.ts`, `maintenance-worker.ts`
- `src/modules/operations/operations.{shared,repository,routes}.ts`
- `src/config/operations.openapi.ts`
- `tests/operations.unit.test.ts`, `tests/operations.mysql.integration.test.ts`
- `OPERATIONS.md`

Integration edits:

- `prisma/schema.prisma`
- `src/app.ts`, `src/routes/index.ts`, `src/server.ts`
- `src/config/swagger.ts`, `src/config/rooms.openapi.ts`
- `src/modules/reservations/{inventory,reservation}.repository.ts`
- `src/modules/stays/stay.{service,repository}.ts`, `room-assignment.service.ts`
- `src/modules/rooms/room.{service,repository,types}.ts`
- `scripts/test-mysql.ts`, `README.md`
- `tests/room-helpers.ts`, Room/Reservation/Stay regression suites; Guest/Billing Swagger counts and Billing fixture cleanup.

Existing Billing files unrelated to these integration edits remain the user's prior work. No dependencies, frontend, extra root directories, notifications, or unrelated modules were added.
