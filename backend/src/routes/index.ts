import { Router } from 'express';
import type { Env } from '../config/env.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { RoomRepositories } from '../app.js';
import { roomTypeRoutes } from '../modules/room-types/room-type.routes.js';
import { RoomTypeService } from '../modules/room-types/room-type.service.js';
import { roomRoutes } from '../modules/rooms/room.routes.js';
import { RoomService } from '../modules/rooms/room.service.js';
import type { GuestRepository } from '../modules/guests/guest.types.js';
import { GuestService } from '../modules/guests/guest.service.js';
import { GuestCrypto } from '../modules/guests/guest.crypto.js';
import { guestRoutes } from '../modules/guests/guest.routes.js';

export function apiRoutes(
  service: AuthService,
  env: Env,
  rooms: RoomRepositories,
  guests: GuestRepository,
) {
  const router = Router();
  router.use('/auth', authRoutes(service, env));
  router.use('/room-types', roomTypeRoutes(new RoomTypeService(rooms.roomTypes), service, env));
  router.use('/rooms', roomRoutes(new RoomService(rooms.rooms), service, env));
  router.use('/guests', guestRoutes(new GuestService(guests, new GuestCrypto(env)), service, env));
  return router;
}
