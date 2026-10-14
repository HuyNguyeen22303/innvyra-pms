import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { reservationController } from './reservation.controller.js';
import type { ReservationService } from './reservation.service.js';
import { reservationPermissions } from './reservation.types.js';
import {
  availabilitySchema,
  cancelReservationSchema,
  createReservationSchema,
  listReservationsSchema,
  reservationIdSchema,
} from './reservation.schema.js';

export function reservationRoutes(service: ReservationService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = reservationController(service);
  router.use(
    ['/reservations', '/rooms/availability'],
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    authenticate(auth),
  );
  router.get(
    '/rooms/availability',
    authorizeRoles(...reservationPermissions.availability),
    validate(availabilitySchema),
    controller.availability,
  );
  router.get(
    '/reservations',
    authorizeRoles(...reservationPermissions.read),
    validate(listReservationsSchema),
    controller.list,
  );
  router.get(
    '/reservations/:id',
    authorizeRoles(...reservationPermissions.read),
    validate(reservationIdSchema),
    controller.detail,
  );
  router.post(
    '/reservations',
    authorizeRoles(...reservationPermissions.write),
    csrfProtection(env),
    validate(createReservationSchema),
    controller.create,
  );
  router.post(
    '/reservations/:id/cancel',
    authorizeRoles(...reservationPermissions.write),
    csrfProtection(env),
    validate(cancelReservationSchema),
    controller.cancel,
  );
  return router;
}
