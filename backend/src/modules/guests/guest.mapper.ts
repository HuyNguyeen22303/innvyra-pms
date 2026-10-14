import type { Guest } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type { GuestCrypto } from './guest.crypto.js';

type Summary = Pick<
  Guest,
  'id' | 'fullName' | 'phone' | 'email' | 'nationality' | 'createdAt' | 'updatedAt'
>;
export function guestSummary(record: Summary, role: RoleCode) {
  const identity = { id: record.id.toString(), fullName: record.fullName };
  if (role === 'ACCOUNTANT') return identity;
  return {
    ...identity,
    phone: record.phone,
    email: record.email,
    nationality: record.nationality,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
export function guestDetail(record: Guest, role: RoleCode, crypto: GuestCrypto) {
  if (role === 'ACCOUNTANT') return { id: record.id.toString(), fullName: record.fullName };
  return {
    ...guestSummary(record, role),
    dateOfBirth: record.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: record.gender,
    documentType: record.documentType,
    documentNumber: record.documentNumberCiphertext
      ? crypto.decrypt(record.hotelId, record.documentNumberCiphertext)
      : null,
    address: record.address,
    notes: record.notes,
  };
}
