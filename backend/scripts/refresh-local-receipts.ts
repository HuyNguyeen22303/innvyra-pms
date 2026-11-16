import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from '../src/config/env.js';
import { createPrisma } from '../src/database/prisma.js';
import { planLocalReceiptRefresh, applyLocalReceiptRefresh } from './local-seed/receipt-refresh.js';
import { verifyLocalDataset } from './local-seed/verify.js';
const json = (value: unknown) =>
  JSON.stringify(value, (_key, value) => (typeof value === 'bigint' ? String(value) : value), 2);
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) throw new Error('Use --apply; default is read-only');
  const env = parseEnv(process.env),
    db = createPrisma(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    const plan = await planLocalReceiptRefresh(db, env);
    const summary = {
      database: new URL(env.DATABASE_URL).pathname.slice(1),
      replacements: plan.filter((change) => change.mode === 'REPLACE_UNRECONCILED').length,
      trackedRenames: plan.filter((change) => change.mode === 'RENAME_TRACKED').length,
      changes: plan.map((change) => ({
        hotel: change.receipt.hotel.code,
        id: change.receipt.id,
        from: change.receipt.receiptNumber,
        to: change.newNumber,
        mode: change.mode,
      })),
    };
    if (!args.includes('--apply')) {
      console.info(json({ readOnly: true, ...summary }));
      return;
    }
    const before = await verifyLocalDataset(db, env);
    if (!before.ok) throw new Error('Receipt refresh verification failed before applying');
    const directory = resolve(import.meta.dirname, '../.tmp/local-seed');
    await mkdir(directory, { recursive: true });
    if (plan.length)
      await writeFile(
        resolve(directory, `${summary.database}.receipts-${Date.now()}.backup.json`),
        json({ createdAt: new Date().toISOString(), database: summary.database, plan }),
        { flag: 'wx', mode: 0o600 },
      );
    const changes = await applyLocalReceiptRefresh(db, env, plan);
    const after = await verifyLocalDataset(db, env);
    await writeFile(
      resolve(directory, `${summary.database}.receipts.verification.json`),
      json({ summary, changes, verification: after }),
      { mode: 0o600 },
    );
    if (!after.ok)
      throw new Error(
        'Receipt refresh verification failed after applying; inspect the local report',
      );
    console.info(
      json({
        ...summary,
        applied: true,
        foreignKeys: after.foreignKeyCount,
        businessChecks: after.checks.length - after.foreignKeyCount,
      }),
    );
    console.info(
      'Received quantities, stock balances and existing payments were preserved. Replacement local receipts start unpaid. Backup/report:',
      directory,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && /^(Use --apply|Receipt refresh)/.test(error.message)
      ? error.message
      : 'Receipt refresh failed; inspect local configuration and the backup. No database was reset.',
  );
  process.exitCode = 1;
});
