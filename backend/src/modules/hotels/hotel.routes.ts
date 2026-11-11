import { Router } from 'express';
import type { Env } from '../../config/env.js';
import {
  authenticatePlatform,
  requirePlatformPrincipal,
} from '../../middlewares/platform-authenticate.middleware.js';
import { authenticate, requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLE_CODES } from '../../shared/types/roles.js';
import * as schemas from './hotel.schema.js';
import type { HotelManagementService } from './hotel.service.js';
import type { PlatformAuthService } from '../platform-auth/platform-auth.service.js';
import type { AuthService } from '../auth/auth.service.js';

export function platformHotelRoutes(
  service: HotelManagementService,
  auth: PlatformAuthService,
  env: Env,
) {
  const router = Router();
  const csrf = csrfProtection(env);
  router.use(authenticatePlatform(auth));
  const actor = (req: Parameters<typeof requirePlatformPrincipal>[0]) =>
    BigInt(requirePlatformPrincipal(req).user.id);
  router.get('/', validate(schemas.listHotelSchema), async (_req, res) => {
    const { query } = res.locals.validated as { query: schemas.HotelListQuery };
    res.json({ success: true, data: await service.list(query) });
  });
  router.post('/', csrf, validate(schemas.createHotelSchema), async (req, res) => {
    const { body } = res.locals.validated as { body: schemas.CreateHotelInput };
    res.status(201).json({ success: true, data: await service.create(actor(req), body) });
  });
  router.get('/:id', validate(schemas.getHotelSchema), async (req, res) => {
    res.json({ success: true, data: await service.detail(BigInt(req.params.id as string)) });
  });
  router.patch('/:id', csrf, validate(schemas.updateHotelSchema), async (req, res) => {
    const { body } = res.locals.validated as { body: schemas.UpdateHotelInput };
    res.json({
      success: true,
      data: await service.update(actor(req), BigInt(req.params.id as string), body),
    });
  });
  router.post('/:id/admins', csrf, validate(schemas.createHotelAdminSchema), async (req, res) => {
    const { body } = res.locals.validated as { body: schemas.CreateHotelAdminInput };
    res
      .status(201)
      .json({
        success: true,
        data: await service.addAdmin(actor(req), BigInt(req.params.id as string), body),
      });
  });
  router.post(
    '/:id/admins/:staffId/reset-password',
    csrf,
    validate(schemas.resetHotelAdminSchema),
    async (req, res) => {
      const { body } = res.locals.validated as { body: { reason: string } };
      res.json({
        success: true,
        data: await service.resetAdmin(
          actor(req),
          BigInt(req.params.id as string),
          BigInt(req.params.staffId as string),
          body.reason,
        ),
      });
    },
  );
  return router;
}
export function ownHotelRoutes(service: HotelManagementService, auth: AuthService, env: Env) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate(auth));
  router.get(
    '/',
    authorizeRoles(...ROLE_CODES),
    validate(schemas.ownHotelSchema),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.ownProfile(BigInt(requirePrincipal(req).user.hotelId)),
      });
    },
  );
  router.patch(
    '/',
    authorizeRoles('ADMIN'),
    csrfProtection(env),
    validate(schemas.updateOwnHotelSchema),
    async (req, res) => {
      const { body } = res.locals.validated as { body: schemas.UpdateHotelInput };
      res.json({
        success: true,
        data: await service.updateOwn(BigInt(requirePrincipal(req).user.hotelId), body),
      });
    },
  );
  return router;
}
