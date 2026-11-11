import { Router } from 'express';
import type { Env } from '../../config/env.js';
import {
  authenticatePlatform,
  requirePlatformPrincipal,
} from '../../middlewares/platform-authenticate.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { loginRateLimit, refreshRateLimit } from '../../middlewares/rate-limit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { notFound } from '../../middlewares/error.middleware.js';
import { AppError } from '../../shared/errors/app-error.js';
import { refreshCookieOptions } from '../../shared/utils/cookies.js';
import {
  platformLoginSchema,
  platformPasswordSchema,
  type PlatformLoginInput,
  type PlatformPasswordInput,
} from './platform-auth.schema.js';
import type { PlatformAuthService } from './platform-auth.service.js';

export const PLATFORM_REFRESH_COOKIE = 'innvyra_platform_refresh';
export function platformCookieOptions(env: Env) {
  return { ...refreshCookieOptions(env), path: '/api/v1/platform/auth' };
}
export function platformRoutes(service: PlatformAuthService, env: Env, hotels?: Router) {
  const router = Router();
  const auth = Router();
  const csrf = csrfProtection(env);
  const authenticate = authenticatePlatform(service);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  auth.post(
    '/login',
    loginRateLimit(env),
    csrf,
    validate(platformLoginSchema),
    async (_req, res) => {
      const { body } = res.locals.validated as { body: PlatformLoginInput };
      const result = await service.login(body);
      res.cookie(PLATFORM_REFRESH_COOKIE, result.refreshToken, {
        ...platformCookieOptions(env),
        expires: result.expiresAt,
      });
      res.json({ success: true, message: 'Platform login successful', data: result.data });
    },
  );
  auth.post('/refresh', refreshRateLimit(env), csrf, async (req, res) => {
    try {
      const cookies = req.cookies as Record<string, unknown> | undefined;
      const result = await service.refresh(cookies?.[PLATFORM_REFRESH_COOKIE]);
      res.cookie(PLATFORM_REFRESH_COOKIE, result.refreshToken, {
        ...platformCookieOptions(env),
        expires: result.expiresAt,
      });
      res.json({ success: true, message: 'Platform token refreshed', data: result.data });
    } catch (error) {
      if (error instanceof AppError && [401, 403].includes(error.status))
        res.clearCookie(PLATFORM_REFRESH_COOKIE, platformCookieOptions(env));
      throw error;
    }
  });
  auth.use(authenticate);
  auth.get('/me', (req, res) => {
    res.json({ success: true, data: requirePlatformPrincipal(req).user });
  });
  auth.post('/logout', csrf, async (req, res) => {
    await service.logout(requirePlatformPrincipal(req));
    res.clearCookie(PLATFORM_REFRESH_COOKIE, platformCookieOptions(env));
    res.json({ success: true, message: 'Platform logout successful', data: {} });
  });
  auth.post(
    '/change-password',
    csrf,
    loginRateLimit(env),
    validate(platformPasswordSchema),
    async (req, res) => {
      const { body } = res.locals.validated as { body: PlatformPasswordInput };
      await service.changePassword(requirePlatformPrincipal(req), body);
      res.clearCookie(PLATFORM_REFRESH_COOKIE, platformCookieOptions(env));
      res.json({ success: true, message: 'Password changed; sign in again', data: {} });
    },
  );
  router.use('/auth', auth);
  if (hotels) router.use('/hotels', hotels);
  router.use(authenticate, notFound);
  return router;
}
