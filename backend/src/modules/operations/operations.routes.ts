import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { emptyQuery, idParams } from '../../shared/validation/room-input.js';
import type { RoleCode } from '../../shared/types/roles.js';
import { emptyBody } from './operations.shared.js';
export function operationsRouter(auth: AuthService, env: Env) {
  const router = Router();
  router.use(authenticate(auth), (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const add = (
    method: 'get' | 'post' | 'patch',
    path: string,
    roles: readonly RoleCode[],
    controller: RequestHandler,
    options: { body?: z.ZodType; query?: z.ZodType } = {},
  ) => {
    router[method](
      path,
      authorizeRoles(...roles),
      ...(method === 'get' ? [] : [csrfProtection(env)]),
      validate(
        z.object({
          params: path.includes(':id') ? idParams : emptyQuery,
          query: options.query ?? emptyQuery,
          ...(method === 'get' ? {} : { body: options.body ?? emptyBody }),
        }),
      ),
      controller,
    );
  };
  return { router, add };
}
