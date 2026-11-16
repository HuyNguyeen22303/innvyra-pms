import assert from "node:assert/strict";
import { test } from "node:test";
import { supplierPaymentFromForm } from "../src/utils/supplierPayments.ts";

test("supplier payment preserves the actual payment instant and decimal amount", () => {
  const payment = supplierPaymentFromForm(
    {
      supplierAmount: 400000.5,
      supplierMethod: "BANK_TRANSFER",
      supplierPaidAt: new Date("2026-11-12T09:30:00+07:00"),
      supplierReference: "  VCB-123456  ",
    },
    "stable-payment-request",
  );
  assert.deepEqual(payment, {
    requestKey: "stable-payment-request",
    amount: "400000.50",
    paymentMethod: "BANK_TRANSFER",
    paidAt: "2026-11-12T02:30:00.000Z",
    referenceNumber: "VCB-123456",
  });
});

test("retrying the same payment form keeps the idempotency key and omits empty reference", () => {
  const values = {
    supplierAmount: 600000,
    supplierMethod: "CASH" as const,
    supplierPaidAt: new Date("2026-11-14T03:15:00Z"),
    supplierReference: "  ",
  };
  const original = supplierPaymentFromForm(values, "same-key");
  assert.deepEqual(supplierPaymentFromForm(values, "same-key"), original);
  assert.equal(original.amount, "600000.00");
  assert.equal("referenceNumber" in original, false);
});
