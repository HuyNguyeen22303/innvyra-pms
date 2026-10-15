import { z } from 'zod';
import {
  emptyQuery,
  idParams,
  idSchema,
  paginationFields,
} from '../../shared/validation/room-input.js';
import { dateOnly } from '../reservations/reservation.dates.js';

const notes = z.string().trim().max(2000).nullable().optional();
export const checkinBody = z.object({ roomId: idSchema, notes }).strict();
export const checkoutBody = z.object({ notes }).strict();
export const transferBody = z
  .object({
    toRoomId: idSchema,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const checkinParams = z
  .object({ reservationId: idSchema, reservationRoomId: idSchema })
  .strict();
export const stayListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    status: z.enum(['CHECKED_IN', 'CHECKED_OUT']).optional(),
    roomId: idSchema.optional(),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    checkInDate: dateOnly.optional(),
    checkOutDate: dateOnly.optional(),
    search: z.string().trim().min(1).max(32).optional(),
    sortBy: z
      .enum(['actualCheckinAt', 'actualCheckoutAt', 'createdAt', 'id'])
      .default('actualCheckinAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export const checkinSchema = z.object({
  params: checkinParams,
  body: checkinBody,
  query: emptyQuery,
});
export const checkoutSchema = z.object({ params: idParams, body: checkoutBody, query: emptyQuery });
export const transferSchema = z.object({ params: idParams, body: transferBody, query: emptyQuery });
export const stayIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listStaysSchema = z.object({ query: stayListQuery });
