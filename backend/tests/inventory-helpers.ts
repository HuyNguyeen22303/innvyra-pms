import { Prisma } from '../src/generated/prisma/client.js';
import type {
  InventoryCategory,
  Supplier,
  InventoryItem,
  StockReceipt,
  StockReceiptItem,
  StockIssue,
  StockIssueItem,
  StockAdjustment,
  InventoryMovement,
} from '../src/generated/prisma/client.js';
import type {
  InventoryRepository,
  InventoryOperations,
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
} from '../src/modules/inventory/inventory.types.js';

export function memoryInventory() {
  const categories = new Map<bigint, InventoryCategory>();
  const suppliers = new Map<bigint, Supplier>();
  const items = new Map<bigint, InventoryItem>();
  const receipts = new Map<bigint, StockReceipt>();
  const receiptItems = new Map<bigint, StockReceiptItem>();
  const issues = new Map<bigint, StockIssue>();
  const issueItems = new Map<bigint, StockIssueItem>();
  const adjustments = new Map<bigint, StockAdjustment>();
  const movements = new Map<bigint, InventoryMovement>();

  let nextId = 1000n;
  const genId = () => ++nextId;

  const cloneMap = <K, V>(src: Map<K, V>) => {
    const copy = new Map<K, V>();
    src.forEach((val, key) => {
      copy.set(key, { ...val });
    });
    return copy;
  };

  const repository: InventoryRepository = {
    async withHotelLock<T>(
      _hotelId: bigint,
      action: (repo: InventoryOperations) => Promise<T>,
    ): Promise<T> {
      // Snapshot state for atomic rollback on failure
      const snapCategories = cloneMap(categories);
      const snapSuppliers = cloneMap(suppliers);
      const snapItems = cloneMap(items);
      const snapReceipts = cloneMap(receipts);
      const snapReceiptItems = cloneMap(receiptItems);
      const snapIssues = cloneMap(issues);
      const snapIssueItems = cloneMap(issueItems);
      const snapAdjustments = cloneMap(adjustments);
      const snapMovements = cloneMap(movements);

      try {
        return await action(repository);
      } catch (err) {
        categories.clear();
        snapCategories.forEach((v, k) => categories.set(k, v));
        suppliers.clear();
        snapSuppliers.forEach((v, k) => suppliers.set(k, v));
        items.clear();
        snapItems.forEach((v, k) => items.set(k, v));
        receipts.clear();
        snapReceipts.forEach((v, k) => receipts.set(k, v));
        receiptItems.clear();
        snapReceiptItems.forEach((v, k) => receiptItems.set(k, v));
        issues.clear();
        snapIssues.forEach((v, k) => issues.set(k, v));
        issueItems.clear();
        snapIssueItems.forEach((v, k) => issueItems.set(k, v));
        adjustments.clear();
        snapAdjustments.forEach((v, k) => adjustments.set(k, v));
        movements.clear();
        snapMovements.forEach((v, k) => movements.set(k, v));
        throw err;
      }
    },

    // --- Categories ---
    async findCategoryById(hotelId: bigint, id: bigint) {
      const cat = categories.get(id);
      if (!cat || cat.hotelId !== hotelId) return null;
      return { ...cat };
    },

    async findCategoryByCode(hotelId: bigint, code: string, excludeId?: bigint) {
      for (const cat of categories.values()) {
        if (
          cat.hotelId === hotelId &&
          cat.code.toLowerCase() === code.toLowerCase() &&
          (!excludeId || cat.id !== excludeId)
        ) {
          return { ...cat };
        }
      }
      return null;
    },

    async listCategories(hotelId: bigint, query: CategoryQuery) {
      let filtered = [...categories.values()].filter((c) => c.hotelId === hotelId);
      if (query.isActive !== undefined) {
        filtered = filtered.filter((c) => c.isActive === query.isActive);
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s),
        );
      }
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);
      return { items: paginated, total };
    },

    async createCategory(data: Prisma.InventoryCategoryUncheckedCreateInput) {
      const id = data.id !== undefined ? BigInt(data.id) : genId();
      const cat: InventoryCategory = {
        id,
        hotelId: BigInt(data.hotelId),
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      categories.set(id, cat);
      return { ...cat };
    },

    async updateCategory(
      hotelId: bigint,
      id: bigint,
      data: Prisma.InventoryCategoryUncheckedUpdateInput,
    ) {
      const cat = categories.get(id);
      if (!cat || cat.hotelId !== hotelId) throw new Error('Not found');
      const updated: InventoryCategory = {
        ...cat,
        ...(data.code ? { code: String(data.code) } : {}),
        ...(data.name ? { name: String(data.name) } : {}),
        ...(data.description !== undefined ? { description: data.description as string | null } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        updatedAt: new Date(),
      };
      categories.set(id, updated);
      return { ...updated };
    },

    async countItemsUsingCategory(hotelId: bigint, categoryId: bigint) {
      let count = 0;
      for (const item of items.values()) {
        if (item.hotelId === hotelId && item.categoryId === categoryId) {
          count++;
        }
      }
      return count;
    },

    // --- Suppliers ---
    async findSupplierById(hotelId: bigint, id: bigint) {
      const sup = suppliers.get(id);
      if (!sup || sup.hotelId !== hotelId) return null;
      return { ...sup };
    },

    async findSupplierByCode(hotelId: bigint, code: string, excludeId?: bigint) {
      for (const sup of suppliers.values()) {
        if (
          sup.hotelId === hotelId &&
          sup.code.toLowerCase() === code.toLowerCase() &&
          (!excludeId || sup.id !== excludeId)
        ) {
          return { ...sup };
        }
      }
      return null;
    },

    async listSuppliers(hotelId: bigint, query: SupplierQuery) {
      let filtered = [...suppliers.values()].filter((s) => s.hotelId === hotelId);
      if (query.isActive !== undefined) {
        filtered = filtered.filter((s) => s.isActive === query.isActive);
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (sup) =>
            sup.code.toLowerCase().includes(s) ||
            sup.name.toLowerCase().includes(s) ||
            (sup.contactPerson && sup.contactPerson.toLowerCase().includes(s)) ||
            (sup.phone && sup.phone.includes(s)) ||
            (sup.email && sup.email.toLowerCase().includes(s)),
        );
      }
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);
      return { items: paginated, total };
    },

    async createSupplier(data: Prisma.SupplierUncheckedCreateInput) {
      const id = data.id !== undefined ? BigInt(data.id) : genId();
      const sup: Supplier = {
        id,
        hotelId: BigInt(data.hotelId),
        code: data.code,
        name: data.name,
        contactPerson: data.contactPerson ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      suppliers.set(id, sup);
      return { ...sup };
    },

    async updateSupplier(
      hotelId: bigint,
      id: bigint,
      data: Prisma.SupplierUncheckedUpdateInput,
    ) {
      const sup = suppliers.get(id);
      if (!sup || sup.hotelId !== hotelId) throw new Error('Not found');
      const updated: Supplier = {
        ...sup,
        ...(data.code ? { code: String(data.code) } : {}),
        ...(data.name ? { name: String(data.name) } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson as string | null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone as string | null } : {}),
        ...(data.email !== undefined ? { email: data.email as string | null } : {}),
        ...(data.address !== undefined ? { address: data.address as string | null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes as string | null } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        updatedAt: new Date(),
      };
      suppliers.set(id, updated);
      return { ...updated };
    },

    async countReceiptsUsingSupplier(hotelId: bigint, supplierId: bigint) {
      let count = 0;
      for (const rec of receipts.values()) {
        if (rec.hotelId === hotelId && rec.supplierId === supplierId) {
          count++;
        }
      }
      return count;
    },

    // --- Items ---
    async findItemById(hotelId: bigint, id: bigint): Promise<ItemWithCategory | null> {
      const item = items.get(id);
      if (!item || item.hotelId !== hotelId) return null;
      const cat = categories.get(item.categoryId);
      return {
        ...item,
        category: cat
          ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
          : { id: item.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
      };
    },

    async findItemByCode(hotelId: bigint, code: string, excludeId?: bigint) {
      for (const item of items.values()) {
        if (
          item.hotelId === hotelId &&
          item.code.toLowerCase() === code.toLowerCase() &&
          (!excludeId || item.id !== excludeId)
        ) {
          return { ...item };
        }
      }
      return null;
    },

    async lockItemsForUpdate(hotelId: bigint, itemIds: bigint[]): Promise<ItemWithCategory[]> {
      const result: ItemWithCategory[] = [];
      for (const id of itemIds) {
        const item = items.get(id);
        if (item && item.hotelId === hotelId) {
          const cat = categories.get(item.categoryId);
          result.push({
            ...item,
            category: cat
              ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
              : { id: item.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
          });
        }
      }
      return result;
    },

    async listItems(hotelId: bigint, query: ItemQuery) {
      let filtered = [...items.values()].filter((it) => it.hotelId === hotelId);
      if (query.categoryId) {
        filtered = filtered.filter((it) => it.categoryId === BigInt(query.categoryId!));
      }
      if (query.isActive !== undefined) {
        filtered = filtered.filter((it) => it.isActive === query.isActive);
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (it) => it.code.toLowerCase().includes(s) || it.name.toLowerCase().includes(s),
        );
      }
      if (query.stockStatus === 'OUT_OF_STOCK') {
        filtered = filtered.filter((it) => it.currentStock.lte(0));
      } else if (query.stockStatus === 'IN_STOCK') {
        filtered = filtered.filter((it) => it.currentStock.gt(0));
      } else if (query.stockStatus === 'LOW_STOCK') {
        filtered = filtered.filter((it) => it.currentStock.lte(it.minStockLevel));
      }

      filtered.sort((a, b) => a.name.localeCompare(b.name));
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);

      const itemsWithCategory: ItemWithCategory[] = paginated.map((it) => {
        const cat = categories.get(it.categoryId);
        return {
          ...it,
          category: cat
            ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
            : { id: it.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
        };
      });

      return { items: itemsWithCategory, total };
    },

    async createItem(data: Prisma.InventoryItemUncheckedCreateInput): Promise<ItemWithCategory> {
      const id = data.id !== undefined ? BigInt(data.id) : genId();
      const item: InventoryItem = {
        id,
        hotelId: BigInt(data.hotelId),
        categoryId: BigInt(data.categoryId),
        code: data.code,
        name: data.name,
        unit: data.unit,
        description: data.description ?? null,
        currentStock: new Prisma.Decimal(String(data.currentStock ?? 0)),
        minStockLevel: new Prisma.Decimal(String(data.minStockLevel ?? 0)),
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      items.set(id, item);
      const cat = categories.get(item.categoryId);
      return {
        ...item,
        category: cat
          ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
          : { id: item.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
      };
    },

    async updateItem(
      hotelId: bigint,
      id: bigint,
      data: Prisma.InventoryItemUncheckedUpdateInput,
    ): Promise<ItemWithCategory> {
      const item = items.get(id);
      if (!item || item.hotelId !== hotelId) throw new Error('Not found');
      const updated: InventoryItem = {
        ...item,
        ...(data.code ? { code: String(data.code) } : {}),
        ...(data.name ? { name: String(data.name) } : {}),
        ...(data.categoryId ? { categoryId: BigInt(data.categoryId as number | bigint | string) } : {}),
        ...(data.unit ? { unit: String(data.unit) } : {}),
        ...(data.description !== undefined ? { description: data.description as string | null } : {}),
        ...(data.currentStock !== undefined
          ? { currentStock: new Prisma.Decimal(data.currentStock as number | string | Prisma.Decimal) }
          : {}),
        ...(data.minStockLevel !== undefined
          ? { minStockLevel: new Prisma.Decimal(data.minStockLevel as number | string | Prisma.Decimal) }
          : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        updatedAt: new Date(),
      };
      items.set(id, updated);
      const cat = categories.get(updated.categoryId);
      return {
        ...updated,
        category: cat
          ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
          : { id: updated.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
      };
    },

    async countMovementsUsingItem(hotelId: bigint, itemId: bigint) {
      let count = 0;
      for (const mov of movements.values()) {
        if (mov.hotelId === hotelId && mov.itemId === itemId) {
          count++;
        }
      }
      return count;
    },

    // --- Receipts ---
    async createReceipt(
      receiptData: Prisma.StockReceiptUncheckedCreateInput,
      itemsData: Omit<Prisma.StockReceiptItemUncheckedCreateInput, 'receiptId' | 'hotelId'>[],
    ): Promise<ReceiptWithDetails> {
      const id = receiptData.id !== undefined ? BigInt(receiptData.id) : genId();
      const receipt: StockReceipt = {
        id,
        hotelId: BigInt(receiptData.hotelId),
        supplierId: receiptData.supplierId ? BigInt(receiptData.supplierId) : null,
        receiptNumber: receiptData.receiptNumber,
        receiptDate: new Date(receiptData.receiptDate as string | Date),
        totalAmount: new Prisma.Decimal(String(receiptData.totalAmount ?? 0)),
        notes: receiptData.notes ?? null,
        createdBy: BigInt(receiptData.createdBy),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      receipts.set(id, receipt);

      const createdItems: (StockReceiptItem & {
        item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
      })[] = [];

      for (const it of itemsData) {
        const itemId = genId();
        const rItem: StockReceiptItem = {
          id: itemId,
          hotelId: receipt.hotelId,
          receiptId: receipt.id,
          itemId: BigInt(it.itemId),
          quantity: new Prisma.Decimal(String(it.quantity)),
          unitPrice: new Prisma.Decimal(String(it.unitPrice ?? 0)),
          lineTotal: new Prisma.Decimal(String(it.lineTotal ?? 0)),
          notes: it.notes ?? null,
          createdAt: new Date(),
        };
        receiptItems.set(itemId, rItem);
        const itemObj = items.get(rItem.itemId);
        createdItems.push({
          ...rItem,
          item: itemObj
            ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
            : { id: rItem.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
        });
      }

      const sup = receipt.supplierId ? suppliers.get(receipt.supplierId) : null;
      return {
        ...receipt,
        supplier: sup ? { id: sup.id, code: sup.code, name: sup.name } : null,
        items: createdItems,
        creator: { id: receipt.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async findReceiptById(hotelId: bigint, id: bigint): Promise<ReceiptWithDetails | null> {
      const rec = receipts.get(id);
      if (!rec || rec.hotelId !== hotelId) return null;
      const sup = rec.supplierId ? suppliers.get(rec.supplierId) : null;
      const lines = [...receiptItems.values()]
        .filter((ri) => ri.receiptId === id && ri.hotelId === hotelId)
        .map((ri) => {
          const itemObj = items.get(ri.itemId);
          return {
            ...ri,
            item: itemObj
              ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
              : { id: ri.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
          };
        });
      return {
        ...rec,
        supplier: sup ? { id: sup.id, code: sup.code, name: sup.name } : null,
        items: lines,
        creator: { id: rec.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async findReceiptByNumber(hotelId: bigint, receiptNumber: string) {
      for (const rec of receipts.values()) {
        if (rec.hotelId === hotelId && rec.receiptNumber === receiptNumber) {
          return { ...rec };
        }
      }
      return null;
    },

    async listReceipts(hotelId: bigint, query: ReceiptQuery) {
      let filtered = [...receipts.values()].filter((r) => r.hotelId === hotelId);
      if (query.supplierId) {
        filtered = filtered.filter((r) => r.supplierId === BigInt(query.supplierId!));
      }
      if (query.startDate) {
        filtered = filtered.filter((r) => r.receiptDate >= new Date(query.startDate!));
      }
      if (query.endDate) {
        filtered = filtered.filter((r) => r.receiptDate <= new Date(query.endDate!));
      }
      filtered.sort((a, b) => b.receiptDate.getTime() - a.receiptDate.getTime());
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);

      const itemsWithDetails: ReceiptWithDetails[] = paginated.map((rec) => {
        const sup = rec.supplierId ? suppliers.get(rec.supplierId) : null;
        const lines = [...receiptItems.values()]
          .filter((ri) => ri.receiptId === rec.id && ri.hotelId === hotelId)
          .map((ri) => {
            const itemObj = items.get(ri.itemId);
            return {
              ...ri,
              item: itemObj
                ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
                : { id: ri.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
            };
          });
        return {
          ...rec,
          supplier: sup ? { id: sup.id, code: sup.code, name: sup.name } : null,
          items: lines,
          creator: { id: rec.createdBy, fullName: 'Staff User', username: 'staff' },
        };
      });

      return { items: itemsWithDetails, total };
    },

    // --- Issues ---
    async createIssue(
      issueData: Prisma.StockIssueUncheckedCreateInput,
      itemsData: Omit<Prisma.StockIssueItemUncheckedCreateInput, 'issueId' | 'hotelId'>[],
    ): Promise<IssueWithDetails> {
      const id = issueData.id !== undefined ? BigInt(issueData.id) : genId();
      const issue: StockIssue = {
        id,
        hotelId: BigInt(issueData.hotelId),
        issueNumber: issueData.issueNumber,
        issueDate: new Date(issueData.issueDate as string | Date),
        department: issueData.department,
        purpose: issueData.purpose ?? null,
        notes: issueData.notes ?? null,
        createdBy: BigInt(issueData.createdBy),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      issues.set(id, issue);

      const createdItems: (StockIssueItem & {
        item: Pick<InventoryItem, 'id' | 'code' | 'name' | 'unit'>;
      })[] = [];

      for (const it of itemsData) {
        const itemId = genId();
        const sItem: StockIssueItem = {
          id: itemId,
          hotelId: issue.hotelId,
          issueId: issue.id,
          itemId: BigInt(it.itemId),
          quantity: new Prisma.Decimal(String(it.quantity)),
          notes: it.notes ?? null,
          createdAt: new Date(),
        };
        issueItems.set(itemId, sItem);
        const itemObj = items.get(sItem.itemId);
        createdItems.push({
          ...sItem,
          item: itemObj
            ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
            : { id: sItem.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
        });
      }

      return {
        ...issue,
        items: createdItems,
        creator: { id: issue.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async findIssueById(hotelId: bigint, id: bigint): Promise<IssueWithDetails | null> {
      const iss = issues.get(id);
      if (!iss || iss.hotelId !== hotelId) return null;
      const lines = [...issueItems.values()]
        .filter((ii) => ii.issueId === id && ii.hotelId === hotelId)
        .map((ii) => {
          const itemObj = items.get(ii.itemId);
          return {
            ...ii,
            item: itemObj
              ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
              : { id: ii.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
          };
        });
      return {
        ...iss,
        items: lines,
        creator: { id: iss.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async findIssueByNumber(hotelId: bigint, issueNumber: string) {
      for (const iss of issues.values()) {
        if (iss.hotelId === hotelId && iss.issueNumber === issueNumber) {
          return { ...iss };
        }
      }
      return null;
    },

    async listIssues(hotelId: bigint, query: IssueQuery) {
      let filtered = [...issues.values()].filter((i) => i.hotelId === hotelId);
      if (query.department) {
        filtered = filtered.filter((i) =>
          i.department.toLowerCase().includes(query.department!.toLowerCase()),
        );
      }
      if (query.startDate) {
        filtered = filtered.filter((i) => i.issueDate >= new Date(query.startDate!));
      }
      if (query.endDate) {
        filtered = filtered.filter((i) => i.issueDate <= new Date(query.endDate!));
      }
      filtered.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);

      const itemsWithDetails: IssueWithDetails[] = paginated.map((iss) => {
        const lines = [...issueItems.values()]
          .filter((ii) => ii.issueId === iss.id && ii.hotelId === hotelId)
          .map((ii) => {
            const itemObj = items.get(ii.itemId);
            return {
              ...ii,
              item: itemObj
                ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
                : { id: ii.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
            };
          });
        return {
          ...iss,
          items: lines,
          creator: { id: iss.createdBy, fullName: 'Staff User', username: 'staff' },
        };
      });

      return { items: itemsWithDetails, total };
    },

    // --- Adjustments ---
    async createAdjustment(
      data: Prisma.StockAdjustmentUncheckedCreateInput,
    ): Promise<AdjustmentWithDetails> {
      const id = data.id !== undefined ? BigInt(data.id) : genId();
      const adj: StockAdjustment = {
        id,
        hotelId: BigInt(data.hotelId),
        adjustmentNumber: data.adjustmentNumber,
        itemId: BigInt(data.itemId),
        systemQuantity: new Prisma.Decimal(String(data.systemQuantity)),
        actualQuantity: new Prisma.Decimal(String(data.actualQuantity)),
        difference: new Prisma.Decimal(String(data.difference)),
        reason: data.reason,
        createdBy: BigInt(data.createdBy),
        createdAt: new Date(),
      };
      adjustments.set(id, adj);
      const itemObj = items.get(adj.itemId);
      return {
        ...adj,
        item: itemObj
          ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
          : { id: adj.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
        creator: { id: adj.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async findAdjustmentByNumber(hotelId: bigint, adjustmentNumber: string) {
      for (const adj of adjustments.values()) {
        if (adj.hotelId === hotelId && adj.adjustmentNumber === adjustmentNumber) {
          return { ...adj };
        }
      }
      return null;
    },

    // --- Movements ---
    async createMovement(
      data: Prisma.InventoryMovementUncheckedCreateInput,
    ): Promise<MovementWithDetails> {
      const id = data.id !== undefined ? BigInt(data.id) : genId();
      const mov: InventoryMovement = {
        id,
        hotelId: BigInt(data.hotelId),
        itemId: BigInt(data.itemId),
        type: data.type,
        quantity: new Prisma.Decimal(String(data.quantity)),
        previousStock: new Prisma.Decimal(String(data.previousStock)),
        currentStock: new Prisma.Decimal(String(data.currentStock)),
        referenceType: data.referenceType,
        referenceId: data.referenceId ? BigInt(data.referenceId) : null,
        referenceNumber: data.referenceNumber ?? null,
        notes: data.notes ?? null,
        createdBy: BigInt(data.createdBy),
        createdAt: new Date(),
      };
      movements.set(id, mov);
      const itemObj = items.get(mov.itemId);
      return {
        ...mov,
        item: itemObj
          ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
          : { id: mov.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
        creator: { id: mov.createdBy, fullName: 'Staff User', username: 'staff' },
      };
    },

    async listMovements(hotelId: bigint, query: MovementQuery) {
      let filtered = [...movements.values()].filter((m) => m.hotelId === hotelId);
      if (query.itemId) {
        filtered = filtered.filter((m) => m.itemId === BigInt(query.itemId!));
      }
      if (query.type) {
        filtered = filtered.filter((m) => m.type === query.type);
      }
      if (query.startDate) {
        filtered = filtered.filter((m) => m.createdAt >= new Date(query.startDate!));
      }
      if (query.endDate) {
        filtered = filtered.filter((m) => m.createdAt <= new Date(query.endDate!));
      }
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);

      const itemsWithDetails: MovementWithDetails[] = paginated.map((mov) => {
        const itemObj = items.get(mov.itemId);
        return {
          ...mov,
          item: itemObj
            ? { id: itemObj.id, code: itemObj.code, name: itemObj.name, unit: itemObj.unit }
            : { id: mov.itemId, code: 'UNKNOWN', name: 'Unknown', unit: 'unit' },
          creator: { id: mov.createdBy, fullName: 'Staff User', username: 'staff' },
        };
      });

      return { items: itemsWithDetails, total };
    },

    // --- Summary & Low stock ---
    async listLowStockItems(hotelId: bigint, query: LowStockQuery) {
      let filtered = [...items.values()].filter(
        (it) => it.hotelId === hotelId && it.isActive && it.currentStock.lte(it.minStockLevel),
      );
      if (query.categoryId) {
        filtered = filtered.filter((it) => it.categoryId === BigInt(query.categoryId!));
      }
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      const total = filtered.length;
      const paginated = filtered.slice((query.page - 1) * query.limit, query.page * query.limit);

      const itemsWithCategory: ItemWithCategory[] = paginated.map((it) => {
        const cat = categories.get(it.categoryId);
        return {
          ...it,
          category: cat
            ? { id: cat.id, code: cat.code, name: cat.name, isActive: cat.isActive }
            : { id: it.categoryId, code: 'UNKNOWN', name: 'Unknown', isActive: true },
        };
      });

      return { items: itemsWithCategory, total };
    },

    async getInventorySummary(hotelId: bigint): Promise<InventorySummary> {
      const activeItems = [...items.values()].filter((it) => it.hotelId === hotelId && it.isActive);
      const activeCategories = [...categories.values()].filter(
        (c) => c.hotelId === hotelId && c.isActive,
      );

      // Latest price map
      const latestPrices = new Map<bigint, number>();
      for (const ri of receiptItems.values()) {
        if (ri.hotelId === hotelId && !latestPrices.has(ri.itemId)) {
          latestPrices.set(ri.itemId, Number(ri.unitPrice));
        }
      }

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalValue = 0;

      const catMap = new Map<bigint, { total: number; low: number }>();
      for (const cat of activeCategories) {
        catMap.set(cat.id, { total: 0, low: 0 });
      }

      for (const it of activeItems) {
        const stock = Number(it.currentStock);
        const min = Number(it.minStockLevel);
        const isLow = stock <= min;
        const isOut = stock <= 0;

        if (isLow) lowStockCount++;
        if (isOut) outOfStockCount++;

        const price = latestPrices.get(it.id) ?? 0;
        totalValue += stock * price;

        const stat = catMap.get(it.categoryId);
        if (stat) {
          stat.total++;
          if (isLow) stat.low++;
        }
      }

      return {
        totalActiveItems: activeItems.length,
        lowStockItemsCount: lowStockCount,
        outOfStockItemsCount: outOfStockCount,
        totalCategories: activeCategories.length,
        categories: activeCategories.map((c) => ({
          id: c.id.toString(),
          code: c.code,
          name: c.name,
          totalItems: catMap.get(c.id)?.total ?? 0,
          lowStockItems: catMap.get(c.id)?.low ?? 0,
        })),
        totalInventoryEstimatedValue: totalValue.toFixed(2),
      };
    },
  };

  return {
    repository,
    stores: {
      categories,
      suppliers,
      items,
      receipts,
      receiptItems,
      issues,
      issueItems,
      adjustments,
      movements,
    },
  };
}
