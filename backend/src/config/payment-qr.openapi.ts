const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: object, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const id = { type: 'string', pattern: '^[1-9][0-9]*$' };
const text = { type: 'string' };
const nullableId = { ...id, nullable: true };
const money = { type: 'string', pattern: '^[1-9][0-9]{0,12}(\\.0{1,2})?$', example: '300000.00' };
const accountFields = {
  bankBin: { type: 'string', pattern: '^[0-9]{6}$' },
  bankName: text,
  accountNumber: { type: 'string', pattern: '^[0-9]{6,19}$' },
  accountName: { type: 'string', minLength: 5, maxLength: 50 },
  enabled: { type: 'boolean' },
};
const requestFields = {
  id,
  reservationId: id,
  folioId: nullableId,
  paymentId: nullableId,
  paymentType: { type: 'string', enum: ['DEPOSIT', 'PAYMENT'] },
  amount: money,
  memo: { type: 'string', pattern: '^INN[A-F0-9]{16}$' },
  status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'CANCELLED'] },
  bankBin: accountFields.bankBin,
  bankName: text,
  accountNumber: accountFields.accountNumber,
  accountName: accountFields.accountName,
  cancelledReason: { ...text, nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  confirmedAt: { type: 'string', format: 'date-time', nullable: true },
};
export const paymentQrSchemas = {
  QrBankAccount: {
    ...object({
      ...accountFields,
      version: { type: 'integer' },
      updatedAt: { type: 'string', format: 'date-time' },
    }),
    nullable: true,
  },
  QrBankAccountInput: object({
    bankBin: accountFields.bankBin,
    accountNumber: accountFields.accountNumber,
    accountName: accountFields.accountName,
    enabled: accountFields.enabled,
    expectedVersion: {
      type: 'integer',
      minimum: 0,
      description:
        '0 for first setup; current version for updates. Updates cancel pending QR requests.',
    },
  }),
  QrCollectionInput: object({ amount: money, paymentType: requestFields.paymentType }),
  QrRequest: object(requestFields),
  QrRequestDetail: object({
    ...requestFields,
    qrCode: { ...text, nullable: true },
    qrDataURL: { ...text, nullable: true },
    canConfirm: { type: 'boolean' },
    invalidReason: { ...text, nullable: true },
  }),
  QrConfirmInput: object({
    referenceNumber: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Actual incoming bank transaction reference, separate from QR memo.',
    },
    confirmedReceived: { type: 'boolean', enum: [true] },
  }),
  QrCancelInput: object({ reason: { type: 'string', minLength: 1, maxLength: 2000 } }),
};
const csrf = {
  in: 'header',
  name: 'X-CSRF-Protection',
  required: true,
  schema: { type: 'string', enum: ['1'] },
};
const key = {
  in: 'header',
  name: 'Idempotency-Key',
  required: true,
  schema: { type: 'string', minLength: 8, maxLength: 128 },
};
const pathId = { in: 'path', name: 'id', required: true, schema: id };
const json = (schema: object) => ({ 'application/json': { schema } });
function operation(
  summary: string,
  response: object,
  options: { body?: object; path?: boolean; key?: boolean; created?: boolean; list?: boolean } = {},
) {
  return {
    tags: ['Payment QR'],
    summary,
    security: [{ bearerAuth: [] }],
    description:
      'Hotel-scoped. ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT; bank-account updates require ADMIN. QR is not proof of payment. No webhook or bank transfer is initiated.',
    parameters: [
      ...(options.path ? [pathId] : []),
      ...(options.body ? [csrf] : []),
      ...(options.key ? [key] : []),
      ...(options.list
        ? [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
            {
              in: 'query',
              name: 'limit',
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            },
          ]
        : []),
    ],
    ...(options.body ? { requestBody: { required: true, content: json(options.body) } } : {}),
    responses: {
      [options.created ? 201 : 200]: {
        description: 'Success',
        content: json(object({ success: { type: 'boolean' }, data: response })),
      },
      401: { description: 'Authentication required' },
      403: { description: 'Role or CSRF rejected' },
      404: { description: 'Target not in current hotel' },
      409: {
        description:
          'Changed balance, closed folio, pending/cancelled QR, stale configuration or idempotency conflict',
      },
      422: { description: 'Invalid input or missing idempotency key' },
      503: { description: 'QR rendering unavailable; retry the saved request' },
    },
  };
}
export const paymentQrPaths = {
  '/hotel/banks': {
    get: operation(
      'List supported banks (daily cache, offline snapshot fallback)',
      object({
        banks: {
          type: 'array',
          items: object({ bin: text, code: text, name: text, shortName: text }),
        },
        source: text,
        refreshedAt: { type: 'integer' },
      }),
    ),
  },
  '/hotel/bank-account': {
    get: operation('Get own hotel receiving account or null', ref('QrBankAccount')),
    put: operation(
      'ADMIN: configure receiving account and cancel pending QR requests',
      ref('QrBankAccount'),
      { body: ref('QrBankAccountInput') },
    ),
  },
  '/reservations/{id}/payment-requests': {
    get: operation(
      'List QR request history for a reservation',
      object({
        items: { type: 'array', items: ref('QrRequest') },
        pagination: object({
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        }),
      }),
      { path: true, list: true },
    ),
    post: operation(
      'Create or resume pending QR request without posting money or opening folio',
      ref('QrRequest'),
      { path: true, key: true, created: true, body: ref('QrCollectionInput') },
    ),
  },
  '/payment-requests/{id}': {
    get: operation('Get current request and offline PNG QR when eligible', ref('QrRequestDetail'), {
      path: true,
    }),
  },
  '/payment-requests/{id}/confirm': {
    post: operation(
      'Confirm actual receipt; open/reuse folio and post once atomically',
      ref('QrRequest'),
      { path: true, key: true, body: ref('QrConfirmInput') },
    ),
  },
  '/payment-requests/{id}/cancel': {
    post: operation(
      'Cancel request; does not refund money or revoke saved bank QR',
      ref('QrRequest'),
      { path: true, key: true, body: ref('QrCancelInput') },
    ),
  },
};
