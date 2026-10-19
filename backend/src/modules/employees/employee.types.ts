import type { z } from 'zod';
import type { RoleCode } from '../../shared/types/roles.js';
import type {
  employeeCreateBody,
  employeeUpdateBody,
  employeeListQuery,
} from './employee.schema.js';
import type { PrismaEmployeeRepository } from './employee.repository.js';

export type CreateEmployeeInput = z.infer<typeof employeeCreateBody>;
export type UpdateEmployeeInput = z.infer<typeof employeeUpdateBody>;
export type EmployeeQuery = z.infer<typeof employeeListQuery>;
export type EmployeeRepository = Pick<PrismaEmployeeRepository, keyof PrismaEmployeeRepository>;
export type EmployeeScope = { hotelId: bigint; actorId: bigint; role: RoleCode };

export const employeePermissions = {
  read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'TECHNICIAN'],
  write: ['ADMIN', 'MANAGER'],
  deactivate: ['ADMIN', 'MANAGER'],
  activate: ['ADMIN', 'MANAGER'],
  resetPassword: ['ADMIN', 'MANAGER'],
} as const satisfies Record<string, readonly RoleCode[]>;

/** Roles that MANAGER is NOT allowed to create/edit/deactivate */
export const MANAGER_RESTRICTED_ROLES: readonly RoleCode[] = ['ADMIN'] as const;

/** Hierarchy: a role can only manage roles below its own level. */
export const ROLE_HIERARCHY: Record<RoleCode, number> = {
  ADMIN: 100,
  MANAGER: 80,
  RECEPTIONIST: 60,
  HOUSEKEEPING: 40,
  ACCOUNTANT: 40,
  TECHNICIAN: 40,
} as const;
