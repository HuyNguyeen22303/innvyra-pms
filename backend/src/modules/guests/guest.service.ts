import type { Guest } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import { guestCreateBody, guestUpdateBody } from './guest.schema.js';
import { guestDetail, guestSummary } from './guest.mapper.js';
import type { GuestCrypto } from './guest.crypto.js';
import {
  guestPermissions,
  type CreateGuestInput,
  type GuestQuery,
  type GuestRepository,
  type GuestScope,
  type GuestWrite,
  type UpdateGuestInput,
} from './guest.types.js';

const missing = () => new AppError(404, 'GUEST_NOT_FOUND', 'Guest not found');
const warnings = (candidates: { id: bigint }[]) =>
  candidates.length
    ? [
        {
          code: 'POSSIBLE_DUPLICATE',
          message:
            'Possible matching profiles; review before using this profile. No records were merged.',
          candidateIds: candidates.map((record) => record.id.toString()),
        },
      ]
    : [];

export class GuestService {
  constructor(
    private readonly repository: GuestRepository,
    private readonly crypto: GuestCrypto,
  ) {}
  private authorize(scope: GuestScope, permission: keyof typeof guestPermissions) {
    if (!(guestPermissions[permission] as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  private prepare(hotelId: bigint, input: UpdateGuestInput): Partial<GuestWrite> {
    const data: Partial<GuestWrite> = {};
    // Explicit allowlist: never spread an HTTP input into persistence data.
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.dateOfBirth !== undefined)
      data.dateOfBirth =
        input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.nationality !== undefined) data.nationality = input.nationality;
    if (input.documentType !== undefined) data.documentType = input.documentType;
    if (input.address !== undefined) data.address = input.address;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.documentNumber !== undefined) {
      data.documentNumberCiphertext =
        input.documentNumber === null ? null : this.crypto.encrypt(hotelId, input.documentNumber);
      data.documentNumberHash =
        input.documentNumber === null
          ? null
          : this.crypto.fingerprint(hotelId, input.documentNumber);
    }
    return data;
  }
  async createGuest(scope: GuestScope, raw: CreateGuestInput) {
    this.authorize(scope, 'write');
    const input = guestCreateBody.parse(raw);
    const data: GuestWrite = {
      fullName: input.fullName,
      phone: null,
      email: null,
      dateOfBirth: null,
      gender: null,
      nationality: null,
      documentType: null,
      documentNumberCiphertext: null,
      documentNumberHash: null,
      address: null,
      notes: null,
      ...this.prepare(scope.hotelId, input),
    };
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const candidates = await repository.findPossibleDuplicates(scope.hotelId, data);
      const record = await repository.create(scope.hotelId, data);
      await repository.audit(scope.hotelId, {
        guestId: record.id,
        actorId: scope.actorId,
        action: 'CREATED',
        changedFields: Object.keys(input),
      });
      return {
        guest: guestDetail(record, scope.role, this.crypto),
        warnings: warnings(candidates),
      };
    });
  }
  async getGuests(scope: GuestScope, query: GuestQuery) {
    this.authorize(scope, 'read');
    // Prevent inference of nationality through filtered counts for the minimal billing role.
    if (scope.role === 'ACCOUNTANT' && query.nationality !== undefined)
      throw new AppError(403, 'FORBIDDEN', 'Filter is not available for this role');
    const { items, total } = await this.repository.list(scope.hotelId, query);
    return pageResult(
      items.map((record) => guestSummary(record, scope.role)),
      total,
      query,
    );
  }
  async getGuestById(scope: GuestScope, id: bigint) {
    this.authorize(scope, 'read');
    const record = await this.repository.findById(scope.hotelId, id);
    if (!record) throw missing();
    return guestDetail(record, scope.role, this.crypto);
  }
  async updateGuest(scope: GuestScope, id: bigint, raw: UpdateGuestInput) {
    this.authorize(scope, 'write');
    const input = guestUpdateBody.parse(raw);
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw missing();
      const data = this.prepare(scope.hotelId, input);
      const effective: Guest = { ...record, ...data };
      if (effective.documentNumberCiphertext && !effective.documentType)
        throw new AppError(
          409,
          'GUEST_DOCUMENT_TYPE_REQUIRED',
          'Clear the document number before clearing its type',
        );
      const changedFields = Object.keys(input).filter((key) => {
        if (key === 'documentNumber') return data.documentNumberHash !== record.documentNumberHash;
        const field = key as keyof GuestWrite;
        const before = record[field];
        const after = data[field];
        return (
          (before instanceof Date ? before.getTime() : before) !==
          (after instanceof Date ? after.getTime() : after)
        );
      });
      // A differently formatted equivalent document should not rewrite the stored identity.
      if (!changedFields.includes('documentNumber')) {
        delete data.documentNumberCiphertext;
        delete data.documentNumberHash;
      }
      const candidates = await repository.findPossibleDuplicates(scope.hotelId, effective, id);
      const updated = changedFields.length
        ? await repository.update(scope.hotelId, id, data)
        : record;
      if (changedFields.length)
        await repository.audit(scope.hotelId, {
          guestId: id,
          actorId: scope.actorId,
          action: 'UPDATED',
          changedFields,
        });
      return {
        guest: guestDetail(updated, scope.role, this.crypto),
        warnings: warnings(candidates),
      };
    });
  }
  async deleteGuest(scope: GuestScope, id: bigint) {
    this.authorize(scope, 'delete');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      if (!(await repository.findById(scope.hotelId, id))) throw missing();
      const record = await repository.softDelete(scope.hotelId, id);
      await repository.audit(scope.hotelId, {
        guestId: id,
        actorId: scope.actorId,
        action: 'SOFT_DELETED',
        changedFields: ['deletedAt'],
      });
      return { id: record.id.toString(), deletedAt: record.deletedAt };
    });
  }
}
