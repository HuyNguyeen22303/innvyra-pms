import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBillingRepository } from '../billing/billing.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

export class PrismaPaymentQrRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  get db() {
    return this.tx ?? this.prisma;
  }
  billing() {
    return new PrismaBillingRepository(this.prisma, this.tx);
  }
  async write<T>(
    hotelId: bigint,
    action: (r: PrismaPaymentQrRepository) => Promise<T>,
  ): Promise<T> {
    if (this.tx) return action(this);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const rows = await tx.$queryRaw<
              { id: bigint }[]
            >`SELECT id FROM hotels WHERE id=${hotelId} FOR UPDATE`;
            if (!rows.length)
              throw new AppError(404, 'HOTEL_NOT_FOUND', 'Không tìm thấy khách sạn');
            return action(new PrismaPaymentQrRepository(this.prisma, tx));
          },
          { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (['P2034', 'P2002'].includes(error.code) && attempt < 2) {
            await delay(25 * (attempt + 1));
            continue;
          }
          if (['P2002', 'P2003', 'P2024', 'P2025', 'P2028', 'P2034'].includes(error.code))
            throw new AppError(
              409,
              'FINANCIAL_CONFLICT',
              'Dữ liệu đã thay đổi. Thử lại với cùng khóa xác nhận.',
            );
        }
        throw error;
      }
    }
  }
}
