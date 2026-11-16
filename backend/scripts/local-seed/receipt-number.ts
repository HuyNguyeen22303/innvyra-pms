export function localPurchaseReceiptNumber(day: string, sequence: number) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 3 ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  )
    throw new Error('Invalid local purchase receipt date or sequence');
  return `NHAP-VT-${day.replaceAll('-', '')}-${String(sequence).padStart(2, '0')}`;
}
