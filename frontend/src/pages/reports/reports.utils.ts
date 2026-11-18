import { formatFolioMoney, moneyCentsToDecimal, parseMoneyCents } from '../../utils/folioSettlement.ts';

export const formatVnd = (value: string | number | undefined | null): string => {
  if (typeof value === 'number')
    return Number.isFinite(value) ? `${value.toLocaleString('vi-VN')}\u00A0₫` : '-';
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return '-';
  return formatFolioMoney(value).replace(' ₫', '\u00A0₫');
};

export const sumReportMoney = (...values: (string | null | undefined)[]) =>
  values.reduce((sum, value) => sum + parseMoneyCents(value ?? '0'), 0n);

export const formatReportTotal = (...values: (string | null | undefined)[]) =>
  formatVnd(moneyCentsToDecimal(sumReportMoney(...values)));

export function divideReportMoney(cents: bigint, count: number) {
  if (!count) return null;
  const divisor = BigInt(count);
  const absolute = cents < 0n ? -cents : cents;
  const rounded = (absolute + divisor / 2n) / divisor;
  return moneyCentsToDecimal(cents < 0n ? -rounded : rounded);
}
