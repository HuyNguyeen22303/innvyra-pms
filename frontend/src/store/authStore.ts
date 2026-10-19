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

// React StrictMode runs mount effects twice in development. Share one refresh
// operation so both effect calls cannot rotate the same refresh cookie at once.
let authCheckPromise: Promise<void> | null = null;

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
      if (authCheckPromise) return authCheckPromise;

      authCheckPromise = (async () => {
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
      })();

      try {
        await authCheckPromise;
      } finally {
        authCheckPromise = null;
      }
    },

    clearError: () => set({ error: null }),
  };
});
