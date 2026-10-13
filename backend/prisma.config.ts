import 'dotenv/config';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

function datasourceUrl(): string | undefined {
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  if (process.env.DATABASE_SSL === 'true') {
    url.searchParams.set('sslaccept', 'strict');
    if (process.env.DATABASE_SSL_CA_FILE) {
      url.searchParams.set('sslcert', resolve(process.env.DATABASE_SSL_CA_FILE));
    }
  }
  return url.toString();
}
const url = datasourceUrl();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // Optional here so generate/typecheck/build work without a database or secrets.
  ...(url ? { datasource: { url } } : {}),
});
