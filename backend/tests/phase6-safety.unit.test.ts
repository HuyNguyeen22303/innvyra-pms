import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { parseEnv } from '../src/config/env.js';
import { isolatedMySql } from './isolated-mysql.js';
import { seedPhase6Scenario } from '../scripts/phase6/scenario.js';

const ownedName = `innvyra_phase_six_${'a'.repeat(32)}_test`;
const env = (database: string, nodeEnv = 'test') =>
  parseEnv({
    NODE_ENV: nodeEnv,
    DATABASE_URL: `mysql://fixture:fixture@127.0.0.1:3306/${database}`,
    JWT_ACCESS_SECRET: 'fixture-only-long-and-varied-secret-12345678901234567890',
  });
afterEach(() => vi.unstubAllEnvs());
describe('Phase 6 seed refuses unsafe targets before any mutation', () => {
  it.each(['innvyra_pms', 'innvyra_pms_test', 'innvyra_phase_six_test'])(
    'refuses schema %s even under NODE_ENV=test',
    async (name) => {
      const query = vi.fn();
      await expect(
        seedPhase6Scenario({ $queryRaw: query } as unknown as PrismaClient, env(name)),
      ).rejects.toThrow('newly owned');
      expect(query).not.toHaveBeenCalled();
    },
  );
  it('refuses non-test mode before connecting', async () => {
    const query = vi.fn();
    await expect(
      seedPhase6Scenario(
        { $queryRaw: query } as unknown as PrismaClient,
        env(ownedName, 'development'),
      ),
    ).rejects.toThrow('newly owned');
    expect(query).not.toHaveBeenCalled();
  });
  it('verifies the actual Prisma connection rather than trusting a supplied URL', async () => {
    const query = vi.fn().mockResolvedValue([{ name: 'application_database' }]);
    const count = vi.fn();
    await expect(
      seedPhase6Scenario(
        { $queryRaw: query, hotel: { count } } as unknown as PrismaClient,
        env(ownedName),
      ),
    ).rejects.toThrow('connection does not match');
    expect(count).not.toHaveBeenCalled();
  });
  it('refuses the application database even if its name has the owned-test pattern', async () => {
    vi.stubEnv('DATABASE_URL', env(ownedName).DATABASE_URL);
    const count = vi.fn();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ name: ownedName }]),
      hotel: { count },
    } as unknown as PrismaClient;
    await expect(seedPhase6Scenario(prisma, env(ownedName))).rejects.toThrow(
      'connection does not match',
    );
    expect(count).not.toHaveBeenCalled();
  });
  it.each([
    ['production', 'mysql://fixture:fixture@127.0.0.1:3306/safe_test', 'phase_six'],
    ['test', 'mysql://fixture:fixture@remote.example.test:3306/safe_test', 'phase_six'],
    ['test', 'mysql://fixture:fixture@127.0.0.1:3306/innvyra_pms', 'phase_six'],
    ['test', 'mysql://fixture:fixture@127.0.0.1:3306/app_test', 'phase_six'],
    ['test', 'mysql://fixture:fixture@127.0.0.1:3306/safe_test', 'bad`identifier'],
  ])(
    'isolated fixture rejects %s / unsafe target or label without opening a server connection',
    async (nodeEnv, testUrl, label) => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('DATABASE_URL', 'mysql://fixture:fixture@127.0.0.1:3306/app_test');
      vi.stubEnv('TEST_DATABASE_URL', testUrl);
      await expect(isolatedMySql(label)).rejects.toThrow();
    },
  );
});
