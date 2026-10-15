import { Prisma, type RoomType } from '../src/generated/prisma/client.js';
import type { ReservationRepository } from '../src/modules/reservations/reservation.types.js';
import type { ReservationRecord } from '../src/modules/reservations/reservation.mapper.js';
import { asDateOnly } from '../src/modules/reservations/reservation.dates.js';

// Only an HTTP/unit test seam. No concurrency claims are made about this in-memory store.
export function memoryReservations(hotelId = 9007199254740995n) {
  let next = 9007199254741100n;
  const types = new Map<bigint, RoomType>();
  const capacities = new Map<bigint, number>();
  const records = new Map<bigint, ReservationRecord>();
  const guests = new Map<bigint, bigint>([[12n, hotelId]]);
  const now = new Date();
  for (const id of [2n, 4n]) {
    types.set(id, {
      id,
      hotelId,
      code: `T${id}`,
      name: `Type ${id}`,
      description: null,
      maxAdults: 2,
      maxChildren: 1,
      basePrice: new Prisma.Decimal('900000.01'),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    capacities.set(id, 3);
  }
  const repository: ReservationRepository = {
    withHotelLock: async (_id, action) => action(repository),
    snapshot: async (action) => action(repository),
    hotel: async (id) => (id === hotelId ? { timezone: 'Asia/Ho_Chi_Minh' } : null),
    guest: async (hid, id) => (guests.get(id) === hid ? { id } : null),
    roomTypes: async (hid, ids) =>
      [...types.values()].filter(
        (t) => t.hotelId === hid && (ids ? ids.includes(t.id) : t.isActive),
      ),
    capacity: async (hid, id) => (types.get(id)?.hotelId === hid ? (capacities.get(id) ?? 0) : 0),
    occupied: async (hid, typeId, from, until) => {
      const nights = new Map<string, number>();
      for (const record of records.values()) {
        if (
          record.hotelId !== hid ||
          !['CONFIRMED', 'PARTIALLY_CHECKED_IN', 'CHECKED_IN', 'CHECKED_OUT'].includes(
            record.status,
          )
        )
          continue;
        for (const room of record.rooms.filter((r) => r.roomTypeId === typeId))
          for (const night of room.nights.filter((n) => n.stayDate >= from && n.stayDate < until)) {
            const day = asDateOnly(night.stayDate);
            nights.set(day, (nights.get(day) ?? 0) + 1);
          }
      }
      return [...nights].map(([day, count]) => ({
        stayDate: new Date(`${day}T00:00:00Z`),
        _count: { _all: count },
      }));
    },
    findById: async (hid, id) => (records.get(id)?.hotelId === hid ? records.get(id)! : null),
    list: async (hid, query) => {
      const items = [...records.values()].filter(
        (r) =>
          r.hotelId === hid &&
          (!query.status || r.status === query.status) &&
          (!query.search || r.confirmationCode.includes(query.search)),
      );
      return {
        items: items.slice((query.page - 1) * query.limit, query.page * query.limit),
        total: items.length,
      };
    },
    create: async (hid, actorId, input) => {
      const id = next++;
      const record: ReservationRecord = {
        id,
        hotelId: hid,
        confirmationCode: `INN-${id}`,
        bookerGuestId: input.guestId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        status: 'CONFIRMED',
        bookingSource: input.bookingSource,
        totalAmount: input.totalAmount,
        currency: 'VND',
        notes: input.notes,
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
        bookerGuest: { id: input.guestId, fullName: 'Synthetic guest' },
        creator: { id: actorId, fullName: 'Staff' },
        canceller: null,
        _count: { rooms: input.rooms.length },
        rooms: input.rooms.map((room) => {
          const roomId = next++;
          const type = types.get(room.roomTypeId)!;
          return {
            id: roomId,
            hotelId: hid,
            reservationId: id,
            roomTypeId: room.roomTypeId,
            roomId: null,
            stay: null,
            adults: room.adults,
            children: room.children,
            createdAt: now,
            updatedAt: now,
            roomType: { id: type.id, code: type.code, name: type.name },
            nights: room.nights.map((n) => ({
              ...n,
              id: next++,
              reservationRoomId: roomId,
              createdAt: now,
            })),
          };
        }),
      };
      records.set(id, record);
      return record;
    },
    cancel: async (hid, id, actorId, reason) => {
      const record = records.get(id)!;
      if (record.hotelId !== hid) throw new Error('Unscoped cancel');
      const updated: ReservationRecord = {
        ...record,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: actorId,
        cancellationReason: reason,
        canceller: { id: actorId, fullName: 'Staff' },
      };
      records.set(id, updated);
      return updated;
    },
  };
  return { repository, types, capacities, records, guests };
}

// Future relative dates keep normal test runs independent of the calendar year.
export function futureDay(offset: number) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}
export const reservationInput = () => ({
  guestId: '12',
  checkInDate: futureDay(10),
  checkOutDate: futureDay(12),
  rooms: [{ roomTypeId: '2', quantity: 1, adults: 2, children: 0 }],
  bookingSource: 'DIRECT' as const,
});
