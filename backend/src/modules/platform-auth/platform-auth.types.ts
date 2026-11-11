export interface PlatformAdminRecord {
  id: bigint;
  email: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
}
export interface CurrentPlatformAdmin {
  id: string;
  email: string;
  fullName: string;
  role: 'PLATFORM_ADMIN';
  isActive: boolean;
}
export interface PlatformPrincipal {
  sessionId: string;
  user: CurrentPlatformAdmin;
}
export interface PlatformSessionRecord {
  id: string;
  platformAdminId: bigint;
  expiresAt: Date;
  revokedAt: Date | null;
  platformAdmin: PlatformAdminRecord;
}
export interface NewPlatformSession {
  id: string;
  platformAdminId: bigint;
  expectedPasswordHash: string;
  expiresAt: Date;
  tokenHash: string;
}
export type PlatformRotationResult =
  { status: 'ok'; session: PlatformSessionRecord } | { status: 'invalid' | 'reuse' };
export interface PlatformAuthRepository {
  findAdminByEmail(email: string): Promise<PlatformAdminRecord | null>;
  findAdminById(id: bigint): Promise<PlatformAdminRecord | null>;
  createSession(input: NewPlatformSession): Promise<boolean>;
  findSession(id: string): Promise<PlatformSessionRecord | null>;
  rotateRefreshToken(oldHash: string, newHash: string, now: Date): Promise<PlatformRotationResult>;
  revokeSession(id: string, adminId: bigint, now: Date): Promise<void>;
  changePassword(id: bigint, expectedHash: string, newHash: string, now: Date): Promise<boolean>;
}
