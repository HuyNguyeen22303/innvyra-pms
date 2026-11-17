import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idempotencyKey } from './billing.schema.js';
import type { BillingOperations, BillingScope } from './billing.types.js';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const requestHash = (value: string) => createHash('sha256').update(value).digest('hex');

// Caller owns the hotel-locked transaction, including cross-module booking workflows.
export async function billingIdempotent<T extends Prisma.InputJsonObject>(
  repository: Pick<BillingOperations, 'key' | 'saveKey'>,
  scope: BillingScope,
  key: string,
  operation: string,
  target: bigint,
  input: unknown,
  action: () => Promise<T>,
): Promise<T> {
  if (!idempotencyKey.safeParse(key).success)
    throw new AppError(
      422,
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key must contain 8-128 permitted ASCII characters',
    );
  const keyHash = requestHash(key);
  const fingerprint = requestHash(canonicalJson({ operation, target: target.toString(), input }));
  const existing = await repository.key(scope.hotelId, keyHash);
  if (existing) {
    if (existing.requestHash !== fingerprint)
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Key was already used for a different request',
      );
    return existing.response as T;
  }
  const result = await action();
  await repository.saveKey(scope.hotelId, keyHash, fingerprint, result);
  return result;
}
