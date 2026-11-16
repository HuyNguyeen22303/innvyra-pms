import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from '../src/config/env.js';
import { createPrisma } from '../src/database/prisma.js';
import { backfillLocalSupplies } from './local-seed/supply-backfill.js';
import { verifyLocalDataset } from './local-seed/verify.js';

const json = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? String(item) : item), 2);
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) throw new Error('Use --apply; default is read-only');
  const env = parseEnv(process.env);
  const db = createPrisma(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    const plan = await backfillLocalSupplies(db, env);
    if (!args.includes('--apply')) {
      console.info(json(plan));
      return;
    }
    const before = await verifyLocalDataset(db, env);
    if (!before.ok) throw new Error('Supply backfill verification failed before applying');
    const directory = resolve(import.meta.dirname, '../.tmp/local-seed');
    await mkdir(directory, { recursive: true });
    const backup = resolve(directory, `${plan.database}.supply-backfill-${Date.now()}.json`);
    await writeFile(backup, json({ createdAt: new Date().toISOString(), plan }), {
      flag: 'wx',
      mode: 0o600,
    });
    const result = await backfillLocalSupplies(db, env, true);
    const after = await verifyLocalDataset(db, env);
    await writeFile(
      resolve(directory, `${plan.database}.supply-backfill.verification.json`),
      json({ result, verification: after }),
    );
    if (!after.ok)
      throw new Error('Supply backfill verification failed after applying; inspect the report');
    console.info(
      json({
        database: plan.database,
        itemsClassified: result.itemsClassified,
        itemsCreated: result.itemsCreated,
        newReceipts: result.receipts,
        roomTypesConfigured: result.roomTypesConfigured,
        presetLinesAdded: result.presetLinesAdded,
        presetLinesUpdated: result.presetLinesUpdated,
        foreignKeys: after.foreignKeyCount,
        businessChecks: after.checks.length - after.foreignKeyCount,
        liquidUnitsPreserved: result.unchangedLiquidUnits.length,
      }),
    );
    console.info(
      'Existing stock, invoices, payments and historical usage were preserved. New materials have linked unpaid stock receipts; no supplier payments were inferred.',
    );
    console.info('Backup and verification:', directory);
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && /^(Use --apply|Supply backfill)/.test(error.message)
      ? error.message
      : 'Local supply backfill failed; inspect configuration and the local report. No database was reset.',
  );
  process.exitCode = 1;
});
