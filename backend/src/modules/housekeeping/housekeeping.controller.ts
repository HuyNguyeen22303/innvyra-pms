import { operationHandler as handle } from '../operations/operations.shared.js';
import type { HousekeepingService } from './housekeeping.service.js';
import type {
  CreateTaskInput,
  DirtyRoomQuery,
  InspectInput,
  TaskQuery,
} from './housekeeping.types.js';
export function housekeepingController(service: HousekeepingService) {
  return {
    list: handle<object, TaskQuery>('Tasks retrieved', (s, { query }) => service.list(s, query)),
    detail: handle('Task retrieved', (s, { params }) => service.detail(s, BigInt(params.id!))),
    create: handle<CreateTaskInput>('Task created', (s, { body }) => service.create(s, body), 201),
    assign: handle<{ staffId: string }>('Task assigned', (s, { params, body }) =>
      service.assign(s, BigInt(params.id!), BigInt(body.staffId)),
    ),
    start: handle('Cleaning started', (s, { params }) => service.start(s, BigInt(params.id!))),
    complete: handle('Cleaning awaiting inspection', (s, { params }) =>
      service.complete(s, BigInt(params.id!)),
    ),
    inspect: handle<InspectInput>('Inspection recorded', (s, { params, body }) =>
      service.inspect(s, BigInt(params.id!), body),
    ),
    cancel: handle<{ reason: string }>('Task cancelled', (s, { params, body }) =>
      service.cancel(s, BigInt(params.id!), body.reason),
    ),
    dirtyRooms: handle<object, DirtyRoomQuery>('Dirty rooms retrieved', (s, { query }) =>
      service.dirtyRooms(s, query),
    ),
  };
}
