const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: 'string', pattern: '^[1-9][0-9]{0,19}$' };
const decimal = { type: 'string', pattern: '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$' };
const text = (maxLength: number) => ({ type: 'string', maxLength });
const plan = {
  code: text(50),
  name: text(100),
  description: { ...text(10000), nullable: true },
  monthlyPrice: decimal,
  roomLimit: { type: 'integer', minimum: 1, maximum: 100000 },
  staffLimit: { type: 'integer', minimum: 1, maximum: 100000 },
  isActive: { type: 'boolean' },
};
export const subscriptionSchemas = {
  SubscriptionPlanInput: {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'name', 'monthlyPrice', 'roomLimit', 'staffLimit', 'isActive'],
    properties: plan,
  },
  SubscriptionPlanUpdate: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'code')),
  },
  SubscriptionPlan: {
    type: 'object',
    properties: { id, ...plan, createdAt: { type: 'string', format: 'date-time' } },
  },
  MonthlyHotelPeriod: {
    type: 'object',
    additionalProperties: false,
    required: ['planId', 'startsOn', 'monthCount', 'reason'],
    properties: {
      planId: id,
      startsOn: {
        type: 'string',
        format: 'date',
        description:
          'Today or later in hotel timezone. Must not overlap any recorded period. New plan becomes effective on this date.',
      },
      monthCount: { type: 'integer', minimum: 1, maximum: 120 },
      reason: { ...text(2000), minLength: 1 },
      agreementReference: { ...text(191), nullable: true },
      paymentReference: { ...text(191), nullable: true },
      notes: { ...text(10000), nullable: true },
    },
  },
  HotelSubscriptionSummary: {
    type: 'object',
    properties: {
      id,
      today: { type: 'string', format: 'date' },
      hotelStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
      timezone: text(64),
      suspensionReason: { ...text(2000), nullable: true },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'EXPIRING', 'EXPIRED', 'UPCOMING', 'UNCONFIGURED'],
      },
      daysRemaining: { type: 'integer', nullable: true },
      alert: {
        type: 'string',
        nullable: true,
        enum: ['FOURTEEN_DAYS', 'SEVEN_DAYS', 'ONE_DAY', 'OVERDUE', 'FOLLOW_UP', null],
      },
      current: { ...ref('HotelPeriod'), nullable: true },
      upcoming: { ...ref('HotelPeriod'), nullable: true },
      history: { type: 'array', maxItems: 100, items: ref('HotelPeriod') },
      nextStartsOn: { type: 'string', format: 'date' },
      usage: {
        type: 'object',
        properties: {
          rooms: { type: 'integer' },
          staff: { type: 'integer' },
          roomLimit: { type: 'integer', nullable: true },
          staffLimit: { type: 'integer', nullable: true },
        },
      },
    },
  },
};
function operation(
  summary: string,
  output: object,
  input?: object,
  hotel = false,
  hasId = false,
  created = false,
) {
  const envelope = { type: 'object', properties: { success: { type: 'boolean' }, data: output } };
  const error = (description: string) => ({
    description,
    content: { 'application/json': { schema: ref('Error') } },
  });
  return {
    tags: [hotel ? 'Hotel Profile' : 'Platform Hotels'],
    summary,
    security: [{ [hotel ? 'bearerAuth' : 'platformBearerAuth']: [] }],
    parameters: [
      ...(hasId ? [{ name: 'id', in: 'path', required: true, schema: id }] : []),
      ...(input
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
    ...(input
      ? { requestBody: { required: true, content: { 'application/json': { schema: input } } } }
      : {}),
    responses: {
      [created ? 201 : 200]: {
        description: 'Success',
        content: { 'application/json': { schema: envelope } },
      },
      401: error('Invalid or wrong-realm credentials'),
      403: error('Role, password-change or CSRF rejected'),
      404: error('Hotel/plan not found'),
      409: error(
        'Duplicate, overlap, unavailable plan, limits, unchanged status or concurrency conflict',
      ),
      422: error('Invalid input, past start date or fee overflow'),
      500: error('Internal server error'),
    },
  };
}
export const subscriptionPaths = {
  '/platform/plans': {
    get: operation('List monthly plans (platform only)', {
      type: 'array',
      items: ref('SubscriptionPlan'),
    }),
    post: operation(
      'Create monthly plan with catalog audit',
      ref('SubscriptionPlan'),
      ref('SubscriptionPlanInput'),
      false,
      false,
      true,
    ),
  },
  '/platform/plans/{id}': {
    patch: operation(
      'Update catalog; existing period snapshots stay unchanged',
      ref('SubscriptionPlan'),
      ref('SubscriptionPlanUpdate'),
      false,
      true,
    ),
  },
  '/platform/hotels/{id}/subscription': {
    get: operation(
      'Read service periods, alerts and active usage',
      ref('HotelSubscriptionSummary'),
      undefined,
      false,
      true,
    ),
  },
  '/platform/hotels/{id}/subscription-periods': {
    post: operation(
      'Assign/renew/change plan for a non-overlapping period; does not reactivate suspended hotels',
      ref('HotelPeriod'),
      ref('MonthlyHotelPeriod'),
      false,
      true,
      true,
    ),
  },
  '/platform/hotels/{id}/status': {
    patch: operation(
      'Manually suspend/reactivate with mandatory reason and audit; overdue never auto-suspends',
      {
        type: 'object',
        properties: {
          id,
          status: { type: 'string' },
          suspendedAt: { type: 'string', format: 'date-time', nullable: true },
          suspensionReason: { ...text(2000), nullable: true },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'reason'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
          reason: { ...text(2000), minLength: 1 },
        },
      },
      false,
      true,
    ),
  },
  '/hotel/subscription': {
    get: operation(
      'Read own subscription (ADMIN/MANAGER); available while suspended after password change',
      ref('HotelSubscriptionSummary'),
      undefined,
      true,
    ),
  },
};
