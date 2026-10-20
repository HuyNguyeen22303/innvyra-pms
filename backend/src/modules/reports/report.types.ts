import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type { PrismaReportRepository } from './report.repository.js';

export type ReportScope = { hotelId: bigint; role: RoleCode };
export type ReportDay = { date: string; from: Date; until: Date };
export type DbNumber = bigint | number | Prisma.Decimal;
export type AggregateRow = { date: string; metric: string; value: DbNumber; category: string };
export type BalanceRow = {
  outstandingBalance: Prisma.Decimal;
  accountsReceivable: Prisma.Decimal;
  customerCredits: Prisma.Decimal;
  folioCount: DbNumber;
};
export type OccupancyRow = {
  date: string;
  totalRoomNights: DbNumber;
  maintenanceBlockedRoomNights: DbNumber;
  occupiedRoomNights: DbNumber;
  roomSalesValue: Prisma.Decimal;
  missingPriceNights: DbNumber;
  conflictingRoomNights: DbNumber;
};
export type ReportRepository = Pick<
  PrismaReportRepository,
  | 'snapshot'
  | 'hotel'
  | 'roomTypeExists'
  | 'financialActivity'
  | 'balance'
  | 'outstanding'
  | 'occupancy'
  | 'reservations'
  | 'roomSnapshot'
  | 'operations'
  | 'maintenanceRoomNights'
  | 'procurementSeries'
  | 'procurementByCategory'
  | 'procurementBySupplier'
  | 'procurementTopItems'
>;
export type MetricValue = string | number | null;
export type MetricRecord = Record<string, MetricValue>;
export type SeriesRow = MetricRecord & { date: string };
export type DataQuality = {
  status: 'complete' | 'estimated' | 'incomplete';
  limitations: string[];
};
export interface ProcurementSummary {
  totalExpense: string;
  receiptCount: number;
  averageReceiptValue: string;
  totalItemsPurchased: number;
  topSupplier: { id: string; name: string; totalAmount: string } | null;
}
export interface ProcurementSeriesItem {
  date: string;
  totalExpense: string;
  receiptCount: number;
}
export interface ProcurementCategoryItem {
  categoryId: string;
  categoryName: string;
  totalAmount: string;
  percentage: number;
}
export interface ProcurementSupplierItem {
  supplierId: string;
  supplierName: string;
  receiptCount: number;
  totalAmount: string;
  percentage: number;
}
export interface ProcurementTopItem {
  itemId: string;
  sku: string;
  name: string;
  categoryName: string;
  unit: string;
  totalQuantity: number;
  totalAmount: string;
}
export interface ProcurementReportDto {
  hotelId: string;
  timezone: string;
  currency: string;
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  summary: ProcurementSummary;
  series: ProcurementSeriesItem[];
  byCategory: ProcurementCategoryItem[];
  bySupplier: ProcurementSupplierItem[];
  topItems: ProcurementTopItem[];
}
