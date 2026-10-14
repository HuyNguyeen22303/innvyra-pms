import { DOCUMENT_TYPES, GUEST_GENDERS } from '../modules/guests/guest.schema.js';
import { guestPermissions } from '../modules/guests/guest.types.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const error = (description: string) => ({ description, content: json(ref('Error')) });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  description: 'Unsigned BIGINT decimal string, maximum 18446744073709551615',
  example: '42',
};
const timestamp = { type: 'string', format: 'date-time' };
const text = (maxLength: number) => ({ type: 'string', nullable: true, minLength: 1, maxLength });
const fields = {
  fullName: {
    type: 'string',
    minLength: 1,
    maxLength: 150,
    description: 'Required on create; whitespace is collapsed.',
  },
  phone: {
    ...text(30),
    description:
      '3–20 digits; optional leading +, spaces, parentheses, periods and hyphens; separators are removed.',
  },
  email: { ...text(150), format: 'email', description: 'Trimmed and stored lowercase.' },
  dateOfBirth: {
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'Valid YYYY-MM-DD from 1000-01-01 through today in UTC; future dates rejected.',
  },
  gender: { type: 'string', nullable: true, enum: [...GUEST_GENDERS, null] },
  nationality: text(100),
  documentType: {
    type: 'string',
    nullable: true,
    enum: [...DOCUMENT_TYPES, null],
    description: 'Required when a document number is present.',
  },
  documentNumber: {
    ...text(100),
    description:
      'Optional; trimmed and uppercased. Letters/numbers with spaces, periods, slash or hyphen. Encrypted at rest; never returned in lists.',
  },
  address: text(5000),
  notes: text(5000),
};
const example = {
  id: '42',
  fullName: 'Synthetic Guest',
  phone: '+12025550100',
  email: 'guest@example.test',
  nationality: 'VN',
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
};
const detail = {
  ...example,
  dateOfBirth: '1998-05-20',
  gender: 'OTHER',
  documentType: 'PASSPORT',
  documentNumber: 'TEST-PASSPORT-0001',
  address: null,
  notes: null,
};
const minimal = { id: example.id, fullName: example.fullName };
const summaryFields = {
  id,
  fullName: fields.fullName,
  phone: fields.phone,
  email: fields.email,
  nationality: fields.nationality,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const envelope = (data: object, withWarnings = false) => ({
  type: 'object',
  required: ['success', 'message', 'data', ...(withWarnings ? ['warnings'] : [])],
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data,
    ...(withWarnings ? { warnings: { type: 'array', items: ref('GuestDuplicateWarning') } } : {}),
  },
});
export const guestSchemas = {
  CreateGuest: {
    type: 'object',
    additionalProperties: false,
    required: ['fullName'],
    properties: fields,
  },
  UpdateGuest: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: fields,
    description:
      'Only supplied fields change. null explicitly clears nullable fields. IDs, ownership, timestamps and deletedAt cannot be written.',
  },
  GuestMinimal: {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(minimal),
    properties: { id, fullName: fields.fullName },
    example: minimal,
  },
  GuestSummary: {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(example),
    properties: summaryFields,
    example,
  },
  GuestDetail: {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(detail),
    properties: { ...fields, ...summaryFields },
    example: detail,
  },
  GuestDuplicateWarning: {
    type: 'object',
    required: ['code', 'message', 'candidateIds'],
    properties: {
      code: { type: 'string', enum: ['POSSIBLE_DUPLICATE'] },
      message: { type: 'string' },
      candidateIds: {
        type: 'array',
        maxItems: 5,
        items: id,
        description:
          'At most five ACTIVE candidates in the current hotel. Advisory, not proof of identity or a complete count.',
      },
    },
  },
  GuestDeleted: {
    type: 'object',
    required: ['id', 'deletedAt'],
    properties: { id, deletedAt: timestamp },
  },
};
const security = [{ bearerAuth: [] }];
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const idParam = { name: 'id', in: 'path', required: true, schema: id };
const readPolicy = `Roles: ${guestPermissions.read.join(', ')}. Every role, including ADMIN, is scoped to the current hotel from the authenticated session. ACCOUNTANT receives only id/fullName and cannot filter by nationality. HOUSEKEEPING and TECHNICIAN receive 403. Soft-deleted and foreign-hotel IDs have the same 404 as unknown IDs. Cache-Control: no-store.`;
const writePolicy = `Roles: ${guestPermissions.write.join(', ')}. Hotel/actor/role come only from server authentication; ownership fields are rejected. Requires X-CSRF-Protection: 1 and allowlisted browser Origin. Duplicates by exact normalized name, phone, email or document hash/type within this hotel generate a warning, not a rejection or merge. Audit records contain actor, field names and action only. Guest and audit writes commit atomically.`;
const errors = {
  401: error('Missing/invalid token, revoked session or inactive account'),
  403: error('Role, filter, CSRF or Origin denied'),
  422: error('Invalid body/ID/query; VALIDATION_ERROR with path/message details'),
  500: error('Sanitized internal error or protected document cannot be read'),
};
const writeErrors = {
  ...errors,
  400: error('Malformed JSON'),
  413: error('Request exceeds 16kb'),
  409: error(
    'GUEST_DOCUMENT_TYPE_REQUIRED, GUEST_REFERENCE_CONFLICT or CONCURRENT_MODIFICATION (retry)',
  ),
  503: error(
    'GUEST_CRYPTO_UNAVAILABLE: document encryption keys are not configured; no mutation committed',
  ),
};
const response = (data: object, message: string, sample: object, withWarnings = false) => ({
  description: message,
  content: json(envelope(data, withWarnings), {
    success: true,
    message,
    data: sample,
    ...(withWarnings ? { warnings: [] } : {}),
  }),
});
const query = (name: string, schema: object, description: string) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});
const notFound = error(
  'GUEST_NOT_FOUND for missing, deleted and other-hotel IDs; does not reveal foreign records',
);
export const guestPaths = {
  '/guests': {
    get: {
      tags: ['Guests'],
      summary: 'List guests',
      security,
      description: `${readPolicy} Lists omit DOB, gender, documents, address and notes. Stable sorting uses ascending ID for ties. Unknown or repeated query parameters are rejected.`,
      parameters: [
        query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }, 'Page number'),
        query(
          'limit',
          { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          'Bounded page size',
        ),
        query(
          'search',
          { type: 'string', minLength: 1, maxLength: 150 },
          'Contains fullName, using database collation',
        ),
        query('nationality', text(100), 'Exact nationality; not available to ACCOUNTANT'),
        query(
          'status',
          { type: 'string', enum: ['ACTIVE'], default: 'ACTIVE' },
          'Only non-deleted profiles are exposed; deleted-profile browsing is not supported',
        ),
        query(
          'sortBy',
          { type: 'string', enum: ['fullName', 'createdAt'], default: 'fullName' },
          'Sort whitelist',
        ),
        query(
          'sortOrder',
          { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          'Sort direction',
        ),
      ],
      responses: {
        ...errors,
        200: response(
          {
            type: 'object',
            required: ['items', 'pagination'],
            properties: {
              items: {
                type: 'array',
                items: { oneOf: [ref('GuestSummary'), ref('GuestMinimal')] },
              },
              pagination: ref('Pagination'),
            },
          },
          'Guests retrieved',
          { items: [example], pagination: { total: 1, page: 1, limit: 20, totalPages: 1 } },
        ),
      },
    },
    post: {
      tags: ['Guests'],
      summary: 'Create guest',
      security,
      description: writePolicy,
      parameters: [csrf],
      requestBody: {
        required: true,
        content: json(ref('CreateGuest'), {
          fullName: 'Synthetic Guest',
          phone: '+1 (202) 555-0100',
          email: 'guest@example.test',
        }),
      },
      responses: {
        ...writeErrors,
        404: error('Authenticated hotel no longer exists'),
        201: response(ref('GuestDetail'), 'Guest created', detail, true),
      },
    },
  },
  '/guests/{id}': {
    get: {
      tags: ['Guests'],
      summary: 'Get guest details',
      security,
      description: `${readPolicy} ADMIN, MANAGER and RECEPTIONIST may read full operational detail including decrypted document number.`,
      parameters: [idParam],
      responses: {
        ...errors,
        404: notFound,
        503: writeErrors[503],
        200: response(
          { oneOf: [ref('GuestDetail'), ref('GuestMinimal')] },
          'Guest retrieved',
          detail,
        ),
      },
    },
    patch: {
      tags: ['Guests'],
      summary: 'Partially update guest',
      security,
      description: `${writePolicy} Omitted fields are preserved; nullable fields can be cleared. Clearing documentType while retaining a number returns 409. A number change requires an effective documentType.`,
      parameters: [idParam, csrf],
      requestBody: {
        required: true,
        content: json(ref('UpdateGuest'), { notes: 'Prefers a quiet room' }),
      },
      responses: {
        ...writeErrors,
        404: notFound,
        200: response(ref('GuestDetail'), 'Guest updated', detail, true),
      },
    },
    delete: {
      tags: ['Guests'],
      summary: 'Soft delete guest (retain all references)',
      security,
      description:
        'Roles: ADMIN, MANAGER only. Same hotel and CSRF/Origin checks apply. Sets deletedAt; retains the guest row and every reservation/stay/payment reference. No cascade or hard delete. Existing references may continue reading the retained row internally; future booking flows must reject deleted guests. Repeating DELETE, GET detail or PATCH then returns 404. Deleted guests are excluded from lists and duplicate warnings. Reservation/Stay/Payment modules and restoration are outside Phase 3.',
      parameters: [idParam, csrf],
      responses: {
        ...errors,
        404: notFound,
        409: writeErrors[409],
        200: response(ref('GuestDeleted'), 'Guest soft deleted; record retained', {
          id: '42',
          deletedAt: '2026-10-14T00:00:00.000Z',
        }),
      },
    },
  },
};
