import { describe, expect, it } from 'vitest';
import { parse } from 'dotenv';
import { localDatabaseUrl, replaceDatabaseUrl } from '../scripts/local-seed/config.js';
const original = 'mysql://fixture:fixture%23test@127.0.0.1:3306/innvyra_pms';
const target = 'mysql://fixture:fixture%23test@127.0.0.1:3306/innvyra_pms_multi_hotel';
describe('Persistent local seed: safe configuration switch', () => {
  it('changes only the schema name while retaining encoded connection credentials', () =>
    expect(localDatabaseUrl(original, 'innvyra_pms_multi_hotel')).toBe(target));
  it.each([
    'innvyra_pms',
    'other_app',
    'innvyra_pms_multi_hotel`;DROP DATABASE x',
    '../innvyra_pms_multi_hotel',
  ])('refuses unsafe target %s', (name) =>
    expect(() => localDatabaseUrl(original, name)).toThrow(),
  );
  it('refuses to seed the active application target again', () =>
    expect(() => localDatabaseUrl(target, 'innvyra_pms_multi_hotel')).toThrow(
      'cannot be seeded again',
    ));
  it('allows read-only verification of the active database', () =>
    expect(localDatabaseUrl(target, 'innvyra_pms_multi_hotel', false)).toBe(target));
  it('refuses remote connections even for an approved database name', () =>
    expect(() =>
      localDatabaseUrl(
        original.replace('127.0.0.1', 'remote.example.test'),
        'innvyra_pms_multi_hotel',
      ),
    ).toThrow());
  it.each(['\n', '\r\n'])(
    'preserves all unrelated settings and %j line endings, including guest keys',
    (newline) => {
      const input = [
        '# local app',
        `DATABASE_URL="${original}"`,
        'JWT_ACCESS_SECRET="unchanged"',
        'GUEST_ENCRYPTION_KEY="original-key"',
        'GUEST_HASH_KEY="original-hash"',
        'PORT=3000',
        '',
      ].join(newline);
      const output = replaceDatabaseUrl(input, target);
      expect(output.split(newline).filter((line) => !line.startsWith('DATABASE_URL'))).toEqual(
        input.split(newline).filter((line) => !line.startsWith('DATABASE_URL')),
      );
      expect(parse(output).DATABASE_URL).toBe(target);
    },
  );
  it('handles an exported key and UTF-8 BOM without touching comments or similar variable names', () => {
    const input = `\uFEFF# DATABASE_URL=comment\nDATABASE_URL_EXTRA=x\n export DATABASE_URL = "${original}"\n`;
    const output = replaceDatabaseUrl(input, target);
    expect(output.startsWith('\uFEFF')).toBe(true);
    expect(output).toContain('DATABASE_URL_EXTRA=x');
    expect(parse(output).DATABASE_URL).toBe(target);
  });
  it.each([`PORT=3000\n`, `DATABASE_URL="${original}"\nDATABASE_URL="${original}"\n`])(
    'refuses missing or ambiguous URL lines',
    (contents) => expect(() => replaceDatabaseUrl(contents, target)).toThrow('exactly one'),
  );
});
