import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { parseEnv } from '../src/config/env.js';
import { authorizeRoles } from '../src/middlewares/authorize.middleware.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { testEnv } from './helpers.js';
import { validate } from '../src/middlewares/validate.middleware.js';
import { z } from 'zod';

const base = { DATABASE_URL: testEnv.DATABASE_URL, JWT_ACCESS_SECRET: testEnv.JWT_ACCESS_SECRET };
describe('Configuration and authorization defaults', () => {
  it('requires real environment credentials without leaking values', () => {
    expect(() => parseEnv({})).toThrow('Invalid environment');
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'secret' })).toThrow();
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'x'.repeat(64) })).toThrow();
    expect(() =>
      parseEnv({ ...base, DATABASE_URL: 'mysql://secret:secret@localhost/db?unknown=yes' }),
    ).toThrow();
  });
  it('enforces production HTTPS and secure cross-site cookies', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(
      parseEnv({ ...base, NODE_ENV: 'production', FRONTEND_URL: 'https://pms.example.com' })
        .COOKIE_SECURE,
    ).toBe(true);
    expect(() => parseEnv({ ...base, COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' })).toThrow();
    expect(() => parseEnv({ ...base, CORS_ORIGINS: '*' })).toThrow();
  });
  it('limits access token lifetime', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_EXPIRES_IN: '2h' })).toThrow();
    expect(parseEnv({ ...base, JWT_ACCESS_EXPIRES_IN: '30m' }).accessTokenTtlSeconds).toBe(1800);
  });
  it('denies roles by default when the allowlist is empty', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.principal = {
        sessionId: 'test',
        user: {
          id: '1',
          hotelId: '1',
          fullName: 'Test',
          username: 'test',
          email: null,
          role: 'ADMIN',
          isActive: true,
        },
      };
      next();
    });
    app.get('/', authorizeRoles(), (_req, res) => {
      res.json({ success: true });
    });
    app.use(errorHandler);
    expect((await request(app).get('/')).status).toBe(403);
  });
  it('validates params and query without writing to Express 5 req.query', async () => {
    const app = express();
    app.get(
      '/:id',
      validate(
        z.object({
          params: z.object({ id: z.string().regex(/^\d+$/) }),
          query: z.object({ page: z.coerce.number().int().positive() }),
        }),
      ),
      (_req, res) => {
        res.json(res.locals.validated);
      },
    );
    app.use(errorHandler);
    expect((await request(app).get('/1?page=2')).body).toMatchObject({
      params: { id: '1' },
      query: { page: 2 },
    });
    expect((await request(app).get('/bad?page=0')).status).toBe(422);
  });
  it('requires a strong bootstrap password and valid bigint hotel id', () => {
    const input = { username: 'admin', fullName: 'Admin', hotelId: '1', password: 'short' };
    expect(adminInputSchema.safeParse(input).success).toBe(false);
    expect(
      adminInputSchema.safeParse({ ...input, password: 'A long and varied admin passphrase!' })
        .success,
    ).toBe(true);
    expect(adminInputSchema.safeParse({ ...input, hotelId: '18446744073709551616' }).success).toBe(
      false,
    );
  });
});
