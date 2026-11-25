import axios from 'axios';
import { apiClient } from './axiosClient.ts';
import type { ApiResponse } from '../types/api.types.ts';
import type {
  DashboardReport,
  RevenueReport,
  PaymentReport,
  OccupancyReport,
  ReservationReport,
  OperationsReport,
  OutstandingReport,
  ReportPeriodQuery,
  ReportPaymentQuery,
  ReportOccupancyQuery,
  ReportOutstandingQuery,
  ReportExportQuery,
} from '../types/reports.types.ts';

export const reportConfigKey = ['reports', 'config'] as const;

type ReportFailure = { message?: string; error?: { code?: string } };

export function isReportRangeError(error: unknown) {
  return axios.isAxiosError<ReportFailure>(error) &&
    error.response?.status === 422 &&
    error.response.data?.error?.code === 'REPORT_RANGE_TOO_LARGE';
}

export const reportRangeErrorMessage = 'Khoảng thời gian báo cáo vượt quá giới hạn hiện tại. Vui lòng chọn kỳ ngắn hơn.';

export async function reportExportError(error: unknown) {
  if (!axios.isAxiosError(error)) return undefined;
  const body: unknown = error.response?.data;
  if (!(body instanceof Blob)) return body as ReportFailure | undefined;
  try {
    return JSON.parse(await body.text()) as ReportFailure;
  } catch {
    return undefined;
  }
}

export const reportsApi = {
  getConfig: async (signal: AbortSignal) => {
    const response = await apiClient.get<ApiResponse<{ maxDays: number }>>('/reports/config', { signal });
    return response.data.data;
  },

  /**
   * Hotel-local daily operational dashboard snapshot
   * Roles: ADMIN, MANAGER, RECEPTIONIST
   */
  getDashboard: async (params?: { date?: string }): Promise<ApiResponse<DashboardReport>> => {
    const res = await apiClient.get<ApiResponse<DashboardReport>>('/reports/dashboard', {
      params,
    });
    return res.data;
  },

  /**
   * Billed revenue & cash receipts report
   * Roles: ADMIN, MANAGER, ACCOUNTANT
   */
  getRevenue: async (params: ReportPeriodQuery): Promise<ApiResponse<RevenueReport>> => {
    const res = await apiClient.get<ApiResponse<RevenueReport>>('/reports/revenue', {
      params,
    });
    return res.data;
  },

  /**
   * Cash and bank transfer payment receipts
   * Roles: ADMIN, MANAGER, ACCOUNTANT
   */
  getPayments: async (params: ReportPaymentQuery): Promise<ApiResponse<PaymentReport>> => {
    const res = await apiClient.get<ApiResponse<PaymentReport>>('/reports/payments', {
      params,
    });
    return res.data;
  },

  /**
   * Occupancy rate, operational ADR and RevPAR
   * Roles: ADMIN, MANAGER, RECEPTIONIST
   */
  getOccupancy: async (params: ReportOccupancyQuery): Promise<ApiResponse<OccupancyReport>> => {
    const res = await apiClient.get<ApiResponse<OccupancyReport>>('/reports/occupancy', {
      params,
    });
    return res.data;
  },

  /**
   * Reservation creation cohort, channels and remaining movements
   * Roles: ADMIN, MANAGER, RECEPTIONIST
   */
  getReservations: async (params: ReportPeriodQuery): Promise<ApiResponse<ReservationReport>> => {
    const res = await apiClient.get<ApiResponse<ReservationReport>>('/reports/reservations', {
      params,
    });
    return res.data;
  },

  /**
   * Operations snapshot and period performance for Housekeeping & Maintenance
   * Roles: ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING, TECHNICIAN
   */
  getOperations: async (params: ReportPeriodQuery): Promise<ApiResponse<OperationsReport>> => {
    const res = await apiClient.get<ApiResponse<OperationsReport>>('/reports/operations', {
      params,
    });
    return res.data;
  },

  /**
   * Non-zero cumulative folio balances
   * Roles: ADMIN, MANAGER, ACCOUNTANT
   */
  getOutstanding: async (params: ReportOutstandingQuery): Promise<ApiResponse<OutstandingReport>> => {
    const res = await apiClient.get<ApiResponse<OutstandingReport>>('/reports/outstanding', {
      params,
    });
    return res.data;
  },

  /**
   * Export bounded report series as UTF-8 CSV download
   * Roles: ADMIN/MANAGER (all 4), ACCOUNTANT (revenue, payments)
   */
  exportCsv: async (params: ReportExportQuery): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiClient.get('/reports/export', {
      params,
      responseType: 'blob',
    });

    let filename = `innvyra-${params.type}-${params.startDate}-${params.endDate}.csv`;
    const disposition = res.headers['content-disposition'];
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    return { blob: res.data, filename };
  },
};
