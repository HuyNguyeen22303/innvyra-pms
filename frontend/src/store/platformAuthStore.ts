import axios, { CanceledError } from "axios";
import { create } from "zustand";
import {
  clearPlatformSession,
  observePlatformSession,
  platformAuthLock,
  platformAuthMutation,
  platformAuthorization,
  platformClient,
  platformErrorMessage,
  platformSessionGeneration,
  refreshPlatformSession,
  setPlatformAccessToken,
} from "../api/platformClient.ts";
import type { ApiResponse } from "../types/api.types.ts";
import type {
  PlatformCredentials,
  PlatformPasswordChange,
  PlatformTokens,
  PlatformUser,
} from "../types/platform.types.ts";

interface PlatformState {
  user: PlatformUser | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  restoreError: string | null;
  checkAuth: () => Promise<void>;
  login: (input: PlatformCredentials) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (input: PlatformPasswordChange) => Promise<void>;
  clearError: () => void;
}
let checking: Promise<void> | null = null;
let checkingGeneration = -1;

export const usePlatformAuthStore = create<PlatformState>((set) => {
  observePlatformSession((user) =>
    set({
      user,
      isLoading: false,
      restoreError: null,
      ...(user ? {} : { isSubmitting: false }),
    }),
  );
  return {
    user: null,
    isLoading: true,
    isSubmitting: false,
    error: null,
    restoreError: null,
    clearError: () => set({ error: null }),
    checkAuth: async () => {
      const expected = platformSessionGeneration();
      if (checking && checkingGeneration === expected) return checking;
      set({ isLoading: true, restoreError: null });
      const request = (async () => {
        try {
          await refreshPlatformSession(); // The observer installs only the current identity.
        } catch (error: unknown) {
          if (expected !== platformSessionGeneration()) return;
          if (axios.isCancel(error)) return;
          const anonymous =
            axios.isAxiosError(error) &&
            [401, 403].includes(error.response?.status ?? 0);
          set({
            user: null,
            isLoading: false,
            restoreError: anonymous ? null : platformErrorMessage(error),
          });
        }
      })().finally(() => {
        if (checking === request) checking = null;
      });
      checking = request;
      checkingGeneration = expected;
      return request;
    },
    login: async (input) => {
      clearPlatformSession();
      const expected = platformSessionGeneration();
      set({ isSubmitting: true, error: null, restoreError: null });
      try {
        const response = await platformAuthLock(() => {
          if (expected !== platformSessionGeneration())
            throw new CanceledError("Platform session changed");
          return platformClient.post<ApiResponse<PlatformTokens>>(
            "/auth/login",
            input,
          );
        });
        if (expected !== platformSessionGeneration()) return;
        setPlatformAccessToken(
          response.data.data.accessToken,
          response.data.data.user.id,
        );
        set({
          user: response.data.data.user,
          isLoading: false,
          isSubmitting: false,
        });
      } catch (error: unknown) {
        if (expected === platformSessionGeneration())
          set({ error: platformErrorMessage(error), isSubmitting: false });
        throw error;
      }
    },
    logout: async () => {
      const headers = platformAuthorization();
      const expected = platformSessionGeneration();
      set({ error: null, isSubmitting: true });
      try {
        await platformAuthMutation(
          () =>
            platformClient.post(
              "/auth/logout",
              {},
              {
                headers:
                  platformSessionGeneration() === expected
                    ? platformAuthorization()
                    : headers,
              },
            ),
          expected,
        );
        if (expected === platformSessionGeneration())
          clearPlatformSession(true);
      } catch (error: unknown) {
        if (expected !== platformSessionGeneration()) return;
        if (axios.isAxiosError(error) && error.response?.status === 401)
          clearPlatformSession(true);
        else {
          set({ error: platformErrorMessage(error) });
          throw error;
        }
      } finally {
        if (expected === platformSessionGeneration())
          set({ isSubmitting: false });
      }
    },
    changePassword: async (input) => {
      const expected = platformSessionGeneration();
      await platformAuthMutation(() => {
        if (expected !== platformSessionGeneration())
          throw new CanceledError("Platform session changed");
        return platformClient.post("/auth/change-password", input);
      }, expected);
      if (expected === platformSessionGeneration()) {
        clearPlatformSession(true);
        set({ error: null, isSubmitting: false });
      }
    },
  };
});
