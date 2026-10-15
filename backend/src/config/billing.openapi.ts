import { billingPermissions, type BillingPermission } from '../modules/billing/billing.types.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  example: '101',
  description: 'Unsigned BIGINT, maximum 18446744073709551615',
};
const money = {
  type: 'string',
  pattern: '^(0|[1-9][0-9]{0,15})(\\.0{1,2})?$',
  example: '50000.00',
  description:
    'Whole VND Decimal string. Maximum 9999999999999999.00; responses use two decimal places. Positive for receipts/refunds/adjustments.',
};
const total = {
  type: 'string',
  example: '450000.00',
  description: 'Exact Decimal string; negative outstanding is surfaced, never clamped.',
};
const date = { type: 'string', format: 'date-time' };
const reason = { type: 'string', minLength: 1, maxLength: 2000 };
const nullableText = { type: 'string', nullable: true, maxLength: 2000 };
const object = (properties: object, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const serviceFields = {
  code: { type: 'string', pattern: '^[A-Z0-9][A-Z0-9_-]{0,39}$' },
  name: { type: 'string', minLength: 1, maxLength: 150 },
  unit: { type: 'string', minLength: 1, maxLength: 30 },
  price: money,
  description: { type: 'string', nullable: true, maxLength: 10000 },
  isActive: { type: 'boolean' },
};
const orderItem = object({
  id,
  serviceId: id,
  nameSnapshot: { type: 'string' },
  unitSnapshot: { type: 'string' },
  quantity: { type: 'integer' },
  unitPriceSnapshot: money,
  lineTotal: money,
  createdAt: date,
});
const paymentFields = {
  paymentType: { type: 'string', enum: ['PAYMENT', 'DEPOSIT'] },
  paymentMethod: { type: 'string', enum: ['CASH', 'BANK_TRANSFER'] },
  amount: money,
  referenceNumber: { type: 'string', minLength: 1, maxLength: 100, nullable: true },
  confirmedReceived: {
    type: 'boolean',
    enum: [true],
    description:
      'Authorized staff attests money has actually been received. No gateway transfer is initiated.',
  },
};
export const billingSchemas = {
  BillingServiceCreate: object(serviceFields, ['code', 'name', 'unit', 'price']),
  BillingServiceUpdate: { ...object(serviceFields, []), minProperties: 1 },
  BillingService: object({ id, hotelId: id, ...serviceFields, createdAt: date, updatedAt: date }),
  BillingOrderCreate: object(
    {
      reservationId: id,
      stayId: id,
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        description:
          'Unique serviceId values. Server snapshots catalog prices at request creation.',
        items: object({ serviceId: id, quantity: { type: 'integer', minimum: 1, maximum: 10000 } }),
      },
      notes: nullableText,
    },
    ['reservationId', 'items'],
  ),
  BillingOrder: object({
    id,
    reservationId: id,
    stayId: { ...id, nullable: true },
    status: { type: 'string', enum: ['REQUESTED', 'COMPLETED', 'CANCELLED'] },
    notes: nullableText,
    createdBy: id,
    completedBy: { ...id, nullable: true },
    completedAt: { ...date, nullable: true },
    cancelledBy: { ...id, nullable: true },
    cancelledAt: { ...date, nullable: true },
    cancellationReason: nullableText,
    createdAt: date,
    updatedAt: date,
    items: { type: 'array', items: orderItem },
  }),
  BillingFolio: object({
    id,
    reservationId: id,
    currency: { type: 'string', enum: ['VND'] },
    status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
    openedAt: date,
    closedAt: { ...date, nullable: true },
    createdAt: date,
    updatedAt: date,
    totalCharges: total,
    totalCredits: total,
    totalPayments: total,
    totalDeposits: total,
    totalRefunds: total,
    netCharges: total,
    netPaid: total,
    outstandingBalance: total,
  }),
  BillingItem: object({
    id,
    folioId: id,
    entryType: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
    sourceType: { type: 'string', enum: ['ROOM_NIGHT', 'SERVICE_ORDER_ITEM', 'MANUAL_ADJUSTMENT'] },
    sourceId: { ...id, nullable: true },
    amount: money,
    description: reason,
    relatedItemId: { ...id, nullable: true },
    createdBy: id,
    createdAt: date,
  }),
  BillingAdjustment: object(
    {
      entryType: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
      amount: money,
      reason,
      relatedItemId: id,
    },
    ['entryType', 'amount', 'reason'],
  ),
  BillingPaymentCreate: object(paymentFields, [
    'paymentType',
    'paymentMethod',
    'amount',
    'confirmedReceived',
  ]),
  BillingRefundCreate: object(
    {
      amount: money,
      reason,
      confirmedRefunded: {
        type: 'boolean',
        enum: [true],
        description: 'Staff confirms the actual refund has already occurred.',
      },
      referenceNumber: paymentFields.referenceNumber,
    },
    ['amount', 'reason', 'confirmedRefunded'],
  ),
  BillingPayment: object({
    id,
    folioId: id,
    paymentType: { type: 'string', enum: ['PAYMENT', 'DEPOSIT', 'REFUND'] },
    paymentMethod: paymentFields.paymentMethod,
    amount: money,
    status: { type: 'string', enum: ['CONFIRMED', 'PENDING', 'FAILED'] },
    referenceNumber: paymentFields.referenceNumber,
    originalPaymentId: { ...id, nullable: true },
    reason: nullableText,
    processedBy: id,
    processedAt: date,
    createdAt: date,
  }),
};
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const envelope = (data: object) =>
  object({ success: { type: 'boolean', enum: [true] }, message: { type: 'string' }, data });
