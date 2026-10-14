import { z } from 'zod';
import { emptyQuery, idParams, paginationFields } from '../../shared/validation/room-input.js';

export const GUEST_GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const;
export const DOCUMENT_TYPES = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER'] as const;
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const fullName = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/gu, ' '))
  .pipe(z.string().min(1).max(150));
const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      value >= '1000-01-01' &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10)
    );
  }, 'Use a valid calendar date from 1000-01-01 through today (UTC)');

export const guestFields = z
  .object({
    fullName,
    phone: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^\+?[0-9() .-]+$/, 'Use digits with optional international prefix and separators')
      .transform((value) => value.replace(/[() .-]/g, ''))
      .pipe(z.string().regex(/^\+?\d{3,20}$/, 'Use 3 to 20 phone digits'))
      .nullable()
      .optional(),
    email: z.string().trim().toLowerCase().max(150).email().nullable().optional(),
    dateOfBirth: dateOfBirth.nullable().optional(),
    gender: z.enum(GUEST_GENDERS).nullable().optional(),
    nationality: nullableText(100),
    documentType: z.enum(DOCUMENT_TYPES).nullable().optional(),
    documentNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(100)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ./-]*$/u, 'Invalid document number format')
      .nullable()
      .optional(),
    address: nullableText(5000),
    notes: nullableText(5000),
  })
  .strict();
export const guestCreateBody = guestFields.refine(
  (value) => !value.documentNumber || !!value.documentType,
  { path: ['documentType'], message: 'Document type is required when a number is supplied' },
);
export const guestUpdateBody = guestFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');
export const guestListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: z.string().trim().min(1).max(150).optional(),
    nationality: z.string().trim().min(1).max(100).optional(),
    status: z.literal('ACTIVE').default('ACTIVE'),
    sortBy: z.enum(['fullName', 'createdAt']).default('fullName'),
    sortOrder: paginationFields.sortOrder,
  })
  .strict();
export const createGuestSchema = z.object({ body: guestCreateBody, query: emptyQuery });
export const updateGuestSchema = z.object({
  body: guestUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const guestIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listGuestsSchema = z.object({ query: guestListQuery });
