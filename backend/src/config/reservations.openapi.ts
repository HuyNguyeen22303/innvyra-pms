import { BOOKING_SOURCES } from '../modules/reservations/reservation.schema.js';
import { ReservationStatus } from '../generated/prisma/enums.js';
import { reservationPermissions } from '../modules/reservations/reservation.types.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  example: '12',
  description: 'Unsigned BIGINT as decimal string',
};
const date = { type: 'string', format: 'date', example: '2026-10-20' };
const money = { type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '900000.00' };
const timestamp = { type: 'string', format: 'date-time' };
const identity = {
  type: 'object',
  required: ['id', 'fullName'],
  properties: { id, fullName: { type: 'string' } },
};
const status = { type: 'string', enum: Object.values(ReservationStatus) };
const source = { type: 'string', enum: [...BOOKING_SOURCES], default: 'DIRECT' };
const roomInput = {
  type: 'object',
  additionalProperties: false,
  required: ['roomTypeId', 'quantity', 'adults'],
  properties: {
    roomTypeId: id,
    quantity: { type: 'integer', minimum: 1, maximum: 100 },
    adults: { type: 'integer', minimum: 1, maximum: 65535 },
    children: { type: 'integer', minimum: 0, maximum: 65535, default: 0 },
  },
};
const summaryFields = {
  id,
  confirmationCode: { type: 'string', maxLength: 32 },
  status,
  bookerGuest: identity,
  checkInDate: date,
  checkOutDate: date,
  totalNights: { type: 'integer' },
  totalRooms: { type: 'integer' },
  bookingSource: source,
  totalAmount: money,
  currency: { type: 'string', enum: ['VND'] },
  createdAt: timestamp,
};
const summaryExample = {
  id: '101',
  confirmationCode: 'INN-A7DC158049FA43FC102B1240F001',
  bookerGuest: { id: '12', fullName: 'Synthetic Guest' },
  checkInDate: '2026-10-20',
  checkOutDate: '2026-10-22',
  totalNights: 2,
  totalRooms: 2,
  status: 'CONFIRMED',
  bookingSource: 'DIRECT',
  totalAmount: '3600000.00',
  currency: 'VND',
  createdAt: '2026-10-14T00:00:00.000Z',
};
const detailExample = {
  ...summaryExample,
  createdBy: { id: '1', fullName: 'Receptionist' },
  updatedAt: summaryExample.createdAt,
  notes: null,
  cancellation: null,
  rooms: ['201', '202'].map((roomId) => ({
    id: roomId,
    roomType: { id: '2', code: 'DELUXE', name: 'Deluxe' },
    roomId: null,
    adults: 2,
    children: 0,
    nights: ['2026-10-20', '2026-10-21'].map((stayDate) => ({
      stayDate,
      nightlyRate: '900000.00',
    })),
  })),
};
const availabilityExample = [
  {
    roomTypeId: '2',
    roomTypeName: 'Deluxe',
    availableRooms: 3,
    basePrice: '900000.00',
    estimatedTotalPerRoom: '1800000.00',
    currency: 'VND',
  },
];
export const reservationSchemas = {
  CreateReservation: {
    type: 'object',
    additionalProperties: false,
    required: ['guestId', 'checkInDate', 'checkOutDate', 'rooms'],
    properties: {
      guestId: id,
      checkInDate: date,
      checkOutDate: date,
      rooms: { type: 'array', minItems: 1, maxItems: 100, items: roomInput },
      bookingSource: source,
      notes: { type: 'string', nullable: true, maxLength: 5000 },
    },
    description:
      'adults/children are PER ROOM. Each roomTypeId must occur once. Total rooms limited by RESERVATION_MAX_ROOMS (default 20). No roomId, hotelId, status, price or creator fields allowed.',
  },
  CancelReservation: {
    type: 'object',
    additionalProperties: false,
    required: ['reason'],
    properties: { reason: { type: 'string', minLength: 1, maxLength: 2000 } },
  },
  ReservationSummary: {
    type: 'object',
    required: Object.keys(summaryFields),
    properties: summaryFields,
  },
  ReservationDetail: {
    type: 'object',
    required: [...Object.keys(summaryFields), 'createdBy', 'updatedAt', 'rooms', 'cancellation'],
    properties: {
      ...summaryFields,
      createdBy: identity,
      updatedAt: timestamp,
      notes: { type: 'string', nullable: true, description: 'Omitted for ACCOUNTANT.' },
      cancellation: {
        type: 'object',
        nullable: true,
        properties: {
          cancelledAt: timestamp,
          cancelledBy: identity,
          reason: { type: 'string', description: 'Omitted for ACCOUNTANT.' },
        },
      },
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'roomType', 'roomId', 'adults', 'children', 'nights'],
          properties: {
            id,
            roomType: {
              type: 'object',
              properties: { id, name: { type: 'string' }, code: { type: 'string' } },
            },
            roomId: {
              ...id,
              nullable: true,
              description: 'Always null in Phase 4; physical assignment unsupported.',
            },
            adults: { type: 'integer' },
            children: { type: 'integer' },
            nights: {
              type: 'array',
              items: {
                type: 'object',
                required: ['stayDate', 'nightlyRate'],
                properties: { stayDate: date, nightlyRate: money },
              },
            },
          },
        },
      },
    },
  },
  ReservationAvailability: {
    type: 'object',
    required: [
      'roomTypeId',
      'roomTypeName',
      'availableRooms',
      'basePrice',
      'estimatedTotalPerRoom',
      'currency',
    ],
    properties: {
      roomTypeId: id,
      roomTypeName: { type: 'string' },
      availableRooms: { type: 'integer', minimum: 0 },
      basePrice: money,
      estimatedTotalPerRoom: money,
      currency: { type: 'string', enum: ['VND'] },
    },
  },
};
const envelope = (data: object) => ({
  type: 'object',
  required: ['success', 'message', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, message: { type: 'string' }, data },
});
const response = (data: object, example: object) => ({
  description: 'Success',
  content: json(envelope(data), { success: true, message: 'Success', data: example }),
});
const errors = {
  401: {
    description: 'Missing/invalid JWT, expired or revoked session',
    content: json(ref('Error')),
  },
  403: { description: 'Role, filter or CSRF forbidden', content: json(ref('Error')) },
  404: {
    description: 'Scoped hotel, guest, room type or reservation not found',
    content: json(ref('Error')),
  },
  409: {
    description:
      'INSUFFICIENT_AVAILABILITY, ROOM_TYPE_INACTIVE, INVALID_ROOM_PRICE, RESERVATION_CONFLICT or RESERVATION_CANNOT_BE_CANCELLED',
    content: json(ref('Error')),
  },
  422: {
    description:
      'VALIDATION_ERROR, INVALID_DATE_RANGE, RESERVATION_ROOM_LIMIT, RESERVATION_TOTAL_TOO_LARGE or ROOM_CAPACITY_EXCEEDED',
    content: json(ref('Error')),
  },
  500: { description: 'Sanitized internal error', content: json(ref('Error')) },
  503: { description: 'Hotel timezone configuration invalid', content: json(ref('Error')) },
};
const query = (name: string, schema: object, description: string, required = false) => ({
  name,
  in: 'query',
  required,
  schema,
  description,
});
const idParam = { name: 'id', in: 'path', required: true, schema: id };
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const operation = (summary: string, roles: readonly string[], description: string) => ({
  tags: ['Reservations'],
  summary,
  description: `Roles: ${roles.join(', ')}. ${description}`,
  security: [{ bearerAuth: [] }],
  'x-required-roles': roles,
});
const read = reservationPermissions.read;
const write = reservationPermissions.write;
export const reservationPaths = {
  '/rooms/availability': {
    get: {
      ...operation(
        'Check room type availability',
        reservationPermissions.availability,
        'Read-only consistent snapshot. Half-open [checkInDate, checkOutDate); minimum remaining capacity across every night. Active room types and ACTIVE physical rooms only; housekeeping readiness is not a future capacity constraint. Dates must start today or later in hotel.timezone; max nights configured by RESERVATION_MAX_NIGHTS (default 30). Creation rechecks inventory and prices. Zero-availability types are returned with availableRooms=0. No maintenance scheduling.',
      ),
      parameters: [
        query('checkInDate', date, 'Hotel-local DATE', true),
        query('checkOutDate', date, 'Exclusive departure date', true),
        query(
          'adults',
          { type: 'integer', minimum: 1, maximum: 65535, default: 1 },
          'Adults per room',
        ),
        query(
          'children',
          { type: 'integer', minimum: 0, maximum: 65535, default: 0 },
          'Children per room',
        ),
        query('roomTypeId', id, 'Optional scoped room type; missing/inactive yields 404/409'),
      ],
      responses: {
        200: response(
          { type: 'array', items: ref('ReservationAvailability') },
          availabilityExample,
        ),
        ...errors,
      },
    },
  },
  '/reservations': {
    get: {
      ...operation(
        'List reservations',
        read,
        'Hotel scoped. search matches confirmation code; guestSearch matches guest name and is forbidden for ACCOUNTANT. Date filters are exact dates. Summary excludes nightly rows, private notes and identity documents. Pagination follows the existing data.items/data.pagination convention.',
      ),
      parameters: [
        query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }, 'Page'),
        query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Page size'),
        query('search', { type: 'string', maxLength: 32 }, 'Confirmation code contains'),
        query('guestId', id, 'Booker ID'),
        query(
          'guestSearch',
          { type: 'string', maxLength: 150 },
          'Guest name contains; front desk roles only',
        ),
        query('status', status, 'Reservation status'),
        query('checkInDate', date, 'Exact check-in date'),
        query('checkOutDate', date, 'Exact check-out date'),
        query('bookingSource', source, 'Booking channel'),
        query(
          'sortBy',
          {
            type: 'string',
            enum: ['createdAt', 'checkInDate', 'checkOutDate', 'totalAmount', 'confirmationCode'],
            default: 'createdAt',
          },
          'Sort field',
        ),
        query(
          'sortOrder',
          { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          'Sort direction',
        ),
      ],
      responses: {
        200: response(
          {
            type: 'object',
            properties: {
              items: { type: 'array', items: ref('ReservationSummary') },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
          { items: [summaryExample], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
        ),
        ...errors,
      },
    },
    post: {
      ...operation(
        'Create a confirmed multi-room reservation',
        write,
        'One transaction locks hotel capacity, validates scoped active guest/types, checks each night, snapshots Decimal prices and confirms all rooms. No temporary hold. Max rooms 20 and nights 30 by default (server configuration). Capacity or partial-write failures roll back the entire reservation. Hotel and actor IDs come from server context; supplied guest/type IDs are checked within that hotel. No physical assignment, tax, discounts or payments. A retried POST is a new booking; creation has no idempotency key.',
      ),
      parameters: [csrf],
      requestBody: {
        required: true,
        content: json(ref('CreateReservation'), {
          guestId: '12',
          checkInDate: '2026-10-20',
          checkOutDate: '2026-10-22',
          rooms: [{ roomTypeId: '2', quantity: 2, adults: 2, children: 0 }],
          bookingSource: 'DIRECT',
          notes: 'Quiet rooms preferred',
        }),
      },
      responses: { 201: response(ref('ReservationDetail'), detailExample), ...errors },
    },
  },
  '/reservations/{id}': {
    get: {
      ...operation(
        'Get reservation details and stored nightly prices',
        read,
        'Hotel scoped; foreign IDs return 404. Booker projection is id/fullName only. ACCOUNTANT cannot see private notes or cancellation reason. Stored prices never follow later room type price changes.',
      ),
      parameters: [idParam],
      responses: { 200: response(ref('ReservationDetail'), detailExample), ...errors },
    },
  },
  '/reservations/{id}/cancel': {
    post: {
      ...operation(
        'Cancel a confirmed reservation',
        write,
        'CONFIRMED -> CANCELLED only. Repeating cancellation returns 200 with original audit information retained. CHECKED_IN/CHECKED_OUT/NO_SHOW return 409. Inventory is released exactly once in the same transaction. Nightly snapshots and financial transactions are retained; refund policy belongs to Payments/Billing. No arbitrary status/date/room PATCH endpoint.',
      ),
      parameters: [idParam, csrf],
      requestBody: {
        required: true,
        content: json(ref('CancelReservation'), { reason: 'Guest changed travel plans' }),
      },
      responses: {
        200: response(
          {
            type: 'object',
            required: ['id', 'status'],
            properties: { id, status: { type: 'string', enum: ['CANCELLED'] } },
          },
          { id: '101', status: 'CANCELLED' },
        ),
        ...errors,
      },
    },
  },
};
