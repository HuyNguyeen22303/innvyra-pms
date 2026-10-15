export type Role =
  | 'ADMIN'
  | 'MANAGER'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'HOUSEKEEPING'
  | 'TECHNICIAN';

export interface CurrentUser {
  id: string;
  hotelId: string;
  fullName: string;
  username: string;
  email: string | null;
  role: Role;
  isActive: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: CurrentUser;
}
