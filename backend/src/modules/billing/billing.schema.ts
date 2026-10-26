import { z } from 'zod';
import { idSchema, paginationFields } from '../../shared/validation/room-input.js';

// VND inputs are whole dong, serialized with optional zero fractional digits.
export const moneyInput = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,15})(\.0{1,2})?$/,
    'Use a whole VND decimal string, at most 16 integer digits',
  )
  .transform((value) => `${value.split('.')[0]}.00`);
export const positiveMoney = moneyInput.refine(
  (value) => value !== '0.00',
  'Amount must be positive',
);
export const reasonInput = z.string().trim().min(1).max(2000);
export const idempotencyKey = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/,
    'Use 8-128 ASCII letters, digits, dot, underscore, colon or hyphen',
  );
export const createServiceBody = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,39}$/),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(10000).nullable().optional(),
    unit: z.string().trim().min(1).max(30),
    price: moneyInput,
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateServiceBody = createServiceBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');
export const serviceQuery = z
  .object({
    ...paginationFields,
    sortBy: z.enum(['name', 'code', 'price', 'createdAt']).default('name'),
  })
  .strict();
export const createOrderBody = z
  .object({
    reservationId: idSchema,
    stayId: idSchema.optional(),
    items: z
      .array(
        z.object({ serviceId: idSchema, quantity: z.number().int().min(1).max(10000) }).strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.serviceId)).size === items.length,
        'Each service may occur only once',
      ),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export const orderQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    reservationId: idSchema.optional(),
    stayId: idSchema.optional(),
    status: z.enum(['REQUESTED', 'COMPLETED', 'CANCELLED']).optional(),
    search: paginationFields.search,
    sortBy: z.enum(['createdAt', 'id']).default('createdAt'),
    sortOrder: paginationFields.sortOrder,
  })
  .strict();
export const ledgerQuery = z
  .object({ page: paginationFields.page, limit: paginationFields.limit })
  .strict();
export const adjustmentBody = z
  .object({
    entryType: z.enum(['DEBIT', 'CREDIT']),
    amount: positiveMoney,
    reason: reasonInput,
    relatedItemId: idSchema.optional(),
  })
  .strict();
export const paymentBody = z
  .object({
    paymentType: z.enum(['PAYMENT', 'DEPOSIT']),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
    amount: positiveMoney,
    referenceNumber: z.string().trim().min(1).max(100).nullable().optional(),
    // A staff attestation, not a gateway confirmation or a client-controlled status.
    confirmedReceived: z.literal(true),
  })
  .strict()
  .refine(
    (value) => value.paymentMethod !== 'BANK_TRANSFER' || !!value.referenceNumber,
    'Bank transfers require a reference number',
  );
export const refundBody = z
  .object({
    amount: positiveMoney,
    reason: reasonInput,
    confirmedRefunded: z.literal(true),
    referenceNumber: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();
export const cancelOrderBody = z.object({ reason: reasonInput }).strict();
export const emptyBody = z.object({}).strict().default({});
