import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createConnection } from 'mariadb';
import { createPrisma, databaseOptions } from '../src/database/prisma.js';

export async function isolatedMySql(label: string) {
  if (!process.env.TEST_DATABASE_URL || process.env.NODE_ENV !== 'test')
    throw new Error('A dedicated local TEST_DATABASE_URL and NODE_ENV=test are required');
  const source = new URL(process.env.TEST_DATABASE_URL);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) ||
    !/^\/[A-Za-z0-9_]+_test$/.test(source.pathname) ||
    !/^[a-z_]{1,18}$/.test(label) ||
    (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === source.pathname)
  )
    throw new Error('Refusing to use the application database or a non-local test database');
  const name = `innvyra_${label}_${randomUUID().replaceAll('-', '')}_test`;
  if (name.length > 64) throw new Error('Test database name is too long');
  const target = new URL(source);
  target.pathname = `/${name}`;
  const { database: _database, ...options } = databaseOptions(source.toString());
  void _database;
  const server = await createConnection({ ...options, allowPublicKeyRetrieval: true });
  let created = false;
  const prisma = createPrisma(target.toString());
  const dispose = async () => {
    try {
      await prisma.$disconnect();
      if (created && /^innvyra_[a-z_]{1,18}_[a-f0-9]{32}_test$/.test(name)) {
        await server.query(`DROP DATABASE \`${name}\``);
        created = false;
      }
    } finally {
      await server.end();
    }
  };
  try {
    // A successful unique CREATE establishes that only this fixture owns the database.
    await server.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    created = true;
    const result = spawnSync(
      process.execPath,
      [
        createRequire(import.meta.url).resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--config',
        resolve(import.meta.dirname, '..', 'prisma.config.ts'),
      ],
      {
        cwd: resolve(import.meta.dirname, '..'),
        timeout: 60000,
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: target.toString(),
          PRISMA_HIDE_UPDATE_MESSAGE: 'true',
        },
      },
    );
    if (result.error || result.status !== 0) throw new Error('Isolated test migration failed');
    await prisma.$connect();
    return { prisma, url: target.toString(), dispose };
  } catch {
    await dispose();
    throw new Error('Cannot prepare the isolated local MySQL test database');
  }
}
