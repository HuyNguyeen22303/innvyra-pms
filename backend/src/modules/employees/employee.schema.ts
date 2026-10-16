import { z } from 'zod';
import { emptyQuery, idParams, paginationFields } from '../../shared/validation/room-input.js';
import { ROLE_CODES } from '../../shared/types/roles.js';
import { usernameSchema } from '../auth/auth.schema.js';

const fullName = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/gu, ' '))
  .pipe(z.string().min(1).max(191));

const email = z.string().trim().toLowerCase().max(191).email().nullable().optional();

const password = z
  .string()
  .min(15)
  .max(128)
  .refine(
    (password) => password.trim().length >= 15 && new Set(password).size >= 8,
    'Use a long, varied password or passphrase',
  );

export const employeeCreateBody = z
  .object({
    fullName,
    username: usernameSchema,
    email,
    password,
    role: z.enum(ROLE_CODES),
  })
  .strict();

export const employeeUpdateBody = z
  .object({
    fullName,
    email,
    role: z.enum(ROLE_CODES),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');

export const employeeListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: z.string().trim().min(1).max(191).optional(),
    role: z.enum(ROLE_CODES).optional(),
    isActive: paginationFields.isActive,
    sortBy: z.enum(['fullName', 'createdAt', 'username']).default('fullName'),
    sortOrder: paginationFields.sortOrder,
  })
  .strict();

export const createEmployeeSchema = z.object({ body: employeeCreateBody, query: emptyQuery });
export const updateEmployeeSchema = z.object({
  body: employeeUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const employeeIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listEmployeesSchema = z.object({ query: employeeListQuery });
