import type { z } from 'zod';
import {
  Prisma,
  type InventoryCategory,
  type InventoryItem,
  type Supplier,
  type StockReceipt,
  type StockReceiptItem,
  type StockIssue,
  type StockIssueItem,
  type StockAdjustment,
  type InventoryMovement,
  type InventoryMovementType,
} from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type {
  categoryCreateBody,
  categoryUpdateBody,
  categoryListQuery,
  supplierCreateBody,
  supplierUpdateBody,
  supplierListQuery,
  itemCreateBody,
  itemUpdateBody,
  itemListQuery,
  receiptCreateBody,
  receiptListQuery,
  issueCreateBody,
  issueListQuery,
  adjustmentCreateBody,
  movementListQuery,
  lowStockListQuery,
} from './inventory.schema.js';
import type { PrismaInventoryRepository } from './inventory.repository.js';

export type InventoryScope = {
  hotelId: bigint;
  actorId: bigint;
  role: RoleCode;
};

export const inventoryPermissions = {
  itemRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'],
  itemWrite: ['ADMIN', 'MANAGER'],
  categoryRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'],
  categoryWrite: ['ADMIN', 'MANAGER'],
  supplierRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  supplierWrite: ['ADMIN', 'MANAGER'],
  receiptRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  receiptWrite: ['ADMIN', 'MANAGER'],
  issueRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'],
  issueWrite: ['ADMIN', 'MANAGER', 'HOUSEKEEPING', 'TECHNICIAN'],
  adjustmentWrite: ['ADMIN', 'MANAGER'],
  movementRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  summaryRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  lowStockRead: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'],
} as const satisfies Record<string, readonly RoleCode[]>;

export type CreateCategoryInput = z.infer<typeof categoryCreateBody>;
export type UpdateCategoryInput = z.infer<typeof categoryUpdateBody>;
export type CategoryQuery = z.infer<typeof categoryListQuery>;

export type CreateSupplierInput = z.infer<typeof supplierCreateBody>;
export type UpdateSupplierInput = z.infer<typeof supplierUpdateBody>;
export type SupplierQuery = z.infer<typeof supplierListQuery>;

export type CreateItemInput = z.input<typeof itemCreateBody>;
export type UpdateItemInput = z.infer<typeof itemUpdateBody>;
export type ItemQuery = z.infer<typeof itemListQuery>;

export type CreateReceiptInput = z.infer<typeof receiptCreateBody>;
export type ReceiptQuery = z.infer<typeof receiptListQuery>;

export type CreateIssueInput = z.infer<typeof issueCreateBody>;
export type IssueQuery = z.infer<typeof issueListQuery>;

export type CreateAdjustmentInput = z.infer<typeof adjustmentCreateBody>;
export type MovementQuery = z.infer<typeof movementListQuery>;
export type LowStockQuery = z.infer<typeof lowStockListQuery>;

export type InventoryRepository = Pick<
  PrismaInventoryRepository,
  keyof PrismaInventoryRepository
>;
export type InventoryOperations = Omit<InventoryRepository, 'withHotelLock'>;

export type ItemWithCategory = InventoryItem & {
  category: Pick<InventoryCategory, 'id' | 'code' | 'name' | 'isActive'>;
};

export type ReceiptWithDetails = StockReceipt & {
  supplier: Pick<Supplier, 'id' | 'code' | 'name'> | null;
  items: (StockReceiptItem & {
    item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
  })[];
  creator: { id: bigint; fullName: string; username: string };
};

export type IssueWithDetails = StockIssue & {
  items: (StockIssueItem & {
    item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
  })[];
  creator: { id: bigint; fullName: string; username: string };
};

export type AdjustmentWithDetails = StockAdjustment & {
  item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
  creator: { id: bigint; fullName: string; username: string };
};

export type MovementWithDetails = InventoryMovement & {
  item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
  creator: { id: bigint; fullName: string; username: string };
};

export const categoryView = (cat: InventoryCategory) => ({
  id: cat.id.toString(),
  hotelId: cat.hotelId.toString(),
  code: cat.code,
  name: cat.name,
  description: cat.description,
  isActive: cat.isActive,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt,
});

export const supplierView = (sup: Supplier) => ({
  id: sup.id.toString(),
  hotelId: sup.hotelId.toString(),
  code: sup.code,
  name: sup.name,
  contactPerson: sup.contactPerson,
  phone: sup.phone,
  email: sup.email,
  address: sup.address,
  notes: sup.notes,
  isActive: sup.isActive,
  createdAt: sup.createdAt,
  updatedAt: sup.updatedAt,
});

