import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asDate, localDay } from './subscription-calendar.js';

// Caller holds the hotel row lock. Expired plans retain their caps; legacy periods
// without snapshots remain uncapped. Future periods do not apply early.
export async function currentPeriod(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  timezone: string,
) {
  return db.hotelSubscriptionPeriod.findFirst({
    where: { hotelId, startsOn: { lte: asDate(localDay(timezone)) } },
    orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
  });
}
export async function assertCapacity(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  kind: 'room' | 'staff',
) {
  const hotel = await db.hotel.findUniqueOrThrow({
    where: { id: hotelId },
    select: { timezone: true },
  });
  const period = await currentPeriod(db, hotelId, hotel.timezone);
  const limit = kind === 'room' ? period?.roomLimit : period?.staffLimit;
  if (limit == null) return;
  const used =
    kind === 'room'
      ? await db.room.count({ where: { hotelId, isActive: true } })
      : await db.staffUser.count({ where: { hotelId, isActive: true } });
  if (used >= limit)
    throw new AppError(
      409,
      'SUBSCRIPTION_LIMIT_REACHED',
      `Active ${kind} limit reached (${used}/${limit}); contact Innvyra to change plan`,
    );
}
