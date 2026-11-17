// Keep financial previews exact, including amounts above Number.MAX_SAFE_INTEGER.
const cents = (value: string): bigint => {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Invalid monetary amount");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -result : result;
};
const decimal = (value: bigint): string => {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
};
export const validFinalCharge = (value: unknown): value is string =>
  typeof value === "string" && /^(0|[1-9]\d{0,15})(\.0{1,2})?$/.test(value);

export function terminalSettlementAmounts(
  netCharges: string,
  netPaid: string,
  finalCharge: string,
) {
  if (!validFinalCharge(finalCharge)) throw new Error("Invalid final charge");
  const final = cents(finalCharge);
  const outstanding = final - cents(netPaid);
  return {
    adjustment: decimal(final - cents(netCharges)),
    outstanding: decimal(outstanding),
    refundDue: decimal(outstanding < 0n ? -outstanding : 0n),
    collectionDue: decimal(outstanding > 0n ? outstanding : 0n),
  };
}

export function formatFolioMoney(value: string): string {
  const amount = cents(value);
  const absolute = amount < 0n ? -amount : amount;
  const remainder = absolute % 100n;
  return `${amount < 0n ? "-" : ""}${(absolute / 100n).toLocaleString("vi-VN")}${remainder ? `,${String(remainder).padStart(2, "0")}` : ""} ₫`;
}

export function refundableAmount(
  receiptAvailable: string,
  netPaid: string,
  terminalBalance?: string,
): string {
  const limits = [cents(receiptAvailable), cents(netPaid)];
  if (terminalBalance !== undefined) limits.push(-cents(terminalBalance));
  const limit = limits.reduce((a, b) => (a < b ? a : b));
  return decimal(limit > 0n ? limit : 0n);
}
