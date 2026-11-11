export interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  role: "PLATFORM_ADMIN";
  isActive: boolean;
}
export interface PlatformCredentials {
  email: string;
  password: string;
}
export interface PlatformTokens {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PlatformUser;
}
export interface PlatformPasswordChange {
  currentPassword: string;
  newPassword: string;
}
