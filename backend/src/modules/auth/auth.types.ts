import type { RoleCode } from '../../shared/types/roles.js';

export interface StaffRecord {
  id: bigint;
  hotelId: bigint;
  fullName: string;
  username: string;
  email: string | null;
  passwordHash: string;
  isActive: boolean;
  role: { code: string };
}

export interface CurrentUser {
  id: string;
  hotelId: string;
  fullName: string;
  username: string;
  email: string | null;
  role: RoleCode;
  isActive: boolean;
}

export interface Principal {
  sessionId: string;
  user: CurrentUser;
}
export interface SessionRecord {
  id: string;
  staffUserId: bigint;
  expiresAt: Date;
  revokedAt: Date | null;
  staffUser: StaffRecord;
}
export interface NewSession {
  id: string;
  staffUserId: bigint;
  expiresAt: Date;
  tokenHash: string;
}
export type RotationResult =
  { status: 'ok'; session: SessionRecord } | { status: 'invalid' | 'reuse' };

export interface AuthRepository {
  findStaffByUsername(username: string): Promise<StaffRecord | null>;
  createSession(input: NewSession): Promise<void>;
  findSession(id: string): Promise<SessionRecord | null>;
  rotateRefreshToken(oldHash: string, newHash: string, now: Date): Promise<RotationResult>;
  revokeSession(id: string, staffUserId: bigint, now: Date): Promise<void>;
}
