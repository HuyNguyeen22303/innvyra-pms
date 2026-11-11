import request, { type Response } from 'supertest';
import { decodeJwt } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';
import type { CurrentPlatformAdmin } from '../src/modules/platform-auth/platform-auth.types.js';
import { hashPassword, verifyPassword } from '../src/shared/utils/password.js';
import { hashRefreshToken } from '../src/shared/utils/tokens.js';
import { MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';
import { memoryGuests } from './guest-helpers.js';
import { memoryReservations } from './reservation-helpers.js';
import { MemoryPlatformAuthRepository } from './platform-helpers.js';

const root = '/api/v1/platform/auth';
const newPassword = 'A different platform passphrase 2026!';
const payload = (response: Response) =>
  response.body as {
    data: { accessToken: string; user: CurrentPlatformAdmin; expiresIn: number };
  };
const cookie = (response: Response) => {
  const result = (response.headers['set-cookie'] as unknown as string[])?.[0]?.split(';')[0];
  if (!result) throw new Error('Missing platform cookie');
  return result;
};

describe('Innvyra platform auth HTTP: separate identity, cookie and token audience', () => {
  let hash: string;
  let repository: MemoryPlatformAuthRepository;
  let staff: MemoryAuthRepository;
  let app: ReturnType<typeof createApp>;
  const build = (env: Env = testEnv) =>
    createApp(
      env,
      staff,
      memoryRooms().repositories,
      memoryGuests().repository,
      memoryReservations().repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      repository,
    );
  beforeAll(async () => {
    hash = await hashPassword(testPassword);
  });
  beforeEach(() => {
    repository = new MemoryPlatformAuthRepository(hash);
    staff = new MemoryAuthRepository(hash);
    app = build();
  });
  const login = (email = 'owner@example.test', password = testPassword) =>
    request(app)
      .post(root + '/login')
      .set('X-CSRF-Protection', '1')
      .send({ email, password });
  const staffLogin = () =>
    request(app)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({ username: 'admin', password: testPassword });
  const me = (token: string) =>
    request(app)
      .get(root + '/me')
      .auth(token, { type: 'bearer' });
  const refresh = (value: string) =>
    request(app)
      .post(root + '/refresh')
      .set('X-CSRF-Protection', '1')
      .set('Cookie', value);
  const logout = (token: string) =>
    request(app)
      .post(root + '/logout')
      .set('X-CSRF-Protection', '1')
      .auth(token, { type: 'bearer' });
  const change = (token: string, currentPassword = testPassword, nextPassword = newPassword) =>
    request(app)
      .post(root + '/change-password')
      .set('X-CSRF-Protection', '1')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword, newPassword: nextPassword });

  it('returns a platform profile without hotel privileges, only a hashed refresh token is stored', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(payload(res).data.user).toEqual({
      id: '1',
      fullName: 'Innvyra Owner',
      email: 'owner@example.test',
      role: 'PLATFORM_ADMIN',
      isActive: true,
    });
    expect(res.text).not.toMatch(/hotelId|passwordHash|refreshToken|tokenHash/);
    expect(res.headers['cache-control']).toBe('no-store');
    const header = String(res.headers['set-cookie']);
    expect(header).toContain('innvyra_platform_refresh=');
    expect(header).toContain('Path=/api/v1/platform/auth');
    expect(header).toContain('HttpOnly');
    expect(header).not.toContain('innvyra_refresh=');
    const raw = cookie(res).split('=')[1]!;
    expect(repository.tokens.has(raw)).toBe(false);
    expect(repository.tokens.has(hashRefreshToken(raw))).toBe(true);
    const claims = decodeJwt(payload(res).data.accessToken);
    expect(claims.aud).toBe(`${testEnv.JWT_AUDIENCE}:platform`);
    expect(claims).not.toHaveProperty('role');
    expect(claims).not.toHaveProperty('email');
    expect(
      [...repository.sessions.values()][0]!.expiresAt.getTime() - Date.now(),
    ).toBeLessThanOrEqual(86400000);
  });

  it('normalizes email while retaining password whitespace', async () => {
    expect((await login(' OWNER@EXAMPLE.TEST ')).status).toBe(200);
    expect((await login('owner@example.test', ` ${testPassword} `)).status).toBe(401);
  });
  it('returns the same error for absent, inactive and incorrect-password accounts', async () => {
    const wrong = await login('owner@example.test', 'wrong');
    const missing = await login('missing@example.test');
    repository.admins.get('owner@example.test')!.isActive = false;
    const inactive = await login();
    expect([wrong.status, missing.status, inactive.status]).toEqual([401, 401, 401]);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.body).toEqual(inactive.body);
    expect(repository.sessions.size).toBe(0);
  });
  it.each([
    {},
    { email: 'invalid', password: testPassword },
    { email: 'owner@example.test', password: testPassword, role: 'PLATFORM_ADMIN' },
    { email: 'owner@example.test', password: testPassword, hotelId: '1' },
  ])('rejects invalid or client-supplied privilege input %#', async (body) => {
    const res = await request(app)
      .post(root + '/login')
      .set('X-CSRF-Protection', '1')
      .send(body);
    expect(res.status).toBe(422);
    expect(res.text).not.toContain(testPassword);
  });
  it('rejects tokens in both directions and does not fall through to hotel permissions', async () => {
    const platform = payload(await login()).data.accessToken;
    const hotel = payload(await staffLogin()).data.accessToken;
    expect((await me(hotel)).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').auth(platform, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/v1/rooms').auth(platform, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/v1/platform/hotels').auth(hotel, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/v1/platform/hotels').auth(platform, { type: 'bearer' })).status,
    ).toBe(404);
  });
  it('uses only its own refresh cookie and cannot refresh a hotel session', async () => {
    const platform = await login();
    const hotel = await staffLogin();
    expect((await refresh(cookie(hotel))).status).toBe(401);
    expect(
      (await refresh(cookie(hotel).replace('innvyra_refresh=', 'innvyra_platform_refresh=')))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .set('X-CSRF-Protection', '1')
          .set('Cookie', cookie(platform))
      ).status,
    ).toBe(401);
    expect((await refresh(cookie(platform))).status).toBe(200);
  });
  it('rotates, then commits family revocation on replay', async () => {
    const initial = await login();
    const rotated = await refresh(cookie(initial));
    expect(rotated.status).toBe(200);
    expect(cookie(rotated)).not.toBe(cookie(initial));
    expect((await refresh(cookie(initial))).status).toBe(401);
    expect((await refresh(cookie(rotated))).status).toBe(401);
    expect((await me(payload(initial).data.accessToken)).status).toBe(401);
    expect((await me(payload(rotated).data.accessToken)).status).toBe(401);
  });
  it('rejects expired sessions and deactivated identities immediately', async () => {
    const initial = await login();
    repository.admins.get('owner@example.test')!.isActive = false;
    expect((await me(payload(initial).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(initial))).status).toBe(401);
    repository.admins.get('owner@example.test')!.isActive = true;
    [...repository.sessions.values()][0]!.expiresAt = new Date(0);
    expect((await me(payload(initial).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(initial))).status).toBe(401);
  });
  it('clears only the platform cookie and preserves other platform and hotel sessions on logout', async () => {
    const first = await login();
    const second = await login();
    const hotel = await staffLogin();
    const res = await logout(payload(first).data.accessToken);
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toContain('innvyra_platform_refresh=;');
    expect(String(res.headers['set-cookie'])).not.toContain('innvyra_refresh=');
    expect((await me(payload(first).data.accessToken)).status).toBe(401);
    expect((await me(payload(second).data.accessToken)).status).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(payload(hotel).data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(200);
  });
  it('does not change or revoke anything for an incorrect current password', async () => {
    const first = await login();
    const token = payload(first).data.accessToken;
    expect((await change(token, 'incorrect')).status).toBe(400);
    expect((await me(token)).status).toBe(200);
    expect(repository.admins.get('owner@example.test')!.passwordHash).toBe(hash);
  });
  it.each(['short', testPassword, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa'])(
    'rejects weak or unchanged replacement password %#',
    async (password) => {
      expect(
        (await change(payload(await login()).data.accessToken, testPassword, password)).status,
      ).toBe(422);
      expect(repository.admins.get('owner@example.test')!.passwordHash).toBe(hash);
    },
  );
  it('changes password, invalidates every platform session and keeps hotel access intact', async () => {
    const first = await login();
    const second = await login();
    const hotel = await staffLogin();
    const res = await change(payload(first).data.accessToken);
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toContain('innvyra_platform_refresh=;');
    for (const item of [first, second]) {
      expect((await me(payload(item).data.accessToken)).status).toBe(401);
      expect((await refresh(cookie(item))).status).toBe(401);
    }
    expect(
      await verifyPassword(repository.admins.get('owner@example.test')!.passwordHash, newPassword),
    ).toBe(true);
    expect((await login()).status).toBe(401);
    expect((await login('owner@example.test', newPassword)).status).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(payload(hotel).data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(200);
  });
  it('requires CSRF and trusted origins for every write endpoint', async () => {
    const token = payload(await login()).data.accessToken;
    for (const path of ['/login', '/refresh', '/logout', '/change-password']) {
      expect(
        (
          await request(app)
            .post(root + path)
            .auth(token, { type: 'bearer' })
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(root + path)
            .set('X-CSRF-Protection', '1')
            .set('Origin', 'https://attacker.example')
            .auth(token, { type: 'bearer' })
            .send({})
        ).status,
      ).toBe(403);
    }
  });
  it('has independent platform and staff login limits', async () => {
    app = build({ ...testEnv, LOGIN_RATE_LIMIT_MAX: 1 });
    expect((await login('unknown@example.test')).status).toBe(401);
    expect((await login()).status).toBe(429);
    expect((await staffLogin()).status).toBe(200);
  });
  it('uses configured secure cross-site cookies', async () => {
    app = build({ ...testEnv, COOKIE_SECURE: true, COOKIE_SAME_SITE: 'none' });
    const res = await login();
    expect(String(res.headers['set-cookie'])).toContain('Secure');
    expect(String(res.headers['set-cookie'])).toContain('SameSite=None');
  });
  it('documents five platform endpoints, a distinct security scheme and no hotel role widening', async () => {
    const spec = (await request(app).get('/api-docs/openapi.json')).body;
    expect(
      Object.keys(spec.paths).filter((path) => path.startsWith('/platform/auth/')),
    ).toHaveLength(5);
    expect(spec.paths['/platform/auth/me'].get.security).toEqual([{ platformBearerAuth: [] }]);
    expect(spec.components.schemas.CurrentUser.properties.role.enum).not.toContain(
      'PLATFORM_ADMIN',
    );
    expect((await request(app).post(root + '/register')).status).toBe(401);
  });
});
