import { platformClient } from "./platformClient.ts";
import { apiClient } from "./axiosClient.ts";
import type { ApiResponse, PaginatedResult } from "../types/api.types.ts";
import type {
  HotelAdminInput,
  HotelCreate,
  HotelDetail,
  HotelEdit,
  HotelProfile,
  HotelRecord,
  IssuedHotelCredentials,
} from "../types/hotel.types.ts";

export const hotelsApi = {
  async list(
    params: { page: number; limit: number; search?: string; status?: string; subscriptionStatus?: string },
    signal?: AbortSignal,
  ) {
    return (
      await platformClient.get<ApiResponse<PaginatedResult<HotelRecord>>>(
        "/hotels",
        { params, signal },
      )
    ).data.data;
  },
  async detail(id: string, signal?: AbortSignal) {
    return (
      await platformClient.get<ApiResponse<HotelDetail>>(`/hotels/${id}`, {
        signal,
      })
    ).data.data;
  },
  async create(input: HotelCreate) {
    return (
      await platformClient.post<
        ApiResponse<IssuedHotelCredentials & { hotel: HotelRecord }>
      >("/hotels", input)
    ).data.data;
  },
  async update(id: string, input: HotelEdit) {
    return (
      await platformClient.patch<ApiResponse<HotelRecord>>(
        `/hotels/${id}`,
        input,
      )
    ).data.data;
  },
  async addAdmin(id: string, input: HotelAdminInput) {
    return (
      await platformClient.post<ApiResponse<IssuedHotelCredentials>>(
        `/hotels/${id}/admins`,
        input,
      )
    ).data.data;
  },
  async resetAdmin(id: string, staffId: string, reason: string) {
    return (
      await platformClient.post<ApiResponse<IssuedHotelCredentials>>(
        `/hotels/${id}/admins/${staffId}/reset-password`,
        { reason },
      )
    ).data.data;
  },
};
export const ownHotelApi = {
  async get(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiResponse<HotelProfile>>("/hotel", { signal })
    ).data.data;
  },
  async update(
    input: Pick<
      HotelEdit,
      "name" | "address" | "contactEmail" | "contactPhone"
    >,
  ) {
    return (await apiClient.patch<ApiResponse<HotelProfile>>("/hotel", input))
      .data.data;
  },
};
