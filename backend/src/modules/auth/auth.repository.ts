import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AuthRepository, NewSession, RotationResult } from './auth.types.js';

const staffInclude = { role: true } as const;
const sessionInclude = { staffUser: { include: staffInclude } } as const;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findStaffByUsername(username: string) {
    return this.prisma.staffUser.findUnique({ where: { username }, include: staffInclude });
  }

  async createSession(input: NewSession): Promise<void> {
    await this.prisma.authSession.create({
      data: {
        id: input.id,
        staffUserId: input.staffUserId,
        expiresAt: input.expiresAt,
        refreshTokens: { create: { tokenHash: input.tokenHash, expiresAt: input.expiresAt } },
      },
    });
  }

  findSession(id: string) {
    return this.prisma.authSession.findUnique({ where: { id }, include: sessionInclude });
  }

  async rotateRefreshToken(oldHash: string, newHash: string, now: Date): Promise<RotationResult> {
    return this.prisma.$transaction(
      async (tx): Promise<RotationResult> => {
        const candidate = await tx.refreshToken.findUnique({
          where: { tokenHash: oldHash },
          select: { sessionId: true },
        });
        if (!candidate) return { status: 'invalid' };
        // All rotation/revocation decisions are serialized on the family (session) row.
        await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${candidate.sessionId} FOR UPDATE`;
        const token = await tx.refreshToken.findUnique({ where: { tokenHash: oldHash } });
        const session = await tx.authSession.findUnique({
          where: { id: candidate.sessionId },
          include: sessionInclude,
        });
        if (!token || !session || session.revokedAt) return { status: 'invalid' };
        if (token.usedAt) {
          await tx.authSession.update({
            where: { id: session.id },
            data: { revokedAt: now, revokedReason: 'REFRESH_REUSE' },
          });
          // Return instead of throwing: the security revocation must COMMIT.
          return { status: 'reuse' };
        }
        if (token.expiresAt <= now || session.expiresAt <= now || !session.staffUser.isActive)
          return { status: 'invalid' };
        await tx.refreshToken.update({ where: { id: token.id }, data: { usedAt: now } });
        await tx.refreshToken.create({
          data: { sessionId: session.id, tokenHash: newHash, expiresAt: session.expiresAt },
        });
        return { status: 'ok', session };
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
    );
  }

  async revokeSession(id: string, staffUserId: bigint, now: Date): Promise<void> {
    // UPDATE takes the same session row lock as rotation, including concurrent logout.
    await this.prisma.authSession.updateMany({
      where: { id, staffUserId, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'LOGOUT' },
    });
  }
}
