import { randomBytes } from 'node:crypto';
import type { Guest } from '../src/generated/prisma/client.js';
import type { GuestAudit, GuestQuery, GuestRepository } from '../src/modules/guests/guest.types.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { testEnv } from './helpers.js';

export const guestEnv = {
  ...testEnv,
  GUEST_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  GUEST_HASH_KEY: randomBytes(32).toString('hex'),
};
export const guestInput = {
  fullName: 'Synthetic Guest',
  phone: '+1 (202) 555-0100',
  email: 'guest@example.test',
  dateOfBirth: '1998-05-20',
  gender: 'OTHER' as const,
  nationality: 'VN',
  documentType: 'PASSPORT' as const,
  documentNumber: 'TEST-PASSPORT-0001',
  address: 'Fictional test address',
  notes: 'Synthetic fixture only',
};

// Only a test double: SQL constraints, concurrent writes and rollback also have real MySQL tests.
export function memoryGuests() {
  const records = new Map<bigint, Guest>();
  const audits: (GuestAudit & { hotelId: bigint })[] = [];
  let nextId = 9007199254741100n;
  const find = (hotelId: bigint, id: bigint) => {
    const row = records.get(id);
    return row?.hotelId === hotelId && row.deletedAt === null ? row : null;
  };
  const matching = (hotelId: bigint, query: GuestQuery) =>
    [...records.values()].filter(
      (row) =>
        row.hotelId === hotelId &&
        row.deletedAt === null &&
        (!query.search || row.fullName.toLowerCase().includes(query.search.toLowerCase())) &&
        (!query.nationality || row.nationality === query.nationality),
    );
  const repository: GuestRepository = {
    async withHotelLock(_hotelId, action) {
      const snapshot = structuredClone(records);
      const auditLength = audits.length;
      try {
        return await action(repository);
      } catch (error) {
        records.clear();
        snapshot.forEach((row, id) => records.set(id, row));
        audits.splice(auditLength);
        throw error;
      }
    },
    async findById(hotelId, id) {
      return find(hotelId, id);
    },
    async findMany(hotelId, query) {
      const rows = matching(hotelId, query).sort((a, b) => {
        const left = a[query.sortBy],
          right = b[query.sortBy];
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return comparison
          ? comparison * (query.sortOrder === 'asc' ? 1 : -1)
          : a.id < b.id
            ? -1
            : 1;
      });
      return rows.slice((query.page - 1) * query.limit, query.page * query.limit);
    },
    async count(hotelId, query) {
      return matching(hotelId, query).length;
    },
    async list(hotelId, query) {
      return {
        items: await repository.findMany(hotelId, query),
        total: await repository.count(hotelId, query),
      };
    },
    async create(hotelId, input) {
      const row: Guest = {
        ...input,
        hotelId,
        id: nextId++,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.set(row.id, row);
      return row;
    },
    async update(hotelId, id, input) {
      const row = find(hotelId, id);
      if (!row) throw new AppError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      const updated = { ...row, ...input, updatedAt: new Date() };
      records.set(id, updated);
      return updated;
    },
    async softDelete(hotelId, id) {
      const row = find(hotelId, id);
      if (!row) throw new AppError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      const updated = { ...row, deletedAt: new Date(), updatedAt: new Date() };
      records.set(id, updated);
      return updated;
    },
    async findPossibleDuplicates(hotelId, input, excludeId) {
      return [...records.values()]
        .filter(
          (row) =>
            row.hotelId === hotelId &&
            row.deletedAt === null &&
            row.id !== excludeId &&
            (row.fullName.toLowerCase() === input.fullName.toLowerCase() ||
              (!!input.phone && row.phone === input.phone) ||
              (!!input.email && row.email === input.email) ||
              (!!input.documentNumberHash &&
                row.documentNumberHash === input.documentNumberHash &&
                row.documentType === input.documentType)),
        )
        .slice(0, 5)
        .map(({ id }) => ({ id }));
    },
    async audit(hotelId, input) {
      audits.push({ ...input, hotelId });
    },
  };
  return { repository, records, audits };
}
