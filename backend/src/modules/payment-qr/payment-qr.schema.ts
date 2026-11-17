import { z } from 'zod';
import { positiveMoney } from '../billing/billing.schema.js';

export const accountName = z
  .string()
  .trim()
  .transform((value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'D')
      .toUpperCase()
      .replace(/\s+/g, ' '),
  )
  .pipe(z.string().regex(/^[A-Z ]{5,50}$/, 'Tên chủ tài khoản cần 5–50 chữ cái không dấu'));
export const bankAccountBody = z
  .object({
    bankBin: z.string().regex(/^\d{6}$/),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,19}$/),
    accountName,
    enabled: z.boolean(),
    expectedVersion: z.number().int().nonnegative().max(4294967294),
  })
  .strict();
export const qrRequestBody = z
  .object({
    amount: positiveMoney.refine(
      (value) => value.split('.')[0]!.length <= 13,
      'QR hỗ trợ tối đa 13 chữ số',
    ),
    paymentType: z.enum(['DEPOSIT', 'PAYMENT']),
  })
  .strict();
export const confirmQrBody = z
  .object({
    referenceNumber: z.string().trim().min(1).max(100),
    confirmedReceived: z.literal(true),
  })
  .strict();
export const cancelQrBody = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
export type BankAccountInput = z.infer<typeof bankAccountBody>;
export type QrRequestInput = z.infer<typeof qrRequestBody>;
export type ConfirmQrInput = z.infer<typeof confirmQrBody>;
