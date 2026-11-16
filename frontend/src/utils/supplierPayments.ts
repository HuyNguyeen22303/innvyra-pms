import type { SupplierPaymentDto } from "../api/supplies.api.ts";

export interface SupplierPaymentFormValues {
  supplierAmount: number;
  supplierMethod: SupplierPaymentDto["paymentMethod"];
  supplierPaidAt: { toISOString(): string };
  supplierReference?: string;
}

export function supplierPaymentFromForm(
  values: SupplierPaymentFormValues,
  requestKey: string,
): SupplierPaymentDto {
  return {
    requestKey,
    amount: Number(values.supplierAmount).toFixed(2),
    paymentMethod: values.supplierMethod,
    paidAt: values.supplierPaidAt.toISOString(),
    ...(values.supplierReference?.trim()
      ? { referenceNumber: values.supplierReference.trim() }
      : {}),
  };
}
