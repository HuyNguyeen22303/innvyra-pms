import 'dotenv/config';
import { createConnection } from 'mariadb';
import { databaseOptions, createPrisma } from '../src/database/prisma.js';

export function requiredDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return process.env.DATABASE_URL;
}
export function scriptPrisma() {
  return createPrisma(
    requiredDatabaseUrl(),
    process.env.DATABASE_SSL === 'true',
    process.env.DATABASE_SSL_CA_FILE,
  );
}
export async function inspectDatabase() {
  const conn = await createConnection(
    databaseOptions(
      requiredDatabaseUrl(),
      process.env.DATABASE_SSL === 'true',
      process.env.DATABASE_SSL_CA_FILE,
    ),
  );
  try {
    const tables = await conn.query<{ name: string }[]>(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
    );
    const columns = await conn.query<
      { tableName: string; columnName: string; columnType: string; nullable: string }[]
    >(
      'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION',
    );
    return { tables: tables.map((row) => row.name), columns };
  } finally {
    await conn.end();
  }
}
