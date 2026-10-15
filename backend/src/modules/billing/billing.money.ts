import { Prisma, type FolioItem, type Payment } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

// Isolated Decimal context: do not change pricing precision in previous modules.
export const Money = Prisma.Decimal.clone({
  precision: 40,
  rounding: Prisma.Decimal.ROUND_HALF_UP,
});
export const maxAmount = new Money('9999999999999999.00');
export function checkedAmount(value: Prisma.Decimal) {
  if (!value.isFinite() || value.isNegative() || value.gt(maxAmount))
    throw new AppError(422, 'INVALID_PAYMENT_AMOUNT', 'Amount exceeds supported financial limits');
  return value;
}
export function roomCharge(snapshot: Prisma.Decimal) {
  return checkedAmount(new Money(snapshot).toDecimalPlaces(0, Money.ROUND_HALF_UP));
}
export function calculateBalance(
  items: Pick<FolioItem, 'entryType' | 'amount'>[],
  payments: Pick<Payment, 'paymentType' | 'status' | 'amount'>[],
) {
  let totalCharges = new Money(0),
    totalCredits = new Money(0),
    totalPayments = new Money(0),
    totalDeposits = new Money(0),
    totalRefunds = new Money(0);
  for (const item of items) {
    if (item.entryType === 'DEBIT') totalCharges = totalCharges.add(item.amount);
    else totalCredits = totalCredits.add(item.amount);
  }
  for (const payment of payments) {
    if (payment.status !== 'CONFIRMED') continue;
    if (payment.paymentType === 'PAYMENT') totalPayments = totalPayments.add(payment.amount);
    else if (payment.paymentType === 'DEPOSIT') totalDeposits = totalDeposits.add(payment.amount);
    else totalRefunds = totalRefunds.add(payment.amount);
  }
  const netCharges = totalCharges.sub(totalCredits);
  const netPaid = totalPayments.add(totalDeposits).sub(totalRefunds);
  return {
    totalCharges,
    totalCredits,
    totalPayments,
    totalDeposits,
    totalRefunds,
    netCharges,
    netPaid,
    outstandingBalance: netCharges.sub(netPaid),
  };
}
export const balanceDto = (balance: ReturnType<typeof calculateBalance>) =>
  Object.fromEntries(Object.entries(balance).map(([key, value]) => [key, value.toFixed(2)]));
