import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  NewPlatformSession,
  PlatformAuthRepository,
  PlatformRotationResult,
} from './platform-auth.types.js';

const include = { platformAdmin: true } as const;
const transactionOptions = {
  isolationLevel: 'ReadCommitted',
  maxWait: 5000,
  timeout: 10000,
} as const;

export class PrismaPlatformAuthRepository implements PlatformAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAdminByEmail(email: string) {
    return this.prisma.platformAdmin.findUnique({ where: { email } });
  }
  findAdminById(id: bigint) {
    return this.prisma.platformAdmin.findUnique({ where: { id } });
  }
  findSession(id: string) {
    return this.prisma.platformAuthSession.findUnique({ where: { id }, include });
  }

  async createSession(input: NewPlatformSession): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_admins WHERE id = ${input.platformAdminId} FOR UPDATE`;
      const admin = await tx.platformAdmin.findUnique({ where: { id: input.platformAdminId } });
      // Password verification happens outside the transaction. Recheck under the
      // same admin lock as password changes so stale credentials cannot create a session.
      if (!admin?.isActive || admin.passwordHash !== input.expectedPasswordHash) return false;
      await tx.platformAuthSession.create({
        data: {
          id: input.id,
          platformAdminId: admin.id,
          expiresAt: input.expiresAt,
          refreshTokens: { create: { tokenHash: input.tokenHash, expiresAt: input.expiresAt } },
        },
      });
      return true;
    }, transactionOptions);
  }

  async rotateRefreshToken(
    oldHash: string,
    newHash: string,
    now: Date,
  ): Promise<PlatformRotationResult> {
    return this.prisma.$transaction(async (tx): Promise<PlatformRotationResult> => {
      const candidate = await tx.platformRefreshToken.findUnique({
        where: { tokenHash: oldHash },
        select: { sessionId: true },
      });
      if (!candidate) return { status: 'invalid' };
      await tx.$queryRaw`SELECT id FROM platform_auth_sessions WHERE id = ${candidate.sessionId} FOR UPDATE`;
      const token = await tx.platformRefreshToken.findUnique({ where: { tokenHash: oldHash } });
      const session = await tx.platformAuthSession.findUnique({
        where: { id: candidate.sessionId },
        include,
      });
      if (!token || !session || session.revokedAt) return { status: 'invalid' };
      if (token.usedAt) {
        await tx.platformAuthSession.update({
          where: { id: session.id },
          data: {
            revokedAt: now,
            revokedReason: 'REFRESH_REUSE',
          },
        });
        return { status: 'reuse' }; // Commit the revocation instead of rolling it back with an exception.
      }
      if (token.expiresAt <= now || session.expiresAt <= now || !session.platformAdmin.isActive)
        return { status: 'invalid' };
      await tx.platformRefreshToken.update({ where: { id: token.id }, data: { usedAt: now } });
      await tx.platformRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: newHash,
          expiresAt: session.expiresAt,
        },
      });
      return { status: 'ok', session };
    }, transactionOptions);
  }

  async revokeSession(id: string, adminId: bigint, now: Date): Promise<void> {
    await this.prisma.platformAuthSession.updateMany({
      where: { id, platformAdminId: adminId, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'LOGOUT' },
    });
  }

  async changePassword(
    id: bigint,
    expectedHash: string,
    newHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_admins WHERE id = ${id} FOR UPDATE`;
      const admin = await tx.platformAdmin.findUnique({ where: { id } });
      if (!admin?.isActive || admin.passwordHash !== expectedHash) return false;
      await tx.platformAdmin.update({ where: { id }, data: { passwordHash: newHash } });
      await tx.platformAuthSession.updateMany({
        where: { platformAdminId: id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'PASSWORD_CHANGED' },
      });
      return true;
    }, transactionOptions);
  }
}
