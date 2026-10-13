import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { body, cookie, testEnv, testPassword } from './helpers.js';

// Never falls back to DATABASE_URL. This suite only writes its own tagged fixtures.
const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('MySQL integration (dedicated local database)', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let app: ReturnType<typeof createApp>;
  let hotelId: bigint | undefined;
  let userId: bigint;
  let adminRoleId: bigint;
  let receptionistRoleId: bigint;
  const username = `test_${randomUUID().replaceAll('-', '')}`;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname)
    ) {
      throw new Error(
        'MySQL tests require NODE_ENV=test and a local database with name ending in _test',
      );
    }
    if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname) {
      throw new Error('TEST_DATABASE_URL must use a separate database name from DATABASE_URL');
    }
    prisma = createPrisma(testUrl!);
    await prisma.$connect();
    const [admin, receptionist] = await Promise.all([
      prisma.role.upsert({
        where: { code: 'ADMIN' },
        create: { code: 'ADMIN', name: 'Administrator' },
        update: {},
      }),
      prisma.role.upsert({
        where: { code: 'RECEPTIONIST' },
        create: { code: 'RECEPTIONIST', name: 'Receptionist' },
        update: {},
      }),
    ]);
    adminRoleId = admin.id;
    receptionistRoleId = receptionist.id;
    const hotel = await prisma.hotel.create({
      data: { code: username, name: 'Temporary auth integration fixture' },
    });
    hotelId = hotel.id;
    const staff = await prisma.staffUser.create({
      data: {
        hotelId,
        roleId: adminRoleId,
        username,
        fullName: 'Test Admin',
        passwordHash: await hashPassword(testPassword),
      },
    });
    userId = staff.id;
    app = createApp({ ...testEnv, DATABASE_URL: testUrl! }, new PrismaAuthRepository(prisma));
  });
  afterAll(async () => {
    if (!prisma) return;
    try {
      if (hotelId !== undefined) {
        await prisma.authSession.deleteMany({ where: { staffUser: { hotelId } } });
        await prisma.staffUser.deleteMany({ where: { hotelId } });
        await prisma.hotel.delete({ where: { id: hotelId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });
  const login = () =>
    request(app)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({ username, password: testPassword });
  const refresh = (value: string) =>
    request(app).post('/api/v1/auth/refresh').set('X-CSRF-Protection', '1').set('Cookie', value);
  const me = (token: string) => request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' });

  it('persists a hashed refresh token, rotates and invalidates the session on logout', async () => {
    const initial = await login();
    expect(initial.status).toBe(200);
    const stored = await prisma.refreshToken.findFirstOrThrow({
      where: { session: { staffUserId: userId } },
    });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie(initial)).not.toContain(stored.tokenHash);
    const rotated = await refresh(cookie(initial));
    expect(rotated.status).toBe(200);
    expect((await me(body(rotated).data.accessToken)).status).toBe(200);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Protection', '1')
      .auth(body(rotated).data.accessToken, { type: 'bearer' });
    expect(logout.status).toBe(200);
    expect((await me(body(initial).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(rotated))).status).toBe(401);
  });
  it('serializes concurrent refreshes and commits reuse revocation', async () => {
    const initial = await login();
    const results = await Promise.all([refresh(cookie(initial)), refresh(cookie(initial))]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    const winner = results.find((result) => result.status === 200)!;
    expect((await me(body(winner).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(winner))).status).toBe(401);
    expect(
      await prisma.authSession.count({
        where: { staffUserId: userId, revokedReason: 'REFRESH_REUSE' },
      }),
    ).toBeGreaterThan(0);
  });
  it('does not resurrect a session during concurrent logout and refresh', async () => {
    const initial = await login();
    const [rotation, logout] = await Promise.all([
      refresh(cookie(initial)),
      request(app)
        .post('/api/v1/auth/logout')
        .set('X-CSRF-Protection', '1')
        .auth(body(initial).data.accessToken, { type: 'bearer' }),
    ]);
    expect(logout.status).toBe(200);
    expect([200, 401]).toContain(rotation.status);
    expect((await me(body(initial).data.accessToken)).status).toBe(401);
    if (rotation.status === 200) expect((await refresh(cookie(rotation))).status).toBe(401);
  });
  it('reads role changes and account deactivation from MySQL on every request', async () => {
    const initial = await login();
    try {
      await prisma.staffUser.update({
        where: { id: userId },
        data: { roleId: receptionistRoleId },
      });
      const denied = await request(app)
        .get('/api/v1/auth/admin-check')
        .auth(body(initial).data.accessToken, { type: 'bearer' });
      expect(denied.status).toBe(403);
      await prisma.staffUser.update({ where: { id: userId }, data: { isActive: false } });
      expect((await me(body(initial).data.accessToken)).status).toBe(401);
      expect((await refresh(cookie(initial))).status).toBe(401);
    } finally {
      await prisma.staffUser.update({
        where: { id: userId },
        data: { roleId: adminRoleId, isActive: true },
      });
    }
  });
});
