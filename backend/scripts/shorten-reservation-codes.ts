import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from '../src/config/env.js';
import { createPrisma } from '../src/database/prisma.js';
import {
  planReservationCodeChanges,
  applyReservationCodeChanges,
} from './local-seed/reservation-codes.js';
import { verifyLocalDataset } from './local-seed/verify.js';
import { RESERVATION_CODE_PATTERN } from '../src/modules/reservations/reservation-code.js';

const json = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? String(item) : item), 2);
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Use --apply to update; default is read-only');
  const env = parseEnv(process.env);
  const prisma = createPrisma(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    const changes = await planReservationCodeChanges(prisma, env);
    const database = new URL(env.DATABASE_URL).pathname.slice(1);
    if (!args.includes('--apply')) {
      console.info(json({ database, readOnly: true, codesToChange: changes.length }));
      return;
    }
    const before = await verifyLocalDataset(prisma, env);
    if (!before.ok) throw new Error('Database verification failed before updating codes');
    const snapshot = async () =>
      createHash('sha256')
        .update(
          json(
            (await prisma.reservation.findMany({ orderBy: { id: 'asc' } })).map(
              ({ confirmationCode: _code, ...row }) => {
                void _code;
                return row;
              },
            ),
          ),
        )
        .digest('hex');
    const beforeHash = await snapshot();
    const directory = resolve(import.meta.dirname, '../.tmp/local-seed');
    await mkdir(directory, { recursive: true });
    const backup = resolve(directory, `${database}.reservation-codes-${Date.now()}.backup.json`);
    await writeFile(backup, json({ database, createdAt: new Date().toISOString(), changes }), {
      flag: 'wx',
    });
    await applyReservationCodeChanges(prisma, env, changes);
    const after = await verifyLocalDataset(prisma, env);
    const codes = await prisma.reservation.findMany({ select: { confirmationCode: true } });
    const valid = codes.every((row) => RESERVATION_CODE_PATTERN.test(row.confirmationCode));
    const preserved = beforeHash === (await snapshot());
    const report = {
      database,
      changed: changes.length,
      total: codes.length,
      allCodes16: valid,
      reservationDetailsPreserved: preserved,
      foreignKeys: after.foreignKeyCount,
      businessChecks: after.checks.length - after.foreignKeyCount,
      backup,
      verification: after,
    };
    await writeFile(
      resolve(directory, `${database}.reservation-codes.verification.json`),
      json(report),
    );
    if (!after.ok || !valid || !preserved)
      throw new Error('Post-update verification failed; inspect the backup and report');
    console.info(
      json({
        database,
        changed: changes.length,
        total: codes.length,
        allCodes16: valid,
        reservationDetailsPreserved: preserved,
        foreignKeys: after.foreignKeyCount,
        businessChecks: after.checks.length - after.foreignKeyCount,
      }),
    );
    console.info('Backup and verification report:', directory);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  const message =
    error instanceof Error &&
    /^(Use --apply|Reservation code update|Database target|Database verification|Post-update verification|Invalid reservation|Reservation changed|Cannot allocate)/.test(
      error.message,
    )
      ? error.message
      : 'Local code update failed. Inspect configuration and the local backup; no database was reset.';
  console.error(message);
  process.exitCode = 1;
});
