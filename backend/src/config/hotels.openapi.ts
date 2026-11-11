const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const text = (maxLength: number) => ({ type: 'string', maxLength });
const nullableText = (maxLength: number) => ({ ...text(maxLength), nullable: true });
const id = { type: 'string', pattern: '^[1-9][0-9]{0,19}$' };
const dateTime = { type: 'string', format: 'date-time' };
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'] },
};
const parameter = (name: string) => ({ name, in: 'path', required: true, schema: id });
const envelope = (schema: object) => ({
  type: 'object',
  required: ['success', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, data: schema },
});
const result = (schema: object) => ({ description: 'Success', content: json(envelope(schema)) });
const error = (description: string) => ({ description, content: json(ref('Error')) });
const errors = {
  401: error('Invalid, expired or wrong-realm credentials'),
  403: error('Forbidden, password change required, or CSRF rejected'),
  404: error('Hotel or hotel administrator not found'),
  409: error('Duplicate hotel/account, missing role, reference or concurrency conflict'),
  422: error('Invalid or unknown fields'),
  500: error('Internal server error'),
};
const profile = {
  id,
  code: text(50),
  name: text(191),
  timezone: text(64),
  status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
  contactEmail: { type: 'string', format: 'email', nullable: true },
  contactPhone: nullableText(30),
  address: nullableText(10000),
};
const editable = {
  name: text(191),
  contactEmail: { type: 'string', format: 'email', nullable: true },
  contactPhone: nullableText(30),
  address: nullableText(10000),
};
const platformEditable = {
  ...editable,
  timezone: { ...text(64), description: 'Valid IANA timezone' },
  agreementReference: nullableText(191),
};
const adminInput = {
  type: 'object',
  additionalProperties: false,
  required: ['fullName', 'username', 'email'],
  properties: {
    fullName: text(191),
    username: { ...text(64), minLength: 3, pattern: '^[a-zA-Z0-9._-]+$' },
    email: { type: 'string', format: 'email', maxLength: 191 },
  },
};
const period = {
  id,
  planName: text(100),
  startsOn: {
    type: 'string',
    format: 'date',
    description: 'Local calendar date. Responses use UTC midnight ISO datetime.',
  },
  endsOn: {
    type: 'string',
    format: 'date',
    description: 'Inclusive local calendar date. Must be >= startsOn.',
  },
  feeAmount: { type: 'string', pattern: '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$' },
  currency: { type: 'string', enum: ['VND'] },
  agreementReference: nullableText(191),
  paymentReference: nullableText(191),
  notes: nullableText(10000),
  createdAt: dateTime,
};
const issued = {
  type: 'object',
  required: ['admin', 'temporaryPassword'],
  properties: {
    admin: ref('HotelAdministrator'),
    temporaryPassword: {
      type: 'string',
      description:
        'One-time response only. Never persisted in plaintext or returned by list/detail. Missing response requires reset.',
    },
  },
};
const body = (schema: object) => ({ required: true, content: json(schema) });
const operation = (
  summary: string,
  schema: object,
  write = false,
  parameters: object[] = [],
  input?: object,
) => ({
  tags: ['Platform Hotels'],
  summary,
  security: [{ platformBearerAuth: [] }],
  parameters: [...parameters, ...(write ? [csrf] : [])],
  ...(input ? { requestBody: body(input) } : {}),
  responses: { 200: result(schema), ...errors },
});
export const hotelSchemas = {
  HotelProfile: {
    type: 'object',
    required: Object.keys(profile),
    additionalProperties: false,
    properties: profile,
  },
  PlatformHotel: {
    type: 'object',
    required: [...Object.keys(profile), 'agreementReference', 'suspendedAt', 'suspensionReason'],
    properties: {
      ...profile,
      agreementReference: nullableText(191),
      suspendedAt: { ...dateTime, nullable: true },
      suspensionReason: nullableText(2000),
    },
  },
  HotelAdministrator: {
    type: 'object',
    required: [
      'id',
      'fullName',
      'username',
      'email',
      'isActive',
      'mustChangePassword',
      'createdAt',
    ],
    additionalProperties: false,
    properties: {
      id,
      fullName: text(191),
      username: text(64),
      email: { type: 'string', nullable: true },
      isActive: { type: 'boolean' },
      mustChangePassword: { type: 'boolean' },
      createdAt: dateTime,
    },
  },
  HotelAdminInput: adminInput,
  InitialHotelPeriod: {
    type: 'object',
    additionalProperties: false,
    required: ['planName', 'startsOn', 'endsOn', 'feeAmount'],
    properties: Object.fromEntries(
      Object.entries(period).filter(([key]) => !['id', 'currency', 'createdAt'].includes(key)),
    ),
  },
  HotelPeriod: { type: 'object', properties: { ...period, startsOn: dateTime, endsOn: dateTime } },
  PlatformHotelCreate: {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'name', 'timezone', 'admin', 'subscription'],
    properties: {
      ...platformEditable,
      code: { ...text(50), pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' },
      admin: ref('HotelAdminInput'),
      subscription: ref('InitialHotelPeriod'),
    },
  },
  PlatformHotelUpdate: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: platformEditable,
  },
  HotelProfileUpdate: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: editable,
  },
  IssuedHotelCredentials: issued,
  PlatformHotelDetail: {
    allOf: [
      ref('PlatformHotel'),
      {
        type: 'object',
        required: ['staff', 'subscriptionPeriods', 'platformAudits'],
        properties: {
          staff: { type: 'array', items: ref('HotelAdministrator') },
          subscriptionPeriods: { type: 'array', maxItems: 50, items: ref('HotelPeriod') },
          platformAudits: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              properties: {
                id,
                action: { type: 'string' },
                reason: nullableText(2000),
                changes: { type: 'object', nullable: true },
                targetStaffUserId: { ...id, nullable: true },
                subscriptionPeriodId: { ...id, nullable: true },
                createdAt: dateTime,
                actor: { type: 'object', properties: { fullName: text(191) } },
              },
            },
          },
        },
      },
    ],
  },
};
export const hotelPaths = {
  '/platform/hotels': {
    get: operation(
      'List hotels (PLATFORM_ADMIN only)',
      {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('PlatformHotel') },
          pagination: ref('Pagination'),
        },
      },
      false,
      [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        { name: 'search', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] } },
      ],
    ),
    post: {
      ...operation(
        'Atomically create hotel, first ADMIN, initial period and audit (PLATFORM_ADMIN only)',
        { type: 'object' },
        true,
        [],
        ref('PlatformHotelCreate'),
      ),
      responses: {
        201: result({
          type: 'object',
          required: ['hotel', 'admin', 'subscription', 'temporaryPassword'],
          properties: {
            hotel: ref('PlatformHotel'),
            admin: ref('HotelAdministrator'),
            subscription: ref('HotelPeriod'),
            temporaryPassword: issued.properties.temporaryPassword,
          },
        }),
        ...errors,
      },
    },
  },
  '/platform/hotels/{id}': {
    get: operation(
      'Get hotel profile, admins, latest 50 periods/audits (PLATFORM_ADMIN only)',
      ref('PlatformHotelDetail'),
      false,
      [parameter('id')],
    ),
    patch: operation(
      'Update hotel profile with platform audit; code/status remain immutable (PLATFORM_ADMIN only)',
      ref('PlatformHotel'),
      true,
      [parameter('id')],
      ref('PlatformHotelUpdate'),
    ),
  },
  '/platform/hotels/{id}/admins': {
    post: {
      ...operation(
        'Issue another hotel ADMIN with one-time temporary password (PLATFORM_ADMIN only)',
        ref('IssuedHotelCredentials'),
        true,
        [parameter('id')],
        ref('HotelAdminInput'),
      ),
      responses: { 201: result(ref('IssuedHotelCredentials')), ...errors },
    },
  },
  '/platform/hotels/{id}/admins/{staffId}/reset-password': {
    post: operation(
      'Reset a hotel ADMIN, require password change and revoke all their sessions (PLATFORM_ADMIN only)',
      ref('IssuedHotelCredentials'),
      true,
      [parameter('id'), parameter('staffId')],
      {
        type: 'object',
        additionalProperties: false,
        required: ['reason'],
        properties: { reason: { type: 'string', minLength: 1, maxLength: 2000 } },
      },
    ),
  },
  '/hotel': {
    get: {
      ...operation(
        'Get own hotel profile (all staff roles after password change)',
        ref('HotelProfile'),
      ),
      tags: ['Hotel Profile'],
      security: [{ bearerAuth: [] }],
    },
    patch: {
      ...operation(
        'Update own hotel contact/name/address (hotel ADMIN only)',
        ref('HotelProfile'),
        true,
        [],
        ref('HotelProfileUpdate'),
      ),
      tags: ['Hotel Profile'],
      security: [{ bearerAuth: [] }],
    },
  },
  '/auth/change-password': {
    post: {
      ...operation(
        'Change staff password, clear mustChangePassword and revoke all staff sessions',
        { type: 'object' },
        true,
        [],
        ref('PlatformChangePasswordInput'),
      ),
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: result({ type: 'object' }),
        400: error('Current password is incorrect'),
        ...errors,
      },
    },
  },
};
