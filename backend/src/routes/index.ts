import { Router } from 'express';
import type { Env } from '../config/env.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { RoomRepositories } from '../app.js';
import { roomTypeRoutes } from '../modules/room-types/room-type.routes.js';
import { RoomTypeService } from '../modules/room-types/room-type.service.js';
import { roomRoutes } from '../modules/rooms/room.routes.js';
import { RoomService } from '../modules/rooms/room.service.js';

export function apiRoutes(service: AuthService, env: Env, rooms: RoomRepositories) {
  const router = Router();
  router.use('/auth', authRoutes(service, env));
  router.use('/room-types', roomTypeRoutes(new RoomTypeService(rooms.roomTypes), service, env));
  router.use('/rooms', roomRoutes(new RoomService(rooms.rooms), service, env));
  return router;
}
