import { describe, expect, it } from 'vitest';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { memoryInventory } from './inventory-helpers.js';
import type { InventoryScope } from '../src/modules/inventory/inventory.types.js';

describe('InventoryService Unit Tests', () => {
  const adminScope: InventoryScope = { hotelId: 1n, actorId: 100n, role: 'ADMIN' };
  const otherHotelScope: InventoryScope = { hotelId: 99n, actorId: 999n, role: 'ADMIN' };

  describe('Categories & Suppliers', () => {
    it('creates and updates a category successfully', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const category = await service.createCategory(adminScope, {
        code: 'CAT-LINEN',
        name: 'Bedding and Linens',
        description: 'Sheets, pillows and towels',
      });

      expect(category).toMatchObject({
        code: 'CAT-LINEN',
        name: 'Bedding and Linens',
        isActive: true,
      });

      const updated = await service.updateCategory(adminScope, BigInt(category.id), {
        name: 'Bedding, Linens & Towels',
      });
      expect(updated.name).toBe('Bedding, Linens & Towels');
    });

    it('rejects duplicate category code (409 CATEGORY_CODE_EXISTS)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      await service.createCategory(adminScope, {
        code: 'CAT-AMENITY',
        name: 'Guest Amenities',
      });

      await expect(
        service.createCategory(adminScope, {
          code: 'CAT-AMENITY',
          name: 'Another Amenity Category',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'CATEGORY_CODE_EXISTS' });
    });

    it('creates and updates a supplier successfully', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const supplier = await service.createSupplier(adminScope, {
        code: 'SUP-VINAMILK',
        name: 'Vinamilk Corporation',
        phone: '0901234567',
        email: 'supply@vinamilk.test',
      });

      expect(supplier).toMatchObject({
        code: 'SUP-VINAMILK',
        name: 'Vinamilk Corporation',
        phone: '0901234567',
        email: 'supply@vinamilk.test',
        isActive: true,
      });

      const updated = await service.updateSupplier(adminScope, BigInt(supplier.id), {
        contactPerson: 'Trần Văn B',
      });
      expect(updated.contactPerson).toBe('Trần Văn B');
    });

    it('rejects duplicate supplier code (409 SUPPLIER_CODE_EXISTS)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      await service.createSupplier(adminScope, {
        code: 'SUP-UNILEVER',
        name: 'Unilever VN',
      });

      await expect(
        service.createSupplier(adminScope, {
          code: 'SUP-UNILEVER',
          name: 'Unilever Duplicate',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'SUPPLIER_CODE_EXISTS' });
    });
  });

  describe('Item Management (Chức năng A)', () => {
    it('creates and updates item with zero initial stock', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, {
        code: 'AMENITY',
        name: 'Room Amenities',
      });

      const item = await service.createItem(adminScope, {
        code: 'SHAMPOO-30ML',
        name: 'Mini Shampoo 30ml',
        categoryId: cat.id,
        unit: 'bottle',
        minStockLevel: '50.00',
      });

      expect(item).toMatchObject({
        code: 'SHAMPOO-30ML',
        name: 'Mini Shampoo 30ml',
        unit: 'bottle',
        currentStock: '0.00', // Cannot be set directly! Always 0 initially
        minStockLevel: '50.00',
        isLowStock: true,
        isOutOfStock: true,
        isActive: true,
      });

      const updated = await service.updateItem(adminScope, BigInt(item.id), {
        name: 'Premium Mini Shampoo 30ml',
        minStockLevel: '60.00',
      });
      expect(updated.name).toBe('Premium Mini Shampoo 30ml');
      expect(updated.minStockLevel).toBe('60.00');
      // Stock remains unchanged by updateItem
      expect(updated.currentStock).toBe('0.00');
    });

    it('rejects duplicate item code within the same hotel (409 ITEM_CODE_EXISTS)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, {
        code: 'AMENITY',
        name: 'Room Amenities',
      });

      await service.createItem(adminScope, {
        code: 'SOAP-40G',
        name: 'Bath Soap 40g',
        categoryId: cat.id,
        unit: 'bar',
      });

      await expect(
        service.createItem(adminScope, {
          code: 'SOAP-40G',
          name: 'Another Bath Soap',
          categoryId: cat.id,
          unit: 'bar',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'ITEM_CODE_EXISTS' });
    });

    it('rejects creating item with non-existent or inactive category', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      await expect(
        service.createItem(adminScope, {
          code: 'WATER-500ML',
          name: 'Mineral Water 500ml',
          categoryId: '99999',
          unit: 'bottle',
        }),
      ).rejects.toMatchObject({ status: 404, code: 'CATEGORY_NOT_FOUND' });
    });

    it('deactivates item successfully and filters by active status and stock status', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'FNB', name: 'Food & Beverage' });
      const item = await service.createItem(adminScope, {
        code: 'COFFEE-INSTANT',
        name: 'Instant Coffee Sachet',
        categoryId: cat.id,
        unit: 'sachet',
        minStockLevel: '100.00',
      });

      const deactivated = await service.deactivateItem(adminScope, BigInt(item.id));
      expect(deactivated.isActive).toBe(false);

      // List with active filter
      const activeList = await service.getItems(adminScope, {
        page: 1,
        limit: 10,
        isActive: true,
        stockStatus: 'ALL',
      });
      expect(activeList.items).toHaveLength(0);

      const allList = await service.getItems(adminScope, {
        page: 1,
        limit: 10,
        stockStatus: 'ALL',
      });
      expect(allList.items).toHaveLength(1);
    });

    it('enforces tenant isolation: cannot see or update item of another hotel', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'CLEAN', name: 'Cleaning' });
      const item = await service.createItem(adminScope, {
        code: 'BROOM',
        name: 'Floor Broom',
        categoryId: cat.id,
        unit: 'piece',
      });

      // Tenant with different hotelId tries to access
      await expect(service.getItemById(otherHotelScope, BigInt(item.id))).rejects.toMatchObject({
        status: 404,
        code: 'ITEM_NOT_FOUND',
      });

      await expect(
        service.updateItem(otherHotelScope, BigInt(item.id), { name: 'Hacked Broom' }),
      ).rejects.toMatchObject({ status: 404, code: 'ITEM_NOT_FOUND' });
    });
  });

  describe('Stock Receipts (Chức năng C - Nhập kho)', () => {
    it('creates receipt and accurately increases stock and creates movements', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'DRINK', name: 'Beverages' });
      const sup = await service.createSupplier(adminScope, { code: 'AQUAFINA', name: 'Aquafina VN' });

      const item1 = await service.createItem(adminScope, {
        code: 'AQUA-500',
        name: 'Aquafina Water 500ml',
        categoryId: cat.id,
        unit: 'bottle',
        minStockLevel: '20.00',
      });

      const item2 = await service.createItem(adminScope, {
        code: 'COKE-330',
        name: 'Coca Cola 330ml',
        categoryId: cat.id,
        unit: 'can',
        minStockLevel: '30.00',
      });

      const receipt = await service.createReceipt(adminScope, {
        supplierId: sup.id,
        notes: 'Weekly beverage replenishment',
        items: [
          { itemId: item1.id, quantity: '100.00', unitPrice: '5000.00' },
          { itemId: item2.id, quantity: '50.00', unitPrice: '10000.00' },
        ],
      });

      expect(receipt.receiptNumber).toMatch(/^REC-/);
      expect(receipt.totalAmount).toBe('1000000.00'); // (100*5000) + (50*10000) = 1,000,000
      expect(receipt.items).toHaveLength(2);

      // Verify item current stock increased accurately
      const checkItem1 = await service.getItemById(adminScope, BigInt(item1.id));
      const checkItem2 = await service.getItemById(adminScope, BigInt(item2.id));
      expect(checkItem1.currentStock).toBe('100.00');
      expect(checkItem1.isLowStock).toBe(false);
      expect(checkItem2.currentStock).toBe('50.00');
      expect(checkItem2.isLowStock).toBe(false);

      // Verify movements recorded
      const movements = await service.getMovements(adminScope, { page: 1, limit: 10 });
      expect(movements.items).toHaveLength(2);
      expect(movements.items.every((m) => m.type === 'RECEIPT')).toBe(true);
    });

    it('rejects duplicate receipt number (409 RECEIPT_NUMBER_EXISTS)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'DRINK', name: 'Beverages' });
      const item = await service.createItem(adminScope, {
        code: 'TEA-BOX',
        name: 'Tea Box',
        categoryId: cat.id,
        unit: 'box',
      });

      await service.createReceipt(adminScope, {
        receiptNumber: 'REC-2026-CUSTOM-01',
        items: [{ itemId: item.id, quantity: '10.00', unitPrice: '20000.00' }],
      });

      await expect(
        service.createReceipt(adminScope, {
          receiptNumber: 'REC-2026-CUSTOM-01',
          items: [{ itemId: item.id, quantity: '5.00', unitPrice: '20000.00' }],
        }),
      ).rejects.toMatchObject({ status: 409, code: 'RECEIPT_NUMBER_EXISTS' });
    });
  });

  describe('Stock Issues (Chức năng D - Xuất kho)', () => {
    it('creates issue and decreases stock accurately', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'AMENITY', name: 'Amenities' });
      const item = await service.createItem(adminScope, {
        code: 'TOOTHBRUSH',
        name: 'Toothbrush Set',
        categoryId: cat.id,
        unit: 'piece',
      });

      // Receipt 100 pieces
      await service.createReceipt(adminScope, {
        items: [{ itemId: item.id, quantity: '100.00', unitPrice: '2000.00' }],
      });

      // Issue 30 pieces to Housekeeping
      const issue = await service.createIssue(adminScope, {
        department: 'HOUSEKEEPING',
        purpose: 'Room turnover floor 2',
        items: [{ itemId: item.id, quantity: '30.00' }],
      });

      expect(issue.department).toBe('HOUSEKEEPING');
      expect(issue.items[0]?.quantity).toBe('30.00');

      // Verify stock decreased from 100 to 70
      const checkItem = await service.getItemById(adminScope, BigInt(item.id));
      expect(checkItem.currentStock).toBe('70.00');

      // Verify movement recorded
      const movements = await service.getMovements(adminScope, {
        page: 1,
        limit: 10,
        type: 'ISSUE',
      });
      expect(movements.items).toHaveLength(1);
      expect(movements.items[0]?.quantity).toBe('-30.00');
      expect(movements.items[0]?.currentStock).toBe('70.00');
    });

    it('rejects issue when requested quantity exceeds stock (409 INSUFFICIENT_STOCK)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'AMENITY', name: 'Amenities' });
      const item = await service.createItem(adminScope, {
        code: 'SLIPPERS',
        name: 'Room Slippers',
        categoryId: cat.id,
        unit: 'pair',
      });

      // Stock is currently 0
      await expect(
        service.createIssue(adminScope, {
          department: 'HOUSEKEEPING',
          items: [{ itemId: item.id, quantity: '5.00' }],
        }),
      ).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK' });
    });

    it('multi-item issue failure rolls back the entire transaction atomically', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'AMENITY', name: 'Amenities' });
      const item1 = await service.createItem(adminScope, {
        code: 'COMB',
        name: 'Plastic Comb',
        categoryId: cat.id,
        unit: 'piece',
      });
      const item2 = await service.createItem(adminScope, {
        code: 'SHAVER',
        name: 'Shaver Set',
        categoryId: cat.id,
        unit: 'piece',
      });

      // Stock: Comb = 50, Shaver = 5
      await service.createReceipt(adminScope, {
        items: [
          { itemId: item1.id, quantity: '50.00', unitPrice: '1000.00' },
          { itemId: item2.id, quantity: '5.00', unitPrice: '5000.00' },
        ],
      });

      // Issue request: Comb = 10 (valid), Shaver = 20 (exceeds available 5)
      await expect(
        service.createIssue(adminScope, {
          department: 'HOUSEKEEPING',
          items: [
            { itemId: item1.id, quantity: '10.00' },
            { itemId: item2.id, quantity: '20.00' },
          ],
        }),
      ).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK' });

      // Entire transaction must rollback: Comb stock must still be exactly 50.00!
      const checkItem1 = await service.getItemById(adminScope, BigInt(item1.id));
      const checkItem2 = await service.getItemById(adminScope, BigInt(item2.id));
      expect(checkItem1.currentStock).toBe('50.00');
      expect(checkItem2.currentStock).toBe('5.00');
    });

    it('rejects issuing inactive items (409 ITEM_INACTIVE)', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'AMENITY', name: 'Amenities' });
      const item = await service.createItem(adminScope, {
        code: 'OLD-SOAP',
        name: 'Old Stock Soap',
        categoryId: cat.id,
        unit: 'bar',
      });

      await service.createReceipt(adminScope, {
        items: [{ itemId: item.id, quantity: '100.00', unitPrice: '1000.00' }],
      });

      // Deactivate item
      await service.deactivateItem(adminScope, BigInt(item.id));

      await expect(
        service.createIssue(adminScope, {
          department: 'HOUSEKEEPING',
          items: [{ itemId: item.id, quantity: '10.00' }],
        }),
      ).rejects.toMatchObject({ status: 409, code: 'ITEM_INACTIVE' });
    });
  });

  describe('Inventory Adjustment & Count (Chức năng E)', () => {
    it('records physical count difference accurately and updates stock', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat = await service.createCategory(adminScope, { code: 'FNB', name: 'F&B' });
      const item = await service.createItem(adminScope, {
        code: 'WINE-RED',
        name: 'Red Wine Bottle',
        categoryId: cat.id,
        unit: 'bottle',
      });

      // Initial receipt: 20 bottles
      await service.createReceipt(adminScope, {
        items: [{ itemId: item.id, quantity: '20.00', unitPrice: '200000.00' }],
      });

      // Physical audit reveals only 18 bottles (2 broken)
      const adj = await service.createAdjustment(adminScope, {
        itemId: item.id,
        actualQuantity: '18.00',
        reason: '2 bottles broke during cellar rearrangement',
      });

      expect(adj.systemQuantity).toBe('20.00');
      expect(adj.actualQuantity).toBe('18.00');
      expect(adj.difference).toBe('-2.00');
      expect(adj.reason).toBe('2 bottles broke during cellar rearrangement');

      // Verify item stock is now 18
      const checkItem = await service.getItemById(adminScope, BigInt(item.id));
      expect(checkItem.currentStock).toBe('18.00');

      // Check adjustment movement
      const movements = await service.getMovements(adminScope, {
        page: 1,
        limit: 10,
        type: 'ADJUSTMENT',
      });
      expect(movements.items).toHaveLength(1);
      expect(movements.items[0]?.quantity).toBe('-2.00');
      expect(movements.items[0]?.currentStock).toBe('18.00');
    });
  });

  describe('Summary & Low Stock Alerts (Chức năng F)', () => {
    it('computes summary and low stock items correctly', async () => {
      const { repository } = memoryInventory();
      const service = new InventoryService(repository);

      const cat1 = await service.createCategory(adminScope, { code: 'CAT1', name: 'Category 1' });
      const cat2 = await service.createCategory(adminScope, { code: 'CAT2', name: 'Category 2' });

      // Item 1: In stock, above min level
      const item1 = await service.createItem(adminScope, {
        code: 'IT-1',
        name: 'Item 1',
        categoryId: cat1.id,
        unit: 'pc',
        minStockLevel: '10.00',
      });
      await service.createReceipt(adminScope, {
        items: [{ itemId: item1.id, quantity: '50.00', unitPrice: '1000.00' }],
      });

      // Item 2: Low stock (current 5 <= min 20)
      const item2 = await service.createItem(adminScope, {
        code: 'IT-2',
        name: 'Item 2',
        categoryId: cat1.id,
        unit: 'pc',
        minStockLevel: '20.00',
      });
      await service.createReceipt(adminScope, {
        items: [{ itemId: item2.id, quantity: '5.00', unitPrice: '2000.00' }],
      });

      // Item 3: Out of stock (current 0)
      await service.createItem(adminScope, {
        code: 'IT-3',
        name: 'Item 3',
        categoryId: cat2.id,
        unit: 'pc',
        minStockLevel: '5.00',
      });

      const summary = await service.getSummary(adminScope);
      expect(summary.totalActiveItems).toBe(3);
      expect(summary.lowStockItemsCount).toBe(2); // item2 (5 <= 20) and item3 (0 <= 5)
      expect(summary.outOfStockItemsCount).toBe(1); // item3 (0)
      expect(summary.totalCategories).toBe(2);
      // Value: (50 * 1000) + (5 * 2000) + (0 * 0) = 50000 + 10000 = 60000.00
      expect(summary.totalInventoryEstimatedValue).toBe('60000.00');

      // Check low stock query endpoint
      const lowStockList = await service.getLowStock(adminScope, { page: 1, limit: 10 });
      expect(lowStockList.items).toHaveLength(2);
      expect(lowStockList.items.map((i) => i.code)).toContain('IT-2');
      expect(lowStockList.items.map((i) => i.code)).toContain('IT-3');
    });
  });
});