const page = (schema: string) =>
  object({
    items: { type: 'array', items: ref(schema) },
    pagination: object({
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    }),
  });
const param = (name: string) => ({ name, in: 'path', required: true, schema: id });
const query = (name: string, schema: object) => ({ name, in: 'query', required: false, schema });
const paging = [
  query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }),
  query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
];
const sorting = (fields: string[], defaultField: string) => [
  query('sortBy', { type: 'string', enum: fields, default: defaultField }),
  query('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'asc' }),
];
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const key = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: {
    type: 'string',
    minLength: 8,
    maxLength: 128,
    pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$',
    example: 'billing-receipt-0001',
  },
  description:
    'Unique per hotel across payment, refund and adjustment endpoints. Same normalized payload replays original response, even after closing. Different payload/target/operation returns 409. Keys are retained; use a new key only for a new transaction.',
};
const serviceExample = {
  id: '1',
  hotelId: '1',
  code: 'LAUNDRY',
  name: 'Laundry',
  unit: 'item',
  price: '50000.00',
  description: null,
  isActive: true,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};
const orderExample = {
  id: '1',
  reservationId: '101',
  stayId: '501',
  status: 'REQUESTED',
  notes: null,
  createdBy: '1',
  completedBy: null,
  completedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: serviceExample.createdAt,
  updatedAt: serviceExample.updatedAt,
  items: [
    {
      id: '1',
      serviceId: '1',
      nameSnapshot: 'Laundry',
      unitSnapshot: 'item',
      quantity: 2,
      unitPriceSnapshot: '50000.00',
      lineTotal: '100000.00',
      createdAt: serviceExample.createdAt,
    },
  ],
};
const folioExample = {
  id: '1',
  reservationId: '101',
  currency: 'VND',
  status: 'OPEN',
  openedAt: serviceExample.createdAt,
  closedAt: null,
  createdAt: serviceExample.createdAt,
  updatedAt: serviceExample.updatedAt,
  totalCharges: '1950000.00',
  totalCredits: '0.00',
  totalPayments: '1000000.00',
  totalDeposits: '500000.00',
  totalRefunds: '0.00',
  netCharges: '1950000.00',
  netPaid: '1500000.00',
  outstandingBalance: '450000.00',
};
const itemExample = {
  id: '1',
  folioId: '1',
  entryType: 'CREDIT',
  sourceType: 'MANUAL_ADJUSTMENT',
  sourceId: null,
  amount: '100000.00',
  description: 'Service compensation',
  relatedItemId: null,
  createdBy: '1',
  createdAt: serviceExample.createdAt,
};
const paymentExample = {
  id: '1',
  folioId: '1',
  paymentType: 'PAYMENT',
  paymentMethod: 'CASH',
  amount: '1000000.00',
  status: 'CONFIRMED',
  referenceNumber: null,
  originalPaymentId: null,
  reason: null,
  processedBy: '1',
  processedAt: serviceExample.createdAt,
  createdAt: serviceExample.createdAt,
};
const examples: Record<string, object> = {
  BillingService: serviceExample,
  BillingOrder: orderExample,
  BillingFolio: folioExample,
  BillingItem: itemExample,
  BillingPayment: paymentExample,
};
function operation(
  tag: string,
  summary: string,
  description: string,
  permission: BillingPermission,
  response: string,
  options: {
    mutation?: boolean;
    created?: boolean;
    body?: string | object;
    example?: object;
    params?: string[];
    queries?: object[];
    key?: boolean;
    list?: boolean;
    responseExample?: object;
  } = {},
) {
  const data = options.responseExample ?? examples[response]!;
  return {
    tags: [tag],
    summary,
    description: `${description} Required roles: ${billingPermissions[permission].join(', ')}. Scope comes from the authenticated staff's current hotel. Unknown fields are rejected.`,
    security: [{ bearerAuth: [] }],
    'x-required-roles': billingPermissions[permission],
    parameters: [
      ...(options.params ?? []).map(param),
      ...(options.queries ?? []),
      ...(options.mutation ? [csrf] : []),
      ...(options.key ? [key] : []),
    ],
    ...(options.mutation
      ? {
          requestBody: {
            required: true,
            content: json(
              typeof options.body === 'string' ? ref(options.body) : (options.body ?? object({})),
              options.example ?? {},
            ),
          },
        }
      : {}),
    responses: {
      [options.created ? 201 : 200]: {
        description: 'Success; monetary values are Decimal strings',
        content: json(envelope(options.list ? page(response) : ref(response)), {
          success: true,
          message: summary,
          data: options.list
            ? { items: [data], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
            : data,
        }),
      },
      ...Object.fromEntries(
        Object.entries({
          401: 'UNAUTHORIZED: missing, invalid or revoked authentication',
          403: 'FORBIDDEN: current role or CSRF/origin check denied',
          404: 'Resource not found in current hotel; foreign IDs are indistinguishable',
          409: 'Business conflict: FOLIO_NOT_OPEN, FOLIO_UNSETTLED, FOLIO_PENDING_ACTIVITY, STAYS_NOT_FINISHED, SERVICE_INACTIVE, INVALID_ORDER_STATUS, INSUFFICIENT_OUTSTANDING_BALANCE, REFUND_AMOUNT_EXCEEDED, REFUND_NOT_ALLOWED, IDEMPOTENCY_CONFLICT or FINANCIAL_CONFLICT',
          422: 'VALIDATION_ERROR, INVALID_IDEMPOTENCY_KEY, INVALID_PAYMENT_AMOUNT or REFUND_REFERENCE_REQUIRED',
          500: 'Sanitized internal error; no SQL, credentials or stack traces',
        }).map(([code, description]) => [code, { description, content: json(ref('Error')) }]),
      ),
    },
  };
}
export const billingPaths = {
  '/services': {
    get: operation(
      'Services',
      'List services',
      'Paginated catalog including inactive services unless filtered; search name/code.',
      'read',
      'BillingService',
      {
        list: true,
        queries: [
          ...paging,
          query('search', { type: 'string', maxLength: 100 }),
          query('isActive', { type: 'boolean' }),
          ...sorting(['name', 'code', 'price', 'createdAt'], 'name'),
        ],
      },
    ),
    post: operation(
      'Services',
      'Create service',
      'Create a catalog price in whole VND.',
      'catalog',
      'BillingService',
      {
        mutation: true,
        created: true,
        body: 'BillingServiceCreate',
        example: { code: 'LAUNDRY', name: 'Laundry', unit: 'item', price: '50000.00' },
      },
    ),
  },
  '/services/{id}': {
    get: operation(
      'Services',
      'Get service',
      'Read current catalog details.',
      'read',
      'BillingService',
      { params: ['id'] },
    ),
    patch: operation(
      'Services',
      'Update service',
      'Historical order price/name/unit snapshots remain unchanged.',
      'catalog',
      'BillingService',
      {
        params: ['id'],
        mutation: true,
        body: 'BillingServiceUpdate',
        example: { price: '60000.00' },
      },
    ),
    delete: operation(
      'Services',
      'Deactivate service',
      'Set isActive=false and retain all usage history.',
      'catalog',
      'BillingService',
      { params: ['id'], mutation: true, responseExample: { ...serviceExample, isActive: false } },
    ),
  },
  '/service-orders': {
    get: operation(
      'Service Orders',
      'List service orders',
      'Paginated orders with immutable requested-price snapshots.',
      'read',
      'BillingOrder',
      {
        list: true,
        queries: [
          ...paging,
          query('reservationId', id),
          query('stayId', id),
          query('status', { type: 'string', enum: ['REQUESTED', 'COMPLETED', 'CANCELLED'] }),
          ...sorting(['createdAt', 'id'], 'createdAt'),
        ],
      },
    ),
    post: operation(
      'Service Orders',
      'Request services',
      'Requires at least one active stay; supplied stayId must be active and belong to this reservation. Price is read from the database at creation.',
      'orders',
      'BillingOrder',
      {
        mutation: true,
        created: true,
        body: 'BillingOrderCreate',
        example: { reservationId: '101', stayId: '501', items: [{ serviceId: '1', quantity: 2 }] },
      },
    ),
  },
  '/service-orders/{id}': {
    get: operation(
      'Service Orders',
      'Get service order',
      'Read status, snapshots and staff audit identifiers.',
      'read',
      'BillingOrder',
      { params: ['id'] },
    ),
  },
  '/service-orders/{id}/complete': {
    post: operation(
      'Service Orders',
      'Complete service order',
      'Requires OPEN folio; status transition and all charges commit atomically. Repeating completion returns the existing order. Previously requested services may be completed after physical checkout.',
      'orders',
      'BillingOrder',
      {
        mutation: true,
        params: ['id'],
        responseExample: {
          ...orderExample,
          status: 'COMPLETED',
          completedBy: '1',
          completedAt: serviceExample.createdAt,
        },
      },
    ),
  },
  '/service-orders/{id}/cancel': {
    post: operation(
      'Service Orders',
      'Cancel requested services',
      'Only REQUESTED orders can be cancelled. Completed charges require an authorized adjustment.',
      'orders',
      'BillingOrder',
      {
        mutation: true,
        params: ['id'],
        body: object({ reason }),
        example: { reason: 'Guest withdrew request' },
        responseExample: {
          ...orderExample,
          status: 'CANCELLED',
          cancelledBy: '1',
          cancelledAt: serviceExample.createdAt,
          cancellationReason: 'Guest withdrew request',
        },
      },
    ),
  },
  '/reservations/{reservationId}/folio/open': {
    post: operation(
      'Folios',
      'Open reservation folio',
      'One folio per reservation. Posts every booked night once using nightlyRate snapshot rounded half-up per night to whole VND, retaining originals. Existing folios are returned unchanged. New opening for CANCELLED/NO_SHOW is denied. Contract charges are not daily revenue recognition.',
      'pay',
      'BillingFolio',
      { mutation: true, params: ['reservationId'] },
    ),
  },
  '/reservations/{reservationId}/folio': {
    get: operation(
      'Folios',
      'Get reservation folio',
      'GET never creates financial records. Missing folio returns 404 FOLIO_NOT_FOUND.',
      'read',
      'BillingFolio',
      { params: ['reservationId'] },
    ),
  },
  '/folios/{id}': {
    get: operation(
      'Folios',
      'Get folio balance',
      'Outstanding = debits - credits - confirmed payments - confirmed deposits + confirmed refunds. Pending/failed transactions do not settle debt. Deposits are receipts, not room charges or additional revenue.',
      'read',
      'BillingFolio',
      { params: ['id'] },
    ),
  },
  '/folios/{id}/items': {
    get: operation(
      'Folios',
      'List immutable folio entries',
      'Chronological ledger with source and related item references.',
      'read',
      'BillingItem',
      { params: ['id'], queries: paging, list: true },
    ),
  },
  '/folios/{id}/adjustments': {
    post: operation(
      'Folios',
      'Record folio adjustment',
      'Append-only DEBIT/CREDIT with mandatory reason and staff identity. CREDIT cannot produce negative outstanding; for a paid concession record an approved actual refund first, then a credit. Related item must belong to this folio.',
      'settle',
      'BillingItem',
      {
        params: ['id'],
        mutation: true,
        created: true,
        key: true,
        body: 'BillingAdjustment',
        example: { entryType: 'CREDIT', amount: '100000.00', reason: 'Service compensation' },
      },
    ),
  },
  '/folios/{id}/close': {
    post: operation(
      'Folios',
      'Close settled folio',
      'Balance must equal zero, no requested services/pending payments, and all stays ended or reservation cancelled. CLOSED is final in MVP. Physical checkout does not pay, repost charges or close the folio.',
      'settle',
      'BillingFolio',
      {
        params: ['id'],
        mutation: true,
        responseExample: {
          ...folioExample,
          status: 'CLOSED',
          closedAt: serviceExample.createdAt,
          totalPayments: '1450000.00',
          netPaid: '1950000.00',
          outstandingBalance: '0.00',
        },
      },
    ),
  },
  '/folios/{folioId}/payments': {
    get: operation(
      'Payments',
      'List receipts and refunds',
      'Separate immutable rows, ordered by ID.',
      'read',
      'BillingPayment',
      { params: ['folioId'], queries: paging, list: true },
    ),
    post: operation(
      'Payments',
      'Record actual payment or deposit',
      'Staff must attest actual receipt; BANK_TRANSFER requires referenceNumber. No gateway transfer is initiated. Amount must not exceed current balance. DEPOSIT only before/during stay, and never creates a duplicate credit entry.',
      'pay',
      'BillingPayment',
      {
        params: ['folioId'],
        mutation: true,
        created: true,
        key: true,
        body: 'BillingPaymentCreate',
        example: {
          paymentType: 'PAYMENT',
          paymentMethod: 'CASH',
          amount: '1000000.00',
          confirmedReceived: true,
        },
      },
    ),
  },
  '/payments/{id}/refunds': {
    post: operation(
      'Payments',
      'Record approved actual refund',
      'Manual approval by ADMIN/MANAGER/ACCOUNTANT with reason and actual-refund attestation. Cumulative refunds cannot exceed original confirmed receipt or net money received. Bank refunds require outgoing reference. Refund increases outstanding; it never deletes the original payment, reverses a charge or sends bank funds. CLOSED folios reject new refunds.',
      'settle',
      'BillingPayment',
      {
        params: ['id'],
        mutation: true,
        created: true,
        key: true,
        body: 'BillingRefundCreate',
        example: {
          amount: '200000.00',
          reason: 'Manager approved return of deposit',
          confirmedRefunded: true,
        },
        responseExample: {
          ...paymentExample,
          id: '2',
          paymentType: 'REFUND',
          amount: '200000.00',
          originalPaymentId: '1',
          reason: 'Manager approved return of deposit',
        },
      },
    ),
  },
};
