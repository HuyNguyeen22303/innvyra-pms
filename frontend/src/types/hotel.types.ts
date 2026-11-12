export interface HotelProfile {
  id: string;
  code: string;
  name: string;
  timezone: string;
  status: "ACTIVE" | "SUSPENDED";
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}
export interface HotelRecord extends HotelProfile {
  agreementReference: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
}
export interface HotelAdmin {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
export interface HotelAdminInput {
  fullName: string;
  username: string;
  email: string;
}
export interface HotelPeriod {
  id: string;
  planId?: string | null;
  monthlyPrice?: string | null;
  monthCount?: number | null;
  roomLimit?: number | null;
  staffLimit?: number | null;
  planName: string;
  startsOn: string;
  endsOn: string;
  feeAmount: string;
  currency: string;
  agreementReference: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
}
export interface HotelDetail extends HotelRecord {
  staff: HotelAdmin[];
  subscriptionPeriods: HotelPeriod[];
  platformAudits: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
    actor: { fullName: string };
  }[];
}
export type HotelEdit = Pick<
  HotelRecord,
  | "name"
  | "timezone"
  | "contactEmail"
  | "contactPhone"
  | "address"
  | "agreementReference"
>;
export interface HotelCreate extends HotelEdit {
  code: string;
  admin: HotelAdminInput;
  subscription:
    | import("../api/subscriptions.api.ts").MonthlyPeriodInput
    | {
        planName: string;
        startsOn: string;
        endsOn: string;
        feeAmount: string;
        agreementReference?: string;
        paymentReference?: string;
        notes?: string;
      };
}
export interface IssuedHotelCredentials {
  admin: HotelAdmin;
  temporaryPassword: string;
}
