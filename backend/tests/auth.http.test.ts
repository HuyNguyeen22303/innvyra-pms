import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decodeJwt, SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { getDummyPasswordHash, hashPassword } from '../src/shared/utils/password.js';
import { hashRefreshToken } from '../src/shared/utils/tokens.js';
import { body, cookie, MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';

describe('Auth HTTP integration (in-memory repository, real Argon2/JWT/middleware)', () => {
  let passwordHash: string;
  let repository: MemoryAuthRepository;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    passwordHash = await hashPassword(testPassword);
    await getDummyPasswordHash();
  });
  beforeEach(() => {
    repository = new MemoryAuthRepository(passwordHash);
    app = createApp(testEnv, repository, memoryRooms().repositories);
  });
  const login = (username = 'admin', password = testPassword) =>
    request(app)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({ username, password });
  const me = (token: string) => request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' });
  const refresh = (value: string) =>
    request(app).post('/api/v1/auth/refresh').set('X-CSRF-Protection', '1').set('Cookie', value);
  const adminCheck = (token: string) =>
    request(app).get('/api/v1/auth/admin-check').auth(token, { type: 'bearer' });

  it('logs in with Argon2id and returns safe string IDs plus an HttpOnly cookie', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(body(res).data.user).toMatchObject({
      id: '9007199254740993',
      hotelId: '9007199254740995',
      role: 'ADMIN',
      email: null,
    });
    expect(res.text).not.toMatch(/password|refreshToken|tokenHash/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/SameSite=Lax/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/Path=\/api\/v1\/auth/);
    const raw = cookie(res).split('=')[1]!;
    expect(repository.tokens.has(raw)).toBe(false);
    expect(repository.tokens.has(hashRefreshToken(raw))).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
    const claims = decodeJwt(body(res).data.accessToken);
    expect(claims).not.toHaveProperty('role');
    expect(claims).not.toHaveProperty('email');
    expect(claims.exp! - claims.iat!).toBe(900);
  });

  it('returns identical errors for a wrong password, unknown username and inactive account', async () => {
    const wrong = await login('admin', 'wrong');
    const absent = await login('missing');
    repository.users.get('admin')!.isActive = false;
    const disabled = await login();
    expect([wrong.status, absent.status, disabled.status]).toEqual([401, 401, 401]);
    expect(wrong.body).toEqual(absent.body);
    expect(disabled.body).toEqual(wrong.body);
    expect(repository.sessions.size).toBe(0);
  });

  it('validates request and rejects client-supplied role / hotelId', async () => {
    for (const payload of [
      {},
      { username: 'admin', password: 5 },
      { username: 'admin', password: testPassword, role: 'ADMIN', hotelId: '42' },
    ]) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-CSRF-Protection', '1')
        .send(payload);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(res.text).not.toContain(testPassword);
    }
  });

  it('normalizes username, preserving password whitespace', async () => {
    expect((await login(' ADMIN ')).status).toBe(200);
    expect((await login('admin', ` ${testPassword} `)).status).toBe(401);
  });
  it('accepts a valid access token and returns the current user', async () => {
    const res = await me(body(await login()).data.accessToken);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { username: 'admin', role: 'ADMIN' } });
    expect(res.text).not.toMatch(/password|tokenHash|refreshToken/);
  });
  it('rejects missing and malformed access tokens', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await me('not.a.jwt')).status).toBe(401);
  });
  it('rejects a tampered signature', async () => {
    const token = body(await login()).data.accessToken;
    const segments = token.split('.');
    segments[2] = `${segments[2]![0] === 'a' ? 'b' : 'a'}${segments[2]!.slice(1)}`;
    expect((await me(segments.join('.'))).status).toBe(401);
  });
  it.each(['expired', 'issuer', 'audience', 'algorithm', 'subject', 'missing-exp', 'future-iat'])(
    'rejects JWT with invalid %s',
    async (kind) => {
      const claims = decodeJwt(body(await login()).data.accessToken);
      const now = Math.floor(Date.now() / 1000);
      if (kind === 'missing-exp') delete claims.exp;
      const signed = await new SignJWT({
        ...claims,
        ...(kind === 'expired' ? { exp: now - 10 } : {}),
        ...(kind === 'issuer' ? { iss: 'wrong' } : {}),
        ...(kind === 'audience' ? { aud: 'wrong' } : {}),
        ...(kind === 'subject' ? { sub: '2' } : {}),
        ...(kind === 'future-iat' ? { iat: now + 300 } : {}),
      })
        .setProtectedHeader({ alg: kind === 'algorithm' ? 'HS384' : 'HS256', typ: 'JWT' })
        .sign(new TextEncoder().encode(testEnv.JWT_ACCESS_SECRET));
      expect((await me(signed)).status).toBe(401);
    },
  );
  it('rotates refresh tokens and preserves the absolute expiry', async () => {
    const initial = await login();
    const expiry = [...repository.sessions.values()][0]!.expiresAt;
    const result = await refresh(cookie(initial));
    expect(result.status).toBe(200);
    expect(cookie(result)).not.toBe(cookie(initial));
    expect((await me(body(result).data.accessToken)).status).toBe(200);
    expect([...repository.tokens.values()].every((token) => token.expiresAt === expiry)).toBe(true);
    expect([...repository.tokens.values()].filter((token) => token.usedAt).length).toBe(1);
  });
  it('rejects missing and malformed refresh cookies', async () => {
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('X-CSRF-Protection', '1')).status,
    ).toBe(401);
    expect((await refresh('innvyra_refresh=invalid')).status).toBe(401);
  });
  it('rejects an expired refresh token', async () => {
    const initial = await login();
    [...repository.tokens.values()][0]!.expiresAt = new Date(0);
    expect((await refresh(cookie(initial))).status).toBe(401);
  });
  it('rejects an expired session for access and refresh', async () => {
    const initial = await login();
    [...repository.sessions.values()][0]!.expiresAt = new Date(0);
    expect((await me(body(initial).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(initial))).status).toBe(401);
  });
  it('detects refresh reuse, revokes the entire family and clears the cookie', async () => {
    const initial = await login();
    const next = await refresh(cookie(initial));
    const reused = await refresh(cookie(initial));
    expect(reused.status).toBe(401);
    expect(reused.headers['set-cookie']?.[0]).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await me(body(initial).data.accessToken)).status).toBe(401);
    expect((await me(body(next).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(next))).status).toBe(401);
  });
  it('logs out and rejects every token in that session', async () => {
    const initial = await login();
    const token = body(initial).data.accessToken;
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await me(token)).status).toBe(401);
    expect((await refresh(cookie(initial))).status).toBe(401);
  });
  it('keeps other sessions active on logout', async () => {
    const first = await login();
    const second = await login();
    await request(app)
      .post('/api/v1/auth/logout')
      .auth(body(first).data.accessToken, { type: 'bearer' })
      .set('X-CSRF-Protection', '1');
    expect((await me(body(second).data.accessToken)).status).toBe(200);
  });
  it('allows ADMIN and denies RECEPTIONIST', async () => {
    expect((await adminCheck(body(await login()).data.accessToken)).status).toBe(200);
    expect((await adminCheck(body(await login('receptionist')).data.accessToken)).status).toBe(403);
  });
  it('applies role and hotel changes on the next request', async () => {
    const token = body(await login()).data.accessToken;
    repository.users.get('admin')!.role.code = 'RECEPTIONIST';
    repository.users.get('admin')!.hotelId = 3n;
    expect((await adminCheck(token)).status).toBe(403);
    expect((await me(token)).body).toMatchObject({ data: { hotelId: '3', role: 'RECEPTIONIST' } });
    repository.users.get('admin')!.role.code = 'UNRECOGNIZED';
    expect((await me(token)).status).toBe(403);
  });
  it('rejects access and refresh immediately after account deactivation', async () => {
    const initial = await login();
    repository.users.get('admin')!.isActive = false;
    expect((await me(body(initial).data.accessToken)).status).toBe(401);
    expect((await refresh(cookie(initial))).status).toBe(401);
  });
  it('requires CSRF headers on login, refresh and logout', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ username: 'admin', password: testPassword })
      ).status,
    ).toBe(403);
    const initial = await login();
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie(initial))).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/logout')
          .auth(body(initial).data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(403);
  });
  it('allows exact trusted Origin and rejects hostile/null origins', async () => {
    const allowed = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', testEnv.FRONTEND_URL)
      .set('X-CSRF-Protection', '1')
      .send({ username: 'admin', password: testPassword });
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(testEnv.FRONTEND_URL);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    for (const origin of ['https://attacker.example', 'null']) {
      expect(
        (
          await request(app)
            .post('/api/v1/auth/refresh')
            .set('Origin', origin)
            .set('X-CSRF-Protection', '1')
            .set('Cookie', cookie(allowed))
        ).status,
      ).toBe(403);
    }
  });
  it('rate limits login with a consistent 429 response', async () => {
    app = createApp(
      { ...testEnv, LOGIN_RATE_LIMIT_MAX: 1 },
      repository,
      memoryRooms().repositories,
    );
    expect((await login('missing')).status).toBe(401);
    const limited = await login();
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
  it('sets secure cross-site cookies when configured', async () => {
    app = createApp(
      { ...testEnv, COOKIE_SECURE: true, COOKIE_SAME_SITE: 'none' },
      repository,
      memoryRooms().repositories,
    );
    const res = await login();
    expect(res.headers['set-cookie']?.[0]).toMatch(/Secure/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/SameSite=None/);
  });
  it('returns a consistent 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });
  it('serves Swagger and all five documented operations', async () => {
    expect((await request(app).get('/api-docs/')).status).toBe(200);
    const spec = await request(app).get('/api-docs/openapi.json');
    expect(spec.status).toBe(200);
    const document = spec.body as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths).filter((path) => path.startsWith('/auth/'))).toHaveLength(5);
  });
  it('does not expose registration or unrelated modules', async () => {
    expect((await request(app).post('/api/v1/auth/register')).status).toBe(401);
    expect((await request(app).get('/api/v1/reservations')).status).toBe(404);
  });
});
