type Quantity = string | number | null | undefined;

const options: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};
const quantityFormatter = new Intl.NumberFormat('vi-VN', options);
const inputFormatter = new Intl.NumberFormat('vi-VN', {
  ...options,
  useGrouping: false,
});

function format(value: Quantity, formatter: Intl.NumberFormat, empty: string) {
  if (value == null || (typeof value === 'string' && !value.trim()))
    return empty;
  const number = Number(value);
  if (!Number.isFinite(number)) return empty;
  const result = formatter.format(number);
  return result === '-0' ? '0' : result;
}

export const formatInventoryQuantity = (value: Quantity) =>
  format(value, quantityFormatter, '—');

// Leave in-progress input alone (including an unfinished decimal). Ungrouped
// input lets InputNumber's decimal separator parser accept both ',' and '.'.
export const inventoryQuantityInputProps = {
  decimalSeparator: ',',
  formatter: (
    value: string | number | undefined,
    { userTyping, input }: { userTyping: boolean; input: string },
  ) => (userTyping ? input : format(value, inputFormatter, '')),
};
