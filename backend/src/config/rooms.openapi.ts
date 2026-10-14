import { z } from 'zod';
import {
  roomTypeCreateBody,
  roomTypeUpdateBody,
  roomTypeListQuery,
} from '../modules/room-types/room-type.schema.js';
import { roomCreateBody, roomUpdateBody, roomListQuery } from '../modules/rooms/room.schema.js';
import { ROLE_CODES } from '../shared/types/roles.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const error = (description: string) => ({ description, content: json(ref('Error')) });
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: 'openapi-3.0', io: 'input' });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  description: 'Positive unsigned BIGINT, maximum 18446744073709551615',
  example: '1',
};
const timestamp = { type: 'string', format: 'date-time' };
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
  description: 'Required for writes; browser Origin must be allowlisted.',
};
const idParam = { name: 'id', in: 'path', required: true, schema: id };
const pagination = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages'],
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    total: { type: 'integer', minimum: 0 },
    totalPages: { type: 'integer', minimum: 0 },
  },
};
const typeExample = {
  id: '3',
  hotelId: '1',
  code: 'DLX',
  name: 'Deluxe',
  description: 'Deluxe room',
  maxAdults: 2,
  maxChildren: 1,
  basePrice: '900000.00',
  isActive: true,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
};
const roomExample = {
  id: '301',
  hotelId: '1',
  roomTypeId: '3',
  roomNumber: '301',
  floorNumber: 3,
  physicalStatus: 'ACTIVE',
  housekeepingStatus: 'READY',
  notes: 'Near elevator',
  isActive: true,
  roomType: { id: '3', code: 'DLX', name: 'Deluxe', isActive: true },
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
};
const envelope = (data: object) => ({
  type: 'object',
  required: ['success', 'message', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, message: { type: 'string' }, data },
});

