import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { parseEnv } from '../src/config/env.js';
import { isolatedMySql } from './isolated-mysql.js';
import { seedPhase6Scenario, dayOffset, type Phase6Scenario } from '../scripts/phase6/scenario.js';
import { PHASE6_INITIAL_PASSWORD, PHASE6_PASSWORD, cookie } from '../scripts/phase6/client.js';
import { ROLE_CODES } from '../src/shared/types/roles.js';
import { localDay } from '../src/modules/hotels/subscription-calendar.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Phase 6: SaaS lifecycle with a complete A/B HTTP seed',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let scenario: Phase6Scenario;
    beforeAll(async () => {
      database = await isolatedMySql('phase_six');
      const env = parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: database.url,
        JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
        GUEST_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        GUEST_HASH_KEY: randomBytes(32).toString('hex'),
        LOGIN_RATE_LIMIT_MAX: '10000',
        REFRESH_RATE_LIMIT_MAX: '10000',
      });
      scenario = await seedPhase6Scenario(database.prisma, env);
    }, 180000);
    afterAll(async () => {
      await database?.dispose();
    });

    it('onboards A/B through platform accounts and forces each hotel staff password change', async () => {
      const { a, b, http } = scenario;
      expect(a.types.STANDARD).not.toBe(b.types.STANDARD);
      for (const hotel of [a, b])
        for (const role of ROLE_CODES) {
          const user = await http.ok<{
            hotelId: string;
            role: string;
            mustChangePassword: boolean;
          }>('get', '/auth/me', hotel.staff[role].session.accessToken);
          expect(user).toMatchObject({ hotelId: hotel.id, role, mustChangePassword: false });
        }
      const inactive = await http.request('post', '/auth/login', {
        body: { username: a.inactive.username, password: PHASE6_INITIAL_PASSWORD },
      });
      expect(inactive.status).toBe(401);
      const temp = await http.login(a.temporary.username, PHASE6_INITIAL_PASSWORD);
      const blocked = await http.request('get', '/rooms', { token: temp.accessToken });
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      const restricted = await http.request('get', '/hotel/subscription', {
        token: a.staff.RECEPTIONIST.session.accessToken,
      });
      expect(restricted.status).toBe(403);
    });

    it.each(['a', 'b'] as const)(
      '%s has coherent bookings, stays, folios, housekeeping, maintenance and stock',
      async (key) => {
        const hotel = scenario[key],
          db = database.prisma;
        const { http } = scenario;
        const admin = hotel.staff.ADMIN.session.accessToken;
        const closed = await http.ok<{
          status: string;
          totalCharges: string;
          outstandingBalance: string;
        }>('get', `/folios/${hotel.closed.folioId}`, admin);
        expect(closed).toMatchObject({
          status: 'CLOSED',
          totalCharges: hotel.expected.closedBill,
          outstandingBalance: '0.00',
        });
        expect(await http.ok('get', `/folios/${hotel.active.folioId}`, admin)).toMatchObject({
          status: 'OPEN',
          outstandingBalance: hotel.expected.outstanding,
        });
        const stays = await db.stay.findMany({
          where: { hotelId: BigInt(hotel.id) },
          orderBy: { id: 'asc' },
        });
        expect(stays.map((stay) => stay.status)).toEqual(['CHECKED_OUT', 'CHECKED_IN']);
        expect(await db.roomOccupancy.count({ where: { hotelId: BigInt(hotel.id) } })).toBe(1);
        expect(
          await db.room.findUniqueOrThrow({ where: { id: BigInt(hotel.rooms['101']!) } }),
        ).toMatchObject({ housekeepingStatus: 'READY', isActive: true });
        expect(
          await db.room.findUniqueOrThrow({ where: { id: BigInt(hotel.rooms['103']!) } }),
        ).toMatchObject({ housekeepingStatus: 'DIRTY' });
        expect(
          await db.room.findUniqueOrThrow({ where: { id: BigInt(hotel.rooms['104']!) } }),
        ).toMatchObject({ physicalStatus: 'MAINTENANCE' });
        expect(
          await db.reservation.findUniqueOrThrow({ where: { id: BigInt(hotel.cancelled.id) } }),
        ).toMatchObject({ status: 'CANCELLED' });
        expect(
          await http.ok('get', `/inventory/items/${hotel.inventory.itemId}`, admin),
        ).toMatchObject({ currentStock: hotel.expected.stock });
        expect(await db.inventoryMovement.count({ where: { hotelId: BigInt(hotel.id) } })).toBe(3);
        for (const [id, status] of [
          [hotel.housekeeping.pending, 'PENDING'],
          [hotel.housekeeping.inProgress, 'IN_PROGRESS'],
          [hotel.housekeeping.awaitingInspection, 'AWAITING_INSPECTION'],
        ] as const) {
          expect(
            await db.housekeepingTask.findUniqueOrThrow({ where: { id: BigInt(id) } }),
          ).toMatchObject({ status, assignedTo: BigInt(hotel.staff.HOUSEKEEPING.id) });
        }
        const guest = await db.guest.findUniqueOrThrow({ where: { id: BigInt(hotel.guests[0]!) } });
        expect(
          JSON.stringify(guest, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
        ).not.toContain('SYNTHETIC-DOC');
      },
    );

    it.each(['a', 'b'] as const)(
      '%s reports reconcile to exact guest ledger amounts and exclude SaaS fees',
      async (key) => {
        const hotel = scenario[key],
          token = hotel.staff.ACCOUNTANT.session.accessToken;
        const range = `startDate=${dayOffset(hotel.today, -1)}&endDate=${dayOffset(hotel.today, 2)}`;
        const report = await scenario.http.ok<{ summary: object; balance: object }>(
          'get',
          `/reports/revenue?${range}`,
          token,
        );
        expect(report.summary).toMatchObject({
          roomCharges: hotel.expected.roomCharges,
          serviceCharges: hotel.expected.serviceCharges,
          netCashCollected: hotel.expected.collected,
        });
        expect(report.balance).toMatchObject({
          outstandingBalance: hotel.expected.outstanding,
          folioCount: 1,
        });
        const exportResult = await scenario.http.request(
          'get',
          `/reports/export?type=payments&${range}`,
          { token },
        );
        expect(exportResult.status).toBe(200);
        expect(exportResult.headers['content-type']).toContain('text/csv');
        expect(exportResult.text).not.toContain('DEMO-P6_');
        expect(exportResult.text).not.toContain('299000.25');
        expect(exportResult.text).toContain(hotel.expected.collected);
        expect(exportResult.text).not.toContain(
          scenario[key === 'a' ? 'b' : 'a'].expected.collected,
        );
      },
    );

    it('rejects cross-hotel IDs in every module without changing B', async () => {
      const { a, b, http } = scenario,
        token = a.staff.ADMIN.session.accessToken;
      const paths = [
        `/rooms/${b.rooms['101']}`,
        `/room-types/${b.types.STANDARD}`,
        `/guests/${b.guests[0]}`,
        `/reservations/${b.active.booking.id}`,
        `/stays/${b.active.stayId}`,
        `/folios/${b.active.folioId}`,
        `/services/${b.serviceId}`,
        `/service-orders/${b.active.orderId}`,
        `/maintenance/tickets/${b.maintenance.ticketId}`,
        `/housekeeping/tasks/${b.housekeeping.pending}`,
        `/maintenance/blocks/${b.maintenance.blockId}`,
        `/inventory/items/${b.inventory.itemId}`,
        `/inventory/categories/${b.inventory.categoryId}`,
        `/inventory/suppliers/${b.inventory.supplierId}`,
        `/inventory/receipts/${b.inventory.receiptId}`,
        `/inventory/issues/${b.inventory.issueId}`,
      ];
      const before = await database.prisma.inventoryItem.findUniqueOrThrow({
        where: { id: BigInt(b.inventory.itemId) },
      });
      for (const path of paths)
        expect((await http.request('get', path, { token })).status, path).toBe(404);
      const writes: [string, object][] = [
        [
          '/reservations',
          {
            guestId: b.guests[0]!,
            checkInDate: dayOffset(a.today, 10),
            checkOutDate: dayOffset(a.today, 12),
            rooms: [{ roomTypeId: a.types.STANDARD, quantity: 1, adults: 1 }],
          },
        ],
        [
          '/inventory/receipts',
          {
            supplierId: b.inventory.supplierId,
            items: [{ itemId: a.inventory.itemId, quantity: '1', unitPrice: '1' }],
          },
        ],
        [
          '/inventory/issues',
          { department: 'HOUSEKEEPING', items: [{ itemId: b.inventory.itemId, quantity: '1' }] },
        ],
        ['/housekeeping/tasks', { roomId: b.rooms['103']! }],
        [
          '/service-orders',
          { reservationId: a.active.booking.id, items: [{ serviceId: b.serviceId, quantity: 1 }] },
        ],
        [`/stays/${b.active.stayId}/check-out`, {}],
      ];
      for (const [path, body] of writes)
        expect((await http.request('post', path, { token, body })).status, path).toBe(404);
      expect(
        (
          await http.request('patch', `/housekeeping/tasks/${a.housekeeping.pending}/assign`, {
            token,
            body: { staffId: b.staff.HOUSEKEEPING.id },
          })
        ).status,
      ).toBe(422);
      expect(
        await database.prisma.inventoryItem.findUniqueOrThrow({ where: { id: before.id } }),
      ).toEqual(before);
    });

    it('list, search and CSV exports cannot leak the other hotel or private guest fields', async () => {
      const { a, b, http } = scenario;
      for (const [current, foreign] of [
        [a, b],
        [b, a],
      ] as const) {
        const admin = current.staff.ADMIN.session.accessToken;
        const tasks = await database.prisma.housekeepingTask.findMany({
          where: { hotelId: BigInt(current.id) },
          select: { id: true },
        });
        const allowed: Record<string, string[]> = {
          '/rooms': Object.values(current.rooms),
          '/room-types': Object.values(current.types),
          '/guests': current.guests,
          '/reservations': [
            current.closed.booking.id,
            current.active.booking.id,
            current.future.id,
            current.cancelled.id,
          ],
          '/stays': [current.closed.stayId, current.active.stayId],
          '/services': [current.serviceId],
          '/service-orders': [current.closed.orderId, current.active.orderId],
          '/employees': [
            ...Object.values(current.staff).map((staff) => staff.id),
            current.inactive.id,
            current.temporary.id,
          ],
          '/inventory/items': [current.inventory.itemId],
          '/inventory/receipts': [current.inventory.receiptId],
          '/housekeeping/tasks': tasks.map((task) => String(task.id)),
          '/maintenance/tickets': [current.maintenance.ticketId],
        };
        for (const path of [
          '/rooms',
          '/room-types',
          '/guests',
          '/reservations',
          '/stays',
          '/services',
          '/service-orders',
          '/employees',
          '/inventory/items',
          '/inventory/receipts',
          '/housekeeping/tasks',
          '/maintenance/tickets',
        ]) {
          const response = await http.request('get', path, { token: admin });
          expect(response.status, path).toBe(200);
          const items = response.body.data.items as { id?: string; stayId?: string }[];
          expect(
            items.map((item) => (path === '/stays' ? item.stayId : item.id)).sort(),
            path,
          ).toEqual(allowed[path]!.slice().sort());
          const json = JSON.stringify(response.body);
          expect(json, path).not.toContain(`PRIVATE_${foreign.code.at(-1)}_ONLY`);
          expect(json, path).not.toContain(foreign.staff.ADMIN.username);
        }
        const guests = await http.ok<{ items: unknown[] }>(
          'get',
          `/guests?search=Synthetic%20Guest%20${foreign.code.at(-1)}`,
          admin,
        );
        expect(guests.items).toHaveLength(0);
        const accountant = await http.request('get', `/guests/${current.guests[0]}`, {
          token: current.staff.ACCOUNTANT.session.accessToken,
        });
        expect(accountant.status).toBe(200);
        expect(JSON.stringify(accountant.body)).not.toContain('SYNTHETIC-DOC');
        expect(JSON.stringify(accountant.body)).not.toContain('PRIVATE_');
      }
    });

    it('separates platform and hotel realms, enforces all six role boundaries and CSRF', async () => {
      const { a, http, platform } = scenario;
      expect((await http.request('get', '/rooms', { token: platform.accessToken })).status).toBe(
        401,
      );
      expect(
        (
          await http.request('get', '/platform/hotels', {
            token: a.staff.ADMIN.session.accessToken,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await http.request('post', '/platform/plans', {
            token: platform.accessToken,
            csrf: false,
            body: {},
          })
        ).status,
      ).toBe(403);
      for (const role of ROLE_CODES) {
        const token = a.staff[role].session.accessToken;
        const report = await http.request(
          'get',
          `/reports/revenue?startDate=${a.today}&endDate=${dayOffset(a.today, 1)}`,
          { token },
        );
        expect(report.status, role).toBe(
          ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role) ? 200 : 403,
        );
        const subscription = await http.request('get', '/hotel/subscription', { token });
        expect(subscription.status, role).toBe(['ADMIN', 'MANAGER'].includes(role) ? 200 : 403);
        const platformWrite = await http.request('patch', `/platform/hotels/${a.id}/status`, {
          token,
          body: { status: 'ACTIVE', reason: 'Attempt' },
        });
        expect(platformWrite.status, role).toBe(401);
      }
    });

    it.each([
      [14, 'FOURTEEN_DAYS'],
      [7, 'SEVEN_DAYS'],
      [1, 'ONE_DAY'],
      [0, 'ONE_DAY'],
      [-1, 'OVERDUE'],
      [-8, 'FOLLOW_UP'],
    ] as const)(
      'seeded hotel with %i days remaining has expected alert and still operates',
      async (days, alert) => {
        const { http, platform, states } = scenario;
        const hotel = states[String(days)]!;
        const summary = await http.ok<{ status: string; alert: string; daysRemaining: number }>(
          'get',
          `/platform/hotels/${hotel.id}/subscription`,
          platform.accessToken,
        );
        expect(summary).toMatchObject({
          daysRemaining: days,
          alert,
          status: days < 0 ? 'EXPIRED' : 'EXPIRING',
        });
        const session = await http.login(hotel.username);
        expect((await http.request('get', '/rooms', { token: session.accessToken })).status).toBe(
          200,
        );
      },
    );

    it('future and legacy fixtures remain distinct and list filters match detail classifications', async () => {
      const { http, platform, states } = scenario;
      for (const name of ['UPCOMING', 'UNCONFIGURED']) {
        const hotel = states[name]!;
        expect(
          await http.ok('get', `/platform/hotels/${hotel.id}/subscription`, platform.accessToken),
        ).toMatchObject({ status: name, usage: { roomLimit: null, staffLimit: null } });
        const list = await http.ok<{ items: { id: string }[] }>(
          'get',
          `/platform/hotels?subscriptionStatus=${name}&limit=100`,
          platform.accessToken,
        );
        expect(list.items.map((item) => item.id)).toContain(hotel.id);
      }
    });

    it('renewal snapshots survive catalog edits and suspended hotel sessions stay blocked until manual reopening', async () => {
      const { http, platform, plans } = scenario;
      const hotel = await scenario.createHotel();
      const summary = await http.ok<{ nextStartsOn: string }>(
        'get',
        `/platform/hotels/${hotel.hotel.id}/subscription`,
        platform.accessToken,
      );
      const periodBody = {
        planId: plans.large,
        startsOn: summary.nextStartsOn,
        monthCount: 2,
        reason: 'Phase 6 plan change',
      };
      const periods = await Promise.all(
        [1, 2].map(() =>
          http.request('post', `/platform/hotels/${hotel.hotel.id}/subscription-periods`, {
            token: platform.accessToken,
            body: periodBody,
          }),
        ),
      );
      expect(periods.map((res) => res.status).sort()).toEqual([201, 409]);
      await http.ok('patch', `/platform/plans/${plans.large}`, platform.accessToken, {
        monthlyPrice: '799000',
        name: 'Changed catalog',
        roomLimit: 25,
        staffLimit: 30,
      });
      const after = await http.ok<{
        history: { planName: string; feeAmount: string; monthlyPrice: string; roomLimit: number }[];
      }>('get', `/platform/hotels/${hotel.hotel.id}/subscription`, platform.accessToken);
      expect(after.history[0]).toMatchObject({
        planName: 'Gói mẫu mở rộng',
        feeAmount: '1198001',
        monthlyPrice: '599000.5',
        roomLimit: 20,
      });
      await http.ok('patch', `/platform/hotels/${hotel.hotel.id}/status`, platform.accessToken, {
        status: 'SUSPENDED',
        reason: 'Phase 6 manual hold',
      });
      const oldToken = hotel.session.accessToken;
      for (const path of [
        '/rooms',
        '/guests',
        '/employees',
        '/services',
        '/reservations',
        '/stays',
        '/inventory/summary',
        '/housekeeping/tasks',
        '/maintenance/tickets',
        `/reports/revenue?startDate=${hotel.today}&endDate=${dayOffset(hotel.today, 1)}`,
      ]) {
        const response = await http.request('get', path, { token: oldToken });
        expect(response.status, path).toBe(403);
        expect(response.body.error.code, path).toBe('HOTEL_SUSPENDED');
      }
      const refreshed = await http.request('post', '/auth/refresh', {
        cookie: hotel.session.refreshCookie,
      });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.user.hotel.status).toBe('SUSPENDED');
      expect((await http.request('get', '/hotel/subscription', { token: oldToken })).status).toBe(
        200,
      );
      const next = await http.ok<{ nextStartsOn: string }>(
        'get',
        `/platform/hotels/${hotel.hotel.id}/subscription`,
        platform.accessToken,
      );
      await http.ok(
        'post',
        `/platform/hotels/${hotel.hotel.id}/subscription-periods`,
        platform.accessToken,
        { ...periodBody, startsOn: next.nextStartsOn },
        201,
      );
      expect((await http.request('get', '/rooms', { token: oldToken })).body.error.code).toBe(
        'HOTEL_SUSPENDED',
      );
      await http.ok('patch', `/platform/hotels/${hotel.hotel.id}/status`, platform.accessToken, {
        status: 'ACTIVE',
        reason: 'Phase 6 manual release',
      });
      expect((await http.request('get', '/rooms', { token: oldToken })).status).toBe(200);
      expect(
        (await http.request('get', '/rooms', { token: scenario.b.staff.ADMIN.session.accessToken }))
          .status,
      ).toBe(200);
    });

    it('changing/resetting passwords revokes old access and refresh tokens without affecting B', async () => {
      const { http, platform } = scenario;
      const hotel = await scenario.createHotel();
      const second = await http.login(hotel.username);
      const reset = await http.ok<{ temporaryPassword: string }>(
        'post',
        `/platform/hotels/${hotel.hotel.id}/admins/${hotel.admin.id}/reset-password`,
        platform.accessToken,
        { reason: 'Phase 6 reset isolation' },
      );
      for (const session of [hotel.session, second]) {
        expect((await http.request('get', '/auth/me', { token: session.accessToken })).status).toBe(
          401,
        );
        expect(
          (await http.request('post', '/auth/refresh', { cookie: session.refreshCookie })).status,
        ).toBe(401);
      }
      const temporary = await http.login(hotel.username, reset.temporaryPassword);
      expect(
        (await http.request('get', '/rooms', { token: temporary.accessToken })).body.error.code,
      ).toBe('PASSWORD_CHANGE_REQUIRED');
      const valid = await http.activatePassword(hotel.username, reset.temporaryPassword);
      expect((await http.request('get', '/rooms', { token: valid.accessToken })).status).toBe(200);
      const refresh = await http.request('post', '/auth/refresh', { cookie: valid.refreshCookie });
      expect(refresh.status).toBe(200);
      expect(cookie(refresh)).not.toBe(valid.refreshCookie);
      await http.ok('post', '/auth/logout', refresh.body.data.accessToken as string, {});
      expect(
        (await http.request('get', '/auth/me', { token: refresh.body.data.accessToken as string }))
          .status,
      ).toBe(401);
      expect(
        (
          await http.request('get', '/auth/me', {
            token: scenario.b.staff.ADMIN.session.accessToken,
          })
        ).status,
      ).toBe(200);
    });

    it('caps concurrent room/staff creation and prevents lowering the plan below usage', async () => {
      const { http, platform, plans } = scenario;
      const hotel = await scenario.createHotel(),
        token = hotel.session.accessToken;
      const type = await http.ok<{ id: string }>(
        'post',
        '/room-types',
        token,
        { code: 'STANDARD', name: 'Capacity scenario', maxAdults: 2, basePrice: '100000' },
        201,
      );
      const rooms = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          http.request('post', '/rooms', {
            token,
            body: { roomTypeId: type.id, roomNumber: `R${i}`, floorNumber: 1 },
          }),
        ),
      );
      expect(rooms.filter((res) => res.status === 201)).toHaveLength(8);
      expect(
        rooms.filter((res) => res.body.error?.code === 'SUBSCRIPTION_LIMIT_REACHED'),
      ).toHaveLength(2);
      const employees = await Promise.all(
        Array.from({ length: 9 }, (_, i) =>
          http.request('post', '/employees', {
            token,
            body: {
              fullName: `Concurrent ${i}`,
              username: `race_${hotel.hotel.id}_${i}`,
              role: 'RECEPTIONIST',
              password: PHASE6_PASSWORD,
            },
          }),
        ),
      );
      expect(employees.filter((res) => res.status === 201)).toHaveLength(7);
      expect(
        employees.filter((res) => res.body.error?.code === 'SUBSCRIPTION_LIMIT_REACHED'),
      ).toHaveLength(2);
      const summary = await http.ok<{ nextStartsOn: string }>(
        'get',
        `/platform/hotels/${hotel.hotel.id}/subscription`,
        platform.accessToken,
      );
      const downgrade = await http.request(
        'post',
        `/platform/hotels/${hotel.hotel.id}/subscription-periods`,
        {
          token: platform.accessToken,
          body: {
            planId: plans.small,
            startsOn: summary.nextStartsOn,
            monthCount: 1,
            reason: 'Below usage',
          },
        },
      );
      expect(downgrade.status).toBe(409);
      expect(downgrade.body.error.code).toBe('PLAN_BELOW_USAGE');
      expect(
        await database.prisma.staffUser.count({
          where: { hotelId: BigInt(hotel.hotel.id), isActive: true },
        }),
      ).toBe(8);
    });

    it('serializes competing bookings and retries a payment without collecting it twice', async () => {
      const { http } = scenario;
      const hotel = await scenario.createHotel(),
        token = hotel.session.accessToken;
      const type = await http.ok<{ id: string }>(
        'post',
        '/room-types',
        token,
        { code: 'RACE', name: 'Last room', maxAdults: 2, basePrice: '100000' },
        201,
      );
      await http.ok(
        'post',
        '/rooms',
        token,
        { roomTypeId: type.id, roomNumber: '101', floorNumber: 1 },
        201,
      );
      const guest = await http.ok<{ id: string }>(
        'post',
        '/guests',
        token,
        { fullName: 'Synthetic race guest' },
        201,
      );
      const body = {
        guestId: guest.id,
        checkInDate: dayOffset(hotel.today, 10),
        checkOutDate: dayOffset(hotel.today, 11),
        rooms: [{ roomTypeId: type.id, quantity: 1, adults: 1 }],
      };
      const bookings = await Promise.all(
        [1, 2, 3].map(() => http.request('post', '/reservations', { token, body })),
      );
      expect(bookings.filter((res) => res.status === 201)).toHaveLength(1);
      expect(bookings.filter((res) => res.status === 409)).toHaveLength(2);
      const bookingId = String(bookings.find((res) => res.status === 201)!.body.data.id);
      const folio = await http.ok<{ id: string }>(
        'post',
        `/reservations/${bookingId}/folio/open`,
        token,
        {},
      );
      const payment = {
        paymentType: 'DEPOSIT',
        paymentMethod: 'CASH',
        amount: '10000',
        confirmedReceived: true,
      };
      const attempts = await Promise.all(
        [1, 2].map(() =>
          http.request('post', `/folios/${folio.id}/payments`, {
            token,
            body: payment,
            key: `phase6-retry-${hotel.hotel.id}`,
          }),
        ),
      );
      expect(attempts.map((res) => res.status)).toEqual([201, 201]);
      expect(attempts[0]!.body.data.id).toBe(attempts[1]!.body.data.id);
      expect(await database.prisma.payment.count({ where: { folioId: BigInt(folio.id) } })).toBe(1);
      expect(await http.ok('get', `/folios/${folio.id}`, token)).toMatchObject({
        totalDeposits: '10000.00',
        outstandingBalance: '90000.00',
      });
    });

    it('stock issues cannot race below zero and rejected over-precision input leaves no receipt or movement', async () => {
      const { http } = scenario;
      const hotel = await scenario.createHotel(),
        token = hotel.session.accessToken;
      const category = await http.ok<{ id: string }>(
        'post',
        '/inventory/categories',
        token,
        { code: 'RACE', name: 'Race stock' },
        201,
      );
      const item = await http.ok<{ id: string }>(
        'post',
        '/inventory/items',
        token,
        { code: 'RACE_ITEM', name: 'Synthetic stock', categoryId: category.id, unit: 'piece' },
        201,
      );
      await http.ok(
        'post',
        '/inventory/receipts',
        token,
        { items: [{ itemId: item.id, quantity: '10', unitPrice: '1' }] },
        201,
      );
      const issues = await Promise.all(
        [1, 2].map((i) =>
          http.request('post', '/inventory/issues', {
            token,
            body: {
              issueNumber: `RACE-${i}`,
              department: 'HOUSEKEEPING',
              items: [{ itemId: item.id, quantity: '7' }],
            },
          }),
        ),
      );
      expect(issues.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(await http.ok('get', `/inventory/items/${item.id}`, token)).toMatchObject({
        currentStock: '3.00',
      });
      const before = await database.prisma.inventoryMovement.count({
        where: { hotelId: BigInt(hotel.hotel.id) },
      });
      for (const quantity of ['0.001', 0.001, '1000000000000']) {
        const res = await http.request('post', '/inventory/receipts', {
          token,
          body: { items: [{ itemId: item.id, quantity, unitPrice: '1' }] },
        });
        expect(res.status, `quantity ${quantity}`).toBe(422);
      }
      expect(
        await database.prisma.stockReceipt.count({ where: { hotelId: BigInt(hotel.hotel.id) } }),
      ).toBe(1);
      expect(
        await database.prisma.inventoryMovement.count({
          where: { hotelId: BigInt(hotel.hotel.id) },
        }),
      ).toBe(before);
    });

    it('receipt totals reconcile to rounded line amounts and overflowing totals roll back atomically', async () => {
      const { http } = scenario;
      const hotel = await scenario.createHotel(),
        token = hotel.session.accessToken;
      const category = await http.ok<{ id: string }>(
        'post',
        '/inventory/categories',
        token,
        { code: 'MONEY', name: 'Receipt accounting' },
        201,
      );
      const items: string[] = [];
      for (const code of ['ONE', 'TWO'])
        items.push(
          (
            await http.ok<{ id: string }>(
              'post',
              '/inventory/items',
              token,
              { code, name: code, categoryId: category.id, unit: 'kg' },
              201,
            )
          ).id,
        );
      const receipt = await http.ok<{
        id: string;
        totalAmount: string;
        items: { lineTotal: string }[];
      }>(
        'post',
        '/inventory/receipts',
        token,
        { items: items.map((itemId) => ({ itemId, quantity: '1.25', unitPrice: '0.10' })) },
        201,
      );
      expect(receipt.items.map((line) => line.lineTotal)).toEqual(['0.13', '0.13']);
      expect(receipt.totalAmount).toBe('0.26');
      const before = await database.prisma.inventoryMovement.count({
        where: { hotelId: BigInt(hotel.hotel.id) },
      });
      const excess = await http.request('post', '/inventory/receipts', {
        token,
        body: {
          items: [{ itemId: items[0]!, quantity: '999999999999', unitPrice: '999999999999' }],
        },
      });
      expect(excess.status).toBe(422);
      const stockOverflow = await http.request('post', '/inventory/receipts', {
        token,
        body: { items: [{ itemId: items[0]!, quantity: '999999999999', unitPrice: '0' }] },
      });
      expect(stockOverflow.status).toBe(422);
      expect(stockOverflow.body.error.code).toBe('INVENTORY_AMOUNT_TOO_LARGE');
      const headerOverflow = await http.request('post', '/inventory/receipts', {
        token,
        body: {
          items: items.map((itemId) => ({ itemId, quantity: '1', unitPrice: '600000000000' })),
        },
      });
      expect(headerOverflow.status).toBe(422);
      expect(
        await database.prisma.stockReceipt.count({ where: { hotelId: BigInt(hotel.hotel.id) } }),
      ).toBe(1);
      expect(
        await database.prisma.inventoryMovement.count({
          where: { hotelId: BigInt(hotel.hotel.id) },
        }),
      ).toBe(before);
    });

    it('rejects reseeding a populated schema and records the hotel-local anchor for repeatable expectations', async () => {
      await expect(seedPhase6Scenario(database.prisma, scenario.env)).rejects.toThrow(
        'empty schema',
      );
      expect(scenario.a.today).toBe(localDay(scenario.a.timezone));
      expect(scenario.b.today).toBe(localDay(scenario.b.timezone));
    });
  },
);
