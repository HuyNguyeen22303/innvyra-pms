import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  CategoryQuery,
  SupplierQuery,
  ItemQuery,
  ReceiptQuery,
  IssueQuery,
  MovementQuery,
  LowStockQuery,
  ItemWithCategory,
  ReceiptWithDetails,
  IssueWithDetails,
  AdjustmentWithDetails,
  MovementWithDetails,
  InventorySummary,
  InventoryOperations,
} from './inventory.types.js';

export class PrismaInventoryRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}

  private get db() {
    return this.tx ?? this.prisma;
  }

  async withHotelLock<T>(
    hotelId: bigint,
    action: (repository: InventoryOperations) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const hotels = await tx.$queryRaw<{ id: bigint }[]>`
              SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE
            `;
            if (!hotels.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
            return action(new PrismaInventoryRepository(this.prisma, tx));
          },
          { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && attempt < 2) {
            await delay(25 * (attempt + 1));
            continue;
          }
          if (['P2002', 'P2003', 'P2024', 'P2025', 'P2028', 'P2034'].includes(error.code)) {
            throw new AppError(
              409,
              'INVENTORY_CONFLICT',
              'Inventory operation conflict; please retry',
            );
          }
        }
        throw error;
      }
    }
  }

  // --- Category operations ---
  async findCategoryById(hotelId: bigint, id: bigint) {
    return this.db.inventoryCategory.findFirst({
      where: { hotelId, id },
    });
  }

  async findCategoryByCode(hotelId: bigint, code: string, excludeId?: bigint) {
    return this.db.inventoryCategory.findFirst({
      where: {
        hotelId,
        code,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async listCategories(hotelId: bigint, query: CategoryQuery) {
    const where: Prisma.InventoryCategoryWhereInput = {
      hotelId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.inventoryCategory.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.inventoryCategory.count({ where }),
    ]);
    return { items, total };
  }

  async createCategory(data: Prisma.InventoryCategoryUncheckedCreateInput) {
    return this.db.inventoryCategory.create({ data });
  }

  async updateCategory(
    hotelId: bigint,
    id: bigint,
    data: Prisma.InventoryCategoryUncheckedUpdateInput,
  ) {
    return this.db.inventoryCategory.update({
      where: { hotelId_id: { hotelId, id } },
      data,
    });
  }

  async countItemsUsingCategory(hotelId: bigint, categoryId: bigint) {
    return this.db.inventoryItem.count({
      where: { hotelId, categoryId },
    });
  }

  // --- Supplier operations ---
  async findSupplierById(hotelId: bigint, id: bigint) {
    return this.db.supplier.findFirst({
      where: { hotelId, id },
    });
  }

  async findSupplierByCode(hotelId: bigint, code: string, excludeId?: bigint) {
    return this.db.supplier.findFirst({
      where: {
        hotelId,
        code,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async listSuppliers(hotelId: bigint, query: SupplierQuery) {
    const where: Prisma.SupplierWhereInput = {
      hotelId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
              { contactPerson: { contains: query.search } },
              { phone: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.supplier.count({ where }),
    ]);
    return { items, total };
  }

  async createSupplier(data: Prisma.SupplierUncheckedCreateInput) {
    return this.db.supplier.create({ data });
  }

  async updateSupplier(
    hotelId: bigint,
    id: bigint,
    data: Prisma.SupplierUncheckedUpdateInput,
  ) {
    return this.db.supplier.update({
      where: { hotelId_id: { hotelId, id } },
      data,
    });
  }

  async countReceiptsUsingSupplier(hotelId: bigint, supplierId: bigint) {
    return this.db.stockReceipt.count({
      where: { hotelId, supplierId },
    });
  }

  // --- Item operations ---
  async findItemById(hotelId: bigint, id: bigint): Promise<ItemWithCategory | null> {
    return this.db.inventoryItem.findFirst({
      where: { hotelId, id },
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
  }

  async findItemByCode(hotelId: bigint, code: string, excludeId?: bigint) {
    return this.db.inventoryItem.findFirst({
      where: {
        hotelId,
        code,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async lockItemsForUpdate(hotelId: bigint, itemIds: bigint[]): Promise<ItemWithCategory[]> {
    if (itemIds.length === 0) return [];
    // Ensure sorted IDs to prevent deadlocks when locking multiple rows
    const sortedIds = [...itemIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    await this.db.$queryRaw`
      SELECT id FROM inventory_items
      WHERE hotel_id = ${hotelId} AND id IN (${Prisma.join(sortedIds)})
      FOR UPDATE
    `;
    const items = await this.db.inventoryItem.findMany({
      where: { hotelId, id: { in: sortedIds } },
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
    return items;
  }

  async listItems(hotelId: bigint, query: ItemQuery) {
    const where: Prisma.InventoryItemWhereInput = {
      hotelId,
      ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          }
        : {}),
    };

    if (query.stockStatus === 'OUT_OF_STOCK') {
      where.currentStock = { lte: 0 };
    } else if (query.stockStatus === 'IN_STOCK') {
      where.currentStock = { gt: 0 };
    }

    const items = await this.db.inventoryItem.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    // Handle LOW_STOCK filtering in application memory since it compares two columns (currentStock <= minStockLevel)
    let filteredItems = items;
    if (query.stockStatus === 'LOW_STOCK') {
      filteredItems = items.filter(
        (item) => Number(item.currentStock) <= Number(item.minStockLevel),
      );
    }

    const total = filteredItems.length;
    const paginatedItems = filteredItems.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );

    return { items: paginatedItems, total };
  }

  async createItem(data: Prisma.InventoryItemUncheckedCreateInput): Promise<ItemWithCategory> {
    return this.db.inventoryItem.create({
      data,
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
  }

  async updateItem(
    hotelId: bigint,
    id: bigint,
    data: Prisma.InventoryItemUncheckedUpdateInput,
  ): Promise<ItemWithCategory> {
    return this.db.inventoryItem.update({
      where: { hotelId_id: { hotelId, id } },
      data,
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
  }

  async countMovementsUsingItem(hotelId: bigint, itemId: bigint) {
    return this.db.inventoryMovement.count({
      where: { hotelId, itemId },
    });
  }

  // --- Receipt operations ---
  async createReceipt(
    receiptData: Prisma.StockReceiptUncheckedCreateInput,
    itemsData: Omit<Prisma.StockReceiptItemUncheckedCreateInput, 'receiptId' | 'hotelId'>[],
  ): Promise<ReceiptWithDetails> {
    const receipt = await this.db.stockReceipt.create({
      data: receiptData,
    });
    await this.db.stockReceiptItem.createMany({
      data: itemsData.map((item) => ({
        hotelId: receiptData.hotelId,
        receiptId: receipt.id,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? new Prisma.Decimal('0.00'),
        lineTotal: item.lineTotal ?? new Prisma.Decimal('0.00'),
        notes: item.notes ?? null,
      })),
    });
    const result = await this.findReceiptById(receipt.hotelId, receipt.id);
    if (!result) {
      throw new AppError(500, 'RECEIPT_CREATION_FAILED', 'Failed to retrieve created receipt');
    }
    return result;
  }

  async findReceiptById(hotelId: bigint, id: bigint): Promise<ReceiptWithDetails | null> {
    return this.db.stockReceipt.findFirst({
      where: { hotelId, id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        creator: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async findReceiptByNumber(hotelId: bigint, receiptNumber: string) {
    return this.db.stockReceipt.findFirst({
      where: { hotelId, receiptNumber },
    });
  }

  async listReceipts(hotelId: bigint, query: ReceiptQuery) {
    const where: Prisma.StockReceiptWhereInput = {
      hotelId,
      ...(query.supplierId ? { supplierId: BigInt(query.supplierId) } : {}),
      ...(query.startDate || query.endDate
        ? {
            receiptDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.stockReceipt.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, code: true, name: true, unit: true } },
            },
          },
          creator: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.stockReceipt.count({ where }),
    ]);
    return { items, total };
  }

  // --- Issue operations ---
  async createIssue(
    issueData: Prisma.StockIssueUncheckedCreateInput,
    itemsData: Omit<Prisma.StockIssueItemUncheckedCreateInput, 'issueId' | 'hotelId'>[],
  ): Promise<IssueWithDetails> {
    const issue = await this.db.stockIssue.create({
      data: issueData,
    });
    await this.db.stockIssueItem.createMany({
      data: itemsData.map((item) => ({
        hotelId: issueData.hotelId,
        issueId: issue.id,
        itemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes ?? null,
      })),
    });
    const result = await this.findIssueById(issue.hotelId, issue.id);
    if (!result) {
      throw new AppError(500, 'ISSUE_CREATION_FAILED', 'Failed to retrieve created issue');
    }
    return result;
  }

  async findIssueById(hotelId: bigint, id: bigint): Promise<IssueWithDetails | null> {
    return this.db.stockIssue.findFirst({
      where: { hotelId, id },
      include: {
        items: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        creator: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async findIssueByNumber(hotelId: bigint, issueNumber: string) {
    return this.db.stockIssue.findFirst({
      where: { hotelId, issueNumber },
    });
  }

  async listIssues(hotelId: bigint, query: IssueQuery) {
    const where: Prisma.StockIssueWhereInput = {
      hotelId,
      ...(query.department ? { department: { contains: query.department } } : {}),
      ...(query.startDate || query.endDate
        ? {
            issueDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.stockIssue.findMany({
        where,
        include: {
          items: {
            include: {
              item: { select: { id: true, code: true, name: true, unit: true } },
            },
          },
          creator: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.stockIssue.count({ where }),
    ]);
    return { items, total };
  }

  // --- Adjustment operations ---
  async createAdjustment(
    data: Prisma.StockAdjustmentUncheckedCreateInput,
  ): Promise<AdjustmentWithDetails> {
    return this.db.stockAdjustment.create({
      data,
      include: {
        item: { select: { id: true, code: true, name: true, unit: true } },
        creator: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async findAdjustmentByNumber(hotelId: bigint, adjustmentNumber: string) {
    return this.db.stockAdjustment.findFirst({
      where: { hotelId, adjustmentNumber },
    });
  }

  // --- Movement operations ---
  async createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput,
  ): Promise<MovementWithDetails> {
    return this.db.inventoryMovement.create({
      data,
      include: {
        item: { select: { id: true, code: true, name: true, unit: true } },
        creator: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async listMovements(hotelId: bigint, query: MovementQuery) {
    const where: Prisma.InventoryMovementWhereInput = {
      hotelId,
      ...(query.itemId ? { itemId: BigInt(query.itemId) } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.inventoryMovement.findMany({
        where,
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          creator: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.inventoryMovement.count({ where }),
    ]);
    return { items, total };
  }

  // --- Summary & Low stock ---
  async listLowStockItems(hotelId: bigint, query: LowStockQuery) {
    const items = await this.db.inventoryItem.findMany({
      where: {
        hotelId,
        isActive: true,
        ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
      },
      include: {
        category: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const lowStock = items.filter(
      (item) => Number(item.currentStock) <= Number(item.minStockLevel),
    );
    const total = lowStock.length;
    const paginatedItems = lowStock.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );
    return { items: paginatedItems, total };
  }

  async getInventorySummary(hotelId: bigint): Promise<InventorySummary> {
    const [items, categories, receiptItems] = await Promise.all([
      this.db.inventoryItem.findMany({
        where: { hotelId, isActive: true },
        include: { category: true },
      }),
      this.db.inventoryCategory.findMany({
        where: { hotelId, isActive: true },
      }),
      // Latest receipt price per item for inventory value estimation
      this.db.stockReceiptItem.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Map latest unitPrice for items
    const latestPriceMap = new Map<bigint, number>();
    for (const ri of receiptItems) {
      if (!latestPriceMap.has(ri.itemId)) {
        latestPriceMap.set(ri.itemId, Number(ri.unitPrice));
      }
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let estimatedTotalValue = 0;

    const categoryStats = new Map<bigint, { total: number; low: number }>();
    for (const cat of categories) {
      categoryStats.set(cat.id, { total: 0, low: 0 });
    }

    for (const item of items) {
      const stock = Number(item.currentStock);
      const minStock = Number(item.minStockLevel);
      const isLow = stock <= minStock;
      const isOut = stock <= 0;

      if (isLow) lowStockCount++;
      if (isOut) outOfStockCount++;

      const price = latestPriceMap.get(item.id) ?? 0;
      estimatedTotalValue += stock * price;

      const stat = categoryStats.get(item.categoryId);
      if (stat) {
        stat.total++;
        if (isLow) stat.low++;
      }
    }

    return {
      totalActiveItems: items.length,
      lowStockItemsCount: lowStockCount,
      outOfStockItemsCount: outOfStockCount,
      totalCategories: categories.length,
      categories: categories.map((cat) => ({
        id: cat.id.toString(),
        code: cat.code,
        name: cat.name,
        totalItems: categoryStats.get(cat.id)?.total ?? 0,
        lowStockItems: categoryStats.get(cat.id)?.low ?? 0,
      })),
      totalInventoryEstimatedValue: estimatedTotalValue.toFixed(2),
    };
  }
}
