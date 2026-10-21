import { stayPermissions } from '../modules/stays/stay.types.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  description: 'Internal unsigned BIGINT ID, maximum 18446744073709551615; not a room number',
  example: '301',
};
const timestamp = { type: 'string', format: 'date-time' };
const identity = {
  type: 'object',
  required: ['id', 'fullName'],
  properties: { id, fullName: { type: 'string' } },
};
const room = {
  type: 'object',
  required: ['id', 'roomNumber'],
  properties: { id, roomNumber: { type: 'string' } },
};
const status = { type: 'string', enum: ['CHECKED_IN', 'CHECKED_OUT'] };
const notes = { type: 'string', nullable: true, maxLength: 2000 };
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const envelope = (data: object) => ({
  type: 'object',
  required: ['success', 'message', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data,
  },
});
const summary = {
  stayId: id,
  reservationId: id,
  reservationRoomId: id,
  confirmationCode: { type: 'string' },
  bookerGuest: {
    ...identity,
    description: 'Omitted for ACCOUNTANT. No contact or identity documents are exposed.',
  },
  room: {
    ...room,
    properties: {
      ...room.properties,
      housekeepingStatus: { type: 'string', enum: ['READY', 'DIRTY', 'CLEANING', 'INSPECTION'] },
    },
  },
  roomType: {
    type: 'object',
    required: ['id', 'code', 'name'],
    properties: { id, code: { type: 'string' }, name: { type: 'string' } },
  },
  status,
  actualCheckinAt: timestamp,
  actualCheckoutAt: { ...timestamp, nullable: true },
};
const requiredSummary = Object.keys(summary).filter((key) => key !== 'bookerGuest');
export const staySchemas = {
  StayCheckin: {
    type: 'object',
    additionalProperties: false,
    required: ['roomId'],
    properties: { roomId: id, notes },
  },
  StayCheckout: { type: 'object', additionalProperties: false, properties: { notes } },
  StayTransfer: {
    type: 'object',
    additionalProperties: false,
    required: ['toRoomId', 'reason'],
    properties: { toRoomId: id, reason: { type: 'string', minLength: 1, maxLength: 2000 } },
  },
  StaySummary: { type: 'object', required: requiredSummary, properties: summary },
  StayDetail: {
    type: 'object',
    required: [...requiredSummary, 'reservation'],
    properties: {
      ...summary,
      reservation: {
        type: 'object',
        required: ['id', 'confirmationCode', 'status', 'checkInDate', 'checkOutDate'],
        properties: {
          id,
          confirmationCode: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'CONFIRMED',
              'PARTIALLY_CHECKED_IN',
              'CHECKED_IN',
              'CHECKED_OUT',
              'CANCELLED',
              'NO_SHOW',
            ],
          },
          checkInDate: { type: 'string', format: 'date' },
          checkOutDate: { type: 'string', format: 'date' },
        },
      },
      checkinNotes: notes,
      checkoutNotes: notes,
      checkinStaff: identity,
      checkoutStaff: { ...identity, nullable: true },
      transfers: {
        type: 'array',
        description: 'Chronological history; omitted together with notes and staff for ACCOUNTANT.',
        items: {
          type: 'object',
          required: ['id', 'fromRoom', 'toRoom', 'transferredAt', 'transferredBy', 'reason'],
          properties: {
            id,
            fromRoom: room,
            toRoom: room,
            transferredAt: timestamp,
            transferredBy: identity,
            reason: { type: 'string' },
          },
        },
      },
    },
  },
  StayPage: {
    type: 'object',
    required: ['items', 'pagination'],
    properties: {
      items: { type: 'array', items: ref('StaySummary') },
      pagination: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
};
const example = {
  stayId: '501',
  reservationId: '101',
  reservationRoomId: '1001',
  confirmationCode: 'INN-A7DC158049FA43FC102B1240F001',
  bookerGuest: { id: '12', fullName: 'Synthetic Guest' },
  room: { id: '301', roomNumber: '301', housekeepingStatus: 'READY' },
  roomType: { id: '2', code: 'DELUXE', name: 'Deluxe' },
  status: 'CHECKED_IN',
  actualCheckinAt: '2026-10-20T07:00:00.000Z',
  actualCheckoutAt: null,
};
const detailExample = {
  ...example,
  reservation: {
    id: '101',
    confirmationCode: example.confirmationCode,
    status: 'CHECKED_IN',
    checkInDate: '2026-10-20',
    checkOutDate: '2026-10-22',
  },
  checkinNotes: 'Guest arrived at reception',
  checkoutNotes: null,
  checkinStaff: { id: '1', fullName: 'Receptionist' },
  checkoutStaff: null,
  transfers: [],
};
const error = (description: string) => ({ description, content: json(ref('Error')) });
const errors = {
  400: error('Malformed JSON'),
  401: error('UNAUTHORIZED: missing, invalid or expired access token/session'),
  403: error('FORBIDDEN: role not allowed or CSRF check failed'),
  404: error(
    'RESERVATION_NOT_FOUND, RESERVATION_ROOM_NOT_FOUND, STAY_NOT_FOUND, ROOM_NOT_FOUND; foreign hotel IDs also return 404',
  ),
  409: error(
    'RESERVATION_NOT_CONFIRMED, STAY_ALREADY_CHECKED_IN, STAY_ALREADY_CHECKED_OUT, ROOM_ALREADY_OCCUPIED, ROOM_NOT_READY, ROOM_UNAVAILABLE, ROOM_TYPE_MISMATCH, INVALID_CHECKIN_DATE, INVALID_CHECKOUT_OPERATION, INVALID_ROOM_TRANSFER, CROSS_ROOM_TYPE_TRANSFER_NOT_SUPPORTED, STAY_CONFLICT',
  ),
  422: error(
    'VALIDATION_ERROR: invalid ID/body/query, unknown fields, invalid date or excessive length',
  ),
  500: error('Internal server error; no database details'),
  503: error('HOTEL_TIMEZONE_INVALID: hotel configuration needs repair'),
};
const response = (schema: string, message: string, data: object) => ({
  description: message,
  content: json(envelope(ref(schema)), { success: true, message, data }),
});
const base = (write: boolean) => ({
  tags: ['Stays'],
  security: [{ bearerAuth: [] }],
  'x-required-roles': [...stayPermissions[write ? 'write' : 'read']],
});
const path = (name: string) => ({ in: 'path', name, required: true, schema: id });
const csrf = {
  in: 'header',
  name: 'X-CSRF-Protection',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const query = (name: string, schema: object, description: string) => ({
  in: 'query',
  name,
  schema,
  description,
});
const body = (schema: string, example: object) => ({
  required: true,
  content: json(ref(schema), example),
});
export const stayPaths = {
  '/stays': {
    get: {
      ...base(false),
      summary: 'List stays in the authenticated hotel',
      description:
        'ADMIN, MANAGER, RECEPTIONIST and ACCOUNTANT. All statuses by default; status=CHECKED_IN selects active stays. Accountant receives room/date/booking identifiers only. Actual date filters use hotel.timezone (default Asia/Ho_Chi_Minh), not UTC calendar dates. roomId/roomNumber mean current or last room. Stable pagination and sorting.',
      parameters: [
        query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }, 'Page number'),
        query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Page size'),
        query('status', status, 'Filter stay status'),
        query('roomId', id, 'Current or last internal room ID'),
        query(
          'roomNumber',
          { type: 'string', minLength: 1, maxLength: 20 },
          'Exact current or last room number',
        ),
        query(
          'checkInDate',
          { type: 'string', format: 'date' },
          'Actual check-in hotel-local date',
        ),
        query(
          'checkOutDate',
          { type: 'string', format: 'date' },
          'Actual checkout hotel-local date',
        ),
        query(
          'search',
          { type: 'string', minLength: 1, maxLength: 100 },
          'Confirmation code, guest full name or room number substring',
        ),
        query(
          'sortBy',
          {
            type: 'string',
            enum: ['actualCheckinAt', 'actualCheckoutAt', 'createdAt', 'id'],
            default: 'actualCheckinAt',
          },
          'Sort column',
        ),
        query(
          'sortOrder',
          { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          'Sort direction',
        ),
      ],
      responses: {
        200: response('StayPage', 'Stays retrieved', {
          items: [example],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
        ...errors,
      },
    },
  },
  '/stays/{id}': {
    get: {
      ...base(false),
      summary: 'Get stay details and transfer history',
      description:
        'ADMIN, MANAGER, RECEPTIONIST and ACCOUNTANT. Hotel scoped. ACCOUNTANT does not receive guest, staff, notes or transfer history. No financial settlement claim is made.',
      parameters: [path('id')],
      responses: { 200: response('StayDetail', 'Stay retrieved', detailExample), ...errors },
    },
  },
  '/reservations/{reservationId}/rooms/{reservationRoomId}/check-in': {
    post: {
      ...base(true),
      summary: 'Check in one booked room',
      description:
        'ADMIN, MANAGER, RECEPTIONIST. Booked hotel-local arrival date only, any time on that day; no early/late arrival override. Requires same-type ACTIVE and READY unoccupied room without conflicting assignment. Partial arrival sets PARTIALLY_CHECKED_IN; all arrived sets CHECKED_IN. Server timestamps and actor only. Atomic stay/occupancy/assignment; inventory and prices unchanged. Repeated arrival returns 409; no Idempotency-Key support.',
      parameters: [path('reservationId'), path('reservationRoomId'), csrf],
      requestBody: body('StayCheckin', { roomId: '301', notes: 'Guest arrived at reception' }),
      responses: { 201: response('StayDetail', 'Check-in successful', detailExample), ...errors },
    },
  },
  '/stays/{id}/check-out': {
    post: {
      ...base(true),
      summary: 'End physical occupancy',
      description:
        'ADMIN, MANAGER, RECEPTIONIST. Physical departure only; payment/settlement is not verified. Any time at or after actual check-in (including early/late departure). Atomically ends stay, releases occupancy and sets room DIRTY. Keeps all inventory nights, prices, assignments and history. All rooms ended sets CHECKED_OUT. Repeated checkout returns 409. Send {} when no notes.',
      parameters: [path('id'), csrf],
      requestBody: body('StayCheckout', { notes: 'Guest returned room key' }),
      responses: {
        200: response('StayDetail', 'Check-out successful', {
          ...detailExample,
          status: 'CHECKED_OUT',
          actualCheckoutAt: '2026-10-22T05:00:00.000Z',
          room: { ...example.room, housekeepingStatus: 'DIRTY' },
          reservation: { ...detailExample.reservation, status: 'CHECKED_OUT' },
          checkoutNotes: 'Guest returned room key',
          checkoutStaff: detailExample.checkinStaff,
        }),
        ...errors,
      },
    },
  },
  '/stays/{id}/transfers': {
    post: {
      ...base(true),
      summary: 'Transfer an active stay to another room',
      description:
        'ADMIN, MANAGER, RECEPTIONIST. Same booked room type only, before booked checkout date. Destination must be ACTIVE, READY, vacant and free of overlapping assignments. Moves unique occupancy, records staff/time/reason and sets old room DIRTY in one transaction. Preserves Stay ID, arrival time, inventory and prices. Cross-type/overdue transfers require future amendment/billing policy and return 409.',
      parameters: [path('id'), csrf],
      requestBody: body('StayTransfer', { toRoomId: '302', reason: 'Air conditioner malfunction' }),
      responses: {
        201: response('StayDetail', 'Room transferred successfully', {
          ...detailExample,
          room: { ...example.room, id: '302', roomNumber: '302' },
          transfers: [
            {
              id: '601',
              fromRoom: { id: '301', roomNumber: '301' },
              toRoom: { id: '302', roomNumber: '302' },
              transferredAt: '2026-10-20T09:00:00.000Z',
              transferredBy: detailExample.checkinStaff,
              reason: 'Air conditioner malfunction',
            },
          ],
        }),
        ...errors,
      },
    },
  },
};
