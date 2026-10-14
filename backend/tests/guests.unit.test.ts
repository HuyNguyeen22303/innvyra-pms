import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { GuestService } from '../src/modules/guests/guest.service.js';
import { guestCreateBody, guestListQuery } from '../src/modules/guests/guest.schema.js';
import { guestEnv, memoryGuests } from './guest-helpers.js';

describe('Guest document protection and service rules', () => {
  const crypto = new GuestCrypto(guestEnv);
  it('uses randomized authenticated encryption and round-trips documents', () => {
    const one = crypto.encrypt(1n, 'TEST-PASSPORT');
    const two = crypto.encrypt(1n, 'TEST-PASSPORT');
    expect(one).not.toBe(two);
    expect(one).not.toContain('TEST-PASSPORT');
    expect(crypto.decrypt(1n, one)).toBe('TEST-PASSPORT');
  });
  it('rejects ciphertext tampering, invalid envelope, wrong hotel and wrong key', () => {
    const value = crypto.encrypt(1n, 'TEST-PASSPORT');
    const parts = value.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    for (const invalid of [parts.join('.'), 'plaintext', `v2.${value.slice(3)}`])
      expect(() => crypto.decrypt(1n, invalid)).toThrow('Guest document could not be read');
    expect(() => crypto.decrypt(2n, value)).toThrow('Guest document could not be read');
    expect(() =>
      new GuestCrypto({
        ...guestEnv,
        GUEST_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      }).decrypt(1n, value),
    ).toThrow('Guest document could not be read');
  });
  it('uses a stable normalized keyed hash isolated by hotel and hashing key', () => {
    const hash = crypto.fingerprint(1n, 'test-ab 123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(crypto.fingerprint(1n, 'TEST.AB/123'));
    expect(hash).not.toBe(crypto.fingerprint(2n, 'TESTAB123'));
    expect(hash).not.toBe(
      new GuestCrypto({ ...guestEnv, GUEST_HASH_KEY: randomBytes(32).toString('hex') }).fingerprint(
        1n,
        'TESTAB123',
      ),
    );
  });
  it('rejects incomplete or identical configuration without exposing keys', () => {
    const base = {
      NODE_ENV: 'test',
      DATABASE_URL: guestEnv.DATABASE_URL,
      JWT_ACCESS_SECRET: guestEnv.JWT_ACCESS_SECRET,
    };
    expect(() =>
      parseEnv({ ...base, GUEST_ENCRYPTION_KEY: guestEnv.GUEST_ENCRYPTION_KEY }),
    ).toThrow('Configure both');
    expect(() =>
      parseEnv({
        ...base,
        GUEST_ENCRYPTION_KEY: guestEnv.GUEST_ENCRYPTION_KEY,
        GUEST_HASH_KEY: guestEnv.GUEST_ENCRYPTION_KEY.toUpperCase(),
      }),
    ).toThrow('independent');
    expect(() =>
      parseEnv({
        ...base,
        GUEST_ENCRYPTION_KEY: 'invalid-secret',
        GUEST_HASH_KEY: 'invalid-secret',
      }),
    ).not.toThrow('invalid-secret');
    expect(
      parseEnv({ ...base, GUEST_ENCRYPTION_KEY: '', GUEST_HASH_KEY: '' }).GUEST_HASH_KEY,
    ).toBeUndefined();
  });
  it('validates calendar boundaries against request time instead of module load', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
      expect(
        guestCreateBody.safeParse({ fullName: 'Test', dateOfBirth: '2026-10-15' }).success,
      ).toBe(false);
      vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
      expect(
        guestCreateBody.safeParse({ fullName: 'Test', dateOfBirth: '2026-10-15' }).success,
      ).toBe(true);
      expect(
        guestCreateBody.safeParse({ fullName: 'Test', dateOfBirth: '0999-01-01' }).success,
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('enforces role checks at the service boundary before querying persistence', async () => {
    const store = memoryGuests();
    const find = vi.spyOn(store.repository, 'findById');
    const service = new GuestService(store.repository, crypto);
    const scope = { hotelId: 1n, actorId: 1n, role: 'TECHNICIAN' as const };
    await expect(service.getGuestById(scope, 1n)).rejects.toMatchObject({ status: 403 });
    await expect(service.getGuests(scope, guestListQuery.parse({}))).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.createGuest(scope, { fullName: 'Test' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.updateGuest(scope, 1n, { notes: 'Test' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.deleteGuest(scope, 1n)).rejects.toMatchObject({ status: 403 });
    expect(find).not.toHaveBeenCalled();
  });
  it('bounds duplicate candidates and excludes self from update warnings', async () => {
    const store = memoryGuests();
    const service = new GuestService(store.repository, crypto);
    const scope = { hotelId: 1n, actorId: 1n, role: 'ADMIN' as const };
    const first = await service.createGuest(scope, { fullName: 'Synthetic Twin' });
    const updated = await service.updateGuest(scope, BigInt(first.guest.id), {
      notes: 'Only profile',
    });
    expect(updated.warnings).toEqual([]);
    for (let i = 0; i < 7; i++) await service.createGuest(scope, { fullName: 'Synthetic Twin' });
    const last = await service.createGuest(scope, { fullName: 'Synthetic Twin' });
    expect(last.warnings[0]!.candidateIds).toHaveLength(5);
    expect(store.records.size).toBe(9);
  });
  it('avoids rewriting unchanged documents or producing spurious audit events', async () => {
    const store = memoryGuests();
    const service = new GuestService(store.repository, crypto);
    const scope = { hotelId: 1n, actorId: 1n, role: 'ADMIN' as const };
    const result = await service.createGuest(scope, {
      fullName: 'Test',
      documentType: 'PASSPORT',
      documentNumber: 'TEST-123',
    });
    const id = BigInt(result.guest.id);
    const ciphertext = store.records.get(id)!.documentNumberCiphertext;
    await service.updateGuest(scope, id, { fullName: ' Test ', documentNumber: 'test 123' });
    expect(store.records.get(id)!.documentNumberCiphertext).toBe(ciphertext);
    expect(store.audits).toHaveLength(1);
  });
});
