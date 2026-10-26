import type {
  Folio,
  FolioItem,
  Payment,
  Service,
} from '../../generated/prisma/client.js';
import type { OrderRecord } from './billing.repository.js';
import { balanceDto, type calculateBalance } from './billing.money.js';

export const serviceDto = (row: Service) => ({
  ...row,
  id: row.id.toString(),
  hotelId: row.hotelId.toString(),
  price: row.price.toFixed(2),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
export const orderDto = (row: OrderRecord) => ({
  id: row.id.toString(),
  reservationId: row.reservationId.toString(),
  stayId: row.stayId?.toString() ?? null,
  guestName: row.reservation.bookerGuest.fullName,
  confirmationCode: row.reservation.confirmationCode,
  roomNumber: row.stay?.currentRoom?.roomNumber ?? null,
  roomTypeName: row.stay?.currentRoom?.roomType?.name ?? null,
  status: row.status,
  notes: row.notes,
  createdBy: row.createdBy.toString(),
  completedBy: row.completedBy?.toString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  cancelledBy: row.cancelledBy?.toString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  cancellationReason: row.cancellationReason,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  items: row.items.map((item) => ({
    id: item.id.toString(),
    serviceId: item.serviceId.toString(),
    nameSnapshot: item.nameSnapshot,
    unitSnapshot: item.unitSnapshot,
    quantity: item.quantity,
    unitPriceSnapshot: item.unitPriceSnapshot.toFixed(2),
    lineTotal: item.lineTotal.toFixed(2),
    createdAt: item.createdAt.toISOString(),
  })),
});
export const itemDto = (row: FolioItem) => ({
  id: row.id.toString(),
  folioId: row.folioId.toString(),
  entryType: row.entryType,
  sourceType: row.sourceType,
  sourceId: row.sourceId?.toString() ?? null,
  amount: row.amount.toFixed(2),
  description: row.description,
  relatedItemId: row.relatedItemId?.toString() ?? null,
  createdBy: row.createdBy.toString(),
  createdAt: row.createdAt.toISOString(),
});
export const paymentDto = (row: Payment) => ({
  id: row.id.toString(),
  folioId: row.folioId.toString(),
  paymentType: row.paymentType,
  paymentMethod: row.paymentMethod,
  amount: row.amount.toFixed(2),
  status: row.status,
  referenceNumber: row.referenceNumber,
  originalPaymentId: row.originalPaymentId?.toString() ?? null,
  reason: row.reason,
  processedBy: row.processedBy.toString(),
  processedAt: row.processedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});
export const folioDto = (row: Folio, balance: ReturnType<typeof calculateBalance>) => ({
  id: row.id.toString(),
  reservationId: row.reservationId.toString(),
  currency: row.currency,
  status: row.status,
  openedAt: row.openedAt.toISOString(),
  closedAt: row.closedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  ...balanceDto(balance),
});
