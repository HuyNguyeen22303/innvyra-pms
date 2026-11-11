import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';
import { AppError, unauthorized } from '../../shared/errors/app-error.js';
import { getDummyPasswordHash, hashPassword, verifyPassword } from '../../shared/utils/password.js';
import { AccessTokens, hashRefreshToken, newRefreshToken } from '../../shared/utils/tokens.js';
import type { PlatformLoginInput, PlatformPasswordInput } from './platform-auth.schema.js';
import type {
  CurrentPlatformAdmin,
  PlatformAdminRecord,
  PlatformAuthRepository,
  PlatformPrincipal,
} from './platform-auth.types.js';

export function platformAccessTokens(env: Env) {
  return new AccessTokens({ ...env, JWT_AUDIENCE: `${env.JWT_AUDIENCE}:platform` });
}
function currentUser(admin: PlatformAdminRecord): CurrentPlatformAdmin {
  return {
    id: admin.id.toString(),
    fullName: admin.fullName,
    email: admin.email,
    role: 'PLATFORM_ADMIN',
    isActive: admin.isActive,
  };
}

export class PlatformAuthService {
  private readonly tokens: AccessTokens;
  constructor(
    private readonly repository: PlatformAuthRepository,
    private readonly env: Env,
  ) {
    this.tokens = platformAccessTokens(env);
  }
  async login(input: PlatformLoginInput) {
    const admin = await this.repository.findAdminByEmail(input.email);
    const valid = await verifyPassword(
      admin?.passwordHash ?? (await getDummyPasswordHash()),
      input.password,
    );
    if (!admin?.isActive || !valid)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    const sessionId = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.env.PLATFORM_REFRESH_TOKEN_EXPIRES_IN_DAYS * 86400000,
    );
    const refresh = newRefreshToken();
    const created = await this.repository.createSession({
      id: sessionId,
      platformAdminId: admin.id,
      expectedPasswordHash: admin.passwordHash,
      expiresAt,
      tokenHash: refresh.hash,
    });
    if (!created) throw unauthorized();
    return {
      data: {
        accessToken: await this.tokens.sign(admin.id.toString(), sessionId),
        tokenType: 'Bearer' as const,
        expiresIn: this.env.accessTokenTtlSeconds,
        user: currentUser(admin),
      },
      refreshToken: refresh.token,
      expiresAt,
    };
  }
  async refresh(raw: unknown) {
    if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw unauthorized();
    const refresh = newRefreshToken();
    const result = await this.repository.rotateRefreshToken(
      hashRefreshToken(raw),
      refresh.hash,
      new Date(),
    );
    if (result.status !== 'ok') throw unauthorized();
    const user = currentUser(result.session.platformAdmin);
    return {
      data: {
        accessToken: await this.tokens.sign(user.id, result.session.id),
        tokenType: 'Bearer' as const,
        expiresIn: this.env.accessTokenTtlSeconds,
        user,
      },
      refreshToken: refresh.token,
      expiresAt: result.session.expiresAt,
    };
  }
  async authenticate(token: string): Promise<PlatformPrincipal> {
    const claims = await this.tokens.verify(token);
    const session = await this.repository.findSession(claims.sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.platformAdminId.toString() !== claims.userId ||
      !session.platformAdmin.isActive
    )
      throw unauthorized();
    return { sessionId: session.id, user: currentUser(session.platformAdmin) };
  }
  async logout(principal: PlatformPrincipal) {
    await this.repository.revokeSession(principal.sessionId, BigInt(principal.user.id), new Date());
  }
  async changePassword(principal: PlatformPrincipal, input: PlatformPasswordInput) {
    const admin = await this.repository.findAdminById(BigInt(principal.user.id));
    if (!admin?.isActive) throw unauthorized();
    if (!(await verifyPassword(admin.passwordHash, input.currentPassword)))
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    const changed = await this.repository.changePassword(
      admin.id,
      admin.passwordHash,
      await hashPassword(input.newPassword),
      new Date(),
    );
    if (!changed)
      throw new AppError(409, 'PASSWORD_CHANGE_CONFLICT', 'Account changed; sign in again');
  }
}
