import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLE_CODES } from '../../shared/types/roles.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RoomService } from './room.service.js';
import { roomController } from './room.controller.js';
import {
  createRoomSchema,
  updateRoomSchema,
  roomIdSchema,
  listRoomsSchema,
} from './room.schema.js';

export function roomRoutes(service: RoomService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = roomController(service);
  router.use(authenticate(auth));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/', authorizeRoles(...ROLE_CODES), validate(listRoomsSchema), controller.list);
  router.get('/:id', authorizeRoles(...ROLE_CODES), validate(roomIdSchema), controller.detail);
  router.use(authorizeRoles('ADMIN', 'MANAGER'), csrfProtection(env));
  router.post('/', validate(createRoomSchema), controller.create);
  router.patch('/:id', validate(updateRoomSchema), controller.update);
  router.delete('/:id', validate(roomIdSchema), controller.deactivate);
  return router;
}
