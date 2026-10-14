import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { GuestService } from './guest.service.js';
import { guestController } from './guest.controller.js';
import { guestPermissions } from './guest.types.js';
import {
  createGuestSchema,
  updateGuestSchema,
  guestIdSchema,
  listGuestsSchema,
} from './guest.schema.js';

export function guestRoutes(service: GuestService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = guestController(service);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate(auth));
  router.get(
    '/',
    authorizeRoles(...guestPermissions.read),
    validate(listGuestsSchema),
    controller.getGuests,
  );
  router.get(
    '/:id',
    authorizeRoles(...guestPermissions.read),
    validate(guestIdSchema),
    controller.getGuestById,
  );
  router.post(
    '/',
    authorizeRoles(...guestPermissions.write),
    csrfProtection(env),
    validate(createGuestSchema),
    controller.createGuest,
  );
  router.patch(
    '/:id',
    authorizeRoles(...guestPermissions.write),
    csrfProtection(env),
    validate(updateGuestSchema),
    controller.updateGuest,
  );
  router.delete(
    '/:id',
    authorizeRoles(...guestPermissions.delete),
    csrfProtection(env),
    validate(guestIdSchema),
    controller.deleteGuest,
  );
  return router;
}
