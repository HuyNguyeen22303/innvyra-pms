import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { StayService } from './stay.service.js';
import { stayController } from './stay.controller.js';
import { stayPermissions } from './stay.types.js';
import {
  checkinSchema,
  checkoutSchema,
  transferSchema,
  stayIdSchema,
  listStaysSchema,
} from './stay.schema.js';

export function stayRoutes(service: StayService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = stayController(service);
  const secured = [authenticate(auth)] as const;
  router.use(
    ['/stays', '/reservations/:reservationId/rooms/:reservationRoomId/check-in'],
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  router.get(
    '/stays',
    ...secured,
    authorizeRoles(...stayPermissions.read),
    validate(listStaysSchema),
    controller.list,
  );
  router.get(
    '/stays/:id',
    ...secured,
    authorizeRoles(...stayPermissions.read),
    validate(stayIdSchema),
    controller.detail,
  );
  router.post(
    '/reservations/:reservationId/rooms/:reservationRoomId/check-in',
    ...secured,
    authorizeRoles(...stayPermissions.write),
    csrfProtection(env),
    validate(checkinSchema),
    controller.checkin,
  );
  router.post(
    '/stays/:id/check-out',
    ...secured,
    authorizeRoles(...stayPermissions.write),
    csrfProtection(env),
    validate(checkoutSchema),
    controller.checkout,
  );
  router.post(
    '/stays/:id/transfers',
    ...secured,
    authorizeRoles(...stayPermissions.write),
    csrfProtection(env),
    validate(transferSchema),
    controller.transfer,
  );
  return router;
}
