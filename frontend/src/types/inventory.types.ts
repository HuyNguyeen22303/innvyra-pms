export interface InventoryCategoryView {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierView {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemCategoryInfo {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface InventoryItemView {
  id: string;
  hotelId: string;
  categoryId: string;
  category: InventoryItemCategoryInfo;
  code: string;
  name: string;
  unit: string;
  description: string | null;
  currentStock: string;
  minStockLevel: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockReceiptItemView {
  id: string;
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  createdAt: string;
}

export interface StockReceiptView {
  id: string;
  hotelId: string;
  receiptNumber: string;
  receiptDate: string;
  supplierId: string | null;
  supplier: {
    id: string;
    code: string;
    name: string;
  } | null;
  totalAmount: string;
  notes: string | null;
  createdBy: string;
  creator?: {
    id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  items: StockReceiptItemView[];
}

export interface StockIssueItemView {
  id: string;
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  quantity: string;
  notes: string | null;
  createdAt: string;
}

export interface StockIssueView {
  id: string;
  hotelId: string;
  issueNumber: string;
  issueDate: string;
  department: string;
  purpose: string | null;
  notes: string | null;
  createdBy: string;
  creator?: {
    id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  items: StockIssueItemView[];
}

export interface StockAdjustmentView {
  id: string;
  hotelId: string;
  adjustmentNumber: string;
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  systemQuantity: string;
  actualQuantity: string;
  difference: string;
  reason: string;
  createdBy: string;
  creator?: {
    id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
}

export type InventoryMovementType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT';

export interface InventoryMovementView {
  id: string;
  hotelId: string;
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
  type: InventoryMovementType;
  quantity: string;
  previousStock: string;
  currentStock: string;
  referenceType: string;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  creator?: {
    id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
}

export interface InventorySummaryCategory {
  id: string;
  code: string;
  name: string;
  totalItems: number;
  lowStockItems: number;
}

export interface InventorySummary {
  totalActiveItems: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  totalCategories: number;
  categories: InventorySummaryCategory[];
  totalInventoryEstimatedValue: string;
}

// Request / DTO Types
export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateCategoryDto {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateSupplierDto {
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateSupplierDto {
  code?: string;
  name?: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface SupplierQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateItemDto {
  code: string;
  name: string;
  categoryId: string;
  unit: string;
  description?: string | null;
  minStockLevel?: string;
}

export interface UpdateItemDto {
  code?: string;
  name?: string;
  categoryId?: string;
  unit?: string;
  description?: string | null;
  minStockLevel?: string;
}

export type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ItemQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  stockStatus?: StockStatusFilter;
}

export interface CreateReceiptItemDto {
  itemId: string;
  quantity: string | number;
  unitPrice?: string | number;
  notes?: string | null;
}

export interface CreateReceiptDto {
  receiptNumber?: string;
  supplierId?: string | null;
  receiptDate?: string;
  notes?: string | null;
  items: CreateReceiptItemDto[];
}

export interface ReceiptQueryParams {
  page?: number;
  limit?: number;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateIssueItemDto {
  itemId: string;
  quantity: string | number;
  notes?: string | null;
}

export interface CreateIssueDto {
  issueNumber?: string;
  issueDate?: string;
  department: string;
  purpose?: string | null;
  notes?: string | null;
  items: CreateIssueItemDto[];
}

export interface IssueQueryParams {
  page?: number;
  limit?: number;
  department?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateAdjustmentDto {
  adjustmentNumber?: string;
  itemId: string;
  actualQuantity: string | number;
  reason: string;
}

export interface MovementQueryParams {
  page?: number;
  limit?: number;
  itemId?: string;
  type?: InventoryMovementType;
  startDate?: string;
  endDate?: string;
}

export interface LowStockQueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
}
