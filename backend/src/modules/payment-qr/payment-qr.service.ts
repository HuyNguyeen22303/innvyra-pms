import { randomBytes } from 'node:crypto';
import type { HotelBankAccount, PaymentRequest, Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import { BillingService } from '../billing/billing.service.js';
import { billingIdempotent, requestHash } from '../billing/billing.idempotency.js';
import { Money, calculateBalance, roomCharge } from '../billing/billing.money.js';
import {
  billingPermissions,
  type BillingScope,
  type LedgerQuery,
} from '../billing/billing.types.js';
import type { PrismaPaymentQrRepository } from './payment-qr.repository.js';
import {
  bankAccountBody,
  qrRequestBody,
  confirmQrBody,
  cancelQrBody,
  type BankAccountInput,
  type QrRequestInput,
  type ConfirmQrInput,
} from './payment-qr.schema.js';
import { paymentBanks, renderPaymentQr } from './vietqr.js';

const requestDto = (r: PaymentRequest) => ({
  id: r.id.toString(),
  reservationId: r.reservationId.toString(),
  folioId: r.folioId?.toString() ?? null,
  paymentId: r.paymentId?.toString() ?? null,
  paymentType: r.paymentType,
  amount: r.amount.toFixed(2),
  memo: r.memo,
  status: r.status,
  bankBin: r.bankBin,
  bankName: r.bankName,
  accountNumber: r.accountNumber,
  accountName: r.accountName,
  cancelledReason: r.cancelledReason,
  createdAt: r.createdAt.toISOString(),
  confirmedAt: r.confirmedAt?.toISOString() ?? null,
});
const accountDto = (a: HotelBankAccount | null) =>
  a
    ? {
        bankBin: a.bankBin,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        enabled: a.enabled,
        version: a.version,
        updatedAt: a.updatedAt.toISOString(),
      }
    : null;

export class PaymentQrService {
  constructor(private readonly repository: PrismaPaymentQrRepository) {}
  private authorize(scope: BillingScope, admin = false) {
    if (
      admin
        ? scope.role !== 'ADMIN'
        : !(billingPermissions.pay as readonly string[]).includes(scope.role)
    )
      throw new AppError(403, 'FORBIDDEN', 'Không có quyền thực hiện thao tác');
  }
  banks(scope: BillingScope) {
    this.authorize(scope);
    return paymentBanks();
  }
  async account(scope: BillingScope) {
    this.authorize(scope);
    return accountDto(
      await this.repository.db.hotelBankAccount.findUnique({ where: { hotelId: scope.hotelId } }),
    );
  }
  async saveAccount(scope: BillingScope, raw: BankAccountInput) {
    this.authorize(scope, true);
    const input = bankAccountBody.parse(raw);
    const bank = (await paymentBanks()).banks.find((bank) => bank.bin === input.bankBin);
    if (!bank)
      throw new AppError(422, 'BANK_UNSUPPORTED', 'Ngân hàng chưa hỗ trợ nhận chuyển khoản QR');
    return this.repository.write(scope.hotelId, async (r) => {
      const previous = await r.db.hotelBankAccount.findUnique({
        where: { hotelId: scope.hotelId },
      });
      if ((previous?.version ?? 0) !== input.expectedVersion)
        throw new AppError(
          409,
          'BANK_ACCOUNT_STALE',
          'Cấu hình đã thay đổi. Tải lại trước khi lưu.',
        );
      const data = {
        bankBin: input.bankBin,
        bankName: bank.shortName,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        enabled: input.enabled,
        updatedBy: scope.actorId,
        version: input.expectedVersion + 1,
      };
      const updated = await r.db.hotelBankAccount.upsert({
        where: { hotelId: scope.hotelId },
        create: { hotelId: scope.hotelId, ...data },
        update: data,
      });
      await r.db.paymentRequest.updateMany({
        where: { hotelId: scope.hotelId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledReason: 'Tài khoản nhận chuyển khoản đã thay đổi' },
      });
      await r
        .billing()
        .audit(
          scope,
          'BANK_ACCOUNT_UPDATED',
          updated.id,
          `Phiên bản ${updated.version}; ${updated.bankName}; đuôi ${updated.accountNumber.slice(-4)}; ${updated.enabled ? 'bật' : 'tắt'} QR`,
        );
      return accountDto(updated);
    });
  }
  // Read only. Financial posting still validates all billing invariants under the shared hotel lock.
  private async eligible(
    r: PrismaPaymentQrRepository,
    scope: BillingScope,
    reservationId: bigint,
    input: QrRequestInput,
  ) {
    const billing = r.billing();
    const reservation = await billing.reservation(scope.hotelId, reservationId);
    if (!reservation)
      throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
    if (
      input.paymentType === 'DEPOSIT' &&
      !['CONFIRMED', 'PARTIALLY_CHECKED_IN', 'CHECKED_IN'].includes(reservation.status)
    )
      throw new AppError(409, 'DEPOSIT_NOT_ALLOWED', 'Đơn này không còn được nhận tiền cọc');
    if (reservation.currency !== 'VND')
      throw new AppError(409, 'UNSUPPORTED_CURRENCY', 'Chỉ hỗ trợ VND');
    const folio = await billing.reservationFolio(scope.hotelId, reservationId);
    if (folio && folio.status !== 'OPEN')
      throw new AppError(409, 'FOLIO_NOT_OPEN', 'Folio đã đóng');
    if (!folio && input.paymentType !== 'DEPOSIT')
      throw new AppError(409, 'FOLIO_NOT_FOUND', 'Cần mở folio trước khi thanh toán công nợ');
    let maximum: Prisma.Decimal;
    if (folio) {
      if (await billing.pendingPayments(scope.hotelId, folio.id))
        throw new AppError(409, 'FOLIO_PENDING_ACTIVITY', 'Xử lý thanh toán đang chờ trước');
      const ledger = await billing.ledger(scope.hotelId, folio.id);
      maximum = calculateBalance(ledger.items, ledger.payments).outstandingBalance;
    } else {
      const nights =
        (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86400000;
      if (
        !reservation.rooms.length ||
        !Number.isInteger(nights) ||
        nights <= 0 ||
        reservation.rooms.some(
          (room) =>
            room.nights.length !== nights ||
            room.nights.some(
              (night, index) =>
                night.stayDate.getTime() !== reservation.checkInDate.getTime() + index * 86400000,
            ),
        )
      )
        throw new AppError(
          409,
          'ROOM_SNAPSHOTS_MISSING',
          'Thiếu giá phòng đã lưu, cần kiểm tra đơn',
        );
      maximum = reservation.rooms.reduce(
        (total, room) =>
          room.nights.reduce((sum, night) => sum.add(roomCharge(night.nightlyRate)), total),
        new Money(0),
      );
    }
    if (new Money(input.amount).gt(maximum))
      throw new AppError(
        409,
        'INSUFFICIENT_OUTSTANDING_BALANCE',
        'Số tiền vượt số còn phải thu. Kiểm tra lại công nợ.',
      );
    return folio;
  }
  async create(scope: BillingScope, reservationId: bigint, raw: QrRequestInput, key: string) {
    this.authorize(scope);
    const input = qrRequestBody.parse(raw);
    return this.repository.write(scope.hotelId, (r) =>
      billingIdempotent(
        r.billing(),
        scope,
        key,
        'QR_REQUEST_CREATE',
        reservationId,
        input,
        async () => {
          const account = await r.db.hotelBankAccount.findUnique({
            where: { hotelId: scope.hotelId },
          });
          if (!account?.enabled)
            throw new AppError(
              409,
              'BANK_ACCOUNT_UNCONFIGURED',
              'ADMIN cần thiết lập tài khoản nhận chuyển khoản trước',
            );
          const folio = await this.eligible(r, scope, reservationId, input);
          const pending = await r.db.paymentRequest.findFirst({
            where: { hotelId: scope.hotelId, reservationId, status: 'PENDING' },
          });
          if (pending) {
            if (pending.paymentType === input.paymentType && pending.amount.eq(input.amount))
              return requestDto(pending);
            throw new AppError(
              409,
              'QR_REQUEST_PENDING',
              'Đơn đã có yêu cầu thu đang chờ. Mở lại hoặc hủy yêu cầu cũ trước.',
            );
          }
          const request = await r.db.paymentRequest.create({
            data: {
              hotelId: scope.hotelId,
              reservationId,
              folioId: folio?.id ?? null,
              paymentType: input.paymentType,
              amount: input.amount,
              memo: `INN${randomBytes(8).toString('hex').toUpperCase()}`,
              bankVersion: account.version,
              bankBin: account.bankBin,
              bankName: account.bankName,
              accountNumber: account.accountNumber,
              accountName: account.accountName,
              createdBy: scope.actorId,
            },
          });
          await r.billing().audit(scope, 'QR_REQUEST_CREATED', request.id);
          return requestDto(request);
        },
      ),
    );
  }
  private async requireRequest(r: PrismaPaymentQrRepository, scope: BillingScope, id: bigint) {
    const request = await r.db.paymentRequest.findFirst({ where: { hotelId: scope.hotelId, id } });
    if (!request)
      throw new AppError(404, 'PAYMENT_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu thu');
    return request;
  }
  async list(scope: BillingScope, reservationId: bigint, query: LedgerQuery) {
    this.authorize(scope);
    if (!(await this.repository.billing().reservation(scope.hotelId, reservationId)))
      throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
    const where = { hotelId: scope.hotelId, reservationId };
    const [rows, total] = await Promise.all([
      this.repository.db.paymentRequest.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.repository.db.paymentRequest.count({ where }),
    ]);
    return pageResult(rows.map(requestDto), total, query);
  }
  async detail(scope: BillingScope, id: bigint) {
    this.authorize(scope);
    const request = await this.requireRequest(this.repository, scope, id);
    let invalidReason: string | null = null;
    if (request.status === 'PENDING') {
      try {
        const account = await this.repository.db.hotelBankAccount.findUnique({
          where: { hotelId: scope.hotelId },
        });
        if (!account?.enabled || account.version !== request.bankVersion)
          throw new AppError(
            409,
            'BANK_ACCOUNT_STALE',
            'Tài khoản nhận đã thay đổi. Hủy yêu cầu này và tạo QR mới.',
          );
        await this.eligible(this.repository, scope, request.reservationId, {
          paymentType: request.paymentType as 'DEPOSIT' | 'PAYMENT',
          amount: request.amount.toFixed(2),
        });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        invalidReason = error.message;
      }
    }
    const qr =
      request.status === 'PENDING' && !invalidReason ? await renderPaymentQr(request) : null;
    return {
      ...requestDto(request),
      canConfirm: request.status === 'PENDING' && !invalidReason,
      invalidReason,
      qrCode: qr?.qrCode ?? null,
      qrDataURL: qr?.qrDataURL ?? null,
    };
  }
  async confirm(scope: BillingScope, id: bigint, raw: ConfirmQrInput, key: string) {
    this.authorize(scope);
    const input = confirmQrBody.parse(raw);
    return this.repository.write(scope.hotelId, (r) =>
      billingIdempotent(r.billing(), scope, key, 'QR_CONFIRM', id, input, async () => {
        const request = await this.requireRequest(r, scope, id);
        if (request.status === 'CONFIRMED') {
          const payment = await r.billing().payment(scope.hotelId, request.paymentId!);
          if (payment?.referenceNumber !== input.referenceNumber)
            throw new AppError(
              409,
              'QR_ALREADY_CONFIRMED',
              'Yêu cầu đã được ghi nhận bằng mã giao dịch khác',
            );
          return requestDto(request);
        }
        if (request.status !== 'PENDING')
          throw new AppError(
            409,
            'QR_REQUEST_CANCELLED',
            'Yêu cầu thu đã hủy. Kiểm tra giao dịch thực nhận nếu khách đã chuyển tiền.',
          );
        const account = await r.db.hotelBankAccount.findUnique({
          where: { hotelId: scope.hotelId },
        });
        if (!account?.enabled || account.version !== request.bankVersion)
          throw new AppError(409, 'BANK_ACCOUNT_STALE', 'Tài khoản nhận tiền đã thay đổi');
        await this.eligible(r, scope, request.reservationId, {
          paymentType: request.paymentType as 'DEPOSIT' | 'PAYMENT',
          amount: request.amount.toFixed(2),
        });
        const duplicateReference = await r.db.payment.findFirst({
          where: {
            hotelId: scope.hotelId,
            status: 'CONFIRMED',
            paymentMethod: 'BANK_TRANSFER',
            paymentType: { in: ['DEPOSIT', 'PAYMENT'] },
            referenceNumber: input.referenceNumber,
          },
          select: { id: true },
        });
        if (duplicateReference)
          throw new AppError(
            409,
            'BANK_REFERENCE_ALREADY_RECORDED',
            'Mã giao dịch này đã được ghi nhận trong khách sạn. Kiểm tra lịch sử thu tiền trước khi xác nhận lại.',
          );
        const billing = new BillingService(r.billing());
        const folio = await billing.openFolio(scope, request.reservationId);
        const payment = await billing.recordPayment(
          scope,
          BigInt(folio.id),
          {
            paymentType: request.paymentType as 'DEPOSIT' | 'PAYMENT',
            paymentMethod: 'BANK_TRANSFER',
            amount: request.amount.toFixed(2),
            ...input,
          },
          requestHash(`qr-payment:${request.id}`),
        );
        const updated = await r.db.paymentRequest.update({
          where: { id, hotelId: scope.hotelId },
          data: {
            status: 'CONFIRMED',
            folioId: BigInt(folio.id),
            paymentId: BigInt(payment.id),
            confirmedBy: scope.actorId,
            confirmedAt: new Date(),
          },
        });
        await r.billing().audit(scope, 'QR_REQUEST_CONFIRMED', id);
        return requestDto(updated);
      }),
    );
  }
  async cancel(scope: BillingScope, id: bigint, reason: string, key: string) {
    this.authorize(scope);
    const input = cancelQrBody.parse({ reason });
    return this.repository.write(scope.hotelId, (r) =>
      billingIdempotent(r.billing(), scope, key, 'QR_CANCEL', id, input, async () => {
        const request = await this.requireRequest(r, scope, id);
        if (request.status === 'CONFIRMED')
          throw new AppError(
            409,
            'QR_ALREADY_CONFIRMED',
            'Khoản thu đã xác nhận. Dùng nghiệp vụ hoàn tiền nếu cần.',
          );
        if (request.status === 'CANCELLED') return requestDto(request);
        const updated = await r.db.paymentRequest.update({
          where: { id, hotelId: scope.hotelId },
          data: { status: 'CANCELLED', cancelledReason: input.reason },
        });
        await r.billing().audit(scope, 'QR_REQUEST_CANCELLED', id, input.reason);
        return requestDto(updated);
      }),
    );
  }
}
