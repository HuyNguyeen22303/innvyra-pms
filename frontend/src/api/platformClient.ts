import axios, {
  CanceledError,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "../types/api.types.ts";
import type { PlatformTokens, PlatformUser } from "../types/platform.types.ts";

const baseURL = `${(import.meta.env?.VITE_API_URL || "/api/v1").replace(/\/$/, "")}/platform`;
export const platformClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
});
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "X-CSRF-Protection": "1" },
});

let token: string | null = null;
let subjectId: string | null = null;
let generation = 0;
let refreshing: Promise<PlatformTokens> | null = null;
let observer: (user: PlatformUser | null) => void = () => {};
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("innvyra-platform-session")
    : null;

export function observePlatformSession(callback: typeof observer) {
  observer = callback;
}
export function platformSessionGeneration() {
  return generation;
}
export function setPlatformAccessToken(value: string, userId: string) {
  token = value;
  subjectId = userId;
}
export function clearPlatformSession(broadcast = false) {
  generation += 1;
  token = null;
  subjectId = null;
  refreshing = null;
  observer(null);
  if (broadcast) channel?.postMessage("signed-out");
}
channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.data === "signed-out") clearPlatformSession();
});

// Serialize cookie rotation between tabs as well as coalescing it within this tab.
export async function platformAuthLock<T>(
  action: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("innvyra-platform-auth", action);
  return action();
}

export function refreshPlatformSession(): Promise<PlatformTokens> {
  if (refreshing) return refreshing;
  const expected = generation;
  const request = platformAuthLock(async () => {
    if (expected !== generation)
      throw new CanceledError("Platform session changed");
    const response = await refreshClient.post<ApiResponse<PlatformTokens>>(
      "/auth/refresh",
      {},
    );
    if (expected !== generation)
      throw new CanceledError("Platform session changed");
    const result = response.data.data;
    if (subjectId && subjectId !== result.user.id) generation += 1;
    subjectId = result.user.id;
    token = result.accessToken;
    observer(result.user);
    return result;
  })
    .catch((error: unknown) => {
      if (
        expected === generation &&
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      )
        clearPlatformSession();
      throw error;
    })
    .finally(() => {
      if (refreshing === request) refreshing = null;
    });
  refreshing = request;
  return request;
}

interface PlatformRequest extends InternalAxiosRequestConfig {
  _platformGeneration?: number;
  _platformRetry?: boolean;
}
platformClient.interceptors.request.use((config) => {
  const request = config as PlatformRequest;
  request._platformGeneration = generation;
  if (token && !request.headers.Authorization)
    request.headers.Authorization = `Bearer ${token}`;
  return request;
});
platformClient.interceptors.response.use(
  (response) => {
    if ((response.config as PlatformRequest)._platformGeneration !== generation)
      throw new CanceledError("Platform session changed");
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as PlatformRequest | undefined;
    if (!request || request._platformGeneration !== generation)
      throw new CanceledError("Platform session changed");
    const terminalAuth = [
      "/auth/login",
      "/auth/refresh",
      "/auth/logout",
      "/auth/change-password",
    ].includes(request.url ?? "");
    if (error.response?.status !== 401 || terminalAuth) throw error;
    if (request._platformRetry) {
      clearPlatformSession();
      throw error;
    }
    request._platformRetry = true;
    const current = token;
    const newToken =
      current && request.headers.Authorization !== `Bearer ${current}`
        ? current
        : (await refreshPlatformSession()).accessToken;
    if (request._platformGeneration !== generation)
      throw new CanceledError("Platform identity changed");
    request.headers.Authorization = `Bearer ${newToken}`;
    return platformClient(request);
  },
);

export function platformAuthorization() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Do not hold a browser auth lock while requesting another auth lock for refresh.
export async function platformAuthMutation<T>(
  action: () => Promise<T>,
  expected: number,
): Promise<T> {
  const run = () =>
    platformAuthLock(() => {
      if (expected !== generation)
        throw new CanceledError("Platform session changed");
      return action();
    });
  try {
    return await run();
  } catch (error: unknown) {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      expected !== generation
    )
      throw error;
    await refreshPlatformSession();
    return run();
  }
}

export function platformErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error))
    return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
  const code = (
    error.response?.data as { error?: { code?: string } } | undefined
  )?.error?.code;
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
    INVALID_CURRENT_PASSWORD: "Mật khẩu hiện tại không đúng.",
    PASSWORD_CHANGE_CONFLICT: "Tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
    VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
    RATE_LIMITED: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
    UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    CSRF_REJECTED: "Không thể xác nhận yêu cầu. Vui lòng tải lại trang.",
  };
  return code && messages[code]
    ? messages[code]
    : "Không thể kết nối tới Innvyra. Vui lòng thử lại.";
}
