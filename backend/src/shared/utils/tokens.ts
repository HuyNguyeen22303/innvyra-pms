import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../../config/env.js';
import { unauthorized } from '../errors/app-error.js';

export function newRefreshToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AccessTokens {
  private readonly key: Uint8Array;
  constructor(private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  async sign(userId: string, sessionId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(this.env.JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + this.env.accessTokenTtlSeconds)
      .sign(this.key);
  }

  async verify(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        typ: 'JWT',
        issuer: this.env.JWT_ISSUER,
        audience: this.env.JWT_AUDIENCE,
        requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'],
      });
      if (
        !payload.sub ||
        !/^[1-9]\d{0,19}$/.test(payload.sub) ||
        BigInt(payload.sub) > 18446744073709551615n ||
        typeof payload.sid !== 'string' ||
        !/^[0-9a-f-]{36}$/.test(payload.sid) ||
        typeof payload.iat !== 'number' ||
        payload.iat > Math.floor(Date.now() / 1000) ||
        typeof payload.jti !== 'string'
      )
        throw unauthorized();
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw unauthorized();
    }
  }
}
