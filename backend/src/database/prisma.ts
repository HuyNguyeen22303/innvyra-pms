import { readFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { databaseUrlSchema } from '../config/env.js';

export function databaseOptions(databaseUrl: string, tls = false, caFile = '') {
  const parsed = databaseUrlSchema.safeParse(databaseUrl);
  if (!parsed.success)
    throw new Error('Invalid DATABASE_URL; expected a MySQL URL without query parameters');
  const url = new URL(parsed.data);
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 10,
    connectTimeout: 5000,
    acquireTimeout: 10000,
    timezone: '+00:00',
    ...(tls
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(caFile ? { ca: readFileSync(caFile, 'utf8') } : {}),
          },
        }
      : {}),
  };
}

export function createPrisma(databaseUrl: string, tls = false, caFile = '') {
  return new PrismaClient({
    adapter: new PrismaMariaDb(databaseOptions(databaseUrl, tls, caFile)),
    log: [],
  });
}
