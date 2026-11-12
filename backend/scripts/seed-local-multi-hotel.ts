import { parse as parseDotenv } from 'dotenv';
import 'dotenv/config';
import { createConnection } from 'mariadb';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from '../src/config/env.js';
import { createPrisma, databaseOptions } from '../src/database/prisma.js';
import { seedLocalDataset, sqlIdentifier } from './local-seed/dataset.js';
import { verifyLocalDataset } from './local-seed/verify.js';
import { localDatabaseUrl, replaceDatabaseUrl } from './local-seed/config.js';
import {
  LOCAL_DATABASE_NAME,
  LOCAL_PASSWORD,
  LOCAL_PLATFORM_EMAIL,
  localHotels,
} from './local-seed/catalog.js';
import { localStaff } from './local-seed/staff.js';

const root = resolve(import.meta.dirname, '..');
const artifactDir = resolve(root, '.tmp/local-seed');
let stage = 'configuration';
let createdName: string | undefined;
async function main() {
  const args = process.argv.slice(2);
  const known = new Set(['--database', '--activate', '--check']);
  for (let index = 0; index < args.length; index++) {
    if (!known.has(args[index]!)) throw new Error('Invalid seed option');
    if (args[index] === '--database') {
      if (!args[index + 1]) throw new Error('Database name is required');
      index++;
    }
  }
  const checking = args.includes('--check'),
    activate = args.includes('--activate');
  if (checking && activate) throw new Error('Check mode never changes application configuration');
  const nameIndex = args.indexOf('--database');
  const current = parseEnv(process.env);
  const name =
    nameIndex >= 0
      ? args[nameIndex + 1]!
      : checking
        ? new URL(current.DATABASE_URL).pathname.slice(1)
        : LOCAL_DATABASE_NAME;
  if (current.NODE_ENV === 'production')
    throw new Error('Local seeding is unavailable in production');
  const targetUrl = localDatabaseUrl(current.DATABASE_URL, name, !checking);
  const envFile = resolve(root, '.env');
  const originalEnv = activate ? await readFile(envFile, 'utf8') : '';
  if (activate) {
    const configured = parseEnv(parseDotenv(originalEnv));
    if (
      ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'GUEST_ENCRYPTION_KEY', 'GUEST_HASH_KEY'].some(
        (key) =>
          configured[key as keyof typeof configured] !== current[key as keyof typeof current],
      )
    )
      throw new Error('Environment file differs from runtime overrides; activation refused');
  }
  const env = parseEnv({
    ...process.env,
    DATABASE_URL: targetUrl,
    LOGIN_RATE_LIMIT_MAX: '10000',
    REFRESH_RATE_LIMIT_MAX: '10000',
  });
  if (!env.GUEST_ENCRYPTION_KEY || !env.GUEST_HASH_KEY)
    throw new Error('Persistent guest keys must be configured');
  await mkdir(artifactDir, { recursive: true });
  const prisma = createPrisma(targetUrl, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    if (!checking) {
      stage = 'create database';
      const { database: _database, ...options } = databaseOptions(
        current.DATABASE_URL,
        current.DATABASE_SSL,
        current.DATABASE_SSL_CA_FILE,
      );
      void _database;
      const server = await createConnection({ ...options, allowPublicKeyRetrieval: true });
      try {
        // Exclusive CREATE, never IF NOT EXISTS/reset/drop. A conflict leaves the
        // existing schema untouched. Failures retain our new schema for inspection.
        await server.query(
          `CREATE DATABASE ${sqlIdentifier(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
        createdName = name;
      } finally {
        await server.end();
      }
      stage = 'migrations';
      const result = spawnSync(
        process.execPath,
        [
          createRequire(import.meta.url).resolve('prisma/build/index.js'),
          'migrate',
          'deploy',
          '--config',
          resolve(root, 'prisma.config.ts'),
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 120000,
          env: { ...process.env, DATABASE_URL: targetUrl },
        },
      );
      if (result.error || result.status !== 0)
        throw new Error('Cannot migrate the newly created database');
      stage = 'seed linked records';
      const dataset = await seedLocalDataset(prisma, env, (message) => console.info(message));
      await writeFile(
        resolve(artifactDir, `${name}.manifest.json`),
        JSON.stringify(
          {
            ...dataset.manifest,
            previousDatabase: new URL(current.DATABASE_URL).pathname.slice(1),
            persistent: true,
          },
          null,
          2,
        ),
      );
    }
    stage = 'verify relationships and balances';
    const report = await verifyLocalDataset(prisma, env);
    await writeFile(
      resolve(artifactDir, `${name}.verification.json`),
      JSON.stringify(report, null, 2),
    );
    if (!report.ok)
      throw new Error(
        `Verification failed: ${report.checks
          .filter((check) => check.failures)
          .map((check) => check.name)
          .join(', ')}`,
      );
    if (!checking) {
      // Do not leave authenticated seed clients alive in the persistent database.
      await prisma.authSession.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOCAL_SEED_COMPLETE' },
      });
      await prisma.platformAuthSession.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOCAL_SEED_COMPLETE' },
      });
    }
    if (activate) {
      stage = 'activate verified database';
      if ((await readFile(envFile, 'utf8')) !== originalEnv)
        throw new Error('Environment file changed during seed; database kept but not activated');
      const patched = replaceDatabaseUrl(originalEnv, targetUrl);
      const temporary = resolve(root, `.env.local-seed-${process.pid}.tmp`);
      try {
        await writeFile(temporary, patched, { flag: 'wx', mode: 0o600 });
        await rename(temporary, envFile);
      } finally {
        await rm(temporary, { force: true });
      }
    }
    console.info(`Database ready: ${name} (persistent, not auto-deleted).`);
    console.info(
      `Verified ${report.foreignKeyCount} foreign keys and ${report.checks.length - report.foreignKeyCount} business checks; no violations.`,
    );
    console.info(
      'Rows:',
      JSON.stringify({
        hotels: report.counts.hotels,
        rooms: report.counts.rooms,
        staff: report.counts.staff_users,
        guests: report.counts.guests,
        reservations: report.counts.reservations,
        stays: report.counts.stays,
      }),
    );
    if (!checking) {
      console.info(
        `Platform: ${LOCAL_PLATFORM_EMAIL}; hotel ADMIN: ${localHotels.map((hotel) => localStaff(hotel).find((person) => person.role === 'ADMIN')!.username).join(' / ')}.`,
      );
      console.info('Local sample password:', LOCAL_PASSWORD);
    }
    console.info(
      activate
        ? 'backend/.env now points to the verified database; encryption keys are unchanged.'
        : 'Application configuration was not changed.',
    );
    console.info('Reports:', artifactDir);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  // Error messages from drivers/migration tools may include connection details.
  const safeMessage =
    error instanceof Error &&
    /^(Current application|Choose a separate|Expected exactly|Verification failed|Environment file|Invalid seed|Local seeding|Persistent guest)/.test(
      error.message,
    )
      ? error.message
      : 'Check local configuration and the new-database verification report.';
  console.error(`Local seed failed during ${stage}. ${safeMessage}`);
  if (createdName)
    console.error(
      `New database ${createdName} was retained for inspection. No existing database was reset or deleted.`,
    );
  process.exitCode = 1;
});
