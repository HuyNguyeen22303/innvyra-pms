/**
 * Innvyra PMS - Reporting & Analytics Types
 * Aligned with backend/REPORTS.md and backend/src/config/reports.openapi.ts
 */

export interface ReportPeriod {
  startDate: string;
  endDate: string;
  endExclusive: true;
}

export interface DataQuality {
  status: 'complete' | 'estimated' | 'incomplete';
  limitations: string[];
}

export interface BalanceAt {
  outstandingBalance: string;
  accountsReceivable: string;
  customerCredits: string;
  folioCount: number;
  cutoffExclusive: string;
  scope: 'ALL_PAYMENT_METHODS';
}

export interface FinanceBasis {
  charges: string;
  cash: string;
  balance: string;
  recognition: string;
  cashPayments: string;
}

// ----------------------------------------------------
// 1. Revenue Report
// ----------------------------------------------------
export interface RevenueMetrics {
  roomCharges: string;
  serviceCharges: string;
  adjustmentDebits: string;
  adjustmentCredits: string;
  totalDebits: string;
  totalCredits: string;
  netBilledCharges: string;
  successfulPayments: string;
  successfulDeposits: string;
  successfulRefunds: string;
  netCashCollected: string;
  balanceMovement: string;
  paymentCount: number;
  depositCount: number;
  refundCount: number;
}

export interface RevenueSeriesItem extends RevenueMetrics {
  date: string;
}

export interface RevenueReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  summary: RevenueMetrics;
  series: RevenueSeriesItem[];
  balance: BalanceAt;
  filters: {
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | null;
  };
  basis: FinanceBasis;
}

// ----------------------------------------------------
// 2. Payment Report
// ----------------------------------------------------
export interface PaymentMetrics {
  cashPayments: string;
  bankTransferPayments: string;
  successfulPayments: string;
  successfulDeposits: string;
  successfulRefunds: string;
  netCashCollected: string;
  paymentCount: number;
  depositCount: number;
  refundCount: number;
}

export interface PaymentSeriesItem extends PaymentMetrics {
  date: string;
}

export interface PaymentReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  summary: PaymentMetrics;
  series: PaymentSeriesItem[];
  balance: BalanceAt;
  filters: {
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | null;
  };
  basis: FinanceBasis;
}

// ----------------------------------------------------
// 3. Occupancy Report
// ----------------------------------------------------
export interface OccupancyMetrics {
  totalRoomNights: number;
  sellableRoomNights: number;
  occupiedRoomNights: number | null;
  outOfServiceRoomNights: number | null;
  maintenanceBlockedRoomNights: number;
  missingPriceNights: number;
  conflictingRoomNights: number;
  unclosedDays: number;
  roomSalesValue?: string | null;
  operationalAdr?: string | null;
  operationalRevpar?: string | null;
  occupancyRate: number | null;
}

export interface OccupancySeriesItem extends OccupancyMetrics {
  date: string;
}

export interface OccupancyReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  summary: OccupancyMetrics;
  series: OccupancySeriesItem[];
  filters: {
    roomTypeId: string | null;
  };
  basis: string;
}

// ----------------------------------------------------
// 4. Reservation Report
// ----------------------------------------------------
export interface ReservationMetrics {
  totalReservationsCreated: number;
  totalReservationRoomsCreated: number;
  cancelledReservations: number;
  confirmedReservationsInCreatedCohort: number;
  noShowReservationsInCreatedCohort: number;
  actualCheckedInReservations: number;
  actualCheckedOutReservations: number;
  activeStaysCreated: number;
}

export interface ReservationSeriesItem extends ReservationMetrics {
  date: string;
}

export interface BookingSourceItem {
  source: string;
  reservations: number;
}

export interface ReservationReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  summary: ReservationMetrics;
  series: ReservationSeriesItem[];
  bookingSources: BookingSourceItem[];
}

// ----------------------------------------------------
// 5. Operations Report
// ----------------------------------------------------
export interface HousekeepingSnapshot {
  dirtyRooms: number;
  readyRooms: number;
  cleaningRooms: number;
  roomsAwaitingInspection: number;
  activeHousekeepingTasks: number;
  cleaningTasks: number;
}

export interface HousekeepingPeriod {
  completedHousekeepingTasks: number;
  inspectedHousekeepingTasks: number;
}

export interface MaintenanceSnapshot {
  roomsUnderMaintenance: number;
  roomsOutOfService: number;
  openMaintenanceTickets: number;
  inProgressMaintenanceTickets: number;
  activeMaintenanceBlocks: number;
}

export interface MaintenancePeriod {
  maintenanceBlockedRoomNights: number;
}

export interface OperationsReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  snapshotAt: string;
  housekeeping?: {
    snapshot: HousekeepingSnapshot;
    period: HousekeepingPeriod;
  };
  maintenance?: {
    snapshot: MaintenanceSnapshot;
    period: MaintenancePeriod;
  };
}

// ----------------------------------------------------
// 6. Outstanding Balances Report
// ----------------------------------------------------
export interface OutstandingItem {
  folioId: string;
  outstandingBalance: string;
}

export interface OutstandingReport {
  period: ReportPeriod;
  timezone: string;
  currency: string;
  groupBy: 'day' | 'month';
  generatedAt: string;
  dataQuality: DataQuality;
  cutoffExclusive: string;
  summary: BalanceAt;
  items: OutstandingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------
// 7. Dashboard Report
// ----------------------------------------------------
export interface DashboardRooms {
  total: number;
  active: number;
  occupied: number;
  vacant: number;
  dirty: number;
  cleaning: number;
  awaitingInspection: number;
  ready: number;
  underMaintenance: number;
  outOfService: number;
}

export interface DashboardReport {
  reportDate: string;
  timezone: string;
  currency: string;
  generatedAt: string;
  rooms: DashboardRooms | null;
  roomSnapshotAt: string | null;
  reservations: {
    expectedArrivals: number;
    expectedDepartures: number;
  };
  currentGuestsCount: number | null;
  finance?: PaymentMetrics & BalanceAt;
  dataQuality: DataQuality;
}

// ----------------------------------------------------
// Query Parameters
// ----------------------------------------------------
export interface ReportPeriodQuery {
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'month';
}

export interface ReportPaymentQuery extends ReportPeriodQuery {
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
}

export interface ReportOccupancyQuery extends ReportPeriodQuery {
  roomTypeId?: string;
}

export interface ReportOutstandingQuery {
  startDate: string;
  endDate: string;
  page?: number;
  limit?: number;
  sortBy?: 'folioId' | 'outstandingBalance';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportExportQuery extends ReportPeriodQuery {
  type: 'revenue' | 'occupancy' | 'reservations' | 'payments';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  roomTypeId?: string;
}
