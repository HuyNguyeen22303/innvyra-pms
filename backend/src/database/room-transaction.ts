import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../shared/errors/app-error.js';

// A single lock order for all room/type writes keeps validation and mutation atomic.
// Reservation/stay integration must participate in this protocol before enabling bookings.
export async function roomTransaction<T>(
  prisma: PrismaClient,
  hotelId: bigint,
  conflictCode: string,
  conflictMessage: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const hotels = await tx.$queryRaw<
          { id: bigint }[]
        >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
        if (!hotels.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
        return action(tx);
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new AppError(409, conflictCode, conflictMessage);
      if (error.code === 'P2003')
        throw new AppError(
          409,
          'ROOM_REFERENCE_CONFLICT',
          'Related record is unavailable or still in use',
        );
      if (error.code === 'P2025') throw new AppError(404, 'NOT_FOUND', 'Record not found');
      if (error.code === 'P2034')
        throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Concurrent change; retry the request');
    }
    throw error;
  }
}
