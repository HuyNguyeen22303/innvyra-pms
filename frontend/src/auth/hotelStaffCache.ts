import { hotelSessionGeneration, onHotelSessionReset } from "./hotelSession.ts";
import type { StaffMemberInfo } from "../utils/staffDirectory.ts";
const records = new Map<string, StaffMemberInfo>();
onHotelSessionReset(() => records.clear());
export function registerHotelStaff(
  staff: StaffMemberInfo[],
  expectedGeneration: number,
) {
  if (expectedGeneration !== hotelSessionGeneration()) return;
  for (const member of staff) records.set(member.id, member);
}
export const getRegisteredHotelStaff = (id: string) => records.get(id);
