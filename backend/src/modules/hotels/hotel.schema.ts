import { day } from './subscription-day.js';
import { monthlyPeriodBody } from './subscription.schema.js';
import { z } from 'zod';
import {
  emptyQuery,
  idParams,
  idSchema,
  paginationFields,
  priceSchema,
} from '../../shared/validation/room-input.js';
import { usernameSchema } from '../auth/auth.schema.js';

const name = z.string().trim().min(1).max(191);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const hotelTimezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Use a valid IANA timezone');
const email = z.string().trim().toLowerCase().pipe(z.email().max(191));
export const hotelProfileBody = z
  .object({
    name,
    contactEmail: email.nullable().optional(),
    contactPhone: optionalText(30),
    address: optionalText(10000),
  })
  .strict();
export const hotelPlatformBody = hotelProfileBody
  .extend({
    timezone: hotelTimezone,
    agreementReference: optionalText(191),
  })
  .strict();
export const hotelAdminBody = z
  .object({ fullName: name, username: usernameSchema, email })
  .strict();
export const initialPeriodBody = z
  .object({
    planName: z.string().trim().min(1).max(100),
    startsOn: day,
    endsOn: day,
    feeAmount: priceSchema,
    agreementReference: optionalText(191),
    paymentReference: optionalText(191),
    notes: optionalText(10000),
  })
  .strict()
  .refine((value) => value.startsOn <= value.endsOn, {
    path: ['endsOn'],
    message: 'End date must not precede start date',
  });
export const hotelCreateBody = hotelPlatformBody
  .extend({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(50)
      .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
    admin: hotelAdminBody,
    subscription: z.union([monthlyPeriodBody, initialPeriodBody]),
  })
  .strict();
export const hotelUpdateBody = hotelPlatformBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');
export const hotelOwnUpdateBody = hotelProfileBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');
export const hotelListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: paginationFields.search,
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    subscriptionStatus: z
      .enum(['ACTIVE', 'EXPIRING', 'EXPIRED', 'UPCOMING', 'UNCONFIGURED'])
      .optional(),
  })
  .strict();
export const createHotelSchema = z.object({ body: hotelCreateBody, query: emptyQuery });
export const listHotelSchema = z.object({ query: hotelListQuery });
export const getHotelSchema = z.object({ params: idParams, query: emptyQuery });
export const updateHotelSchema = z.object({
  params: idParams,
  query: emptyQuery,
  body: hotelUpdateBody,
});
export const createHotelAdminSchema = z.object({
  params: idParams,
  query: emptyQuery,
  body: hotelAdminBody,
});
export const resetHotelAdminSchema = z.object({
  params: z.object({ id: idSchema, staffId: idSchema }).strict(),
  query: emptyQuery,
  body: z.object({ reason: z.string().trim().min(1).max(2000) }).strict(),
});
export const ownHotelSchema = z.object({ query: emptyQuery });
export const updateOwnHotelSchema = z.object({ query: emptyQuery, body: hotelOwnUpdateBody });
export type CreateHotelInput = z.infer<typeof hotelCreateBody>;
export type UpdateHotelInput = z.infer<typeof hotelUpdateBody>;
export type CreateHotelAdminInput = z.infer<typeof hotelAdminBody>;
export type HotelListQuery = z.infer<typeof hotelListQuery>;
