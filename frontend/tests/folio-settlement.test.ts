import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatFolioMoney,
  refundableAmount,
  terminalSettlementAmounts,
  validFinalCharge,
} from "../src/utils/folioSettlement.ts";
import { divideReportMoney, formatReportTotal, formatVnd, sumReportMoney } from "../src/pages/reports/reports.utils.ts";

test("terminal review distinguishes waived charges, retained deposits, refunds and money still owed", () => {
  assert.deepEqual(terminalSettlementAmounts("700000.00", "0.00", "0"), {
    adjustment: "-700000.00",
    outstanding: "0.00",
    refundDue: "0.00",
    collectionDue: "0.00",
  });
  assert.equal(
    terminalSettlementAmounts("700000", "300000", "300000").outstanding,
    "0.00",
  );
  assert.equal(
    terminalSettlementAmounts("700000", "500000", "300000").refundDue,
    "200000.00",
  );
  assert.equal(
    terminalSettlementAmounts("700000", "300000", "500000").collectionDue,
    "200000.00",
  );
});
test("settlement and refund limits preserve whole VND above safe integer", () => {
  const result = terminalSettlementAmounts(
    "9999999999999999.00",
    "9999999999999998.00",
    "9999999999999997",
  );
  assert.equal(result.adjustment, "-2.00");
  assert.equal(result.refundDue, "1.00");
  assert.equal(
    formatFolioMoney("9999999999999999.00"),
    "9.999.999.999.999.999 ₫",
  );
  assert.equal(
    refundableAmount("9999999999999999", "9999999999999998", "-1.00"),
    "1.00",
  );
});
test("refund suggestions use remaining receipt and folio credit, without offering a second full refund", () => {
  assert.equal(refundableAmount("200000", "400000", "-300000"), "200000.00");
  assert.equal(refundableAmount("200000", "100000", "-300000"), "100000.00");
  assert.equal(refundableAmount("200000", "400000", "100000"), "0.00");
  assert.equal(refundableAmount("0", "400000", "-300000"), "0.00");
});
test("settlement requires an explicit nonnegative whole amount rather than defaulting an empty fee to zero", () => {
  for (const value of [
    "",
    undefined,
    "-1",
    "0.50",
    "1e3",
    "10000000000000000",
    300000,
  ]) {
    assert.equal(validFinalCharge(value), false);
  }
  assert.equal(validFinalCharge("0"), true);
});

test("reports keep decimal amounts exact for labels, chart totals and rates", () => {
  assert.equal(formatVnd("9007199254740993.00"), "9.007.199.254.740.993\u00a0₫");
  assert.equal(formatReportTotal("9007199254740993.00", "1.25"), "9.007.199.254.740.994,25\u00a0₫");
  assert.equal(divideReportMoney(sumReportMoney("9007199254740993.01"), 2), "4503599627370496.51");
});
