import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(/^[1-9]\d{0,19}$/)
  .refine(
    (value) => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n,
    'ID exceeds unsigned BIGINT',
  );
export const idParams = z.object({ id: idSchema }).strict();
export const emptyQuery = z.object({}).strict();
const queryInteger = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
export const paginationFields = {
  page: queryInteger(1, 1_000_000).default(1),
  limit: queryInteger(1, 100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
};
export const floorSchema = z.number().int().min(-32768).max(32767);
export const floorQuerySchema = queryInteger(-32768, 32767);
export const textSchema = z.string().trim().max(10000).nullable();
export const priceSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/,
    'Use a non-negative decimal string with at most 12 integer and 2 fractional digits',
  );
export function pageResult<T>(items: T[], total: number, query: { page: number; limit: number }) {
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
