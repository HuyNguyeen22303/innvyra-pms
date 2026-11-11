import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request, { type Response } from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { PrismaEmployeeRepository } from '../src/modules/employees/employee.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { HotelManagementService } from '../src/modules/hotels/hotel.service.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { ROLE_CODES } from '../src/shared/types/roles.js';
import { isolatedMySql } from './isolated-mysql.js';
import { testEnv, testPassword } from './helpers.js';

const replacement = 'A new private employee passphrase 2026!';
const token = (res: Response) => (res.body as { data: { accessToken: string } }).data.accessToken;
const cookie = (res: Response) =>
  (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Phase 3 hotel account lifecycle on isolated MySQL',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let app: ReturnType<typeof createApp>;
    let adminToken: string;
    let otherToken: string;
    let hotelId: bigint;
    beforeAll(async () => {
      database = await isolatedMySql('hotel_accounts');
      const prisma = database.prisma;
      await prisma.role.createMany({ data: ROLE_CODES.map((code) => ({ code, name: code })) });
      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
      const hash = await hashPassword(testPassword);
      for (const suffix of ['a', 'b']) {
        const hotel = await prisma.hotel.create({
          data: { code: suffix.toUpperCase(), name: `Synthetic Hotel ${suffix}` },
        });
        if (suffix === 'a') hotelId = hotel.id;
        await prisma.staffUser.create({
          data: {
            username: `legacy_${suffix}`,
            fullName: `Legacy Admin ${suffix}`,
            hotelId: hotel.id,
            roleId: role.id,
            passwordHash: hash,
          },
        });
      }
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
        undefined,
        new HotelManagementService(prisma),
      );
      adminToken = token(await login('legacy_a'));
      otherToken = token(await login('legacy_b'));
    }, 120000);
    afterAll(async () => {
      await database?.dispose();
    });
    const login = (username: string, password = testPassword) =>
      request(app)
        .post('/api/v1/auth/login')
        .set('X-CSRF-Protection', '1')
        .send({ username, password });
    const get = (path: string, access: string) =>
      request(app).get(`/api/v1${path}`).auth(access, { type: 'bearer' });
    const post = (path: string, body: object, access = adminToken) =>
      request(app)
        .post(`/api/v1${path}`)
        .auth(access, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const newStaff = async (role = 'RECEPTIONIST') => {
      const username = `staff_${randomUUID().replaceAll('-', '').slice(0, 14)}`;
      const response = await post('/employees', {
        fullName: 'Synthetic Employee',
        username,
        password: testPassword,
        role,
      });
      expect(response.status).toBe(201);
      const { data } = response.body as { data: { id: string; mustChangePassword: boolean } };
      expect(data.mustChangePassword).toBe(true);
      return { username, id: data.id };
    };
    const change = (access: string, currentPassword = testPassword) =>
      post('/auth/change-password', { currentPassword, newPassword: replacement }, access);

    it('keeps pre-existing accounts usable with username and no forced password reset', async () => {
      const response = await login(' LEGACY_A ');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ data: { user: { mustChangePassword: false } } });
      expect((await get('/rooms', token(response))).status).toBe(200);
      expect((await get('/hotel', token(response))).body).toMatchObject({
        data: { id: hotelId.toString() },
      });
    });

    it.each(ROLE_CODES)(
      'requires every newly issued %s account to change password before operations',
      async (role) => {
        const staff = await newStaff(role);
        const first = await login(staff.username);
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({ data: { user: { mustChangePassword: true, role } } });
        const blocked = await get('/rooms', token(first));
        expect(blocked.status).toBe(403);
        expect(blocked.body).toMatchObject({ error: { code: 'PASSWORD_CHANGE_REQUIRED' } });
        expect((await get('/auth/me', token(first))).status).toBe(200);
        expect((await change(token(first))).status).toBe(200);
        expect((await get('/auth/me', token(first))).status).toBe(401);
        expect((await login(staff.username)).status).toBe(401);
        const second = await login(staff.username, replacement);
        expect(second.body).toMatchObject({ data: { user: { mustChangePassword: false } } });
        expect((await get('/rooms', token(second))).status).toBe(200);
      },
    );

    it('manual employee reset re-enables the flag and revokes all old access/refresh sessions', async () => {
      const staff = await newStaff();
      expect((await change(token(await login(staff.username)))).status).toBe(200);
      const old = await login(staff.username, replacement);
      const otherOld = await login(staff.username, replacement);
      const reset = await post(`/employees/${staff.id}/reset-password`, { password: testPassword });
      expect(reset.status).toBe(200);
      expect(reset.body).toMatchObject({ data: { mustChangePassword: true } });
      for (const previous of [old, otherOld]) {
        expect((await get('/auth/me', token(previous))).status).toBe(401);
        expect(
          (
            await request(app)
              .post('/api/v1/auth/refresh')
              .set('X-CSRF-Protection', '1')
              .set('Cookie', cookie(previous))
          ).status,
        ).toBe(401);
      }
      expect((await login(staff.username, replacement)).status).toBe(401);
      const issued = await login(staff.username);
      expect((await get('/rooms', token(issued))).status).toBe(403);
      expect((await get('/rooms', otherToken)).status).toBe(200);
      expect((await change(token(issued))).status).toBe(200);
    });

    it('server-generated employee reset also sets the flag and exposes no credential in reads', async () => {
      const staff = await newStaff();
      const old = await login(staff.username);
      const reset = await post(`/employees/${staff.id}/reset-password`, {});
      expect(reset.status).toBe(200);
      expect(reset.body).toMatchObject({ data: { mustChangePassword: true } });
      expect(reset.text).not.toMatch(/passwordHash|temporaryPassword|tokenHash/);
      expect((await get('/auth/me', token(old))).status).toBe(401);
      const record = await database.prisma.staffUser.findUniqueOrThrow({
        where: { id: BigInt(staff.id) },
      });
      expect(record.mustChangePassword).toBe(true);
      expect((await get('/employees', adminToken)).text).not.toContain(record.passwordHash);
    });

    it('rejects attempts to disable the flag from create/update bodies or change another hotel account', async () => {
      expect(
        (
          await post('/employees', {
            username: 'flag_bypass',
            fullName: 'Synthetic',
            role: 'ADMIN',
            password: testPassword,
            mustChangePassword: false,
          })
        ).status,
      ).toBe(422);
      const staff = await newStaff();
      expect(
        (
          await request(app)
            .patch(`/api/v1/employees/${staff.id}`)
            .auth(adminToken, { type: 'bearer' })
            .set('X-CSRF-Protection', '1')
            .send({ mustChangePassword: false })
        ).status,
      ).toBe(422);
      expect(
        (
          await post(
            `/employees/${staff.id}/reset-password`,
            { password: testPassword },
            otherToken,
          )
        ).status,
      ).toBe(404);
    });

    it('a stale verified hash cannot open a new session after employee reset', async () => {
      const staff = await newStaff();
      const original = await database.prisma.staffUser.findUniqueOrThrow({
        where: { id: BigInt(staff.id) },
      });
      expect(
        (await post(`/employees/${staff.id}/reset-password`, { password: replacement })).status,
      ).toBe(200);
      const repository = new PrismaAuthRepository(database.prisma);
      const id = randomUUID();
      await expect(
        repository.createSession({
          id,
          staffUserId: original.id,
          tokenHash: 'b'.repeat(64),
          expiresAt: new Date(Date.now() + 60000),
          expectedPasswordHash: original.passwordHash,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(await database.prisma.authSession.findUnique({ where: { id } })).toBeNull();
    });
  },
);
