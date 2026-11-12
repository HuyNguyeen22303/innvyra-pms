import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile, access, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { parseEnv } from '../src/config/env.js';
import { isolatedMySql } from './testing/isolated-mysql.js';
import { seedPhase6Scenario } from './phase6/scenario.js';
import { PHASE6_PASSWORD, PHASE6_INITIAL_PASSWORD } from './phase6/client.js';
import { MaintenanceBlockService } from '../src/modules/maintenance/maintenance-block.service.js';
import { PrismaMaintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { startMaintenanceWorker } from '../src/modules/maintenance/maintenance-worker.js';

const backendRoot = resolve(import.meta.dirname, '..');
const workspace = resolve(backendRoot, '.tmp/phase6-demo');
const manifestPath = resolve(workspace, 'manifest.json');
const stopFile = resolve(workspace, `stop-${process.pid}`);
let requestedStop = false;
let shutdown: (() => Promise<void>) | undefined;
process.once('SIGINT', () => {
  requestedStop = true;
  void shutdown?.();
});
process.once('SIGTERM', () => {
  requestedStop = true;
  void shutdown?.();
});

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production environment refused');
  if (!process.env.DATABASE_URL)
    throw new Error('Local DATABASE_URL is required for test connection credentials');
  const source = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  if (!process.env.TEST_DATABASE_URL) source.pathname = '/innvyra_phase6_source_test';
  // Shared helper verifies loopback, _test suffix and separation from application DB.
  process.env.NODE_ENV = 'test';
  process.env.TEST_DATABASE_URL = source.toString();
  const viteCli = resolve(backendRoot, '../frontend/node_modules/vite/bin/vite.js');
  await access(viteCli);
  await mkdir(workspace, { recursive: true });
  const database = await isolatedMySql('phase_six');
  let server: Server | undefined;
  let web: ChildProcess | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopWorker: (() => Promise<void>) | undefined;
  let cleanup: Promise<void> | undefined;
  let published = false;
  shutdown = () =>
    (cleanup ??= (async () => {
      if (timer) clearInterval(timer);
      if (web && web.exitCode === null && !web.killed) web.kill();
      server?.closeAllConnections();
      if (server) await new Promise<void>((done) => server!.close(() => done()));
      await stopWorker?.();
      await database.dispose();
      await rm(stopFile, { force: true });
      if (published)
        await writeFile(
          manifestPath,
          JSON.stringify(
            {
              disposed: true,
              message:
                'Demo stopped; its owned schema was removed. Run npm run demo:phase6 for a fresh scenario.',
            },
            null,
            2,
          ),
        );
      console.info('Phase 6 demo stopped; owned test database disposed.');
    })());
  try {
    const env = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: database.url,
      JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
      GUEST_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      GUEST_HASH_KEY: randomBytes(32).toString('hex'),
      FRONTEND_URL: 'http://127.0.0.1:5176',
      CORS_ORIGINS: 'http://127.0.0.1:3136',
      LOGIN_RATE_LIMIT_MAX: '10000',
      REFRESH_RATE_LIMIT_MAX: '10000',
    });
    console.info('Preparing a new owned test database and complete HTTP scenarios...');
    const scenario = await seedPhase6Scenario(database.prisma, env);
    if (requestedStop) {
      await shutdown();
      return;
    }
    // Credentials in this manifest are public synthetic demo accounts only.
    // Access/refresh tokens, generated temporary passwords and DB credentials are omitted.
    server = scenario.app.listen(3136, '127.0.0.1');
    await new Promise<void>((done, reject) => {
      server!.once('listening', done);
      server!.once('error', reject);
    });
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          disposed: false,
          database: new URL(database.url).pathname.slice(1),
          ui: 'http://127.0.0.1:5176',
          api: 'http://127.0.0.1:3136/api/v1',
          platformEmail: 'phase6.owner@example.test',
          password: PHASE6_PASSWORD,
          temporaryPassword: PHASE6_INITIAL_PASSWORD,
          hotels: [scenario.a, scenario.b].map((hotel) => ({
            code: hotel.code,
            id: hotel.id,
            timezone: hotel.timezone,
            anchorDay: hotel.today,
            staff: Object.fromEntries(
              Object.entries(hotel.staff).map(([role, user]) => [role, user.username]),
            ),
            inactive: hotel.inactive.username,
            temporary: hotel.temporary.username,
            expected: hotel.expected,
          })),
          subscriptionFixtures: scenario.states,
        },
        null,
        2,
      ),
    );
    published = true;
    stopWorker = startMaintenanceWorker(
      new MaintenanceBlockService(new PrismaMaintenanceRepository(database.prisma)),
    );
    web = spawn(
      process.execPath,
      [viteCli, '--host', '127.0.0.1', '--port', '5176', '--strictPort'],
      {
        cwd: resolve(backendRoot, '../frontend'),
        windowsHide: true,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          VITE_API_URL: 'http://127.0.0.1:3136/api/v1',
        },
      },
    );
    web.once('error', () => {
      process.exitCode = 1;
      void shutdown?.();
    });
    web.once('exit', (code) => {
      if (!cleanup) {
        if (code !== 0) process.exitCode = 1;
        void shutdown?.();
      }
    });
    timer = setInterval(() => {
      if (existsSync(stopFile)) void shutdown?.();
    }, 500);
    console.info('Phase 6 UI: http://127.0.0.1:5176');
    console.info('Platform login: phase6.owner@example.test');
    console.info('Hotel logins: p6_a_admin / p6_b_admin (all six roles are listed in manifest)');
    console.info('Synthetic demo password:', PHASE6_PASSWORD);
    console.info('Scenario manifest:', manifestPath);
    console.info('Stopping removes only this demo test schema; the next run starts fresh.');
    console.info('Stop with Ctrl+C, or create this stop file:', stopFile);
  } catch {
    await shutdown();
    throw new Error(
      'Phase 6 demo setup failed; inspect local ports, dependencies and MySQL permissions',
    );
  }
}
main().catch(() => {
  console.error(
    'Phase 6 demo could not start. Use a local MySQL test connection, install backend/frontend dependencies and free ports 3136/5176. Application data was not reset.',
  );
  process.exitCode = 1;
});