const formatDecimal = (val: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(val).toFixed(2);

export const itemView = (item: ItemWithCategory) => {
  const currentStock = Number(item.currentStock);
  const minStockLevel = Number(item.minStockLevel);
  return {
    id: item.id.toString(),
    hotelId: item.hotelId.toString(),
    categoryId: item.categoryId.toString(),
    category: {
      id: item.category.id.toString(),
      code: item.category.code,
      name: item.category.name,
      isActive: item.category.isActive,
    },
    code: item.code,
    name: item.name,
    unit: item.unit,
    description: item.description,
    currentStock: formatDecimal(item.currentStock),
    minStockLevel: formatDecimal(item.minStockLevel),
    isLowStock: currentStock <= minStockLevel,
    isOutOfStock: currentStock <= 0,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export const receiptView = (receipt: ReceiptWithDetails) => ({
  id: receipt.id.toString(),
  hotelId: receipt.hotelId.toString(),
  receiptNumber: receipt.receiptNumber,
  receiptDate: receipt.receiptDate,
  supplierId: receipt.supplierId ? receipt.supplierId.toString() : null,
  supplier: receipt.supplier
    ? {
        id: receipt.supplier.id.toString(),
        code: receipt.supplier.code,
        name: receipt.supplier.name,
      }
    : null,
  totalAmount: formatDecimal(receipt.totalAmount),
  notes: receipt.notes,
  createdBy: receipt.createdBy.toString(),
  creator: receipt.creator
    ? {
        id: receipt.creator.id.toString(),
        fullName: receipt.creator.fullName,
        username: receipt.creator.username,
      }
    : undefined,
  createdAt: receipt.createdAt,
  updatedAt: receipt.updatedAt,
  items: receipt.items.map((item) => ({
    id: item.id.toString(),
    itemId: item.itemId.toString(),
    item: {
      id: item.item.id.toString(),
      code: item.item.code,
      name: item.item.name,
      unit: item.item.unit,
    },
    quantity: formatDecimal(item.quantity),
    unitPrice: formatDecimal(item.unitPrice),
    lineTotal: formatDecimal(item.lineTotal),
    notes: item.notes,
    createdAt: item.createdAt,
  })),
});

export const issueView = (issue: IssueWithDetails) => ({
  id: issue.id.toString(),
  hotelId: issue.hotelId.toString(),
  issueNumber: issue.issueNumber,
  issueDate: issue.issueDate,
  department: issue.department,
  purpose: issue.purpose,
  notes: issue.notes,
  createdBy: issue.createdBy.toString(),
  creator: issue.creator
    ? {
        id: issue.creator.id.toString(),
        fullName: issue.creator.fullName,
        username: issue.creator.username,
      }
    : undefined,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
  items: issue.items.map((item) => ({
    id: item.id.toString(),
    itemId: item.itemId.toString(),
    item: {
      id: item.item.id.toString(),
      code: item.item.code,
      name: item.item.name,
      unit: item.item.unit,
    },
    quantity: formatDecimal(item.quantity),
    notes: item.notes,
    createdAt: item.createdAt,
  })),
});

export const adjustmentView = (adj: AdjustmentWithDetails) => ({
  id: adj.id.toString(),
  hotelId: adj.hotelId.toString(),
  adjustmentNumber: adj.adjustmentNumber,
  itemId: adj.itemId.toString(),
  item: {
    id: adj.item.id.toString(),
    code: adj.item.code,
    name: adj.item.name,
    unit: adj.item.unit,
  },
  systemQuantity: formatDecimal(adj.systemQuantity),
  actualQuantity: formatDecimal(adj.actualQuantity),
  difference: formatDecimal(adj.difference),
  reason: adj.reason,
  createdBy: adj.createdBy.toString(),
  creator: adj.creator
    ? {
        id: adj.creator.id.toString(),
        fullName: adj.creator.fullName,
        username: adj.creator.username,
      }
    : undefined,
  createdAt: adj.createdAt,
});

export const movementView = (mov: MovementWithDetails) => ({
  id: mov.id.toString(),
  hotelId: mov.hotelId.toString(),
  itemId: mov.itemId.toString(),
  item: {
    id: mov.item.id.toString(),
    code: mov.item.code,
    name: mov.item.name,
    unit: mov.item.unit,
  },
  type: mov.type as InventoryMovementType,
  quantity: formatDecimal(mov.quantity),
  previousStock: formatDecimal(mov.previousStock),
  currentStock: formatDecimal(mov.currentStock),
  referenceType: mov.referenceType,
  referenceId: mov.referenceId ? mov.referenceId.toString() : null,
  referenceNumber: mov.referenceNumber,
  notes: mov.notes,
  createdBy: mov.createdBy.toString(),
  creator: mov.creator
    ? {
        id: mov.creator.id.toString(),
        fullName: mov.creator.fullName,
        username: mov.creator.username,
      }
    : undefined,
  createdAt: mov.createdAt,
});

export type InventorySummary = {
  totalActiveItems: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  totalCategories: number;
  categories: {
    id: string;
    code: string;
    name: string;
    totalItems: number;
    lowStockItems: number;
  }[];
  totalInventoryEstimatedValue: string;
};
