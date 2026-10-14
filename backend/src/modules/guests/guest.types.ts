import type { z } from 'zod';
import type { Guest } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type { guestCreateBody, guestUpdateBody, guestListQuery } from './guest.schema.js';
import type { PrismaGuestRepository } from './guest.repository.js';

export type CreateGuestInput = z.infer<typeof guestCreateBody>;
export type UpdateGuestInput = z.infer<typeof guestUpdateBody>;
export type GuestQuery = z.infer<typeof guestListQuery>;
export type GuestRepository = Pick<PrismaGuestRepository, keyof PrismaGuestRepository>;
export type GuestOperations = Omit<GuestRepository, 'withHotelLock' | 'list'>;
export type GuestWrite = Pick<
  Guest,
  | 'fullName'
  | 'phone'
  | 'email'
  | 'dateOfBirth'
  | 'gender'
  | 'nationality'
  | 'documentType'
  | 'documentNumberCiphertext'
  | 'documentNumberHash'
  | 'address'
  | 'notes'
>;
export type GuestScope = { hotelId: bigint; actorId: bigint; role: RoleCode };
export const guestPermissions = {
  read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  write: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  delete: ['ADMIN', 'MANAGER'],
  sensitive: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
} as const satisfies Record<string, readonly RoleCode[]>;
export type GuestAudit = {
  guestId: bigint;
  actorId: bigint;
  action: 'CREATED' | 'UPDATED' | 'SOFT_DELETED';
  changedFields: string[];
};
