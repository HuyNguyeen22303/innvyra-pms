import { z } from 'zod';
import {
  emptyQuery,
  idParams,
  paginationFields,
  priceSchema,
  textSchema,
} from '../../shared/validation/room-input.js';

const fields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  name: z.string().trim().min(1).max(100),
  description: textSchema,
  maxAdults: z.number().int().min(1).max(65535),
  maxChildren: z.number().int().min(0).max(65535),
  basePrice: priceSchema,
  isActive: z.boolean(),
};
export const roomTypeCreateBody = z
  .object({
    ...fields,
    description: fields.description.optional(),
    maxChildren: fields.maxChildren.default(0),
    isActive: fields.isActive.default(true),
  })
  .strict();
export const roomTypeUpdateBody = z
  .object(fields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field');
export const roomTypeListQuery = z
  .object({
    ...paginationFields,
    sortBy: z.enum(['name', 'basePrice', 'createdAt']).default('name'),
  })
  .strict();
export const createRoomTypeSchema = z.object({ body: roomTypeCreateBody, query: emptyQuery });
export const updateRoomTypeSchema = z.object({
  body: roomTypeUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const roomTypeIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listRoomTypesSchema = z.object({ query: roomTypeListQuery });
