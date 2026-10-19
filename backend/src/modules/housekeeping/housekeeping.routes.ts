import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { operationsRouter } from '../operations/operations.routes.js';
import {
  cleaners,
  housekeepingReaders,
  managers,
  requesters,
} from '../operations/operations.shared.js';
import { housekeepingController } from './housekeeping.controller.js';
import {
  assignBody,
  cancelTaskBody,
  createTaskBody,
  dirtyRoomQuery,
  inspectBody,
  taskNotesBody,
  taskQuery,
} from './housekeeping.schema.js';
import type { HousekeepingService } from './housekeeping.service.js';
export function housekeepingRoutes(service: HousekeepingService, auth: AuthService, env: Env) {
  const { router, add } = operationsRouter(auth, env),
    c = housekeepingController(service);
  add('get', '/tasks', housekeepingReaders, c.list, { query: taskQuery });
  add('get', '/tasks/:id', housekeepingReaders, c.detail);
  add('post', '/tasks', requesters, c.create, { body: createTaskBody });
  add('patch', '/tasks/:id/assign', managers, c.assign, { body: assignBody });
  add('post', '/tasks/:id/start', cleaners, c.start, { body: taskNotesBody });
  add('post', '/tasks/:id/complete', cleaners, c.complete, { body: taskNotesBody });
  add('post', '/tasks/:id/inspect', managers, c.inspect, { body: inspectBody });
  add('post', '/tasks/:id/cancel', managers, c.cancel, { body: cancelTaskBody });
  add('get', '/dirty-rooms', requesters, c.dirtyRooms, { query: dirtyRoomQuery });
  return router;
}
