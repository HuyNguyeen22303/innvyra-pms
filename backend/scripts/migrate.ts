import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { inspectDatabase } from './database-tools.js';

async function main() {
  const { tables } = await inspectDatabase();
  if (tables.length && !tables.includes('_prisma_migrations')) {
    throw new Error(
      'Existing tables without Prisma migration history detected. STOP: follow the baseline procedure in backend/README.md. No migration was applied.',
    );
  }
  const require = createRequire(import.meta.url);
  const result = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    { stdio: 'inherit' },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      'Migration failed. Inspect the failure; never use migrate reset to repair existing data.',
    );
}

main().catch((error: unknown) => {
  // Connection errors are redacted because driver errors may contain configuration.
  const message =
    error instanceof Error &&
    (error.message.startsWith('Existing tables') || error.message.startsWith('Migration failed'))
      ? error.message
      : 'Cannot inspect database. Check configuration and connectivity; nothing was reset.';
  console.error(message);
  process.exitCode = 1;
});
