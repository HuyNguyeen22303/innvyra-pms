import { Prisma, type PrismaClient } from '../../src/generated/prisma/client.js';
import { asDate } from '../../src/modules/hotels/subscription-calendar.js';
import { dayOffset } from '../phase6/scenario.js';

export interface HistoryInput {
  hotelId: bigint;
  code: string;
  today: string;
  guestIds: bigint[];
  rooms: { id: bigint; typeId: bigint; rate: string }[];
  receptionistId: bigint;
  accountantId: bigint;
  managerId: bigint;
  cleanerId: bigint;
  service: { id: bigint; name: string; unit: string; price: string };
}
const at = (day: string, time: string) => new Date(`${day}T${time}:00+07:00`);

// Import only synthetic historical records. Public APIs intentionally reject past
// bookings. Each complete graph is inserted transactionally with real FKs enabled.
export async function seedLocalHistory(prisma: PrismaClient, input: HistoryInput) {
  const reservations: string[] = [];
  for (let index = 0; index < 8; index++) {
    const startsOn = dayOffset(input.today, -(index * 4 + 6));
    const nights = 1 + (index % 3);
    const endsOn = dayOffset(startsOn, nights);
    const room = input.rooms[index % input.rooms.length]!;
    const checkinAt = at(startsOn, '14:00');
    const checkoutAt = at(endsOn, '11:00');
    const postedAt = at(startsOn, '14:05');
    const paidAt = at(endsOn, '10:30');
    const createdAt = at(dayOffset(startsOn, -3), '10:00');
    const record = await prisma.$transaction(async (tx) => {
      const totalRoom = new Prisma.Decimal(room.rate).mul(nights);
      const reservation = await tx.reservation.create({
        data: {
          hotelId: input.hotelId,
          confirmationCode: `LOCAL-${input.code}-H${index + 1}`,
          bookerGuestId: input.guestIds[index % input.guestIds.length]!,
          checkInDate: asDate(startsOn),
          checkOutDate: asDate(endsOn),
          status: 'CHECKED_OUT',
          totalAmount: totalRoom,
          bookingSource: index % 2 ? 'PHONE' : 'DIRECT',
          createdBy: input.receptionistId,
          createdAt,
          updatedAt: checkoutAt,
          notes: 'Khách đã hoàn tất lưu trú.',
        },
      });
      const allocation = await tx.reservationRoom.create({
        data: {
          hotelId: input.hotelId,
          reservationId: reservation.id,
          roomTypeId: room.typeId,
          roomId: room.id,
          adults: 2,
          createdAt,
          updatedAt: checkoutAt,
        },
      });
      const stay = await tx.stay.create({
        data: {
          hotelId: input.hotelId,
          roomTypeId: room.typeId,
          reservationRoomId: allocation.id,
          currentRoomId: room.id,
          status: 'CHECKED_OUT',
          actualCheckinAt: checkinAt,
          actualCheckoutAt: checkoutAt,
          checkinStaffId: input.receptionistId,
          checkoutStaffId: input.receptionistId,
          createdAt: checkinAt,
          updatedAt: checkoutAt,
        },
      });
      const openBalance = index === 7;
      const folio = await tx.folio.create({
        data: {
          hotelId: input.hotelId,
          reservationId: reservation.id,
          status: openBalance ? 'OPEN' : 'CLOSED',
          openedAt: postedAt,
          closedAt: openBalance ? null : checkoutAt,
          createdAt: postedAt,
          updatedAt: checkoutAt,
        },
      });
      for (let night = 0; night < nights; night++) {
        const snapshot = await tx.reservationRoomNight.create({
          data: {
            reservationRoomId: allocation.id,
            stayDate: asDate(dayOffset(startsOn, night)),
            nightlyRate: room.rate,
            createdAt,
          },
        });
        await tx.folioItem.create({
          data: {
            hotelId: input.hotelId,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'ROOM_NIGHT',
            sourceId: snapshot.id,
            roomNightId: snapshot.id,
            amount: new Prisma.Decimal(room.rate).toDecimalPlaces(0),
            description: `Tiền phòng ${dayOffset(startsOn, night)}`,
            createdBy: input.accountantId,
            createdAt: postedAt,
          },
        });
      }
      const serviceAt = at(startsOn, '18:00');
      const order = await tx.serviceOrder.create({
        data: {
          hotelId: input.hotelId,
          reservationId: reservation.id,
          stayId: stay.id,
          status: 'COMPLETED',
          createdBy: input.receptionistId,
          completedBy: input.receptionistId,
          completedAt: serviceAt,
          createdAt: serviceAt,
          updatedAt: serviceAt,
        },
      });
      const serviceItem = await tx.serviceOrderItem.create({
        data: {
          hotelId: input.hotelId,
          serviceOrderId: order.id,
          serviceId: input.service.id,
          nameSnapshot: input.service.name,
          unitSnapshot: input.service.unit,
          quantity: 2,
          unitPriceSnapshot: input.service.price,
          lineTotal: new Prisma.Decimal(input.service.price).mul(2),
          createdAt: serviceAt,
        },
      });
      await tx.folioItem.create({
        data: {
          hotelId: input.hotelId,
          folioId: folio.id,
          entryType: 'DEBIT',
          sourceType: 'SERVICE_ORDER_ITEM',
          sourceId: serviceItem.id,
          serviceOrderItemId: serviceItem.id,
          amount: serviceItem.lineTotal,
          description: input.service.name,
          createdBy: input.receptionistId,
          createdAt: serviceAt,
        },
      });
      const billed = totalRoom.add(serviceItem.lineTotal);
      const collected = openBalance ? billed.sub(150000) : billed;
      const payment = await tx.payment.create({
        data: {
          hotelId: input.hotelId,
          folioId: folio.id,
          paymentType: 'PAYMENT',
          status: 'CONFIRMED',
          paymentMethod: index % 2 ? 'BANK_TRANSFER' : 'CASH',
          referenceNumber: `LOCAL-HISTORY-${input.code}-${index + 1}`,
          amount: collected,
          processedBy: input.accountantId,
          processedAt: paidAt,
          createdAt: paidAt,
        },
      });
      // A compensated/refunded stay demonstrates the full receipt/refund relation,
      // without leaving an impossible nonzero balance on a closed folio.
      if (index === 5) {
        await tx.folioItem.create({
          data: {
            hotelId: input.hotelId,
            folioId: folio.id,
            entryType: 'CREDIT',
            sourceType: 'MANUAL_ADJUSTMENT',
            amount: '20000',
            description: 'Bồi hoàn phí giặt ủi',
            createdBy: input.managerId,
            createdAt: paidAt,
          },
        });
        await tx.payment.create({
          data: {
            hotelId: input.hotelId,
            folioId: folio.id,
            paymentType: 'REFUND',
            status: 'CONFIRMED',
            paymentMethod: payment.paymentMethod,
            referenceNumber: `LOCAL-REFUND-${input.code}-${index}`,
            originalPaymentId: payment.id,
            amount: '20000',
            reason: 'Bồi hoàn phí giặt ủi',
            processedBy: input.managerId,
            processedAt: paidAt,
            createdAt: paidAt,
          },
        });
      }
      const task = await tx.housekeepingTask.create({
        data: {
          hotelId: input.hotelId,
          roomId: room.id,
          status: 'COMPLETED',
          assignedTo: input.cleanerId,
          createdBy: input.receptionistId,
          startedAt: at(endsOn, '11:10'),
          completedAt: at(endsOn, '11:40'),
          inspectedAt: at(endsOn, '11:50'),
          inspectedBy: input.managerId,
          createdAt: checkoutAt,
          updatedAt: at(endsOn, '11:50'),
        },
      });
      await tx.operationsAuditLog.create({
        data: {
          hotelId: input.hotelId,
          actorId: input.managerId,
          taskId: task.id,
          action: 'TASK_INSPECTED',
          fromStatus: 'AWAITING_INSPECTION',
          toStatus: 'COMPLETED',
          notes: 'Phòng đã được kiểm tra sau khi khách trả phòng.',
          createdAt: at(endsOn, '11:50'),
        },
      });
      await tx.billingAuditLog.createMany({
        data: [
          {
            hotelId: input.hotelId,
            actorId: input.accountantId,
            action: 'FOLIO_OPENED',
            entityId: folio.id,
            createdAt: postedAt,
          },
          {
            hotelId: input.hotelId,
            actorId: input.accountantId,
            action: 'PAYMENT_RECORDED',
            entityId: payment.id,
            createdAt: paidAt,
          },
        ],
      });
      return reservation;
    });
    reservations.push(String(record.id));
  }
  return reservations;
}
