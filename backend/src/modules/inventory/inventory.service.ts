import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import type {
  InventoryRepository,
  InventoryScope,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryQuery,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierQuery,
  CreateItemInput,
  UpdateItemInput,
  ItemQuery,
  CreateReceiptInput,
  ReceiptQuery,
  CreateIssueInput,
  IssueQuery,
  CreateAdjustmentInput,
  MovementQuery,
  LowStockQuery,
} from './inventory.types.js';
import {
  categoryView,
  supplierView,
  itemView,
  receiptView,
  issueView,
  adjustmentView,
  movementView,
} from './inventory.types.js';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  // ==================== CATEGORIES ====================
  async createCategory(scope: InventoryScope, input: CreateCategoryInput) {
    const existing = await this.repository.findCategoryByCode(scope.hotelId, input.code);
    if (existing) {
      throw new AppError(409, 'CATEGORY_CODE_EXISTS', 'Category code already exists in this hotel');
    }
    const category = await this.repository.createCategory({
      hotelId: scope.hotelId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
    });
    return categoryView(category);
  }

  async getCategories(scope: InventoryScope, query: CategoryQuery) {
    const { items, total } = await this.repository.listCategories(scope.hotelId, query);
    return pageResult(items.map(categoryView), total, query);
  }

  async getCategoryById(scope: InventoryScope, id: bigint) {
    const category = await this.repository.findCategoryById(scope.hotelId, id);
    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    return categoryView(category);
  }

  async updateCategory(scope: InventoryScope, id: bigint, input: UpdateCategoryInput) {
    const existing = await this.repository.findCategoryById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    if (input.code && input.code !== existing.code) {
      const duplicate = await this.repository.findCategoryByCode(scope.hotelId, input.code, id);
      if (duplicate) {
        throw new AppError(
          409,
          'CATEGORY_CODE_EXISTS',
          'Category code already exists in this hotel',
        );
      }
    }
    const updated = await this.repository.updateCategory(scope.hotelId, id, {
      ...(input.code ? { code: input.code } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
    return categoryView(updated);
  }

  async deactivateCategory(scope: InventoryScope, id: bigint) {
    const existing = await this.repository.findCategoryById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    const countItems = await this.repository.countItemsUsingCategory(scope.hotelId, id);
    if (countItems > 0) {
      throw new AppError(
        409,
        'CATEGORY_IN_USE',
        'Cannot deactivate category that is still assigned to active or existing items',
      );
    }
    const updated = await this.repository.updateCategory(scope.hotelId, id, {
      isActive: false,
    });
    return categoryView(updated);
  }

  // ==================== SUPPLIERS ====================
  async createSupplier(scope: InventoryScope, input: CreateSupplierInput) {
    const existing = await this.repository.findSupplierByCode(scope.hotelId, input.code);
    if (existing) {
      throw new AppError(409, 'SUPPLIER_CODE_EXISTS', 'Supplier code already exists in this hotel');
    }
    const supplier = await this.repository.createSupplier({
      hotelId: scope.hotelId,
      code: input.code,
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    });
    return supplierView(supplier);
  }

  async getSuppliers(scope: InventoryScope, query: SupplierQuery) {
    const { items, total } = await this.repository.listSuppliers(scope.hotelId, query);
    return pageResult(items.map(supplierView), total, query);
  }

  async getSupplierById(scope: InventoryScope, id: bigint) {
    const supplier = await this.repository.findSupplierById(scope.hotelId, id);
    if (!supplier) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    return supplierView(supplier);
  }

  async updateSupplier(scope: InventoryScope, id: bigint, input: UpdateSupplierInput) {
    const existing = await this.repository.findSupplierById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    if (input.code && input.code !== existing.code) {
      const duplicate = await this.repository.findSupplierByCode(scope.hotelId, input.code, id);
      if (duplicate) {
        throw new AppError(
          409,
          'SUPPLIER_CODE_EXISTS',
          'Supplier code already exists in this hotel',
        );
      }
    }
    const updated = await this.repository.updateSupplier(scope.hotelId, id, {
      ...(input.code ? { code: input.code } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
    return supplierView(updated);
  }

  async deactivateSupplier(scope: InventoryScope, id: bigint) {
    const existing = await this.repository.findSupplierById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    const updated = await this.repository.updateSupplier(scope.hotelId, id, {
      isActive: false,
    });
    return supplierView(updated);
  }

  // ==================== ITEMS ====================
  async createItem(scope: InventoryScope, input: CreateItemInput) {
    const category = await this.repository.findCategoryById(
      scope.hotelId,
      BigInt(input.categoryId),
    );
    if (!category || !category.isActive) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found or inactive');
    }

    const existing = await this.repository.findItemByCode(scope.hotelId, input.code);
    if (existing) {
      throw new AppError(409, 'ITEM_CODE_EXISTS', 'Item code already exists in this hotel');
    }

    const item = await this.repository.createItem({
      hotelId: scope.hotelId,
      categoryId: BigInt(input.categoryId),
      code: input.code,
      name: input.name,
      unit: input.unit,
      description: input.description ?? null,
      minStockLevel: new Prisma.Decimal(input.minStockLevel ?? '0.00'),
      currentStock: new Prisma.Decimal('0.00'), // Cannot be set directly via create
      isActive: true,
    });
    return itemView(item);
  }

  async getItems(scope: InventoryScope, query: ItemQuery) {
    const { items, total } = await this.repository.listItems(scope.hotelId, query);
    return pageResult(items.map(itemView), total, query);
  }

  async getItemById(scope: InventoryScope, id: bigint) {
    const item = await this.repository.findItemById(scope.hotelId, id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }
    return itemView(item);
  }

  async updateItem(scope: InventoryScope, id: bigint, input: UpdateItemInput) {
    const existing = await this.repository.findItemById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }

    if (input.code && input.code !== existing.code) {
      const duplicate = await this.repository.findItemByCode(scope.hotelId, input.code, id);
      if (duplicate) {
        throw new AppError(409, 'ITEM_CODE_EXISTS', 'Item code already exists in this hotel');
      }
    }

    if (input.categoryId && BigInt(input.categoryId) !== existing.categoryId) {
      const category = await this.repository.findCategoryById(
        scope.hotelId,
        BigInt(input.categoryId),
      );
      if (!category || !category.isActive) {
        throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found or inactive');
      }
    }

    // Direct update of currentStock is forbidden! We deliberately exclude currentStock.
    const updated = await this.repository.updateItem(scope.hotelId, id, {
      ...(input.code ? { code: input.code } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.categoryId ? { categoryId: BigInt(input.categoryId) } : {}),
      ...(input.unit ? { unit: input.unit } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.minStockLevel !== undefined
        ? { minStockLevel: new Prisma.Decimal(input.minStockLevel) }
        : {}),
    });
    return itemView(updated);
  }

  async deactivateItem(scope: InventoryScope, id: bigint) {
    const existing = await this.repository.findItemById(scope.hotelId, id);
    if (!existing) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }
    const updated = await this.repository.updateItem(scope.hotelId, id, {
      isActive: false,
    });
    return itemView(updated);
  }

  // ==================== RECEIPTS (NHẬP KHO) ====================
  async createReceipt(scope: InventoryScope, input: CreateReceiptInput) {
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      // Validate supplier if provided
      if (input.supplierId) {
        const supplier = await repo.findSupplierById(scope.hotelId, BigInt(input.supplierId));
        if (!supplier) {
          throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
        }
        if (!supplier.isActive) {
          throw new AppError(409, 'SUPPLIER_INACTIVE', 'Supplier is inactive');
        }
      }

      // Generate or validate receiptNumber
      const receiptNumber =
        input.receiptNumber?.trim() ||
        `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const existingReceipt = await repo.findReceiptByNumber(scope.hotelId, receiptNumber);
      if (existingReceipt) {
        throw new AppError(
          409,
          'RECEIPT_NUMBER_EXISTS',
          `Receipt number ${receiptNumber} already exists in this hotel`,
        );
      }

      // Collect item IDs and lock items FOR UPDATE
      const itemIds = Array.from(new Set(input.items.map((i) => BigInt(i.itemId))));
      const lockedItems = await repo.lockItemsForUpdate(scope.hotelId, itemIds);
      const itemMap = new Map(lockedItems.map((item) => [item.id, item]));

      // Verify all items exist and are active
      for (const line of input.items) {
        const item = itemMap.get(BigInt(line.itemId));
        if (!item) {
          throw new AppError(404, 'ITEM_NOT_FOUND', `Item with ID ${line.itemId} not found`);
        }
        if (!item.isActive) {
          throw new AppError(
            409,
            'ITEM_INACTIVE',
            `Item ${item.name} (${item.code}) is inactive and cannot receive stock`,
          );
        }
      }

      // Calculate totals
      let receiptTotalAmount = new Prisma.Decimal('0.00');
      const preparedLines = input.items.map((line) => {
        const qty = new Prisma.Decimal(line.quantity);
        const price = new Prisma.Decimal(line.unitPrice ?? '0.00');
        const lineTotal = qty.mul(price);
        receiptTotalAmount = receiptTotalAmount.add(lineTotal);
        return {
          itemId: BigInt(line.itemId),
          quantity: qty,
          unitPrice: price,
          lineTotal,
          notes: line.notes ?? null,
        };
      });

      // Create Receipt and line items
      const receiptDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
      const receipt = await repo.createReceipt(
        {
          hotelId: scope.hotelId,
          supplierId: input.supplierId ? BigInt(input.supplierId) : null,
          receiptNumber,
          receiptDate,
          totalAmount: receiptTotalAmount,
          notes: input.notes ?? null,
          createdBy: scope.actorId,
        },
        preparedLines,
      );

      // Increase stock and record movements
      for (const line of preparedLines) {
        const item = itemMap.get(line.itemId)!;
        const prevStock = item.currentStock;
        const newStock = prevStock.add(line.quantity);

        await repo.updateItem(scope.hotelId, line.itemId, {
          currentStock: newStock,
        });

        await repo.createMovement({
          hotelId: scope.hotelId,
          itemId: line.itemId,
          type: 'RECEIPT',
          quantity: line.quantity,
          previousStock: prevStock,
          currentStock: newStock,
          referenceType: 'STOCK_RECEIPT',
          referenceId: receipt.id,
          referenceNumber: receipt.receiptNumber,
          notes: line.notes || `Stock Receipt ${receipt.receiptNumber}`,
          createdBy: scope.actorId,
        });
      }

      return receiptView(receipt);
    });
  }

  async getReceipts(scope: InventoryScope, query: ReceiptQuery) {
    const { items, total } = await this.repository.listReceipts(scope.hotelId, query);
    return pageResult(items.map(receiptView), total, query);
  }

  async getReceiptById(scope: InventoryScope, id: bigint) {
    const receipt = await this.repository.findReceiptById(scope.hotelId, id);
    if (!receipt) {
      throw new AppError(404, 'RECEIPT_NOT_FOUND', 'Stock receipt not found');
    }
    return receiptView(receipt);
  }

  // ==================== ISSUES (XUẤT KHO) ====================
  async createIssue(scope: InventoryScope, input: CreateIssueInput) {
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const issueNumber =
        input.issueNumber?.trim() ||
        `ISS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const existingIssue = await repo.findIssueByNumber(scope.hotelId, issueNumber);
      if (existingIssue) {
        throw new AppError(
          409,
          'ISSUE_NUMBER_EXISTS',
          `Issue number ${issueNumber} already exists in this hotel`,
        );
      }

      // Collect item IDs and lock items FOR UPDATE (concurrency control)
      const itemIds = Array.from(new Set(input.items.map((i) => BigInt(i.itemId))));
      const lockedItems = await repo.lockItemsForUpdate(scope.hotelId, itemIds);
      const itemMap = new Map(lockedItems.map((item) => [item.id, item]));

      // Verify all items exist and are active
      for (const line of input.items) {
        const item = itemMap.get(BigInt(line.itemId));
        if (!item) {
          throw new AppError(404, 'ITEM_NOT_FOUND', `Item with ID ${line.itemId} not found`);
        }
        if (!item.isActive) {
          throw new AppError(
            409,
            'ITEM_INACTIVE',
            `Item ${item.name} (${item.code}) is inactive and cannot be issued`,
          );
        }
      }

      // Aggregate requested quantities per itemId to handle duplicate lines in the same request
      const requestedQuantities = new Map<bigint, Prisma.Decimal>();
      for (const line of input.items) {
        const id = BigInt(line.itemId);
        const qty = new Prisma.Decimal(line.quantity);
        const current = requestedQuantities.get(id) ?? new Prisma.Decimal('0.00');
        requestedQuantities.set(id, current.add(qty));
      }

      // Check sufficient stock for EVERY item - fail fast if any item is insufficient!
      for (const [id, reqQty] of requestedQuantities.entries()) {
        const item = itemMap.get(id)!;
        if (item.currentStock.lessThan(reqQty)) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for item "${item.name}" (${item.code}). Available: ${item.currentStock.toString()}, Requested: ${reqQty.toString()}`,
          );
        }
      }

      // Prepare line items
      const preparedLines = input.items.map((line) => ({
        itemId: BigInt(line.itemId),
        quantity: new Prisma.Decimal(line.quantity),
        notes: line.notes ?? null,
      }));

      // Create issue
      const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
      const issue = await repo.createIssue(
        {
          hotelId: scope.hotelId,
          issueNumber,
          issueDate,
          department: input.department,
          purpose: input.purpose ?? null,
          notes: input.notes ?? null,
          createdBy: scope.actorId,
        },
        preparedLines,
      );

      // Decrease stock and create movements for aggregated items
      for (const [id, reqQty] of requestedQuantities.entries()) {
        const item = itemMap.get(id)!;
        const prevStock = item.currentStock;
        const newStock = prevStock.sub(reqQty);

        if (newStock.isNegative()) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Stock cannot become negative for item "${item.name}" (${item.code})`,
          );
        }

        await repo.updateItem(scope.hotelId, id, {
          currentStock: newStock,
        });

        await repo.createMovement({
          hotelId: scope.hotelId,
          itemId: id,
          type: 'ISSUE',
          quantity: reqQty.negated(),
          previousStock: prevStock,
          currentStock: newStock,
          referenceType: 'STOCK_ISSUE',
          referenceId: issue.id,
          referenceNumber: issue.issueNumber,
          notes: `Issued to ${input.department}${input.purpose ? ` (${input.purpose})` : ''}`,
          createdBy: scope.actorId,
        });
      }

      return issueView(issue);
    });
  }

  async getIssues(scope: InventoryScope, query: IssueQuery) {
    const { items, total } = await this.repository.listIssues(scope.hotelId, query);
    return pageResult(items.map(issueView), total, query);
  }

  async getIssueById(scope: InventoryScope, id: bigint) {
    const issue = await this.repository.findIssueById(scope.hotelId, id);
    if (!issue) {
      throw new AppError(404, 'ISSUE_NOT_FOUND', 'Stock issue not found');
    }
    return issueView(issue);
  }

  // ==================== ADJUSTMENTS (KIỂM KÊ / ĐIỀU CHỈNH) ====================
  async createAdjustment(scope: InventoryScope, input: CreateAdjustmentInput) {
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const adjustmentNumber =
        input.adjustmentNumber?.trim() ||
        `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const existing = await repo.findAdjustmentByNumber(scope.hotelId, adjustmentNumber);
      if (existing) {
        throw new AppError(
          409,
          'ADJUSTMENT_NUMBER_EXISTS',
          `Adjustment number ${adjustmentNumber} already exists in this hotel`,
        );
      }

      const itemId = BigInt(input.itemId);
      const lockedItems = await repo.lockItemsForUpdate(scope.hotelId, [itemId]);
      const item = lockedItems[0];
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', `Item with ID ${input.itemId} not found`);
      }
      if (!item.isActive) {
        throw new AppError(
          409,
          'ITEM_INACTIVE',
          `Item ${item.name} (${item.code}) is inactive and cannot be adjusted`,
        );
      }

      const systemQuantity = item.currentStock;
      const actualQuantity = new Prisma.Decimal(input.actualQuantity);
      const difference = actualQuantity.sub(systemQuantity);

      // Create adjustment record
      const adjustment = await repo.createAdjustment({
        hotelId: scope.hotelId,
        adjustmentNumber,
        itemId,
        systemQuantity,
        actualQuantity,
        difference,
        reason: input.reason,
        createdBy: scope.actorId,
      });

      // Update current stock to actual physical count
      await repo.updateItem(scope.hotelId, itemId, {
        currentStock: actualQuantity,
      });

      // Record movement
      await repo.createMovement({
        hotelId: scope.hotelId,
        itemId,
        type: 'ADJUSTMENT',
        quantity: difference,
        previousStock: systemQuantity,
        currentStock: actualQuantity,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        notes: `Adjustment: ${input.reason}`,
        createdBy: scope.actorId,
      });

      return adjustmentView(adjustment);
    });
  }

  // ==================== MOVEMENTS ====================
  async getMovements(scope: InventoryScope, query: MovementQuery) {
    const { items, total } = await this.repository.listMovements(scope.hotelId, query);
    return pageResult(items.map(movementView), total, query);
  }

  // ==================== SUMMARY & LOW STOCK ====================
  async getSummary(scope: InventoryScope) {
    return this.repository.getInventorySummary(scope.hotelId);
  }

  async getLowStock(scope: InventoryScope, query: LowStockQuery) {
    const { items, total } = await this.repository.listLowStockItems(scope.hotelId, query);
    return pageResult(items.map(itemView), total, query);
  }
}
