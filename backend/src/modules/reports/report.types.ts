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
>;
export type MetricValue = string | number | null;
export type MetricRecord = Record<string, MetricValue>;
export type SeriesRow = MetricRecord & { date: string };
export type DataQuality = {
  status: 'complete' | 'estimated' | 'incomplete';
  limitations: string[];
};
