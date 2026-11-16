import { z } from 'zod';
import { idSchema, priceSchema } from '../../shared/validation/room-input.js';

export const quantity = priceSchema.refine((v) => Number(v) > 0, 'Quantity must be positive');
export const materialLine = z.object({ itemId: idSchema, quantity }).strict();
export const presetLine = materialLine
  .extend({ usageBasis: z.enum(['PER_GUEST', 'PER_ROOM']).default('PER_ROOM') })
  .strict();
export const materialPresetBody = z.object({ materials: z.array(presetLine).max(100) }).strict();
export const completeMaterialsBody = z
  .object({
    workToken: z.string().uuid(),
    materials: z.array(materialLine).max(100),
    noMaterialsReason: z.string().trim().min(1).max(2000).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
    preparedAdults: z.number().int().min(1).max(100).optional(),
    preparedChildren: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((v) => (v.preparedAdults == null) === (v.preparedChildren == null), {
    message: 'Provide both preparation guest counts',
    path: ['preparedAdults'],
  })
  .refine((v) => v.materials.length > 0 || !!v.noMaterialsReason, {
    message: 'Confirm why no consumable materials were used',
    path: ['noMaterialsReason'],
  });
export const supplierPaymentBody = z
  .object({
    requestKey: z.string().uuid(),
    amount: quantity,
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
    paidAt: z.string().datetime({ offset: true }),
    referenceNumber: z.string().trim().min(1).max(100).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((v) => v.paymentMethod !== 'BANK_TRANSFER' || !!v.referenceNumber, {
    message: 'Bank transfer reference is required',
    path: ['referenceNumber'],
  });
export const reconciliationBody = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
export const reconcileReceiptBody = reconciliationBody
  .extend({ payment: supplierPaymentBody.optional() })
  .strict();
export type CompleteMaterialsInput = z.infer<typeof completeMaterialsBody>;
export type SupplierPaymentInput = z.infer<typeof supplierPaymentBody>;
