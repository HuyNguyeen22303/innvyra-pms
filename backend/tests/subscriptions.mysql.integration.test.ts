import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { PrismaPlatformAuthRepository } from '../src/modules/platform-auth/platform-auth.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { PrismaEmployeeRepository } from '../src/modules/employees/employee.repository.js';
import { HotelManagementService } from '../src/modules/hotels/hotel.service.js';
import { SubscriptionService } from '../src/modules/hotels/subscription.service.js';
import { asDate, localDay } from '../src/modules/hotels/subscription-calendar.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { isolatedMySql } from './isolated-mysql.js';
import { testEnv, testPassword } from './helpers.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Monthly plans and subscriptions on real MySQL',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let service: SubscriptionService;
    let app: ReturnType<typeof createApp>;
    let actor: bigint;
    let access: string;
    let hash: string;
    let roleId: bigint;
    const today = () => localDay('Asia/Ho_Chi_Minh');
    const uid = () => randomUUID().slice(0, 8);
    beforeAll(async () => {
      database = await isolatedMySql('subscriptions');
      const db = database.prisma;
      hash = await hashPassword(testPassword);
      roleId = (await db.role.create({ data: { code: 'ADMIN', name: 'Administrator' } })).id;
      await db.role.create({ data: { code: 'RECEPTIONIST', name: 'Receptionist' } });
      actor = (
        await db.platformAdmin.create({
          data: { email: 'owner@example.test', fullName: 'Synthetic Owner', passwordHash: hash },
        })
      ).id;
      service = new SubscriptionService(db);
      app = createApp(
        { ...testEnv, DATABASE_URL: database.url },
        new PrismaAuthRepository(db),
        { rooms: new PrismaRoomRepository(db), roomTypes: new PrismaRoomTypeRepository(db) },
        new PrismaGuestRepository(db),
        new PrismaReservationRepository(db),
        undefined,
        undefined,
        undefined,
        undefined,
        new PrismaEmployeeRepository(db),
        undefined,
        new PrismaPlatformAuthRepository(db),
        new HotelManagementService(db),
      );
      const res = await request(app)
        .post('/api/v1/platform/auth/login')
        .set('X-CSRF-Protection', '1')
        .send({ email: 'owner@example.test', password: testPassword });
      expect(res.status).toBe(200);
      access = res.body.data.accessToken as string;
    }, 120000);
    afterAll(async () => {
      await database?.dispose();
    });
    const plan = (overrides: object = {}) =>
      service.createPlan(actor, {
        code: `PLAN_${uid()}`,
        name: 'Synthetic plan',
        monthlyPrice: '123456.78',
        roomLimit: 2,
        staffLimit: 2,
        isActive: true,
        ...overrides,
      });
    async function hotel(withPeriod = true) {
      const db = database.prisma;
      const h = await db.hotel.create({ data: { code: `HT_${uid()}`, name: 'Synthetic hotel' } });
      const staff = await db.staffUser.create({
        data: {
          hotelId: h.id,
          roleId,
          fullName: 'Owner',
          username: `owner_${uid()}`,
          passwordHash: hash,
        },
      });
      const type = await db.roomType.create({
        data: {
          hotelId: h.id,
          code: 'STANDARD',
          name: 'Standard',
          maxAdults: 2,
          basePrice: '100000',
        },
      });
      const p = await plan();
      if (withPeriod)
        await service.record(actor, h.id, {
          planId: String(p.id),
          startsOn: today(),
          monthCount: 1,
          reason: 'Initial period',
        });
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-CSRF-Protection', '1')
        .send({ username: staff.username, password: testPassword });
      expect(res.status).toBe(200);
      return { ...h, staff, type, plan: p, token: res.body.data.accessToken as string };
    }
    const get = (path: string, token = access) =>
      request(app).get(`/api/v1${path}`).auth(token, { type: 'bearer' });
    it('pages legacy subscription periods across both realms without exposing another hotel', async () => {
      const h = await hotel();
      const other = await hotel();
      const start = asDate(today()).valueOf();
      const oldPeriods = Array.from({ length: 100 }, (_, index) => ({
        hotelId: h.id,
        recordedById: actor,
        planName: `Archived ${index}`,
        startsOn: new Date(start - (index + 1) * 86400000),
        endsOn: new Date(start - (index + 1) * 86400000),
        feeAmount: '1000.00',
      }));
      await database.prisma.hotelSubscriptionPeriod.createMany({ data: oldPeriods });

      for (const path of [
        '/hotel/subscription-periods',
        `/platform/hotels/${h.id}/subscription-periods`,
      ]) {
        const token = path.startsWith('/hotel/') ? h.token : access;
        const page = await get(path, token).query({ page: 21, limit: 5 });
        expect(page.status).toBe(200);
        expect(page.body.data.pagination).toEqual({ page: 21, limit: 5, total: 101, totalPages: 21 });
        expect(page.body.data.items).toHaveLength(1);
        expect(page.body.data.items[0]).toMatchObject({ planName: 'Archived 99', planId: null });
        expect((await get(path, token).query({ limit: 101 })).status).toBe(422);
      }
      const own = await get('/hotel/subscription-periods', other.token);
      expect(own.body.data.pagination.total).toBe(1);
      expect((await get('/hotel/subscription-periods', access)).status).toBe(401);
      expect((await get(`/platform/hotels/${h.id}/subscription-periods`, h.token)).status).toBe(401);
      const summary = await get('/hotel/subscription', h.token);
      expect(summary.body.data.history).toHaveLength(100);
      expect(summary.body.data.nextStartsOn).toBe((await service.summary(h.id)).nextStartsOn);
    });
    const post = (path: string, body: object, token = access) =>
      request(app)
        .post(`/api/v1${path}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const patch = (path: string, body: object, token = access) =>
      request(app)
        .patch(`/api/v1${path}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const roomInput = (type: bigint, number: string) => ({
      roomNumber: number,
      floorNumber: 1,
      roomTypeId: String(type),
      physicalStatus: 'ACTIVE' as const,
      housekeepingStatus: 'DIRTY' as const,
      isActive: true,
    });
    it('catalog CRUD uses platform realm, CSRF, stable codes and separate actor audit', async () => {
      const input = {
        code: `API_${uid()}`,
        name: 'Monthly',
        monthlyPrice: '100.01',
        roomLimit: 3,
        staffLimit: 4,
        isActive: true,
      };
      const created = await post('/platform/plans', input);
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      expect(
        (await patch(`/platform/plans/${id}`, { monthlyPrice: '200.02', isActive: false })).status,
      ).toBe(200);
      expect((await patch(`/platform/plans/${id}`, { code: 'NEW' })).status).toBe(422);
      expect((await post('/platform/plans', input)).status).toBe(409);
      expect(
        (await post('/platform/plans', { ...input, code: `INVALID_${uid()}`, staffLimit: 0 }))
          .status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post('/api/v1/platform/plans')
            .auth(access, { type: 'bearer' })
            .send(input)
        ).status,
      ).toBe(403);
      expect(
        await database.prisma.subscriptionPlanAudit.count({
          where: { planId: BigInt(id), actorId: actor },
        }),
      ).toBe(2);
      const h = await hotel();
      expect((await get('/platform/plans', h.token)).status).toBe(401);
      expect((await get('/platform/plans')).status).toBe(200);
    });
    it('snapshots exact decimal price and caps; editing/disabling catalog does not rewrite existing periods', async () => {
      const h = await hotel(false);
      const period = await service.record(actor, h.id, {
        planId: String(h.plan.id),
        startsOn: today(),
        monthCount: 3,
        reason: 'Contract',
        paymentReference: 'MANUAL-123',
      });
      expect(String(period.feeAmount)).toBe('370370.34');
      await service.updatePlan(actor, h.plan.id, {
        monthlyPrice: '9',
        roomLimit: 100,
        isActive: false,
      });
      const persisted = await database.prisma.hotelSubscriptionPeriod.findUniqueOrThrow({
        where: { id: period.id },
      });
      expect(String(persisted.monthlyPrice)).toBe('123456.78');
      expect(persisted.roomLimit).toBe(2);
      expect((await service.summary(h.id)).usage.roomLimit).toBe(2);
      const available = await get('/hotel/subscription-plans', h.token);
      expect(available.status).toBe(200);
      expect(available.body.data.some((p: { id: string }) => p.id === String(h.plan.id))).toBe(
        false,
      );
      const own = await get('/hotel/subscription', h.token);
      expect(own.body.data.current).toMatchObject({
        planId: String(h.plan.id),
        monthlyPrice: '123456.78',
        roomLimit: 2,
      });
      await expect(
        service.record(actor, h.id, {
          planId: String(h.plan.id),
          startsOn: '2030-01-01',
          monthCount: 1,
          reason: 'Renew',
        }),
      ).rejects.toMatchObject({ code: 'PLAN_UNAVAILABLE' });
    });
    it('hotel catalog lists only available plans ordered by exact monthly price and reflects platform updates', async () => {
      const h = await hotel();
      const low = await plan({ monthlyPrice: '10.10', name: 'Entry' });
      const high = await plan({ monthlyPrice: '10.20', name: 'Larger' });
      const hidden = await plan({ isActive: false });
      const response = await get('/hotel/subscription-plans', h.token);
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const data = response.body.data as { id: string; monthlyPrice: string; isActive: boolean }[];
      const expected = await database.prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ monthlyPrice: 'asc' }, { id: 'asc' }],
      });
      expect(data.map((p) => p.id)).toEqual(expected.map((p) => String(p.id)));
      expect(data.every((p) => p.isActive)).toBe(true);
      expect(data.some((p) => p.id === String(hidden.id))).toBe(false);
      expect(data.findIndex((p) => p.id === String(low.id))).toBeLessThan(
        data.findIndex((p) => p.id === String(high.id)),
      );
      expect(Object.keys(data[0]!).sort()).toEqual(
        [
          'id',
          'code',
          'name',
          'description',
          'monthlyPrice',
          'roomLimit',
          'staffLimit',
          'isActive',
        ].sort(),
      );
      await service.updatePlan(actor, low.id, { monthlyPrice: '9.99', staffLimit: 10 });
      const updated = await get('/hotel/subscription-plans', h.token);
      expect(updated.body.data.find((p: { id: string }) => p.id === String(low.id))).toMatchObject({
        monthlyPrice: '9.99',
        staffLimit: 10,
      });
      expect((await get('/hotel/subscription-plans?hotelId=' + h.id, h.token)).status).toBe(422);
    });
    it('hotel catalog enforces account roles and password change while remaining readable during suspension', async () => {
      const h = await hotel();
      expect((await request(app).get('/api/v1/hotel/subscription-plans')).status).toBe(401);
      expect((await get('/hotel/subscription-plans')).status).toBe(401);
      await service.setStatus(actor, h.id, 'SUSPENDED', 'Account review');
      expect((await get('/hotel/subscription-plans', h.token)).status).toBe(200);
      const manager = await database.prisma.role.create({
        data: { code: 'MANAGER', name: 'Manager' },
      });
      await database.prisma.staffUser.update({
        where: { id: h.staff.id },
        data: { roleId: manager.id },
      });
      expect((await get('/hotel/subscription-plans', h.token)).status).toBe(200);
      await database.prisma.staffUser.update({
        where: { id: h.staff.id },
        data: { mustChangePassword: true },
      });
      expect((await get('/hotel/subscription-plans', h.token)).body.error.code).toBe(
        'PASSWORD_CHANGE_REQUIRED',
      );
      for (const code of ['RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'] as const) {
        const role = await database.prisma.role.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        });
        await database.prisma.staffUser.update({
          where: { id: h.staff.id },
          data: { roleId: role.id, mustChangePassword: false },
        });
        expect((await get('/hotel/subscription-plans', h.token)).body.error.code).toBe('FORBIDDEN');
      }
      expect((await get('/platform/plans', h.token)).status).toBe(401);
    });
    it('serializes overlapping concurrent renewals and retains explicit future change date', async () => {
      const h = await hotel(false);
      const body = {
        planId: String(h.plan.id),
        startsOn: today(),
        monthCount: 1,
        reason: 'Renewal',
      };
      const results = await Promise.all([
        post(`/platform/hotels/${h.id}/subscription-periods`, body),
        post(`/platform/hotels/${h.id}/subscription-periods`, body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const next = (await service.summary(h.id)).nextStartsOn;
      const future = await plan({ roomLimit: 5, monthlyPrice: '999.99' });
      await service.record(actor, h.id, { ...body, planId: String(future.id), startsOn: next });
      const summary = await service.summary(h.id);
      expect(summary.usage.roomLimit).toBe(2);
      expect(summary.upcoming?.roomLimit).toBe(5);
      expect(summary.history).toHaveLength(2);
      const audit = await database.prisma.platformAuditLog.findFirstOrThrow({
        where: { hotelId: h.id },
        orderBy: { id: 'desc' },
      });
      expect(audit.changes).toMatchObject({ effectiveOn: next });
      expect(
        (
          await post(`/platform/hotels/${h.id}/subscription-periods`, {
            ...body,
            startsOn: '2020-01-01',
          })
        ).status,
      ).toBe(422);
    });
    it('counts active rooms and rejects concurrent creation/reactivation beyond capacity', async () => {
      const h = await hotel();
      const repo = new PrismaRoomRepository(database.prisma);
      const result = await Promise.allSettled(
        ['101', '102', '103'].map((number) =>
          repo.withHotelLock(h.id, (tx) => tx.create(h.id, roomInput(h.type.id, number))),
        ),
      );
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(result.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { code: 'SUBSCRIPTION_LIMIT_REACHED' },
      });
      const inactive = await repo.withHotelLock(h.id, (tx) =>
        tx.create(h.id, { ...roomInput(h.type.id, '104'), isActive: false }),
      );
      await expect(
        repo.withHotelLock(h.id, (tx) => tx.update(h.id, inactive.id, { isActive: true })),
      ).rejects.toMatchObject({ code: 'SUBSCRIPTION_LIMIT_REACHED' });
      await repo.withHotelLock(h.id, (tx) =>
        tx.update(h.id, inactive.id, { notes: 'Still editable' }),
      );
    });
    it('counts ADMIN among active staff and enforces create/add-admin/reactivate capacity', async () => {
      const h = await hotel();
      const repo = new PrismaEmployeeRepository(database.prisma);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          repo.withHotelLock(h.id, (tx) =>
            tx.create({
              hotelId: h.id,
              roleId,
              fullName: 'Employee',
              username: `staff_${uid()}`,
              email: null,
              passwordHash: hash,
            }),
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (
          await post(`/platform/hotels/${h.id}/admins`, {
            fullName: 'Another admin',
            username: `extra_${uid()}`,
            email: `${uid()}@example.test`,
          })
        ).body.error.code,
      ).toBe('SUBSCRIPTION_LIMIT_REACHED');
      const inactive = await database.prisma.staffUser.create({
        data: {
          hotelId: h.id,
          roleId,
          fullName: 'Inactive',
          username: `inactive_${uid()}`,
          passwordHash: hash,
          isActive: false,
        },
      });
      await expect(
        repo.withHotelLock(h.id, (tx) => tx.activate(h.id, inactive.id)),
      ).rejects.toMatchObject({ code: 'SUBSCRIPTION_LIMIT_REACHED' });
    });
    it('rejects assigning a plan below current usage without deleting records', async () => {
      const h = await hotel(false);
      await database.prisma.room.createMany({
        data: ['201', '202'].map((roomNumber) => ({
          hotelId: h.id,
          roomTypeId: h.type.id,
          roomNumber,
          floorNumber: 2,
        })),
      });
      const small = await plan({ roomLimit: 1 });
      const res = await post(`/platform/hotels/${h.id}/subscription-periods`, {
        planId: String(small.id),
        startsOn: today(),
        monthCount: 1,
        reason: 'Downgrade',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PLAN_BELOW_USAGE');
      expect(await database.prisma.room.count({ where: { hotelId: h.id } })).toBe(2);
    });
    it('manual suspension blocks already-issued tokens but permits login, account and own subscription; other hotel remains isolated', async () => {
      const a = await hotel();
      const b = await hotel();
      expect(
        (await patch(`/platform/hotels/${a.id}/status`, { status: 'SUSPENDED', reason: ' ' }))
          .status,
      ).toBe(422);
      expect(
        (
          await patch(`/platform/hotels/${a.id}/status`, {
            status: 'SUSPENDED',
            reason: 'Manual review',
          })
        ).status,
      ).toBe(200);
      for (const path of ['/rooms', '/employees', '/guests', '/hotel'])
        expect((await get(path, a.token)).body.error.code).toBe('HOTEL_SUSPENDED');
      expect((await get('/rooms', b.token)).status).toBe(200);
      expect((await get('/auth/me', a.token)).body.data.hotel.status).toBe('SUSPENDED');
      expect((await get('/hotel/subscription', a.token)).body.data.id).toBe(String(a.id));
      expect((await get('/hotel/subscription?hotelId=' + b.id, a.token)).status).toBe(422);
      expect(
        (await post('/auth/login', { username: a.staff.username, password: testPassword }, ''))
          .status,
      ).toBe(200);
      const next = (await service.summary(a.id)).nextStartsOn;
      await service.record(actor, a.id, {
        planId: String(a.plan.id),
        startsOn: next,
        monthCount: 1,
        reason: 'Renew while suspended',
      });
      expect((await get('/rooms', a.token)).status).toBe(403);
      await patch(`/platform/hotels/${a.id}/status`, {
        status: 'ACTIVE',
        reason: 'Confirmed payment',
      });
      expect((await get('/rooms', a.token)).status).toBe(200);
      const actions = await database.prisma.platformAuditLog.findMany({
        where: { hotelId: a.id, action: { in: ['HOTEL_SUSPENDED', 'HOTEL_REACTIVATED'] } },
      });
      expect(actions.map((x) => x.reason)).toEqual(['Manual review', 'Confirmed payment']);
      const receptionist = await database.prisma.role.findUniqueOrThrow({
        where: { code: 'RECEPTIONIST' },
      });
      await database.prisma.staffUser.update({
        where: { id: b.staff.id },
        data: { roleId: receptionist.id },
      });
      expect((await get('/hotel/subscription', b.token)).status).toBe(403);
    });
    it('overdue >7 days only flags follow-up; legacy hotels remain uncapped', async () => {
      const h = await hotel(false);
      await database.prisma.hotelSubscriptionPeriod.create({
        data: {
          hotelId: h.id,
          recordedById: actor,
          planName: 'Legacy agreement',
          startsOn: asDate('2020-01-01'),
          endsOn: asDate('2020-01-31'),
          feeAmount: '0',
        },
      });
      expect(await service.summary(h.id)).toMatchObject({
        status: 'EXPIRED',
        alert: 'FOLLOW_UP',
        usage: { roomLimit: null, staffLimit: null },
      });
      expect((await get('/rooms', h.token)).status).toBe(200);
      const repo = new PrismaRoomRepository(database.prisma);
      for (const number of ['301', '302', '303'])
        await repo.withHotelLock(h.id, (tx) => tx.create(h.id, roomInput(h.type.id, number)));
      const capped = await hotel(false);
      await database.prisma.hotelSubscriptionPeriod.create({
        data: {
          hotelId: capped.id,
          recordedById: actor,
          planId: capped.plan.id,
          planName: capped.plan.name,
          startsOn: asDate('2020-01-01'),
          endsOn: asDate('2020-01-31'),
          feeAmount: '123456.78',
          monthlyPrice: capped.plan.monthlyPrice,
          monthCount: 1,
          roomLimit: 1,
          staffLimit: 2,
        },
      });
      await repo.withHotelLock(capped.id, (tx) =>
        tx.create(capped.id, roomInput(capped.type.id, '401')),
      );
      const excess = await post('/rooms', roomInput(capped.type.id, '402'), capped.token);
      expect(excess.status).toBe(409);
      expect(excess.body.error.code).toBe('SUBSCRIPTION_LIMIT_REACHED');
      expect((await get('/rooms', capped.token)).status).toBe(200);
      expect((await service.summary(capped.id)).alert).toBe('FOLLOW_UP');
      const none = await hotel(false);
      expect((await service.summary(none.id)).status).toBe('UNCONFIGURED');
      expect(
        (await get('/platform/hotels?subscriptionStatus=UNCONFIGURED')).body.data.items.some(
          (x: { id: string }) => x.id === String(none.id),
        ),
      ).toBe(true);
      expect(
        (await get('/platform/hotels?subscriptionStatus=EXPIRED')).body.data.items.some(
          (x: { id: string }) => x.id === String(h.id),
        ),
      ).toBe(true);
    });
    it('monthly onboarding is atomic and uses catalog pricing', async () => {
      const p = await plan();
      const suffix = uid();
      const res = await post('/platform/hotels', {
        code: `MONTH_${suffix}`,
        name: 'New monthly hotel',
        timezone: 'Asia/Ho_Chi_Minh',
        admin: {
          fullName: 'New Admin',
          username: `monthly_${suffix}`,
          email: `${suffix}@example.test`,
        },
        subscription: {
          planId: String(p.id),
          startsOn: today(),
          monthCount: 2,
          reason: 'Onboarding',
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.subscription.feeAmount).toBe('246913.56');
      expect(
        await database.prisma.platformAuditLog.count({
          where: { hotelId: BigInt(res.body.data.hotel.id) },
        }),
      ).toBe(3);
      const failed = await post('/platform/hotels', {
        code: `FAIL_${suffix}`,
        name: 'Invalid plan hotel',
        timezone: 'Asia/Ho_Chi_Minh',
        admin: {
          fullName: 'Admin',
          username: `failed_${suffix}`,
          email: `fail_${suffix}@example.test`,
        },
        subscription: {
          planId: '18446744073709551615',
          startsOn: today(),
          monthCount: 1,
          reason: 'Onboarding',
        },
      });
      expect(failed.status).toBe(409);
      expect(await database.prisma.hotel.count({ where: { code: `FAIL_${suffix}` } })).toBe(0);
    });
  },
);
