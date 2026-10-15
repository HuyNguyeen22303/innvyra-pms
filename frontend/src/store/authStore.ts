import { create } from 'zustand';
import { authApi } from '../api/auth.api.ts';
import { setAccessToken } from '../api/axiosClient.ts';
import type { CurrentUser, LoginCredentials } from '../types/auth.types.ts';

interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for unauthorized events from axios interceptor
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
      set({ user: null, isAuthenticated: false });
    });
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    login: async (credentials: LoginCredentials) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authApi.login(credentials);
        const { accessToken, user } = response.data;
        setAccessToken(accessToken);
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error?.message || 'Đăng nhập không thành công. Vui lòng thử lại!';
        set({ error: errorMessage, isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await authApi.logout();
      } catch {
        // Ignore logout network errors and clear client session anyway
      } finally {
        setAccessToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        // Try to refresh token using existing HttpOnly cookie
        const refreshRes = await authApi.refreshToken();
        const { accessToken } = refreshRes.data;
        setAccessToken(accessToken);

        // Fetch current user details
        const meRes = await authApi.getMe();
        set({ user: meRes.data, isAuthenticated: true, isLoading: false });
      } catch {
        setAccessToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});
