import axios, { CanceledError } from "axios";
import { create } from "zustand";
import {
  apiClient,
  hotelAuthError,
  hotelAuthMutation,
  refreshHotelSession,
} from "../api/axiosClient.ts";
import {
  announceHotelSessionChange,
  clearHotelSession,
  hotelAuthLock,
  hotelSessionGeneration,
  hotelSessionUser,
  installHotelSession,
  invalidateHotelRequests,
  observeHotelSession,
} from "../auth/hotelSession.ts";
import type { ApiResponse } from "../types/api.types.ts";
import type {
  AuthTokens,
  CurrentUser,
  LoginCredentials,
} from "../types/auth.types.ts";

interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  restoreError: string | null;
  login: (input: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  clearError: () => void;
}
let checking: { generation: number; promise: Promise<void> } | null = null;
export const useAuthStore = create<AuthState>((set) => {
  observeHotelSession((user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      restoreError: null,
      ...(!user ? { isSubmitting: false } : {}),
    }),
  );
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isSubmitting: false,
    error: null,
    restoreError: null,
    clearError: () => set({ error: null }),
    login: async (input) => {
      clearHotelSession();
      const expected = hotelSessionGeneration();
      set({
        isLoading: true,
        isSubmitting: true,
        error: null,
        restoreError: null,
      });
      try {
        const response = await hotelAuthLock(() => {
          if (expected !== hotelSessionGeneration())
            throw new CanceledError("Hotel session changed");
          return apiClient.post<ApiResponse<AuthTokens>>("/auth/login", input);
        });
        if (expected !== hotelSessionGeneration())
          throw new CanceledError("Hotel session changed");
        installHotelSession(
          response.data.data.accessToken,
          response.data.data.user,
        );
        set({ isSubmitting: false });
        announceHotelSessionChange();
      } catch (error) {
        if (expected === hotelSessionGeneration())
          set({
            error: hotelAuthError(error),
            isLoading: false,
            isSubmitting: false,
          });
        throw error;
      }
    },
    logout: async () => {
      invalidateHotelRequests();
      const expected = hotelSessionGeneration();
      set({ isLoading: true, isSubmitting: true, error: null });
      try {
        await hotelAuthMutation(
          () => apiClient.post("/auth/logout", {}),
          expected,
        );
        if (expected !== hotelSessionGeneration())
          throw new CanceledError("Hotel session changed");
        if (expected === hotelSessionGeneration()) clearHotelSession(true);
      } catch (error) {
        if (expected !== hotelSessionGeneration()) {
          if (
            !hotelSessionUser() &&
            axios.isAxiosError(error) &&
            error.response?.status === 401
          )
            return;
          throw new CanceledError("Hotel session changed");
        }
        if (axios.isAxiosError(error) && error.response?.status === 401)
          clearHotelSession(true);
        else {
          set({ error: hotelAuthError(error) });
          throw error;
        }
      } finally {
        if (expected === hotelSessionGeneration())
          set({ isLoading: false, isSubmitting: false });
      }
    },
    checkAuth: async () => {
      const expected = hotelSessionGeneration();
      if (checking?.generation === expected) return checking.promise;
      set({ isLoading: true, restoreError: null });
      const promise = (async () => {
        try {
          await refreshHotelSession();
        } catch (error) {
          if (expected !== hotelSessionGeneration() || axios.isCancel(error))
            return;
          set({ isLoading: false, restoreError: hotelAuthError(error) });
        }
      })().finally(() => {
        if (checking?.promise === promise) checking = null;
      });
      checking = { generation: expected, promise };
      return promise;
    },
    changePassword: async (input) => {
      const expected = hotelSessionGeneration();
      await hotelAuthMutation(
        () => apiClient.post("/auth/change-password", input),
        expected,
      );
      if (expected !== hotelSessionGeneration())
        throw new CanceledError("Hotel session changed");
      clearHotelSession(true);
    },
  };
});
