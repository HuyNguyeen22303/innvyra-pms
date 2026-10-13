import { Router } from 'express';
import type { Env } from '../config/env.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import type { AuthService } from '../modules/auth/auth.service.js';

export function apiRoutes(service: AuthService, env: Env) {
  const router = Router();
  router.use('/auth', authRoutes(service, env));
  return router;
}
