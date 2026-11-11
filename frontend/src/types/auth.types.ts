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
  mustChangePassword?: boolean;
  hotel?: { id: string; code: string; name: string; timezone: string };
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
