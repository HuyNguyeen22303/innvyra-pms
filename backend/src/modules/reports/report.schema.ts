import { z } from 'zod';
import { dateOnly } from '../reservations/reservation.dates.js';
import { idSchema, paginationFields } from '../../shared/validation/room-input.js';

export const reportTypes = ['revenue', 'occupancy', 'reservations', 'payments'] as const;
const period = {
  startDate: dateOnly,
  endDate: dateOnly,
  groupBy: z.enum(['day', 'month']).default('day'),
};
export const periodQuery = z.object(period).strict();
export const occupancyQuery = z.object({ ...period, roomTypeId: idSchema.optional() }).strict();
export const paymentQuery = z
  .object({
    ...period,
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']).optional(),
  })
  .strict();
export const dashboardQuery = z.object({ date: dateOnly.optional() }).strict();
export const exportQuery = z
  .object({
    ...period,
    type: z.enum(reportTypes),
    roomTypeId: idSchema.optional(),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.roomTypeId && value.type !== 'occupancy')
      ctx.addIssue({
        code: 'custom',
        path: ['roomTypeId'],
        message: 'Only occupancy accepts roomTypeId',
      });
    if (value.paymentMethod && value.type !== 'payments')
      ctx.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'Only payments accepts paymentMethod',
      });
  });
export const procurementQuery = z
  .object({
    ...period,
    supplierId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .strict();
export const outstandingQuery = z
  .object({
    startDate: dateOnly,
    endDate: dateOnly,
    page: paginationFields.page,
    limit: paginationFields.limit,
    sortBy: z.enum(['folioId', 'outstandingBalance']).default('outstandingBalance'),
    sortOrder: paginationFields.sortOrder,
  })
  .strict();
export type PeriodQuery = z.infer<typeof periodQuery>;
export type ProcurementQuery = z.infer<typeof procurementQuery>;
export type OccupancyQuery = z.infer<typeof occupancyQuery>;
export type PaymentQuery = z.infer<typeof paymentQuery>;
export type ExportQuery = z.infer<typeof exportQuery>;
export type OutstandingQuery = z.infer<typeof outstandingQuery>;
export type ReportType = (typeof reportTypes)[number];
