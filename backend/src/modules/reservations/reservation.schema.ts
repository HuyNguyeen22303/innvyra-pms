import { z } from 'zod';
import { ReservationStatus } from '../../generated/prisma/enums.js';
import {
  emptyQuery,
  idParams,
  idSchema,
  paginationFields,
} from '../../shared/validation/room-input.js';
import { dateOnly } from './reservation.dates.js';

export const BOOKING_SOURCES = ['DIRECT', 'PHONE', 'EMAIL', 'WALK_IN', 'AGENT', 'OTHER'] as const;
const dates = { checkInDate: dateOnly, checkOutDate: dateOnly };
const ordered = (value: { checkInDate: string; checkOutDate: string }) =>
  value.checkOutDate > value.checkInDate;
const rangeError = { path: ['checkOutDate'], message: 'Check-out must be after check-in' };
export const createReservationBody = z
  .object({
    guestId: idSchema,
    ...dates,
    rooms: z
      .array(
        z
          .object({
            roomTypeId: idSchema,
            quantity: z.number().int().min(1).max(100),
            adults: z.number().int().min(1).max(65535),
            children: z.number().int().min(0).max(65535).default(0),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    bookingSource: z.enum(BOOKING_SOURCES).default('DIRECT'),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine(ordered, rangeError)
  .refine(
    (value) => new Set(value.rooms.map((room) => room.roomTypeId)).size === value.rooms.length,
    {
      path: ['rooms'],
      message: 'Each room type must appear once; use quantity for multiple rooms',
    },
  );
const queryInt = (min: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(65535));
export const availabilityQuery = z
  .object({
    ...dates,
    adults: queryInt(1).default(1),
    children: queryInt(0).default(0),
    roomTypeId: idSchema.optional(),
  })
  .strict()
  .refine(ordered, rangeError);
export const reservationListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: z.string().trim().min(1).max(32).optional(),
    guestId: idSchema.optional(),
    guestSearch: z.string().trim().min(1).max(150).optional(),
    status: z.enum(ReservationStatus).optional(),
    checkInDate: dateOnly.optional(),
    checkOutDate: dateOnly.optional(),
    bookingSource: z.enum(BOOKING_SOURCES).optional(),
    sortBy: z
      .enum(['createdAt', 'checkInDate', 'checkOutDate', 'totalAmount', 'confirmationCode'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export const cancelReservationBody = z
  .object({ reason: z.string().trim().min(1).max(2000) })
  .strict();
export const createReservationSchema = z.object({ body: createReservationBody, query: emptyQuery });
export const cancelReservationSchema = z.object({
  body: cancelReservationBody,
  params: idParams,
  query: emptyQuery,
});
export const reservationIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listReservationsSchema = z.object({ query: reservationListQuery });
export const availabilitySchema = z.object({ query: availabilityQuery });
