import type { CreateGuestDto } from "../types/guests.types.ts";
export type GuestFormValues = Omit<CreateGuestDto, "dateOfBirth"> & {
  dateOfBirth?: { format: (pattern: string) => string } | null;
};
const text = (value?: string | null) => value?.trim() || null;
export function guestFormPayload(values: GuestFormValues): CreateGuestDto {
  return {
    fullName: values.fullName.trim(),
    phone: text(values.phone),
    email: text(values.email)?.toLowerCase() ?? null,
    dateOfBirth: values.dateOfBirth?.format("YYYY-MM-DD") ?? null,
    gender: values.gender || null,
    nationality: text(values.nationality),
    documentType: values.documentType || null,
    documentNumber: text(values.documentNumber)?.toUpperCase() ?? null,
    address: text(values.address),
    notes: text(values.notes),
  };
}
