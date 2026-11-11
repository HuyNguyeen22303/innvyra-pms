import axios, {
  CanceledError,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthTokens } from "../types/auth.types.ts";
import type { ApiResponse } from "../types/api.types.ts";
import {
  clearHotelSession,
  getAccessToken,
  hotelAuthLock,
  hotelSessionGeneration,
  installHotelSession,
  updateHotelPasswordRequirement,
} from "../auth/hotelSession.ts";
export { getAccessToken } from "../auth/hotelSession.ts";

const baseURL = (import.meta.env?.VITE_API_URL || "/api/v1").replace(/\/$/, "");
export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
});
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "X-CSRF-Protection": "1" },
});
let refreshing: { generation: number; promise: Promise<AuthTokens> } | null =
  null;

export function refreshHotelSession(): Promise<AuthTokens> {
  const expected = hotelSessionGeneration();
  if (refreshing?.generation === expected) return refreshing.promise;
  const promise = hotelAuthLock(async () => {
    if (expected !== hotelSessionGeneration())
      throw new CanceledError("Hotel session changed");
    const response = await refreshClient.post<ApiResponse<AuthTokens>>(
      "/auth/refresh",
      {},
    );
    if (expected !== hotelSessionGeneration())
      throw new CanceledError("Hotel session changed");
    const result = response.data.data;
    installHotelSession(result.accessToken, result.user);
    return result;
  })
    .catch((error: unknown) => {
      if (
        expected === hotelSessionGeneration() &&
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      )
        clearHotelSession();
      throw error;
    })
    .finally(() => {
      if (refreshing?.promise === promise) refreshing = null;
    });
  refreshing = { generation: expected, promise };
  return promise;
}
interface HotelRequest extends InternalAxiosRequestConfig {
  _hotelGeneration?: number;
  _hotelRetry?: boolean;
}
// Synchronous stamping also covers requests created before a logout but dispatched later.
apiClient.interceptors.request.use(
  (config) => {
    const request = config as HotelRequest;
    request._hotelGeneration ??= hotelSessionGeneration();
    if (request._hotelGeneration !== hotelSessionGeneration())
      throw new CanceledError("Hotel session changed");
    const token = getAccessToken();
    if (!token && !["/auth/login", "/auth/refresh"].includes(request.url ?? ""))
      throw new CanceledError("No active hotel session");
    if (token && !request.headers.Authorization)
      request.headers.Authorization = `Bearer ${token}`;
    request.headers["X-CSRF-Protection"] = "1";
    return request;
  },
  (error) => {
    throw error;
  },
  { synchronous: true },
);
apiClient.interceptors.response.use(
  (response) => {
    if (
      (response.config as HotelRequest)._hotelGeneration !==
      hotelSessionGeneration()
    )
      throw new CanceledError("Hotel session changed");
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as HotelRequest | undefined;
    if (!request || axios.isCancel(error)) throw error;
    if (request._hotelGeneration !== hotelSessionGeneration())
      throw new CanceledError("Hotel session changed");
    const code = (
      error.response?.data as { error?: { code?: string } } | undefined
    )?.error?.code;
    if (code === "PASSWORD_CHANGE_REQUIRED") {
      updateHotelPasswordRequirement();
      throw error;
    }
    const terminal = [
      "/auth/login",
      "/auth/refresh",
      "/auth/logout",
      "/auth/change-password",
    ].includes(request.url ?? "");
    if (error.response?.status !== 401 || terminal) throw error;
    if (request._hotelRetry) {
      clearHotelSession();
      throw error;
    }
    request._hotelRetry = true;
    const current = getAccessToken();
    const newToken =
      current && request.headers.Authorization !== `Bearer ${current}`
        ? current
        : (await refreshHotelSession()).accessToken;
    if (request._hotelGeneration !== hotelSessionGeneration())
      throw new CanceledError("Hotel identity changed");
    request.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(request);
  },
);
export async function hotelAuthMutation<T>(
  action: () => Promise<T>,
  expected: number,
): Promise<T> {
  const run = () =>
    hotelAuthLock(() => {
      if (expected !== hotelSessionGeneration())
        throw new CanceledError("Hotel session changed");
      return action();
    });
  try {
    return await run();
  } catch (error) {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      expected !== hotelSessionGeneration()
    )
      throw error;
    await refreshHotelSession();
    return run();
  }
}
export function hotelAuthError(error: unknown): string {
  const code = axios.isAxiosError(error)
    ? (error.response?.data as { error?: { code?: string } } | undefined)?.error
        ?.code
    : undefined;
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không đúng.",
    INVALID_CURRENT_PASSWORD: "Mật khẩu hiện tại không đúng.",
    PASSWORD_CHANGE_CONFLICT: "Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.",
    VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
    RATE_LIMITED: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
    UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    CSRF_REJECTED: "Không thể xác nhận yêu cầu. Vui lòng tải lại trang.",
  };
  return (
    (code && messages[code]) ||
    "Chưa thể kết nối. Vui lòng kiểm tra kết nối và thử lại."
  );
}