export const roomSchemas = {
  CreateRoomType: {
    ...schema(roomTypeCreateBody),
    description:
      'Code is trimmed and uppercased. At least one adult; children may be zero. Price is a decimal string, never a JSON number. Unknown fields (including hotelId) are rejected.',
  },
  UpdateRoomType: {
    ...schema(roomTypeUpdateBody),
    minProperties: 1,
    description:
      'Partial update. isActive=false follows the same safeguards as DELETE. Prices affect future configuration only.',
  },
  CreateRoom: {
    ...schema(roomCreateBody),
    description:
      'Room type must be active and belong to the authenticated hotel. Basement floors may be negative. Unknown fields are rejected.',
  },
  UpdateRoom: {
    ...schema(roomUpdateBody),
    minProperties: 1,
    description:
      'Partial update. Reassignment and reactivation require an active room type in the same hotel.',
  },
  RoomType: {
    type: 'object',
    required: Object.keys(typeExample),
    properties: {
      ...schema(roomTypeCreateBody).properties,
      id,
      hotelId: id,
      basePrice: { type: 'string', pattern: '^[0-9]{1,12}\\.[0-9]{2}$', example: '900000.00' },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    example: typeExample,
  },
  Room: {
    type: 'object',
    required: Object.keys(roomExample),
    properties: {
      ...schema(roomCreateBody).properties,
      id,
      hotelId: id,
      createdAt: timestamp,
      updatedAt: timestamp,
      roomType: {
        type: 'object',
        required: ['id', 'code', 'name', 'isActive'],
        properties: {
          id,
          code: { type: 'string' },
          name: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
    example: roomExample,
  },
  Pagination: pagination,
};

function parameters(query: z.ZodType) {
  const properties = schema(query).properties ?? {};
  const overrides: Record<string, object> = {
    page: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    floorNumber: { type: 'integer', minimum: -32768, maximum: 32767 },
    isActive: { type: 'boolean' },
  };
  return Object.entries(properties).map(([name, value]) => ({
    name,
    in: 'query',
    required: false,
    schema: overrides[name] ?? value,
    ...(name === 'page' ? { description: 'Decimal integer 1–1000000; default 1.' } : {}),
    ...(name === 'limit' ? { description: 'Decimal integer 1–100; default 20.' } : {}),
    ...(name === 'floorNumber'
      ? { description: 'Signed SMALLINT, -32768–32767; includes basement floors.' }
      : {}),
    ...(name === 'isActive'
      ? { description: 'Literal true or false. Omitted includes active and inactive records.' }
      : {}),
  }));
}

function operations(name: 'RoomType' | 'Room', tag: string, query: z.ZodType, example: object) {
  const label = name === 'RoomType' ? 'Room type' : 'Room';
  const readPolicy = `Roles: ${ROLE_CODES.join(', ')}. Data is scoped to the authenticated user's current hotel, including ADMIN. Unknown query parameters are rejected. No occupancy or date availability is calculated.`;
  const writePolicy =
    'Roles: ADMIN, MANAGER. Hotel comes only from the authenticated user. Other roles receive 403. POST/PATCH/DELETE require X-CSRF-Protection: 1. No hard delete and no reservation/stay records are modified.';
  const errors = {
    401: error('Missing/invalid/expired access token or inactive/revoked session'),
    403: error('Role denied or CSRF/Origin rejected'),
    422: error('VALIDATION_ERROR with error.details containing path and message'),
    500: error('Sanitized internal error'),
  };
  const conflicts =
    name === 'RoomType'
      ? 'ROOM_TYPE_CODE_EXISTS: code already used in this hotel (including inactive types). ROOM_TYPE_IN_USE: active rooms still reference the type. CONCURRENT_MODIFICATION: retry.'
      : 'ROOM_NUMBER_EXISTS: number already used in this hotel (including inactive rooms). ROOM_TYPE_INACTIVE: selected type inactive. ROOM_REFERENCE_CONFLICT: related record unavailable. CONCURRENT_MODIFICATION: retry.';
  const success = (action: string) => ({
    description: 'Success',
    content: json(envelope(ref(name)), {
      success: true,
      message: `${label} ${action}`,
      data: example,
    }),
  });
  const security = [{ bearerAuth: [] }];
  const deactivation =
    name === 'RoomType'
      ? 'Sets isActive=false. Returns 409 while active rooms reference the type. Inactive room references and all history remain. Repeating succeeds.'
      : 'Sets isActive=false and retains the record and references. Repeating succeeds. Physical/housekeeping status is unchanged. Changes reducing sellable capacity (deactivation, room type reassignment or physical unavailability) return ROOM_INVENTORY_CONFLICT (409) if any current/future night would fall below confirmed/checked-in reservation demand. Uses the same hotel lock as booking/cancellation. Stay and physical room assignment workflows are not implemented.';
  return {
    collection: {
      get: {
        tags: [tag],
        summary: `List ${tag.toLowerCase()}`,
        security,
        description: readPolicy,
        parameters: parameters(query),
        responses: {
          ...errors,
          200: {
            description: 'Bounded page with a consistent total; sort ties use ascending ID.',
            content: json(
              envelope({
                type: 'object',
                required: ['items', 'pagination'],
                properties: {
                  items: { type: 'array', items: ref(name) },
                  pagination: ref('Pagination'),
                },
              }),
              {
                success: true,
                message: `${label}s retrieved`,
                data: {
                  items: [example],
                  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
                },
              },
            ),
          },
        },
      },
      post: {
        tags: [tag],
        summary: `Create ${name}`,
        security,
        description: writePolicy,
        parameters: [csrf],
        requestBody: {
          required: true,
          content: json(
            ref(`Create${name}`),
            name === 'RoomType'
              ? {
                  code: 'DLX',
                  name: 'Deluxe',
                  maxAdults: 2,
                  maxChildren: 1,
                  basePrice: '900000.00',
                }
              : {
                  roomNumber: '301',
                  floorNumber: 3,
                  roomTypeId: '3',
                  physicalStatus: 'ACTIVE',
                  housekeepingStatus: 'READY',
                  notes: 'Near elevator',
                },
          ),
        },
        responses: {
          ...errors,
          201: { ...success('created'), description: 'Created' },
          400: error('Malformed JSON'),
          413: error('Body too large'),
          404: error('Hotel or selected room type not found in the current hotel'),
          409: error(conflicts),
        },
      },
    },
    item: {
      get: {
        tags: [tag],
        summary: `Get ${name}`,
        security,
        description: readPolicy,
        parameters: [idParam],
        responses: {
          ...errors,
          200: success('retrieved'),
          404: error('Not found; identical response for an ID outside the current hotel'),
        },
      },
      patch: {
        tags: [tag],
        summary: `Update ${name}`,
        security,
        description: `${writePolicy} ${deactivation}`,
        parameters: [idParam, csrf],
        requestBody: {
          required: true,
          content: json(
            ref(`Update${name}`),
            name === 'RoomType' ? { basePrice: '950000.00' } : { housekeepingStatus: 'READY' },
          ),
        },
        responses: {
          ...errors,
          200: success('updated'),
          400: error('Malformed JSON'),
          413: error('Body too large'),
          404: error('Record or selected room type not found in the current hotel'),
          409: error(conflicts),
        },
      },
      delete: {
        tags: [tag],
        summary: `Deactivate ${name} (record retained)`,
        security,
        description: `${writePolicy} ${deactivation}`,
        parameters: [idParam, csrf],
        responses: {
          ...errors,
          200: {
            description: 'Deactivated; data.isActive is false and record is retained',
            content: json(envelope(ref(name)), {
              success: true,
              message: `${label} deactivated; record retained`,
              data: { ...example, isActive: false },
            }),
          },
          404: error('Record not found in the current hotel'),
          409: error(conflicts),
        },
      },
    },
  };
}
const types = operations('RoomType', 'Room Types', roomTypeListQuery, typeExample);
const rooms = operations('Room', 'Rooms', roomListQuery, roomExample);
export const roomPaths = {
  '/room-types': types.collection,
  '/room-types/{id}': types.item,
  '/rooms': rooms.collection,
  '/rooms/{id}': rooms.item,
};
