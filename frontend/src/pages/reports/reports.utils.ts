export const formatVnd = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '-';
  return `${num.toLocaleString('vi-VN')}\u00A0₫`;
};
