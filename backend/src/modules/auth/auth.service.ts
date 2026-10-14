import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';
import { AppError, unauthorized } from '../../shared/errors/app-error.js';
import { isRoleCode } from '../../shared/types/roles.js';
import { getDummyPasswordHash, verifyPassword } from '../../shared/utils/password.js';
import { AccessTokens, hashRefreshToken, newRefreshToken } from '../../shared/utils/tokens.js';
import type { LoginInput } from './auth.schema.js';
import type { AuthRepository, CurrentUser, Principal, StaffRecord } from './auth.types.js';

function currentUser(staff: StaffRecord): CurrentUser {
  if (!isRoleCode(staff.role.code)) throw new AppError(403, 'FORBIDDEN', 'Role is not authorized');
  return {
    id: staff.id.toString(),
    hotelId: staff.hotelId.toString(),
    fullName: staff.fullName,
    username: staff.username,
    email: staff.email,
    role: staff.role.code,
    isActive: staff.isActive,
  };
}

export class AuthService {
  private readonly tokens: AccessTokens;
  constructor(
    private readonly repository: AuthRepository,
    private readonly env: Env,
  ) {
    this.tokens = new AccessTokens(env);
  }

  async login(input: LoginInput) {
    const staff = await this.repository.findStaffByUsername(input.username);
    const hash = staff?.passwordHash ?? (await getDummyPasswordHash());
    const valid = await verifyPassword(hash, input.password);
    if (!staff || !valid || !staff.isActive)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    const user = currentUser(staff);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86400000);
    const refresh = newRefreshToken();
    const accessToken = await this.tokens.sign(user.id, sessionId);
    await this.repository.createSession({
      id: sessionId,
      staffUserId: staff.id,
      expiresAt,
      tokenHash: refresh.hash,
    });
    return {
      data: {
        accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: this.env.accessTokenTtlSeconds,
        user,
      },
      refreshToken: refresh.token,
      expiresAt,
    };
  }

  async refresh(rawToken: unknown) {
    if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw unauthorized();
    const refresh = newRefreshToken();
    const result = await this.repository.rotateRefreshToken(
      hashRefreshToken(rawToken),
      refresh.hash,
      new Date(),
    );
    if (result.status !== 'ok') throw unauthorized();
    const user = currentUser(result.session.staffUser);
    const accessToken = await this.tokens.sign(user.id, result.session.id);
    return {
      data: {
        accessToken,
        tokenType: 'Bearer' as const,
        expiresIn: this.env.accessTokenTtlSeconds,
        user,
      },
      refreshToken: refresh.token,
      expiresAt: result.session.expiresAt,
    };
  }

  async authenticate(token: string): Promise<Principal> {
    const claims = await this.tokens.verify(token);
    const session = await this.repository.findSession(claims.sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.staffUserId.toString() !== claims.userId ||
      !session.staffUser.isActive
    )
      throw unauthorized();
    return { sessionId: session.id, user: currentUser(session.staffUser) };
  }

  async logout(principal: Principal): Promise<void> {
    await this.repository.revokeSession(principal.sessionId, BigInt(principal.user.id), new Date());
  }
}
