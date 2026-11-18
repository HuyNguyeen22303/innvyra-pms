import { AppError } from '../../shared/errors/app-error.js';
import { localDateRange } from '../stays/stay.dates.js';
import type { InventoryOperations } from './inventory.types.js';

export async function stockDocumentDate(
  repo: InventoryOperations,
  hotelId: bigint,
  date?: string,
): Promise<Date> {
  if (!date) return new Date();
  if (date.length !== 10) return new Date(date);
  const { gte, lt } = localDateRange(date, await repo.hotelTimezone(hotelId));
  if (gte >= lt) throw new AppError(422, 'INVALID_INVENTORY_DATE', 'Date does not exist in the hotel timezone');
  return gte;
}
