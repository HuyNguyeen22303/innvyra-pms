import type {
  NewPlatformSession,
  PlatformAdminRecord,
  PlatformAuthRepository,
  PlatformRotationResult,
  PlatformSessionRecord,
} from '../src/modules/platform-auth/platform-auth.types.js';

export class MemoryPlatformAuthRepository implements PlatformAuthRepository {
  readonly admins = new Map<string, PlatformAdminRecord>();
  readonly sessions = new Map<string, PlatformSessionRecord & { revokedReason: string | null }>();
  readonly tokens = new Map<string, { sessionId: string; expiresAt: Date; usedAt: Date | null }>();
  constructor(passwordHash: string) {
    this.admins.set('owner@example.test', {
      id: 1n,
      email: 'owner@example.test',
      fullName: 'Innvyra Owner',
      passwordHash,
      isActive: true,
    });
  }
  async findAdminByEmail(email: string) {
    return this.admins.get(email) ?? null;
  }
  async findAdminById(id: bigint) {
    return [...this.admins.values()].find((admin) => admin.id === id) ?? null;
  }
  async findSession(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async createSession(input: NewPlatformSession) {
    const admin = await this.findAdminById(input.platformAdminId);
    if (!admin?.isActive || admin.passwordHash !== input.expectedPasswordHash) return false;
    this.sessions.set(input.id, {
      id: input.id,
      platformAdminId: admin.id,
      platformAdmin: admin,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedReason: null,
    });
    this.tokens.set(input.tokenHash, {
      sessionId: input.id,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
    return true;
  }
  async rotateRefreshToken(
    oldHash: string,
    newHash: string,
    now: Date,
  ): Promise<PlatformRotationResult> {
    const token = this.tokens.get(oldHash);
    const session = token ? this.sessions.get(token.sessionId) : undefined;
    if (!token || !session || session.revokedAt) return { status: 'invalid' };
    if (token.usedAt) {
      session.revokedAt = now;
      session.revokedReason = 'REFRESH_REUSE';
      return { status: 'reuse' };
    }
    if (token.expiresAt <= now || session.expiresAt <= now || !session.platformAdmin.isActive)
      return { status: 'invalid' };
    token.usedAt = now;
    this.tokens.set(newHash, { sessionId: session.id, expiresAt: session.expiresAt, usedAt: null });
    return { status: 'ok', session };
  }
  async revokeSession(id: string, adminId: bigint, now: Date) {
    const session = this.sessions.get(id);
    if (session?.platformAdminId === adminId && !session.revokedAt) {
      session.revokedAt = now;
      session.revokedReason = 'LOGOUT';
    }
  }
  async changePassword(id: bigint, expectedHash: string, newHash: string, now: Date) {
    const admin = await this.findAdminById(id);
    if (!admin?.isActive || admin.passwordHash !== expectedHash) return false;
    admin.passwordHash = newHash;
    for (const session of this.sessions.values()) {
      if (session.platformAdminId === id && !session.revokedAt) {
        session.revokedAt = now;
        session.revokedReason = 'PASSWORD_CHANGED';
      }
    }
    return true;
  }
}
