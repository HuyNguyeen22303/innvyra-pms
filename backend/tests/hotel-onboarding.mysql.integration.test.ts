import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { PrismaPlatformAuthRepository } from '../src/modules/platform-auth/platform-auth.repository.js';
import { HotelManagementService } from '../src/modules/hotels/hotel.service.js';
import { PrismaEmployeeRepository } from '../src/modules/employees/employee.repository.js';
import { hashPassword, verifyPassword } from '../src/shared/utils/password.js';
import { isolatedMySql } from './isolated-mysql.js';
import { testEnv, testPassword } from './helpers.js';

const base = '/api/v1/platform/hotels';
const replacement = 'My private hotel owner passphrase 2026!';
interface CreatedHotel {
  hotel: { id: string; code: string; name: string };
  admin: { id: string; username: string; email: string; mustChangePassword: boolean };
  temporaryPassword: string;
  subscription: { id: string; feeAmount: string; startsOn: string; endsOn: string };
}
const data = (res: Response) => (res.body as { data: CreatedHotel }).data;
const token = (res: Response) => (res.body as { data: { accessToken: string } }).data.accessToken;
const cookie = (res: Response) =>
  (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
function input() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return {
    code: `HT_${suffix}`,
    name: `Synthetic hotel ${suffix}`,
    timezone: 'Asia/Ho_Chi_Minh',
    contactEmail: `contact_${suffix}@example.test`,
    contactPhone: '0900000000',
    address: 'Synthetic address',
    agreementReference: 'DEMO-AGREEMENT',
    admin: {
      fullName: 'Synthetic Hotel Admin',
      username: `admin_${suffix}`,
      email: `admin_${suffix}@example.test`,
    },
    subscription: {
      planName: 'Innvyra PMS',
      startsOn: '2026-11-11',
      endsOn: '2027-11-10',
      feeAmount: '1234567.89',
      paymentReference: 'DEMO-PAYMENT',
    },
  };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Hotel onboarding: real MySQL transactions, account issuance and tenant boundaries',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let app: ReturnType<typeof createApp>;
    let ownerId: bigint;
    let platformToken: string;
    let service: HotelManagementService;
    beforeAll(async () => {
      database = await isolatedMySql('hotel_onboard');
      const prisma = database.prisma;
      await prisma.role.createMany({
        data: [
          { code: 'ADMIN', name: 'Hotel Admin' },
          { code: 'MANAGER', name: 'Manager' },
        ],
      });
      const owner = await prisma.platformAdmin.create({
        data: {
          email: 'owner@example.test',
          fullName: 'Synthetic Platform Owner',
          passwordHash: await hashPassword(testPassword),
        },
      });
      ownerId = owner.id;
      service = new HotelManagementService(prisma);
      app = createApp(
        { ...testEnv, DATABASE_URL: database.url },
        new PrismaAuthRepository(prisma),
        {
          rooms: new PrismaRoomRepository(prisma),
          roomTypes: new PrismaRoomTypeRepository(prisma),
        },
        new PrismaGuestRepository(prisma),
        new PrismaReservationRepository(prisma),
        undefined,
        undefined,
        undefined,
        undefined,
        new PrismaEmployeeRepository(prisma),
        undefined,
        new PrismaPlatformAuthRepository(prisma),
        service,
      );
      const login = await request(app)
        .post('/api/v1/platform/auth/login')
        .set('X-CSRF-Protection', '1')
        .send({ email: owner.email, password: testPassword });
      expect(login.status).toBe(200);
      platformToken = token(login);
    }, 120000);
    afterAll(async () => {
      await database?.dispose();
    });
    const post = (url: string, body: object, access = platformToken) =>
      request(app)
        .post(url)
        .auth(access, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const get = (url: string, access = platformToken) =>
      request(app).get(url).auth(access, { type: 'bearer' });
    const patch = (url: string, body: object, access = platformToken) =>
      request(app)
        .patch(url)
        .auth(access, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const staffLogin = (hotel: CreatedHotel, password = hotel.temporaryPassword) =>
      post('/api/v1/auth/login', { username: hotel.admin.username, password }, '');
    const onboard = async () => {
      const res = await post(base, input());
      expect(res.status).toBe(201);
      return data(res);
    };
    const change = (access: string, currentPassword: string, newPassword = replacement) =>
      post('/api/v1/auth/change-password', { currentPassword, newPassword }, access);
    const counts = async () =>
      Promise.all([
        database.prisma.hotel.count(),
        database.prisma.staffUser.count(),
        database.prisma.hotelSubscriptionPeriod.count(),
        database.prisma.platformAuditLog.count(),
      ]);

    it('atomically creates hotel, first admin, precise initial period and three safe audits', async () => {
      const payload = input();
      const before = await counts();
      const res = await post(base, payload);
      expect(res.status).toBe(201);
      expect(await counts()).toEqual(before.map((value, index) => value + (index === 3 ? 3 : 1)));
      const created = data(res);
      expect(created.hotel.code).toBe(payload.code.toUpperCase());
      expect(created.admin.mustChangePassword).toBe(true);
      expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(15);
      expect(new Set(created.temporaryPassword).size).toBeGreaterThanOrEqual(8);
      expect(created.subscription.feeAmount).toBe('1234567.89');
      const staff = await database.prisma.staffUser.findUniqueOrThrow({
        where: { id: BigInt(created.admin.id) },
        include: { role: true },
      });
      expect(staff.role.code).toBe('ADMIN');
      expect(await verifyPassword(staff.passwordHash, created.temporaryPassword)).toBe(true);
      expect(res.text).not.toContain('passwordHash');
      const logs = await database.prisma.platformAuditLog.findMany({
        where: { hotelId: BigInt(created.hotel.id) },
      });
      expect(logs.every((log) => log.actorId === ownerId)).toBe(true);
      expect(
        JSON.stringify(logs, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      ).not.toContain(created.temporaryPassword);
    });

    it('lists/searches with pagination and keeps issued credentials out of list/detail/audits', async () => {
      const hotel = await onboard();
      const list = await get(`${base}?search=${hotel.hotel.code}&limit=1&page=1`);
      expect(list.status).toBe(200);
      expect(list.body).toMatchObject({
        data: { pagination: { total: 1 }, items: [{ id: hotel.hotel.id }] },
      });
      const detail = await get(`${base}/${hotel.hotel.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({
        data: {
          staff: [{ id: hotel.admin.id }],
          subscriptionPeriods: [{ id: hotel.subscription.id }],
        },
      });
      for (const response of [list, detail]) {
        expect(response.text).not.toContain(hotel.temporaryPassword);
        expect(response.text).not.toMatch(/passwordHash|password_hash|tokenHash|temporaryPassword/);
        expect(response.headers['cache-control']).toBe('no-store');
      }
    });

    it('rolls back duplicate hotel code, username and email without partial onboarding', async () => {
      const original = input();
      expect((await post(base, original)).status).toBe(201);
      for (const payload of [
        { ...input(), code: original.code },
        { ...input(), admin: { ...input().admin, username: original.admin.username } },
        { ...input(), admin: { ...input().admin, email: original.admin.email } },
      ]) {
        const before = await counts();
        expect((await post(base, payload)).status).toBe(409);
        expect(await counts()).toEqual(before);
      }
    });

    it('rolls back a failure after hotel/admin creation when recording the initial period', async () => {
      const before = await counts();
      const payload = input();
      await expect(service.create(18446744073709551614n, payload)).rejects.toMatchObject({
        code: 'REFERENCE_CONFLICT',
      });
      expect(await counts()).toEqual(before);
    });

    it('serializes competing unique creates: one complete hotel and no loser side effects', async () => {
      const payload = input();
      const before = await counts();
      const responses = await Promise.all([post(base, payload), post(base, payload)]);
      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(await counts()).toEqual(before.map((value, index) => value + (index === 3 ? 3 : 1)));
    });

    it('rejects malformed dates, timezone, money, role injection and privileged hotel fields', async () => {
      const original = input();
      for (const payload of [
        { ...original, timezone: 'Not/A_Timezone' },
        { ...original, status: 'SUSPENDED' },
        { ...original, admin: { ...original.admin, role: 'PLATFORM_ADMIN' } },
        { ...original, subscription: { ...original.subscription, startsOn: '2026-02-30' } },
        { ...original, subscription: { ...original.subscription, endsOn: '2025-01-01' } },
        { ...original, subscription: { ...original.subscription, feeAmount: '-1' } },
        { ...original, subscription: { ...original.subscription, feeAmount: '1000000000000' } },
        { ...original, admin: { ...original.admin, password: testPassword } },
      ])
        expect((await post(base, payload)).status).toBe(422);
      expect((await get(`${base}?hotelId=1`)).status).toBe(422);
      expect((await get(`${base}?limit=101`)).status).toBe(422);
      for (const id of ['0', 'abc', '18446744073709551616'])
        expect((await get(`${base}/${id}`)).status).toBe(422);
      expect((await get(`${base}/18446744073709551614`)).status).toBe(404);
    });

    it('allows a one-day zero-fee initial period and a non-default timezone', async () => {
      const payload = input();
      const res = await post(base, {
        ...payload,
        timezone: 'Pacific/Auckland',
        subscription: {
          ...payload.subscription,
          endsOn: payload.subscription.startsOn,
          feeAmount: '0',
        },
      });
      expect(res.status).toBe(201);
      expect(data(res).subscription.startsOn).toBe(data(res).subscription.endsOn);
    });

    it('requires platform credentials and CSRF; hotel staff cannot reach platform hotel operations', async () => {
      expect((await request(app).get(base)).status).toBe(401);
      expect(
        (await request(app).post(base).auth(platformToken, { type: 'bearer' }).send(input()))
          .status,
      ).toBe(403);
      const hotel = await onboard();
      const staff = await staffLogin(hotel);
      expect((await get(base, token(staff))).status).toBe(401);
      expect((await post(base, input(), token(staff))).status).toBe(401);
      expect((await get('/api/v1/room-types', platformToken)).status).toBe(401);
    });

    it('updates only permitted platform fields and atomically journals the changes', async () => {
      const hotel = await onboard();
      const res = await patch(`${base}/${hotel.hotel.id}`, {
        name: 'Updated synthetic hotel',
        contactEmail: null,
        address: null,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { name: 'Updated synthetic hotel', contactEmail: null },
      });
      const audit = await database.prisma.platformAuditLog.findFirstOrThrow({
        where: { hotelId: BigInt(hotel.hotel.id), action: 'HOTEL_UPDATED' },
      });
      expect(audit.changes).toMatchObject({
        name: { before: hotel.hotel.name, after: 'Updated synthetic hotel' },
      });
      for (const payload of [
        {},
        { code: 'NEW_CODE' },
        { status: 'SUSPENDED' },
        { id: '1' },
        { subscription: {} },
      ])
        expect((await patch(`${base}/${hotel.hotel.id}`, payload)).status).toBe(422);
    });

    it('issues another scoped ADMIN with its own one-time password and no client-selected role', async () => {
      const hotel = await onboard();
      const second = input().admin;
      const res = await post(`${base}/${hotel.hotel.id}/admins`, second);
      expect(res.status).toBe(201);
      const issued = data(res);
      expect(issued.admin.mustChangePassword).toBe(true);
      expect((await get(`${base}/${hotel.hotel.id}`)).text).not.toContain(issued.temporaryPassword);
      expect(
        (
          await post(
            '/api/v1/auth/login',
            { username: second.username, password: issued.temporaryPassword },
            '',
          )
        ).status,
      ).toBe(200);
      expect(
        (await post(`${base}/${hotel.hotel.id}/admins`, { ...input().admin, role: 'MANAGER' }))
          .status,
      ).toBe(422);
      expect((await post(`${base}/18446744073709551614/admins`, input().admin)).status).toBe(404);
    });

    it('blocks all hotel operations until the temporary password changes, including /hotel and admin-check', async () => {
      const hotel = await onboard();
      const login = await staffLogin(hotel);
      expect(login.status).toBe(200);
      expect(login.body).toMatchObject({
        data: {
          user: {
            hotelId: hotel.hotel.id,
            mustChangePassword: true,
            hotel: { id: hotel.hotel.id, name: hotel.hotel.name },
          },
        },
      });
      for (const url of [
        '/api/v1/hotel',
        '/api/v1/auth/admin-check',
        '/api/v1/rooms',
        '/api/v1/room-types',
        '/api/v1/guests',
        '/api/v1/reservations',
        '/api/v1/employees',
      ]) {
        const res = await get(url, token(login));
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ error: { code: 'PASSWORD_CHANGE_REQUIRED' } });
      }
      expect((await get('/api/v1/auth/me', token(login))).status).toBe(200);
      expect(
        (
          await request(app)
            .post('/api/v1/auth/refresh')
            .set('X-CSRF-Protection', '1')
            .set('Cookie', cookie(login))
        ).status,
      ).toBe(200);
    });

    it('requires current/different strong password, revokes all staff sessions and preserves platform auth', async () => {
      const hotel = await onboard();
      const first = await staffLogin(hotel);
      const second = await staffLogin(hotel);
      expect((await change(token(first), 'wrong')).status).toBe(400);
      expect((await change(token(first), hotel.temporaryPassword, 'short')).status).toBe(422);
      expect(
        (await change(token(first), hotel.temporaryPassword, hotel.temporaryPassword)).status,
      ).toBe(422);
      expect((await change(token(first), hotel.temporaryPassword)).status).toBe(200);
      for (const login of [first, second]) {
        expect((await get('/api/v1/auth/me', token(login))).status).toBe(401);
        expect(
          (
            await request(app)
              .post('/api/v1/auth/refresh')
              .set('X-CSRF-Protection', '1')
              .set('Cookie', cookie(login))
          ).status,
        ).toBe(401);
      }
      expect((await staffLogin(hotel)).status).toBe(401);
      const signedIn = await staffLogin(hotel, replacement);
      expect(signedIn.body).toMatchObject({ data: { user: { mustChangePassword: false } } });
      expect((await get('/api/v1/room-types', token(signedIn))).status).toBe(200);
      expect((await get(base)).status).toBe(200);
    });

    it('reset requires a reason, only targets ADMINs in that hotel, and revokes existing access/refresh', async () => {
      const a = await onboard();
      const b = await onboard();
      const login = await staffLogin(a);
      expect(
        (await post(`${base}/${a.hotel.id}/admins/${a.admin.id}/reset-password`, { reason: '' }))
          .status,
      ).toBe(422);
      expect(
        (
          await post(`${base}/${b.hotel.id}/admins/${a.admin.id}/reset-password`, {
            reason: 'Synthetic reset',
          })
        ).status,
      ).toBe(404);
      const reset = await post(`${base}/${a.hotel.id}/admins/${a.admin.id}/reset-password`, {
        reason: 'Verified owner request',
      });
      expect(reset.status).toBe(200);
      expect(data(reset).temporaryPassword).not.toBe(a.temporaryPassword);
      expect((await get('/api/v1/auth/me', token(login))).status).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/auth/refresh')
            .set('X-CSRF-Protection', '1')
            .set('Cookie', cookie(login))
        ).status,
      ).toBe(401);
      expect((await staffLogin(a)).status).toBe(401);
      expect((await staffLogin(a, data(reset).temporaryPassword)).status).toBe(200);
      expect((await staffLogin(b)).status).toBe(200);
      const audit = await database.prisma.platformAuditLog.findFirstOrThrow({
        where: { hotelId: BigInt(a.hotel.id), action: 'HOTEL_ADMIN_PASSWORD_RESET' },
      });
      expect(audit.reason).toBe('Verified owner request');
      expect(audit.targetStaffUserId?.toString()).toBe(a.admin.id);
    });

    it('permits own profile updates only for hotel ADMIN and rejects changing code, scope or subscription', async () => {
      const a = await onboard();
      const b = await onboard();
      const first = await staffLogin(a);
      expect((await change(token(first), a.temporaryPassword)).status).toBe(200);
      const access = token(await staffLogin(a, replacement));
      expect((await get('/api/v1/hotel', access)).body).toMatchObject({ data: { id: a.hotel.id } });
      const result = await patch(
        '/api/v1/hotel',
        { name: 'Hotel A updated', contactPhone: null },
        access,
      );
      expect(result.status).toBe(200);
      expect((await get(`${base}/${b.hotel.id}`)).body).toMatchObject({
        data: { name: b.hotel.name },
      });
      expect((await get('/api/v1/auth/me', access)).body).toMatchObject({
        data: { hotel: { name: 'Hotel A updated' } },
      });
      for (const body of [
        { hotelId: b.hotel.id },
        { code: 'NEW' },
        { timezone: 'UTC' },
        { status: 'SUSPENDED' },
        { agreementReference: 'X' },
        { subscription: {} },
      ])
        expect((await patch('/api/v1/hotel', body, access)).status).toBe(422);
      expect((await get(`/api/v1/hotel?hotelId=${b.hotel.id}`, access)).status).toBe(422);
      const managerRole = await database.prisma.role.findUniqueOrThrow({
        where: { code: 'MANAGER' },
      });
      await database.prisma.staffUser.update({
        where: { id: BigInt(a.admin.id) },
        data: { roleId: managerRole.id },
      });
      expect((await patch('/api/v1/hotel', { name: 'Not allowed' }, access)).status).toBe(403);
      expect((await get('/api/v1/hotel', access)).status).toBe(200);
      expect(
        (
          await post(`${base}/${a.hotel.id}/admins/${a.admin.id}/reset-password`, {
            reason: 'Not an admin',
          })
        ).status,
      ).toBe(404);
    });

    it('isolates A/B operational data after activation and permits identical room-type codes across hotels', async () => {
      const a = await onboard();
      const b = await onboard();
      const sessions = await Promise.all(
        [a, b].map(async (hotel) => {
          const login = await staffLogin(hotel);
          expect((await change(token(login), hotel.temporaryPassword)).status).toBe(200);
          return token(await staffLogin(hotel, replacement));
        }),
      );
      const roomInput = { code: 'STANDARD', name: 'Standard', basePrice: '500000', maxAdults: 2 };
      const ra = await post('/api/v1/room-types', roomInput, sessions[0]!);
      const rb = await post('/api/v1/room-types', roomInput, sessions[1]!);
      expect(ra.status).toBe(201);
      expect(rb.status).toBe(201);
      const roomId = (ra.body as { data: { id: string } }).data.id;
      expect((await get(`/api/v1/room-types/${roomId}`, sessions[1]!)).status).toBe(404);
      expect(
        (await patch(`/api/v1/room-types/${roomId}`, { name: 'Cross hotel' }, sessions[1]!)).status,
      ).toBe(404);
      expect((await get('/api/v1/hotel', sessions[0]!)).body).toMatchObject({
        data: { id: a.hotel.id },
      });
      expect((await get('/api/v1/hotel', sessions[1]!)).body).toMatchObject({
        data: { id: b.hotel.id },
      });
    });

    it('hotel bootstrap CLI checks ADMIN existence per hotel, rather than globally', async () => {
      await onboard();
      const empty = await database.prisma.hotel.create({
        data: { code: randomUUID(), name: 'Synthetic CLI hotel' },
      });
      const run = promisify(execFile);
      const suffix = randomUUID().slice(0, 8);
      const args = ['--import', 'tsx', 'scripts/create-admin.ts'];
      const options = {
        cwd: resolve(import.meta.dirname, '..'),
        timeout: 30000,
        env: {
          ...process.env,
          DATABASE_URL: database.url,
          ADMIN_HOTEL_ID: empty.id.toString(),
          ADMIN_USERNAME: `cli_${suffix}`,
          ADMIN_FULL_NAME: 'Synthetic CLI Admin',
          ADMIN_PASSWORD: testPassword,
        },
      };
      const success = await run(process.execPath, args, options);
      expect(success.stdout).toContain('First ADMIN created');
      expect(success.stdout + success.stderr).not.toContain(testPassword);
      await expect(run(process.execPath, args, options)).rejects.toBeTruthy();
      expect(await database.prisma.staffUser.count({ where: { hotelId: empty.id } })).toBe(1);
    });

    it('refuses a login session verified against the hash from before a platform reset', async () => {
      const hotel = await onboard();
      const original = await database.prisma.staffUser.findUniqueOrThrow({
        where: { id: BigInt(hotel.admin.id) },
      });
      expect(
        (
          await post(`${base}/${hotel.hotel.id}/admins/${hotel.admin.id}/reset-password`, {
            reason: 'Synthetic stale password race',
          })
        ).status,
      ).toBe(200);
      const repository = new PrismaAuthRepository(database.prisma);
      const sessionId = randomUUID();
      await expect(
        repository.createSession({
          id: sessionId,
          staffUserId: original.id,
          expiresAt: new Date(Date.now() + 60000),
          tokenHash: 'a'.repeat(64),
          expectedPasswordHash: original.passwordHash,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(await database.prisma.authSession.findUnique({ where: { id: sessionId } })).toBeNull();
    });

    it('password change racing a platform reset cannot leave an active session on the replaced credentials', async () => {
      const hotel = await onboard();
      const login = await staffLogin(hotel);
      const [changed, reset] = await Promise.all([
        change(token(login), hotel.temporaryPassword),
        post(`${base}/${hotel.hotel.id}/admins/${hotel.admin.id}/reset-password`, {
          reason: 'Synthetic concurrent reset',
        }),
      ]);
      expect([200, 401, 409]).toContain(changed.status);
      expect(reset.status).toBe(200);
      expect((await get('/api/v1/auth/me', token(login))).status).toBe(401);
      const finalLogin = await staffLogin(hotel, data(reset).temporaryPassword);
      expect(finalLogin.status).toBe(200);
      expect(finalLogin.body).toMatchObject({ data: { user: { mustChangePassword: true } } });
    });
  },
);
