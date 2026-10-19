export type GuestGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'OTHER';

export interface GuestSummary {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuestDetail extends GuestSummary {
  dateOfBirth?: string | null;
  gender?: GuestGender | null;
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface CreateGuestDto {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: GuestGender | null;
  nationality?: string | null;
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type UpdateGuestDto = Partial<CreateGuestDto>;

export interface GuestFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  nationality?: string;
  sortBy?: 'fullName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
