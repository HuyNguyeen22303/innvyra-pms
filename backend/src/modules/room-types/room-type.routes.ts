import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLE_CODES } from '../../shared/types/roles.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RoomTypeService } from './room-type.service.js';
import { roomTypeController } from './room-type.controller.js';
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  roomTypeIdSchema,
  listRoomTypesSchema,
} from './room-type.schema.js';

export function roomTypeRoutes(service: RoomTypeService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = roomTypeController(service);
  router.use(authenticate(auth));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/', authorizeRoles(...ROLE_CODES), validate(listRoomTypesSchema), controller.list);
  router.get('/:id', authorizeRoles(...ROLE_CODES), validate(roomTypeIdSchema), controller.detail);
  router.use(authorizeRoles('ADMIN', 'MANAGER'), csrfProtection(env));
  router.post('/', validate(createRoomTypeSchema), controller.create);
  router.patch('/:id', validate(updateRoomTypeSchema), controller.update);
  router.delete('/:id', validate(roomTypeIdSchema), controller.deactivate);
  return router;
}
