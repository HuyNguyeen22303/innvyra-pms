import { parse as parseDotenv } from 'dotenv';
import { databaseUrlSchema } from '../../src/config/env.js';

export function localDatabaseUrl(source: string, name: string, creating = true) {
  if (!databaseUrlSchema.safeParse(source).success)
    throw new Error('Invalid local database configuration');
  const url = new URL(source);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^innvyra_pms_multi_hotel(?:_[A-Za-z0-9_]+)?$/.test(name) ||
    name.length > 64
  )
    throw new Error('Choose a separate local innvyra_pms_multi_hotel database');
  if (creating && url.pathname === `/${name}`)
    throw new Error('Current application database cannot be seeded again');
  url.pathname = `/${name}`;
  return url.toString();
}

// Change exactly the database URL line. JWT, guest encryption keys, unrelated
// settings, comments on other lines and Windows line endings remain intact.
export function replaceDatabaseUrl(contents: string, nextUrl: string) {
  if (!databaseUrlSchema.safeParse(nextUrl).success) throw new Error('Invalid target database URL');
  const bom = contents.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = bom ? contents.slice(1) : contents;
  const pattern = /^([ \t]*(?:export[ \t]+)?DATABASE_URL[ \t]*=)[^\r\n]*/gm;
  if ([...body.matchAll(pattern)].length !== 1 || !parseDotenv(contents).DATABASE_URL)
    throw new Error('Expected exactly one active DATABASE_URL line');
  return bom + body.replace(pattern, (_line, prefix: string) => prefix + JSON.stringify(nextUrl));
}
