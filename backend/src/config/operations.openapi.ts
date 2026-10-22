import {
  cleaners,
  housekeepingReaders,
  managers,
  operationsReaders,
  requesters,
  technicians,
} from '../modules/operations/operations.shared.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  example: '301',
  description: 'Unsigned BIGINT decimal string, maximum 18446744073709551615',
};
const time = { type: 'string', format: 'date-time' };
const date = { type: 'string', format: 'date', example: '2026-11-01' };
const text = { type: 'string', minLength: 1, maxLength: 2000 };
const nullable = (value: object) => ({ ...value, nullable: true });
const enumeration = (values: string[]) => ({ type: 'string', enum: values });
const object = (properties: Record<string, object>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const hkStatus = enumeration([
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_INSPECTION',
  'COMPLETED',
  'CANCELLED',
]);
const hkPriority = enumeration(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const ticketStatus = enumeration([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
]);
const ticketPriority = enumeration(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
const blockStatus = enumeration(['SCHEDULED', 'ACTIVE', 'RELEASED', 'CANCELLED']);
const roomFields = {
  id,
  roomNumber: { type: 'string' },
  floorNumber: { type: 'integer' },
  roomTypeId: id,
  physicalStatus: enumeration(['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  housekeepingStatus: enumeration(['DIRTY', 'CLEANING', 'INSPECTION', 'READY']),
  isActive: { type: 'boolean' },
};
const audit = object({
  id,
  hotelId: id,
  actorId: id,
  taskId: nullable(id),
  ticketId: nullable(id),
  blockId: nullable(id),
  action: { type: 'string' },
  fromStatus: nullable({ type: 'string' }),
  toStatus: { type: 'string' },
  notes: nullable(text),
  createdAt: time,
});
const base = {
  id,
  hotelId: id,
  roomId: id,
  createdAt: time,
  updatedAt: time,
  room: object(roomFields),
};
const hkFields = {
  ...base,
  taskType: enumeration(['TURNOVER_CLEANING']),
  status: hkStatus,
  priority: hkPriority,
  assignedTo: nullable(id),
  createdBy: id,
  notes: nullable(text),
  startedAt: nullable(time),
  completedAt: nullable(time),
  inspectedAt: nullable(time),
  inspectedBy: nullable(id),
};
const ticketFields = {
  ...base,
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', minLength: 1, maxLength: 10000 },
  priority: ticketPriority,
  status: ticketStatus,
  reportedBy: id,
  assignedTo: nullable(id),
  resolvedBy: nullable(id),
  reportedAt: time,
  startedAt: nullable(time),
  resolvedAt: nullable(time),
  closedAt: nullable(time),
  resolutionNotes: nullable(text),
};
const blockFields = {
  ...base,
  maintenanceTicketId: nullable(id),
  startDate: date,
  endDate: date,
  status: blockStatus,
  reason: text,
  createdBy: id,
  releasedBy: nullable(id),
  releasedAt: nullable(time),
};
const history = { type: 'array', items: audit };
const page = (name: string) =>
  object({
    items: { type: 'array', items: ref(name) },
    pagination: object({
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    }),
  });
export const operationsSchemas = {
  HousekeepingTaskSummary: object(hkFields),
  HousekeepingTask: object({ ...hkFields, history }),
  HousekeepingTaskPage: page('HousekeepingTaskSummary'),
  DirtyRoom: object({ ...roomFields, occupancyStatus: enumeration(['VACANT', 'OCCUPIED']) }),
  DirtyRoomPage: page('DirtyRoom'),
  MaintenanceTicketSummary: object(ticketFields),
  MaintenanceTicket: object({ ...ticketFields, history }),
  MaintenanceTicketPage: page('MaintenanceTicketSummary'),
  MaintenanceTicketStats: {
    type: 'array',
    items: object({ status: ticketStatus, count: { type: 'integer', minimum: 0 } }),
  },
  MaintenanceBlockSummary: object(blockFields),
  MaintenanceBlock: object({ ...blockFields, history }),
  MaintenanceBlockPage: page('MaintenanceBlockSummary'),
  HousekeepingCreate: {
    ...object(
      {
        roomId: id,
        taskType: enumeration(['TURNOVER_CLEANING']),
        priority: hkPriority,
        notes: text,
      },
      ['roomId'],
    ),
    example: {
      roomId: '301',
      taskType: 'TURNOVER_CLEANING',
      priority: 'NORMAL',
      notes: 'Prepare room for next guest',
    },
  },
  OperationsAssignment: { ...object({ staffId: id }), example: { staffId: '8' } },
  HousekeepingInspection: {
    ...object({ passed: { type: 'boolean' }, notes: text }, ['passed']),
    example: { passed: false, notes: 'Bathroom needs cleaning again' },
  },
  OperationsReason: {
    ...object({ reason: text }),
    example: { reason: 'Duplicate request reported by reception' },
  },
  OperationsRelease: {
    ...object({ notes: text }),
    example: { notes: 'Repair verified safe; room requires cleaning and inspection' },
  },
  MaintenanceTicketCreate: {
    ...object(
      {
        roomId: id,
        title: ticketFields.title,
        description: ticketFields.description,
        priority: ticketPriority,
      },
      ['roomId', 'title', 'description'],
    ),
    example: {
      roomId: '301',
      title: 'Air conditioner malfunction',
      description: 'Air conditioner is not cooling',
      priority: 'HIGH',
    },
  },
  MaintenanceResolution: {
    ...object({ resolutionNotes: text }),
    example: { resolutionNotes: 'Replaced faulty component and tested cooling' },
  },
  MaintenanceBlockCreate: {
    ...object(
      { roomId: id, maintenanceTicketId: id, startDate: date, endDate: date, reason: text },
      ['roomId', 'startDate', 'endDate', 'reason'],
    ),
    example: {
      roomId: '301',
      maintenanceTicketId: '45',
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      reason: 'Air conditioning repair',
    },
  },
};
const parameter = (name: string, schema: object, description?: string) => ({
  name,
  in: 'query',
  required: false,
  schema,
  ...(description ? { description } : {}),
});
const pagination = [
  parameter('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }),
  parameter('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
  parameter('sortOrder', { ...enumeration(['asc', 'desc']), default: 'asc' }),
];
const hkQuery = [
  ...pagination,
  parameter('status', hkStatus),
  parameter('priority', hkPriority),
  parameter('roomId', id),
  parameter('assignedTo', id),
  parameter('taskType', enumeration(['TURNOVER_CLEANING'])),
  parameter('floorNumber', { type: 'integer', minimum: -32768, maximum: 32767 }),
  parameter('sortBy', {
    ...enumeration(['createdAt', 'priority', 'status']),
    default: 'createdAt',
  }),
];
const ticketFilterQuery = [
  parameter('search', { type: 'string', maxLength: 100 }),
  parameter('status', ticketStatus),
  parameter('priority', ticketPriority),
  parameter('roomId', id),
  parameter('assignedTo', id),
  parameter('fromDate', date, 'Inclusive reported date in the hotel timezone'),
  parameter('toDate', date, 'Inclusive reported date in the hotel timezone'),
];
const ticketQuery = [
  ...pagination,
  ...ticketFilterQuery,
  parameter('sortBy', {
    ...enumeration(['reportedAt', 'priority', 'status']),
    default: 'reportedAt',
  }),
];
const blockQuery = [
  ...pagination,
  parameter('status', blockStatus),
  parameter('roomId', id),
  parameter('maintenanceTicketId', id),
  parameter('fromDate', date, 'Find blocks overlapping [fromDate,toDate)'),
  parameter('toDate', date, 'Exclusive interval end'),
  parameter('sortBy', { ...enumeration(['startDate', 'createdAt']), default: 'startDate' }),
];
const json = (schema: object) => ({ 'application/json': { schema } });
const error = (description: string) => ({ description, content: json(ref('Error')) });
const hkWorkflow =
  'Turnover MVP: DIRTY → CLEANING → INSPECTION → READY. Failed inspection requires notes, returns PENDING/DIRTY and retains audit history. Only the assignee starts/completes; ADMIN/MANAGER inspect. Occupancy is derived independently from active stays. No stayover cleaning.';
const maintenanceWorkflow =
  'Tickets: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED. OPEN/ASSIGNED can be CANCELLED after all linked blocks are ended. Reporting/resolving a ticket never releases inventory. Only the assignee starts/resolves.';
const blockWorkflow =
  'Blocks: SCHEDULED → ACTIVE → RELEASED; only future SCHEDULED blocks can be CANCELLED. Hotel-local half-open [startDate,endDate), 1–365 nights. Shared hotel lock protects nightly capacity and assignments. Current occupants must be handled before creating any block. Scheduled blocks do not immediately change physical status. A 30-second worker activates due blocks; date guards also run when the worker is offline. Planned end does not auto-reopen the room; manager release requires a resolved linked ticket and safety notes. Release returns DIRTY and ensures one turnover task, never READY. Repeated release returns 409 without changing inventory.';
export const operationsPaths: Record<string, Record<string, object>> = {};
function add(
  method: 'get' | 'post' | 'patch',
  path: string,
  summary: string,
  roles: readonly string[],
  response: string,
  body?: string,
  query: object[] = [],
) {
  const tag = path.startsWith('/housekeeping') ? 'Housekeeping' : 'Maintenance';
  const status =
    method === 'post' &&
    ['/housekeeping/tasks', '/maintenance/tickets', '/maintenance/blocks'].includes(path)
      ? 201
      : 200;
  const workflow =
    tag === 'Housekeeping'
      ? hkWorkflow
      : path.includes('/blocks')
        ? blockWorkflow
        : maintenanceWorkflow;
  (operationsPaths[path] ??= {})[method] = {
    tags: [tag],
    summary,
    description: `${workflow} Required roles: ${roles.join(', ')}. Current hotel only. HOUSEKEEPING sees only assigned tasks; TECHNICIAN sees only assigned tickets. Responses exclude guest data. Mutation bodies reject unknown fields. Actor and hotel come from authentication.`,
    security: [{ bearerAuth: [] }],
    'x-required-roles': roles,
    parameters: [
      ...(path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: id }] : []),
      ...query,
      ...(method !== 'get'
        ? [
            {
              name: 'X-CSRF-Protection',
              in: 'header',
              required: true,
              schema: { type: 'string', enum: ['1'], default: '1' },
            },
          ]
        : []),
    ],
    ...(method !== 'get'
      ? { requestBody: { required: !!body, content: json(body ? ref(body) : object({})) } }
      : {}),
    responses: {
      [status]: {
        description: 'Success',
        content: json(
          object({
            success: { type: 'boolean', enum: [true] },
            message: { type: 'string' },
            data: ref(response),
          }),
        ),
      },
      400: error('Malformed JSON'),
      401: error('UNAUTHORIZED'),
      403: error('FORBIDDEN or CSRF validation failed'),
      404: error('Room, task, ticket or block not found in the current hotel / assigned scope'),
      409: error(
        'State/conflict: HOUSEKEEPING_TASK_ALREADY_ACTIVE, INVALID_HOUSEKEEPING_TRANSITION, HOUSEKEEPING_TASK_CONFLICT, ROOM_NOT_DIRTY, ROOM_UNDER_MAINTENANCE, ROOM_CURRENTLY_OCCUPIED, INVALID_MAINTENANCE_TRANSITION, MAINTENANCE_BLOCK_CONFLICT, MAINTENANCE_AFFECTS_RESERVATIONS, MAINTENANCE_ALREADY_RELEASED, OPERATIONS_CONFLICT',
      ),
      422: error('Invalid fields, assignee or hotel-local date range'),
      500: error('Internal server error'),
    },
  };
}
add(
  'get',
  '/housekeeping/tasks',
  'List housekeeping tasks',
  housekeepingReaders,
  'HousekeepingTaskPage',
  undefined,
  hkQuery,
);
add(
  'post',
  '/housekeeping/tasks',
  'Create a turnover task',
  requesters,
  'HousekeepingTask',
  'HousekeepingCreate',
);
add(
  'get',
  '/housekeeping/tasks/{id}',
  'Get task and immutable history',
  housekeepingReaders,
  'HousekeepingTask',
);
add(
  'patch',
  '/housekeeping/tasks/{id}/assign',
  'Assign a pending turnover task',
  managers,
  'HousekeepingTask',
  'OperationsAssignment',
);
add(
  'post',
  '/housekeeping/tasks/{id}/start',
  'Start assigned cleaning',
  cleaners,
  'HousekeepingTask',
);
add(
  'post',
  '/housekeeping/tasks/{id}/complete',
  'Submit cleaning for inspection',
  cleaners,
  'HousekeepingTask',
);
add(
  'post',
  '/housekeeping/tasks/{id}/inspect',
  'Pass inspection or return for rework',
  managers,
  'HousekeepingTask',
  'HousekeepingInspection',
);
add(
  'post',
  '/housekeeping/tasks/{id}/cancel',
  'Cancel a nonterminal task and leave room DIRTY',
  managers,
  'HousekeepingTask',
  'OperationsReason',
);
add(
  'get',
  '/housekeeping/dirty-rooms',
  'List dirty rooms without guest data',
  requesters,
  'DirtyRoomPage',
  undefined,
  [
    ...pagination,
    parameter('floorNumber', { type: 'integer', minimum: -32768, maximum: 32767 }),
    parameter('sortBy', { ...enumeration(['roomNumber', 'floorNumber']), default: 'roomNumber' }),
  ],
);
add(
  'get',
  '/maintenance/tickets',
  'List maintenance tickets',
  operationsReaders,
  'MaintenanceTicketPage',
  undefined,
  ticketQuery,
);
add(
  'post',
  '/maintenance/tickets',
  'Report a maintenance issue',
  operationsReaders,
  'MaintenanceTicket',
  'MaintenanceTicketCreate',
);
add(
  'get',
  '/maintenance/tickets/stats',
  'Count maintenance tickets by status',
  operationsReaders,
  'MaintenanceTicketStats',
  undefined,
  ticketFilterQuery,
);
add(
  'get',
  '/maintenance/tickets/{id}',
  'Get ticket and history',
  operationsReaders,
  'MaintenanceTicket',
);
add(
  'patch',
  '/maintenance/tickets/{id}/assign',
  'Assign technical staff',
  managers,
  'MaintenanceTicket',
  'OperationsAssignment',
);
add(
  'post',
  '/maintenance/tickets/{id}/start',
  'Start assigned repair',
  technicians,
  'MaintenanceTicket',
);
add(
  'post',
  '/maintenance/tickets/{id}/resolve',
  'Record completed repair; keep room blocks',
  technicians,
  'MaintenanceTicket',
  'MaintenanceResolution',
);
add(
  'post',
  '/maintenance/tickets/{id}/close',
  'Verify and close resolved ticket',
  managers,
  'MaintenanceTicket',
);
add(
  'post',
  '/maintenance/tickets/{id}/cancel',
  'Cancel open or assigned ticket',
  managers,
  'MaintenanceTicket',
  'OperationsReason',
);
add(
  'get',
  '/maintenance/blocks',
  'List maintenance intervals',
  operationsReaders,
  'MaintenanceBlockPage',
  undefined,
  blockQuery,
);
add(
  'post',
  '/maintenance/blocks',
  'Block a room with nightly inventory checks',
  managers,
  'MaintenanceBlock',
  'MaintenanceBlockCreate',
);
add(
  'get',
  '/maintenance/blocks/{id}',
  'Get block and history',
  operationsReaders,
  'MaintenanceBlock',
);
add(
  'post',
  '/maintenance/blocks/{id}/release',
  'Release a block after safety verification',
  managers,
  'MaintenanceBlock',
  'OperationsRelease',
);
add(
  'post',
  '/maintenance/blocks/{id}/cancel',
  'Cancel a future scheduled block',
  managers,
  'MaintenanceBlock',
  'OperationsReason',
);
