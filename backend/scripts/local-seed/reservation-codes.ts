import type { Env } from '../../src/config/env.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  generateReservationCode,
  RESERVATION_CODE_PATTERN,
} from '../../src/modules/reservations/reservation-code.js';
import { isLocalSeedName } from './dataset.js';

export interface ReservationCodeChange {
  id: bigint;
  hotelId: bigint;
  oldCode: string;
  newCode: string;
  updatedAt: Date;
}

async function assertTarget(prisma: PrismaClient, env: Env) {
  const url = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !isLocalSeedName(url.pathname.slice(1))
  )
    throw new Error('Reservation code update requires a separate local multi-hotel database');
  const database = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
  if (database[0]?.name !== url.pathname.slice(1)) throw new Error('Database target mismatch');
}

export async function planReservationCodeChanges(
  prisma: PrismaClient,
  env: Env,
  generate = generateReservationCode,
): Promise<ReservationCodeChange[]> {
  await assertTarget(prisma, env);
  const rows = await prisma.reservation.findMany({
    select: { id: true, hotelId: true, confirmationCode: true, updatedAt: true },
    orderBy: { id: 'asc' },
  });
  // Match MySQL's case-insensitive unique index, including imported legacy codes.
  const used = new Set(rows.map((row) => row.confirmationCode.toUpperCase()));
  return rows
    .filter((row) => !RESERVATION_CODE_PATTERN.test(row.confirmationCode))
    .map((row) => {
      for (let attempt = 0; attempt < 32; attempt++) {
        const code = generate();
        if (!RESERVATION_CODE_PATTERN.test(code))
          throw new Error('Invalid generated reservation code');
        if (used.has(code)) continue;
        used.add(code);
        return {
          id: row.id,
          hotelId: row.hotelId,
          oldCode: row.confirmationCode,
          newCode: code,
          updatedAt: row.updatedAt,
        };
      }
      throw new Error('Cannot allocate a unique reservation code; no changes applied');
    });
}

export async function applyReservationCodeChanges(
  prisma: PrismaClient,
  env: Env,
  changes: ReservationCodeChange[],
) {
  await assertTarget(prisma, env);
  if (
    new Set(changes.map((change) => change.id)).size !== changes.length ||
    new Set(changes.map((change) => change.newCode)).size !== changes.length ||
    changes.some(
      (change) =>
        !RESERVATION_CODE_PATTERN.test(change.newCode) ||
        RESERVATION_CODE_PATTERN.test(change.oldCode),
    )
  )
    throw new Error('Invalid reservation code update plan');
  await prisma.$transaction(
    async (tx) => {
      for (const change of changes) {
        const result = await tx.reservation.updateMany({
          where: {
            id: change.id,
            hotelId: change.hotelId,
            confirmationCode: change.oldCode,
            updatedAt: change.updatedAt,
          },
          // Retain dates, actors, IDs and the original update timestamp.
          data: { confirmationCode: change.newCode, updatedAt: change.updatedAt },
        });
        if (result.count !== 1)
          throw new Error('Reservation changed since planning; entire update rolled back');
      }
    },
    { timeout: 30000 },
  );
}
