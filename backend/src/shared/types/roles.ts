export const ROLE_CODES = [
  'ADMIN',
  'MANAGER',
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'ACCOUNTANT',
  'TECHNICIAN',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];
export function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.some((role) => role === value);
}
