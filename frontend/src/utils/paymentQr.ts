export function validQrAmount(value: unknown): value is string {
  return (
    typeof value === "string" && /^[1-9]\d{0,12}(?:\.0{1,2})?$/.test(value)
  );
}
