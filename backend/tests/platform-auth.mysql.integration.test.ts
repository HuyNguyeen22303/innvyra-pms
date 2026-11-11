import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { PrismaPlatformAuthRepository } from '../src/modules/platform-auth/platform-auth.repository.js';
import { platformAccessTokens } from '../src/modules/platform-auth/platform-auth.service.js';
import { AccessTokens, newRefreshToken } from '../src/shared/utils/tokens.js';
import { verifyPassword } from '../src/shared/utils/password.js';
import { isolatedMySql } from './isolated-mysql.js';
import { testEnv, testPassword } from './helpers.js';

const run = promisify(execFile);
const backendRoot = resolve(import.meta.dirname, '..');
const base = '/api/v1/platform/auth';
const replacement = 'A replacement platform passphrase 2026!';
const token = (res: Response): string =>
  (res.body as { data: { accessToken: string } }).data.accessToken;
const cookie = (res: Response): string =>
  (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Platform MySQL: bootstrap CLI, realm isolation and independent-client races',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let app: ReturnType<typeof createApp>;
    let ownerId: bigint;
    let ownerEmail: string;
    let originalHash: string;
    let bootstrapResults: PromiseSettledResult<{ stdout: string; stderr: string }>[];
    let bootstrapCounts: number[];
    let repository: PrismaPlatformAuthRepository;
    beforeAll(async () => {
      database = await isolatedMySql('platform_auth');
      const env = {
        ...process.env,
        DATABASE_URL: database.url,
        PLATFORM_ADMIN_FULL_NAME: 'Synthetic platform owner',
        PLATFORM_ADMIN_PASSWORD: testPassword,
      };
      bootstrapResults = await Promise.allSettled(
        ['owner@example.test', 'other@example.test'].map((email) =>
          run(process.execPath, ['--import', 'tsx', 'scripts/create-platform-admin.ts'], {
            cwd: backendRoot,
            timeout: 30000,
            env: { ...env, PLATFORM_ADMIN_EMAIL: email },
          }),
        ),
      );
      const { prisma } = database;
      const owner = await prisma.platformAdmin.findFirstOrThrow();
      ownerId = owner.id;
      ownerEmail = owner.email;
      originalHash = owner.passwordHash;
      bootstrapCounts = await Promise.all([
        prisma.hotel.count(),
        prisma.staffUser.count(),
        prisma.role.count(),
      ]);
      const hotel = await prisma.hotel.create({
        data: { code: randomUUID(), name: 'Synthetic realm fixture' },
      });
      const role = await prisma.role.create({ data: { code: 'ADMIN', name: 'Hotel Admin' } });
      await prisma.staffUser.create({
        data: {
          id: ownerId,
          hotelId: hotel.id,
          roleId: role.id,
          fullName: 'Synthetic hotel admin',
          username: 'hotel_admin',
          passwordHash: originalHash,
        },
      });
      repository = new PrismaPlatformAuthRepository(prisma);
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
        undefined,
        undefined,
        repository,
      );
    }, 120000);
    beforeEach(async () => {
      await database.prisma.platformAuthSession.deleteMany();
      await database.prisma.authSession.deleteMany();
      await database.prisma.platformAdmin.update({
        where: { id: ownerId },
        data: { passwordHash: originalHash, isActive: true },
      });
    });
    afterAll(async () => {
      await database?.dispose();
    });
    const login = (password = testPassword) =>
      request(app)
        .post(base + '/login')
        .set('X-CSRF-Protection', '1')
        .send({ email: ownerEmail, password });
    const me = (accessToken: string) =>
      request(app)
        .get(base + '/me')
        .auth(accessToken, { type: 'bearer' });
    const refresh = (value: string) =>
      request(app)
        .post(base + '/refresh')
        .set('X-CSRF-Protection', '1')
        .set('Cookie', value);
    const change = (accessToken: string) =>
      request(app)
        .post(base + '/change-password')
        .set('X-CSRF-Protection', '1')
        .auth(accessToken, { type: 'bearer' })
        .send({ currentPassword: testPassword, newPassword: replacement });

    it('allows exactly one concurrent first-admin CLI bootstrap without a hotel, role seed or password output', () => {
      expect(bootstrapResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(bootstrapResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const success = bootstrapResults.find((result) => result.status === 'fulfilled');
      if (success?.status !== 'fulfilled') throw new Error('No successful bootstrap');
      expect(success.value.stdout).toContain('First PLATFORM_ADMIN created with ID 1.');
      expect(success.value.stdout + success.value.stderr).not.toContain(testPassword);
      expect(bootstrapCounts).toEqual([0, 0, 0]);
    });
    it('refuses a second CLI bootstrap without modifying the original credentials', async () => {
      const result = await run(
        process.execPath,
        ['--import', 'tsx', 'scripts/create-platform-admin.ts'],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            DATABASE_URL: database.url,
            PLATFORM_ADMIN_EMAIL: 'replacement@example.test',
            PLATFORM_ADMIN_FULL_NAME: 'Replacement',
            PLATFORM_ADMIN_PASSWORD: replacement,
          },
        },
      ).then(
        () => null,
        (error: unknown) => error as { stderr: string },
      );
      expect(result?.stderr).toContain('A platform admin already exists');
      expect(result?.stderr).not.toContain(replacement);
      expect(await database.prisma.platformAdmin.count()).toBe(1);
      expect((await repository.findAdminById(ownerId))!.passwordHash).toBe(originalHash);
    });
    it('rejects malformed bootstrap input without printing supplied secrets', async () => {
      const result = await run(
        process.execPath,
        ['--import', 'tsx', 'scripts/create-platform-admin.ts'],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            DATABASE_URL: database.url,
            PLATFORM_ADMIN_EMAIL: 'not-an-email!',
            PLATFORM_ADMIN_FULL_NAME: 'Synthetic',
            PLATFORM_ADMIN_PASSWORD: 'secret-marker',
          },
        },
      ).then(
        () => null,
        (error: unknown) => error as { stderr: string },
      );
      expect(result?.stderr).toContain('Invalid platform admin input');
      expect(result?.stderr).not.toContain('secret-marker');
      expect(result?.stderr).not.toContain('not-an-email!');
    });
    it('rejects cross-realm tokens even when staff/admin IDs and session IDs coincide', async () => {
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + 86400000);
      await database.prisma.authSession.create({ data: { id, staffUserId: ownerId, expiresAt } });
      await database.prisma.platformAuthSession.create({
        data: { id, platformAdminId: ownerId, expiresAt },
      });
      const staffToken = await new AccessTokens(testEnv).sign(ownerId.toString(), id);
      const platformToken = await platformAccessTokens(testEnv).sign(ownerId.toString(), id);
      expect((await me(platformToken)).status).toBe(200);
      expect((await me(staffToken)).status).toBe(401);
      expect(
        (await request(app).get('/api/v1/auth/me').auth(staffToken, { type: 'bearer' })).status,
      ).toBe(200);
      expect(
        (await request(app).get('/api/v1/auth/me').auth(platformToken, { type: 'bearer' })).status,
      ).toBe(401);
    });
    it('commits reuse revocation when two clients rotate the same refresh token', async () => {
      const initial = await login();
      const results = await Promise.all([refresh(cookie(initial)), refresh(cookie(initial))]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
      const winner = results.find((result) => result.status === 200)!;
      expect((await me(token(winner))).status).toBe(401);
      expect((await refresh(cookie(winner))).status).toBe(401);
      expect(
        await database.prisma.platformAuthSession.count({
          where: { revokedReason: 'REFRESH_REUSE' },
        }),
      ).toBe(1);
    });
    it('does not resurrect a session during concurrent logout and refresh', async () => {
      const initial = await login();
      const [rotated, loggedOut] = await Promise.all([
        refresh(cookie(initial)),
        request(app)
          .post(base + '/logout')
          .set('X-CSRF-Protection', '1')
          .auth(token(initial), { type: 'bearer' }),
      ]);
      expect(loggedOut.status).toBe(200);
      expect([200, 401]).toContain(rotated.status);
      expect((await me(token(initial))).status).toBe(401);
      if (rotated.status === 200) expect((await me(token(rotated))).status).toBe(401);
      expect(await database.prisma.platformAuthSession.count({ where: { revokedAt: null } })).toBe(
        0,
      );
    });
    it('atomically changes the password and revokes sessions racing a refresh', async () => {
      const initial = await login();
      const second = await login();
      const [rotated, changed] = await Promise.all([
        refresh(cookie(second)),
        change(token(initial)),
      ]);
      expect(changed.status).toBe(200);
      expect([200, 401]).toContain(rotated.status);
      expect((await me(token(initial))).status).toBe(401);
      if (rotated.status === 200) expect((await me(token(rotated))).status).toBe(401);
      expect(
        await verifyPassword((await repository.findAdminById(ownerId))!.passwordHash, replacement),
      ).toBe(true);
      expect((await login()).status).toBe(401);
      expect((await login(replacement)).status).toBe(200);
    });
    it('prevents stale credentials from opening a session after a concurrent password change', async () => {
      const initial = await login();
      const [attempt, changed] = await Promise.all([login(), change(token(initial))]);
      expect(changed.status).toBe(200);
      expect([200, 401]).toContain(attempt.status);
      if (attempt.status === 200) expect((await me(token(attempt))).status).toBe(401);
      expect(await database.prisma.platformAuthSession.count({ where: { revokedAt: null } })).toBe(
        0,
      );
      const fresh = newRefreshToken();
      expect(
        await repository.createSession({
          id: randomUUID(),
          platformAdminId: ownerId,
          expectedPasswordHash: originalHash,
          expiresAt: new Date(Date.now() + 86400000),
          tokenHash: fresh.hash,
        }),
      ).toBe(false);
    });
    it('rechecks active accounts on every authenticated request and refresh', async () => {
      const initial = await login();
      await database.prisma.platformAdmin.update({
        where: { id: ownerId },
        data: { isActive: false },
      });
      expect((await me(token(initial))).status).toBe(401);
      expect((await refresh(cookie(initial))).status).toBe(401);
      expect((await login()).status).toBe(401);
    });
    it('keeps a password-change compare-and-set failure from revoking valid sessions', async () => {
      const initial = await login();
      expect(
        await repository.changePassword(ownerId, 'stale-hash', 'unused-hash', new Date()),
      ).toBe(false);
      expect((await repository.findAdminById(ownerId))!.passwordHash).toBe(originalHash);
      expect((await me(token(initial))).status).toBe(200);
    });
  },
);
