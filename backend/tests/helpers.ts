import { randomBytes } from 'node:crypto';
import type { Response } from 'supertest';
import { parseEnv } from '../src/config/env.js';
import type {
  AuthRepository,
  CurrentUser,
  NewSession,
  RotationResult,
  SessionRecord,
  StaffRecord,
} from '../src/modules/auth/auth.types.js';

export const testPassword = 'Only-for-tests: correct horse battery!';
export const testEnv = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'mysql://test:test@127.0.0.1:3306/innvyra_pms_test',
  JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
  LOGIN_RATE_LIMIT_MAX: '1000',
});

export interface LoginBody {
  success: boolean;
  data: { accessToken: string; tokenType: string; expiresIn: number; user: CurrentUser };
}
export function body(response: Response): LoginBody {
  return response.body as LoginBody;
}
export function cookie(response: Response): string {
  const headers = response.headers['set-cookie'] as unknown as string[];
  const value = headers?.[0]?.split(';')[0];
  if (!value) throw new Error('Missing refresh cookie');
  return value;
}

interface MemoryToken {
  hash: string;
  sessionId: string;
  expiresAt: Date;
  usedAt: Date | null;
}
export class MemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, StaffRecord>();
  readonly sessions = new Map<string, SessionRecord>();
  readonly tokens = new Map<string, MemoryToken>();
  constructor(passwordHash: string) {
    this.users.set('admin', {
      id: 9007199254740993n,
      hotelId: 9007199254740995n,
      fullName: 'Test Admin',
      username: 'admin',
      email: null,
      passwordHash,
      isActive: true,
      role: { code: 'ADMIN' },
    });
    this.users.set('receptionist', {
      id: 2n,
      hotelId: 1n,
      fullName: 'Test Receptionist',
      username: 'receptionist',
      email: null,
      passwordHash,
      isActive: true,
      role: { code: 'RECEPTIONIST' },
    });
  }
  async findStaffByUsername(username: string) {
    return this.users.get(username) ?? null;
  }
  async createSession(input: NewSession) {
    const user = [...this.users.values()].find((staff) => staff.id === input.staffUserId);
    if (!user) throw new Error('Unknown staff');
    this.sessions.set(input.id, {
      id: input.id,
      staffUserId: input.staffUserId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      staffUser: user,
    });
    this.tokens.set(input.tokenHash, {
      hash: input.tokenHash,
      sessionId: input.id,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
  }
  async findSession(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async rotateRefreshToken(oldHash: string, newHash: string, now: Date): Promise<RotationResult> {
    // Synchronous state transition simulates the repository contract, NOT MySQL locking.
    const token = this.tokens.get(oldHash);
    const session = token ? this.sessions.get(token.sessionId) : undefined;
    if (!token || !session || session.revokedAt) return { status: 'invalid' };
    if (token.usedAt) {
      session.revokedAt = now;
      return { status: 'reuse' };
    }
    if (token.expiresAt <= now || session.expiresAt <= now || !session.staffUser.isActive)
      return { status: 'invalid' };
    token.usedAt = now;
    this.tokens.set(newHash, {
      hash: newHash,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      usedAt: null,
    });
    return { status: 'ok', session };
  }
  async revokeSession(id: string, staffUserId: bigint, now: Date) {
    const session = this.sessions.get(id);
    if (session?.staffUserId === staffUserId) session.revokedAt = now;
  }
}
