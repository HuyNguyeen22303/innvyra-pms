import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { loginRateLimit, refreshRateLimit } from '../../middlewares/rate-limit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLE_CODES } from '../../shared/types/roles.js';
import { authController } from './auth.controller.js';
import { loginSchema } from './auth.schema.js';
import type { AuthService } from './auth.service.js';

export function authRoutes(service: AuthService, env: Env) {
  const router = Router();
  const controller = authController(service, env);
  const csrf = csrfProtection(env);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.post('/login', loginRateLimit(env), csrf, validate(loginSchema), controller.login);
  router.post('/refresh', refreshRateLimit(env), csrf, controller.refresh);
  // Everything below this boundary requires a current, active server-side session.
  router.use(authenticate(service));
  router.post('/logout', csrf, authorizeRoles(...ROLE_CODES), controller.logout);
  router.get('/me', authorizeRoles(...ROLE_CODES), controller.me);
  router.get('/admin-check', authorizeRoles('ADMIN'), controller.adminCheck);
  return router;
}
