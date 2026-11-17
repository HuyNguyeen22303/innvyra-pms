import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingDepositPayload,
  bookingRoomCharge,
  emptyBookingDeposit,
  prepareBookingAttempt,
} from "../src/utils/bookingWorkflow.ts";
import { guestFormPayload } from "../src/utils/guestForm.ts";

test("booking without deposit omits money movement; a full attested deposit is allowed", () => {
  assert.equal(
    bookingDepositPayload(emptyBookingDeposit(), "700000.00"),
    undefined,
  );
  assert.deepEqual(
    bookingDepositPayload(
      {
        ...emptyBookingDeposit(),
        enabled: true,
        amount: "700000",
        confirmedReceived: true,
      },
      "700000.00",
    ),
    {
      amount: "700000.00",
      paymentMethod: "CASH",
      referenceNumber: null,
      confirmedReceived: true,
    },
  );
});
test("deposit validation refuses unreceived, excessive, fractional and unreferenced money", () => {
  const value = {
    ...emptyBookingDeposit(),
    enabled: true,
    amount: "300000",
    confirmedReceived: true,
  };
  for (const patch of [
    { amount: "0" },
    { amount: "700001" },
    { amount: "1.50" },
    { confirmedReceived: false },
    { paymentMethod: "BANK_TRANSFER" as const },
  ])
    assert.throws(() =>
      bookingDepositPayload({ ...value, ...patch }, "700000.00"),
    );
  assert.equal(
    bookingDepositPayload(
      { ...value, paymentMethod: "BANK_TRANSFER", referenceNumber: " BANK-1 " },
      "700000.00",
    )?.referenceNumber,
    "BANK-1",
  );
});
test("deposit limit follows per-night half-up billing, not rounding the whole reservation once", () => {
  assert.equal(
    bookingRoomCharge(
      { "1": { quantity: 2 } },
      [
        {
          roomTypeId: "1",
          basePrice: "900000.50",
          roomTypeName: "Deluxe",
          availableRooms: 3,
          estimatedTotalPerRoom: "1800001.00",
          currency: "VND",
        },
      ],
      2,
    ),
    "3600004.00",
  );
});
test("an ambiguous confirmation reuses its original key and payload even if the visible draft changes", () => {
  const payload = {
    guestId: "1",
    checkInDate: "2026-11-20",
    checkOutDate: "2026-11-21",
    rooms: [{ roomTypeId: "2", quantity: 1, adults: 2 }],
  };
  const original = prepareBookingAttempt(
    null,
    payload,
    false,
    () => "booking-key-1",
  );
  assert.equal(
    prepareBookingAttempt(original, payload, false, () => "unused"),
    original,
  );
  assert.equal(
    prepareBookingAttempt(
      original,
      { ...payload, guestId: "3" },
      true,
      () => "unused",
    ),
    original,
  );
  payload.rooms[0]!.quantity = 2;
  assert.equal(original.payload.rooms[0]!.quantity, 1);
  assert.equal(
    prepareBookingAttempt(null, payload, false, () => "booking-key-2").key,
    "booking-key-2",
  );
});
test("the shared full guest form preserves optional fields and normalizes identity input", () => {
  assert.deepEqual(
    guestFormPayload({
      fullName: "  Nguyễn Văn An ",
      phone: "0909 123 456 ",
      email: " AN@EXAMPLE.COM ",
      dateOfBirth: { format: () => "1995-05-20" },
      gender: "MALE",
      nationality: " Việt Nam ",
      documentType: "PASSPORT",
      documentNumber: " ab123456 ",
      address: " 123 Nguyễn Huệ ",
      notes: " Phòng yên tĩnh ",
    }),
    {
      fullName: "Nguyễn Văn An",
      phone: "0909 123 456",
      email: "an@example.com",
      dateOfBirth: "1995-05-20",
      gender: "MALE",
      nationality: "Việt Nam",
      documentType: "PASSPORT",
      documentNumber: "AB123456",
      address: "123 Nguyễn Huệ",
      notes: "Phòng yên tĩnh",
    },
  );
  assert.equal(guestFormPayload({ fullName: "An", phone: " " }).phone, null);
});
