const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const text = { type: 'string' },
  id = { ...text, pattern: '^[1-9][0-9]*$' },
  decimal = { ...text, pattern: '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$' },
  time = { ...text, format: 'date-time' };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const array = (items: object) => ({ type: 'array', items });
const nullable = (schema: object) => ({ ...schema, nullable: true });
const actor = obj({ id, fullName: text });
const materialType = { ...text, enum: ['CONSUMABLE', 'REUSABLE', 'UNCLASSIFIED'] };
const usageBasis = {
  ...text,
  enum: ['PER_GUEST', 'PER_ROOM'],
  description:
    'Quantity for one guest, or for one whole room. Legacy quantities default to PER_ROOM.',
};
const roomType = obj({
  id,
  code: text,
  name: text,
  maxAdults: { type: 'integer', minimum: 1 },
  maxChildren: { type: 'integer', minimum: 0 },
});
const materialInput = obj(
  {
    itemId: id,
    quantity: { ...decimal, description: 'Positive decimal quantity, at most 2 fractional digits' },
  },
  ['itemId', 'quantity'],
);
const paymentInput = obj(
  {
    requestKey: { ...text, format: 'uuid' },
    amount: decimal,
    paymentMethod: { ...text, enum: ['CASH', 'BANK_TRANSFER'] },
    paidAt: time,
    referenceNumber: { ...text, maxLength: 100 },
    notes: { ...text, maxLength: 2000 },
  },
  ['requestKey', 'amount', 'paymentMethod', 'paidAt'],
);
const materialItem = obj({
  id,
  code: text,
  name: text,
  unit: text,
  currentStock: decimal,
  isActive: { type: 'boolean' },
  materialType,
  description: nullable(text),
});
const materialView = obj({ itemId: id, quantity: decimal, item: materialItem });
const presetView = obj({ itemId: id, quantity: decimal, usageBasis, item: materialItem });
const presetInput = obj({ ...materialInput.properties, usageBasis }, ['itemId', 'quantity']);
export const supplySchemas = {
  MaterialType: materialType,
  HousekeepingMaterialPresetInput: obj({ materials: { ...array(presetInput), maxItems: 100 } }, [
    'materials',
  ]),
  HousekeepingMaterialPreset: obj({
    roomTypeId: id,
    roomType,
    reusableItems: array(materialItem),
    materials: array(presetView),
  }),
  CompleteCleaningMaterials: obj(
    {
      workToken: { ...text, format: 'uuid' },
      materials: { ...array(materialInput), maxItems: 100 },
      noMaterialsReason: { ...text, minLength: 1, maxLength: 2000 },
      notes: { ...text, maxLength: 2000 },
      preparedAdults: { type: 'integer', minimum: 1, maximum: 100 },
      preparedChildren: { type: 'integer', minimum: 0, maximum: 100 },
    },
    ['workToken', 'materials'],
  ),
  TaskMaterials: obj({
    taskId: id,
    roomTypeId: id,
    roomType,
    reusableItems: array(materialItem),
    preparation: obj({
      adults: { type: 'integer', minimum: 1 },
      children: { type: 'integer', minimum: 0 },
      source: { ...text, enum: ['ROOM_TYPE_STANDARD'] },
    }),
    workToken: nullable({ ...text, format: 'uuid' }),
    materials: array(obj({ ...presetView.properties, presetQuantity: decimal })),
    history: array(
      obj({
        id,
        createdAt: time,
        actor,
        noMaterialsReason: nullable(text),
        preparedAdults: nullable({ type: 'integer', minimum: 1 }),
        preparedChildren: nullable({ type: 'integer', minimum: 0 }),
        stockIssueId: nullable(id),
        issueNumber: nullable(text),
        materials: array(materialView),
      }),
    ),
  }),
  SupplierPaymentInput: paymentInput,
  ReceiptReconciliation: obj(
    { reason: { ...text, minLength: 1, maxLength: 2000 }, payment: paymentInput },
    ['reason'],
  ),
  SupplierPaymentReversalInput: obj({ reason: { ...text, minLength: 1, maxLength: 2000 } }, [
    'reason',
  ]),
  SupplierSettlement: obj({
    receiptId: id,
    receiptNumber: text,
    totalAmount: decimal,
    paymentTracking: { ...text, enum: ['TRACKED', 'UNRECONCILED'] },
    reconciledAt: nullable(time),
    reconciliationReason: nullable(text),
    supplier: nullable(obj({ id, name: text })),
    paidAmount: decimal,
    outstandingAmount: nullable(decimal),
    status: { ...text, enum: ['UNRECONCILED', 'UNPAID', 'PARTIAL', 'PAID'] },
    payments: array(
      obj({
        id,
        amount: decimal,
        paymentMethod: { ...text, enum: ['CASH', 'BANK_TRANSFER'] },
        paidAt: time,
        referenceNumber: nullable(text),
        notes: nullable(text),
        actor,
        reversal: nullable(obj({ reason: text, reversedAt: time, actor })),
      }),
    ),
  }),
  SupplierFinanceReport: obj({
    timezone: text,
    startDate: text,
    endDate: text,
    cutoffExclusive: time,
    paidOut: decimal,
    reversedAmount: decimal,
    netPaidOut: text,
    outstandingAmount: decimal,
    unreconciledValue: decimal,
    unreconciledCount: { type: 'integer' },
    items: array(
      obj({
        id,
        receiptNumber: text,
        receiptDate: time,
        supplierName: nullable(text),
        totalAmount: decimal,
        outstandingAmount: nullable(decimal),
        paymentTracking: text,
      }),
    ),
    pagination: obj({
      total: { type: 'integer' },
      page: { type: 'integer' },
      limit: { type: 'integer' },
    }),
  }),
};
function operation(
  summary: string,
  output: string,
  roles: string[],
  body?: string,
  finance = false,
) {
  return {
    tags: [finance ? 'Reports' : 'Inventory'],
    summary,
    description: `Current hotel only. Roles: ${roles.join(', ')}. Decimal strings retain exact database precision. Writes are serialized with the shared hotel lock. Confirmed supplier payments affect cash by paidAt; reversals affect cash by reversedAt. Purchase receipt dates do not imply payment.`,
    security: [{ bearerAuth: [] }],
    'x-required-roles': roles,
    parameters: finance
      ? [
          ...['startDate', 'endDate'].map((name) => ({
            name,
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          })),
          {
            name: 'groupBy',
            in: 'query',
            schema: { type: 'string', enum: ['day', 'month'], default: 'day' },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ]
      : [
          { name: 'id', in: 'path', required: true, schema: id },
          ...(body
            ? [
                {
                  name: 'X-CSRF-Protection',
                  in: 'header',
                  required: true,
                  schema: { type: 'string', enum: ['1'] },
                },
              ]
            : []),
        ],
    ...(body
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(body) } } } }
      : {}),
    responses: {
      [output === 'SupplierSettlement' && body === 'SupplierPaymentInput' ? 201 : 200]: {
        description: 'Success',
        content: {
          'application/json': { schema: obj({ success: { type: 'boolean' }, data: ref(output) }) },
        },
      },
      ...Object.fromEntries(
        [401, 403, 404, 409, 422, 500].map((status) => [
          status,
          {
            description: 'Authentication, permissions, validation or transactional conflict',
            content: { 'application/json': { schema: ref('Error') } },
          },
        ]),
      ),
    },
  };
}
const financeRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];
export const supplyPaths = {
  '/room-types/{id}/housekeeping-materials': {
    get: operation('Read consumable suggestions per room type', 'HousekeepingMaterialPreset', [
      'ADMIN',
      'MANAGER',
      'HOUSEKEEPING',
    ]),
    put: operation(
      'Replace suggestions; unique active consumables in the current hotel',
      'HousekeepingMaterialPreset',
      ['ADMIN', 'MANAGER'],
      'HousekeepingMaterialPresetInput',
    ),
  },
  '/inventory/receipts/{id}/settlement': {
    get: operation(
      'Read supplier settlement; unreconciled receipt balance remains unknown',
      'SupplierSettlement',
      financeRoles,
    ),
  },
  '/inventory/receipts/{id}/payments': {
    post: operation(
      'Confirm a supplier payment; requestKey is idempotent and overpayment is rejected',
      'SupplierSettlement',
      financeRoles,
      'SupplierPaymentInput',
    ),
  },
  '/inventory/receipts/{id}/reconcile': {
    post: operation(
      'Explicitly reconcile legacy payments; optional verified historical payment is posted atomically',
      'SupplierSettlement',
      financeRoles,
      'ReceiptReconciliation',
    ),
  },
  '/inventory/supplier-payments/{id}/reverse': {
    post: operation(
      'Reverse an incorrect payment without deleting history; reversal is dated now',
      'SupplierSettlement',
      financeRoles,
      'SupplierPaymentReversalInput',
    ),
  },
  '/reports/supplier-finance': {
    get: operation(
      'Supplier disbursements in period; cumulative confirmed liabilities and unknown legacy receipts at cutoff',
      'SupplierFinanceReport',
      financeRoles,
      undefined,
      true,
    ),
  },
};
