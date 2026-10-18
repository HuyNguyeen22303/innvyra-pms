import { z } from 'zod';
import {
  emptyQuery,
  idParams,
  idSchema,
  paginationFields,
  priceSchema,
} from '../../shared/validation/room-input.js';

const codeSchema = z
  .string()
  .trim()
  .min(1, 'Code is required')
  .max(50, 'Code must not exceed 50 characters');

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(191, 'Name must not exceed 191 characters');

const unitSchema = z
  .string()
  .trim()
  .min(1, 'Unit is required')
  .max(30, 'Unit must not exceed 30 characters');

const textSchema = z.string().trim().max(5000).nullable().optional();

// Decimal string or positive number for quantity
const positiveQuantitySchema = z
  .union([
    z.number().positive('Quantity must be greater than 0'),
    z
      .string()
      .trim()
      .regex(/^(0\.\d*[1-9]\d*|[1-9]\d*(\.\d{1,2})?)$/, 'Quantity must be a positive decimal'),
  ])
  .transform((val) => String(val));

// Decimal string or non-negative number for min stock level or actual physical count
const nonNegativeQuantitySchema = z
  .union([
    z.number().nonnegative('Quantity cannot be negative'),
    z
      .string()
      .trim()
      .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/, 'Must be a non-negative decimal'),
  ])
  .transform((val) => String(val));

const positiveOrZeroPriceSchema = z
  .union([
    z.number().nonnegative('Price cannot be negative'),
    priceSchema,
  ])
  .transform((val) => String(val));

// --- Category Schemas ---
export const categoryCreateBody = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: textSchema,
  })
  .strict();

export const categoryUpdateBody = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    description: textSchema,
    isActive: z.boolean().optional(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Supply at least one field');

export const categoryListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: paginationFields.search,
    isActive: paginationFields.isActive,
  })
  .strict();

export const createCategorySchema = z.object({ body: categoryCreateBody, query: emptyQuery });
export const updateCategorySchema = z.object({
  body: categoryUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const categoryIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listCategoriesSchema = z.object({ query: categoryListQuery });

// --- Supplier Schemas ---
export const supplierCreateBody = z
  .object({
    code: codeSchema,
    name: nameSchema,
    contactPerson: z.string().trim().max(150).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().trim().toLowerCase().max(191).email().nullable().optional(),
    address: z.string().trim().max(255).nullable().optional(),
    notes: textSchema,
  })
  .strict();

export const supplierUpdateBody = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    contactPerson: z.string().trim().max(150).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().trim().toLowerCase().max(191).email().nullable().optional(),
    address: z.string().trim().max(255).nullable().optional(),
    notes: textSchema,
    isActive: z.boolean().optional(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Supply at least one field');

export const supplierListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: paginationFields.search,
    isActive: paginationFields.isActive,
  })
  .strict();

export const createSupplierSchema = z.object({ body: supplierCreateBody, query: emptyQuery });
export const updateSupplierSchema = z.object({
  body: supplierUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const supplierIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listSuppliersSchema = z.object({ query: supplierListQuery });

// --- Item Schemas ---
export const itemCreateBody = z
  .object({
    code: codeSchema,
    name: nameSchema,
    categoryId: idSchema,
    unit: unitSchema,
    description: textSchema,
    minStockLevel: nonNegativeQuantitySchema.default('0.00'),
  })
  .strict();

export const itemUpdateBody = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    categoryId: idSchema.optional(),
    unit: unitSchema.optional(),
    description: textSchema,
    minStockLevel: nonNegativeQuantitySchema.optional(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Supply at least one field');

export const itemListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    search: paginationFields.search,
    categoryId: idSchema.optional(),
    isActive: paginationFields.isActive,
    stockStatus: z.enum(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).default('ALL'),
  })
  .strict();

export const createItemSchema = z.object({ body: itemCreateBody, query: emptyQuery });
export const updateItemSchema = z.object({
  body: itemUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const itemIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listItemsSchema = z.object({ query: itemListQuery });

// --- Receipt Schemas ---
const receiptItemInputSchema = z
  .object({
    itemId: idSchema,
    quantity: positiveQuantitySchema,
    unitPrice: positiveOrZeroPriceSchema.default('0.00'),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const receiptCreateBody = z
  .object({
    receiptNumber: z.string().trim().max(50).optional(),
    supplierId: idSchema.nullable().optional(),
    receiptDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .optional(),
    notes: textSchema,
    items: z.array(receiptItemInputSchema).min(1, 'Receipt must have at least one item'),
  })
  .strict();

export const receiptListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    supplierId: idSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .strict();

export const createReceiptSchema = z.object({ body: receiptCreateBody, query: emptyQuery });
export const receiptIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listReceiptsSchema = z.object({ query: receiptListQuery });

// --- Issue Schemas ---
const issueItemInputSchema = z
  .object({
    itemId: idSchema,
    quantity: positiveQuantitySchema,
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const issueCreateBody = z
  .object({
    issueNumber: z.string().trim().max(50).optional(),
    issueDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .optional(),
    department: z
      .string()
      .trim()
      .min(1, 'Department is required')
      .max(100, 'Department must not exceed 100 characters'),
    purpose: z.string().trim().max(500).nullable().optional(),
    notes: textSchema,
    items: z.array(issueItemInputSchema).min(1, 'Issue must have at least one item'),
  })
  .strict();

export const issueListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    department: z.string().trim().min(1).max(100).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .strict();

export const createIssueSchema = z.object({ body: issueCreateBody, query: emptyQuery });
export const issueIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listIssuesSchema = z.object({ query: issueListQuery });

// --- Adjustment Schemas ---
export const adjustmentCreateBody = z
  .object({
    adjustmentNumber: z.string().trim().max(50).optional(),
    itemId: idSchema,
    actualQuantity: nonNegativeQuantitySchema,
    reason: z
      .string()
      .trim()
      .min(1, 'Reason for adjustment is required')
      .max(500, 'Reason must not exceed 500 characters'),
  })
  .strict();

export const createAdjustmentSchema = z.object({ body: adjustmentCreateBody, query: emptyQuery });

// --- Movements Schemas ---
export const movementListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    itemId: idSchema.optional(),
    type: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .strict();

export const listMovementsSchema = z.object({ query: movementListQuery });

// --- Low Stock / Summary Schemas ---
export const lowStockListQuery = z
  .object({
    page: paginationFields.page,
    limit: paginationFields.limit,
    categoryId: idSchema.optional(),
  })
  .strict();

export const lowStockSchema = z.object({ query: lowStockListQuery });
