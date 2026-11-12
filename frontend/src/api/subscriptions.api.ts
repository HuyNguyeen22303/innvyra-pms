import { platformClient } from "./platformClient.ts";
import { apiClient } from "./axiosClient.ts";
import type { ApiResponse } from "../types/api.types.ts";
import type { HotelPeriod } from "../types/hotel.types.ts";
export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  roomLimit: number;
  staffLimit: number;
  isActive: boolean;
}
export type PlanInput = Omit<SubscriptionPlan, "id">;
export interface MonthlyPeriodInput {
  planId: string;
  startsOn: string;
  monthCount: number;
  reason: string;
  agreementReference?: string;
  paymentReference?: string;
  notes?: string;
}
export interface SubscriptionSummary {
  today: string;
  timezone: string;
  hotelStatus: "ACTIVE" | "SUSPENDED";
  id: string;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "UPCOMING" | "UNCONFIGURED";
  daysRemaining: number | null;
  alert: string | null;
  suspensionReason: string | null;
  current: HotelPeriod | null;
  upcoming: HotelPeriod | null;
  history: HotelPeriod[];
  usage: {
    rooms: number;
    staff: number;
    roomLimit: number | null;
    staffLimit: number | null;
  };
  nextStartsOn: string;
}
export const subscriptionsApi = {
  async plans(signal?: AbortSignal) {
    return (
      await platformClient.get<ApiResponse<SubscriptionPlan[]>>("/plans", {
        signal,
      })
    ).data.data;
  },
  async createPlan(input: PlanInput) {
    return (
      await platformClient.post<ApiResponse<SubscriptionPlan>>("/plans", input)
    ).data.data;
  },
  async updatePlan(id: string, input: Omit<PlanInput, "code">) {
    return (
      await platformClient.patch<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}`,
        input,
      )
    ).data.data;
  },
  async summary(id: string, signal?: AbortSignal) {
    return (
      await platformClient.get<ApiResponse<SubscriptionSummary>>(
        `/hotels/${id}/subscription`,
        { signal },
      )
    ).data.data;
  },
  async record(id: string, input: MonthlyPeriodInput) {
    return (
      await platformClient.post<ApiResponse<HotelPeriod>>(
        `/hotels/${id}/subscription-periods`,
        input,
      )
    ).data.data;
  },
  async setStatus(id: string, status: "ACTIVE" | "SUSPENDED", reason: string) {
    await platformClient.patch(`/hotels/${id}/status`, { status, reason });
  },
  async own(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiResponse<SubscriptionSummary>>(
        "/hotel/subscription",
        { signal },
      )
    ).data.data;
  },
};
