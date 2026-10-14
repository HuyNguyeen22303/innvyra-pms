import 'dotenv/config';
import { createConnection } from 'mariadb';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { databaseOptions } from '../src/database/prisma.js';

// Creates a dedicated local test schema; never resets, drops or seeds application data.
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production environment refused');
  const applicationUrl = process.env.DATABASE_URL;
  if (!applicationUrl) throw new Error('DATABASE_URL is required');
  const application = new URL(applicationUrl);
  const target = new URL(process.env.TEST_DATABASE_URL || applicationUrl);
  if (!process.env.TEST_DATABASE_URL) target.pathname = '/innvyra_pms_stays_phase5_test';
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    !/^\/[A-Za-z0-9_]+_test$/.test(target.pathname) ||
    target.pathname === application.pathname
  )
    throw new Error('Use a separate local TEST_DATABASE_URL with a database name ending _test');
  const name = target.pathname.slice(1);
  const { database: _database, ...options } = databaseOptions(target.toString());
  void _database;
  const connection = await createConnection(options);
  try {
    const rows = await connection.query<{ version: string }[]>('SELECT VERSION() AS version');
    console.info('Test server version:', rows[0]?.version);
    // Identifier is restricted to ASCII letters/digits/underscore above; no user SQL.
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
  const require = createRequire(import.meta.url);
  const run = (args: string[], env: NodeJS.ProcessEnv) => {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
    if (result.error || result.status !== 0) throw new Error('Verification command failed');
  };
  const migrationEnv = { ...process.env, DATABASE_URL: target.toString() };
  run(['--import', 'tsx', 'scripts/migrate.ts'], migrationEnv);
  run(
    [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    migrationEnv,
  );
  run(['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
    ...process.env,
    TEST_DATABASE_URL: target.toString(),
    NODE_ENV: 'test',
  });
  console.info('Verified using dedicated database:', name);
}
main().catch((error: unknown) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'VERIFICATION_FAILED';
  console.error(
    'Verification error code:',
    /^[A-Z0-9_]+$/.test(code) ? code : 'VERIFICATION_FAILED',
  );
  console.error(
    'MySQL verification failed. Inspect the sanitized results above; application database was not modified.',
  );
  process.exitCode = 1;
});
