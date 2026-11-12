import { z } from 'zod';
import { emptyQuery, idParams, idSchema, priceSchema } from '../../shared/validation/room-input.js';
import { day } from './subscription-day.js';
const text = (max: number) => z.string().trim().max(max).nullable().optional();
export const planBody = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,49}$/),
    name: z.string().trim().min(1).max(100),
    description: text(10000),
    monthlyPrice: priceSchema,
    roomLimit: z.number().int().min(1).max(100000),
    staffLimit: z.number().int().min(1).max(100000),
    isActive: z.boolean(),
  })
  .strict();
export const monthlyPeriodBody = z
  .object({
    planId: idSchema,
    startsOn: day,
    monthCount: z.number().int().min(1).max(120),
    agreementReference: text(191),
    paymentReference: text(191),
    notes: text(10000),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const createPlanSchema = z.object({ query: emptyQuery, body: planBody });
export const updatePlanSchema = z.object({
  params: idParams,
  query: emptyQuery,
  body: planBody
    .omit({ code: true })
    .partial()
    .refine((v) => Object.keys(v).length > 0),
});
export const recordPeriodSchema = z.object({
  params: idParams,
  query: emptyQuery,
  body: monthlyPeriodBody,
});
export const statusSchema = z.object({
  params: idParams,
  query: emptyQuery,
  body: z
    .object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(1).max(2000) })
    .strict(),
});
export type PlanInput = z.infer<typeof planBody>;
export type MonthlyPeriodInput = z.infer<typeof monthlyPeriodBody>;
