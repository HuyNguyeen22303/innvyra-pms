import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';
import { memoryGuests } from './guest-helpers.js';
import { memoryReservations } from './reservation-helpers.js';
import { memoryInventory } from './inventory-helpers.js';
import { openApiDocument } from '../src/config/swagger.js';

describe('Inventory HTTP API: RBAC, Transactions, Concurrency, Tenant Isolation & OpenAPI', () => {
  let passwordHash: string;
  let auth: MemoryAuthRepository;
  let inventoryStore: ReturnType<typeof memoryInventory>;
  let app: ReturnType<typeof createApp>;

  let adminToken: string;
  let managerToken: string;
  let receptionistToken: string;
  let housekeepingToken: string;
  let technicianToken: string;
  let accountantToken: string;
  let otherHotelAdminToken: string;

  const hotelId = 9007199254740995n;
  const otherHotelId = 8888888888888888n;

  beforeAll(async () => {
    passwordHash = await hashPassword(testPassword);
    auth = new MemoryAuthRepository(passwordHash);

    // Setup staff accounts for all roles in hotelId
    auth.users.set('manager', {
      id: 200n,
      hotelId,
      fullName: 'Hotel Manager',
      username: 'manager',
      email: 'manager@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'MANAGER' },
    });

    auth.users.set('receptionist', {
      id: 300n,
      hotelId,
      fullName: 'Front Desk Receptionist',
      username: 'receptionist',
      email: 'rec@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'RECEPTIONIST' },
    });

    auth.users.set('housekeeping', {
      id: 400n,
      hotelId,
      fullName: 'Housekeeping Staff',
      username: 'housekeeping',
      email: 'hk@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'HOUSEKEEPING' },
    });

    auth.users.set('technician', {
      id: 500n,
      hotelId,
      fullName: 'Maintenance Tech',
      username: 'technician',
      email: 'tech@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'TECHNICIAN' },
    });

    auth.users.set('accountant', {
      id: 600n,
      hotelId,
      fullName: 'Financial Accountant',
      username: 'accountant',
      email: 'acc@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'ACCOUNTANT' },
    });

    // Staff for different tenant (hotelId = otherHotelId)
    auth.users.set('other_hotel_admin', {
      id: 999n,
      hotelId: otherHotelId,
      fullName: 'Other Hotel Admin',
      username: 'other_hotel_admin',
      email: 'other@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'ADMIN' },
    });

    const authService = new AuthService(auth, testEnv);

    const adminLogin = await authService.login({ username: 'admin', password: testPassword });
    adminToken = adminLogin.data.accessToken;

    const managerLogin = await authService.login({ username: 'manager', password: testPassword });
    managerToken = managerLogin.data.accessToken;

    const recLogin = await authService.login({ username: 'receptionist', password: testPassword });
    receptionistToken = recLogin.data.accessToken;

    const hkLogin = await authService.login({ username: 'housekeeping', password: testPassword });
    housekeepingToken = hkLogin.data.accessToken;

    const techLogin = await authService.login({ username: 'technician', password: testPassword });
    technicianToken = techLogin.data.accessToken;

    const accLogin = await authService.login({ username: 'accountant', password: testPassword });
    accountantToken = accLogin.data.accessToken;

    const otherLogin = await authService.login({
      username: 'other_hotel_admin',
      password: testPassword,
    });
    otherHotelAdminToken = otherLogin.data.accessToken;
  });

  beforeEach(async () => {
    inventoryStore = memoryInventory();

    app = createApp(
      testEnv,
      auth,
      memoryRooms().repositories,
      memoryGuests().repository,
      memoryReservations().repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      inventoryStore.repository,
    );
  });

  describe('1. Authentication & RBAC Authorization', () => {
    it('returns 401 UNAUTHORIZED when no token is provided', async () => {
      const res = await request(app).get('/api/v1/inventory/items');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('returns 403 CSRF_REJECTED on mutating requests without X-CSRF-Protection: 1', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'CAT-1', name: 'Category 1' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_REJECTED');
    });

    it('denies RECEPTIONIST from creating inventory items (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          code: 'TEST-ITEM',
          name: 'Test Item',
          categoryId: '1',
          unit: 'piece',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies ACCOUNTANT from creating stock issues (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          department: 'ACCOUNTING',
          items: [{ itemId: '1', quantity: '5.00' }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows HOUSEKEEPING and TECHNICIAN to create stock issues', async () => {
      // First create a category and item with stock as admin
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'LINEN', name: 'Linen' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'TOWEL', name: 'Bath Towel', categoryId: catId, unit: 'piece' });
      const itemId = itemRes.body.data.id;

      // Stock up 100 towels
      await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [{ itemId, quantity: '100.00', unitPrice: '50000.00' }],
        });

      // Housekeeping issues 10 towels
      const hkIssueRes = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${housekeepingToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          department: 'HOUSEKEEPING',
          purpose: 'Floor 1 setup',
          items: [{ itemId, quantity: '10.00' }],
        });
      expect(hkIssueRes.status).toBe(201);
      expect(hkIssueRes.body.data.items[0]?.quantity).toBe('10.00');

      // Technician issues 5 towels for cleaning equipment
      const techIssueRes = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${technicianToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          department: 'MAINTENANCE',
          purpose: 'Workshop rags',
          items: [{ itemId, quantity: '5.00' }],
        });
      expect(techIssueRes.status).toBe(201);
      expect(techIssueRes.body.data.items[0]?.quantity).toBe('5.00');
    });

    it('allows ACCOUNTANT to view inventory summary, receipts, and movements (read-only)', async () => {
      const summaryRes = await request(app)
        .get('/api/v1/inventory/summary')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(summaryRes.status).toBe(200);

      const receiptsRes = await request(app)
        .get('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(receiptsRes.status).toBe(200);

      const movementsRes = await request(app)
        .get('/api/v1/inventory/movements')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(movementsRes.status).toBe(200);
    });

    it('strictly restricts stock adjustments to ADMIN and MANAGER', async () => {
      // Create category & item
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'MINIBAR', name: 'Minibar Goods' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'BEER-CAN', name: 'Beer Can', categoryId: catId, unit: 'can' });
      const itemId = itemRes.body.data.id;

      // Receptionist attempt -> 403
      const recAdjRes = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ itemId, actualQuantity: '10.00', reason: 'Audit count' });
      expect(recAdjRes.status).toBe(403);

      // Housekeeping attempt -> 403
      const hkAdjRes = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${housekeepingToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ itemId, actualQuantity: '10.00', reason: 'Audit count' });
      expect(hkAdjRes.status).toBe(403);

      // Manager attempt -> 201
      const mgrAdjRes = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ itemId, actualQuantity: '10.00', reason: 'Monthly audit count' });
      expect(mgrAdjRes.status).toBe(201);
      expect(mgrAdjRes.body.data.actualQuantity).toBe('10.00');
    });
  });

  describe('2. Validation & Error Handling (Zod & AppError)', () => {
    it('returns 422 VALIDATION_ERROR on malformed request bodies', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({}); // missing code and name

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('returns 422 when receipt items quantity is zero or negative', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [{ itemId: '1', quantity: '-10.00' }],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when receipt items list is empty', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Category & Supplier Management Lifecycle', () => {
    it('manages category lifecycle and prevents deactivation when items are attached', async () => {
      const createRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'STATIONERY', name: 'Front Desk Stationery' });

      expect(createRes.status).toBe(201);
      const catId = createRes.body.data.id;

      // Attach an item to this category
      await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'PEN-BLUE', name: 'Blue Ballpoint Pen', categoryId: catId, unit: 'piece' });

      // Deactivation must be rejected because item is using it
      const deactRes = await request(app)
        .patch(`/api/v1/inventory/categories/${catId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send();

      expect(deactRes.status).toBe(409);
      expect(deactRes.body.error.code).toBe('CATEGORY_IN_USE');
    });

    it('creates, lists, and deactivates supplier', async () => {
      const createRes = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          code: 'SUP-COCA',
          name: 'Coca Cola Beverages Ltd',
          phone: '0281234567',
          email: 'order@coca.test',
        });
      expect(createRes.status).toBe(201);
      const supId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/v1/inventory/suppliers?search=Coca')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(1);

      const deactRes = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send();
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);
    });
  });

  describe('4. Inventory Item Lifecycle & Search Filters', () => {
    it('creates item, updates details, and supports pagination & search', async () => {
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'BATH', name: 'Bathroom Supplies' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          code: 'SOAP-BAR',
          name: 'Lavender Herbal Soap',
          categoryId: catId,
          unit: 'bar',
          minStockLevel: '20.00',
        });
      expect(itemRes.status).toBe(201);
      expect(itemRes.body.data.currentStock).toBe('0.00'); // Always 0 on creation!
      const itemId = itemRes.body.data.id;

      // Update name
      const patchRes = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ name: 'Lavender Herbal Soap 50g' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Lavender Herbal Soap 50g');

      // Search item
      const searchRes = await request(app)
        .get('/api/v1/inventory/items?search=Lavender&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.items).toHaveLength(1);
      expect(searchRes.body.data.pagination.total).toBe(1);

      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send();
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);
    });
  });

  describe('5. Stock Receipts, Issues & Atomic Transactions', () => {
    it('increases stock on receipt and decreases stock on issue', async () => {
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'KITCHEN', name: 'Kitchen Pantry' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'SALT-1KG', name: 'Cooking Salt 1kg', categoryId: catId, unit: 'bag' });
      const itemId = itemRes.body.data.id;

      // Receipt 50 bags
      const recRes = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [{ itemId, quantity: '50.00', unitPrice: '12000.00' }],
        });
      expect(recRes.status).toBe(201);
      expect(recRes.body.data.totalAmount).toBe('600000.00');

      // Stock is 50
      const afterRecItem = await request(app)
        .get(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(afterRecItem.body.data.currentStock).toBe('50.00');

      // Issue 20 bags
      const issueRes = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          department: 'RESTAURANT',
          items: [{ itemId, quantity: '20.00' }],
        });
      expect(issueRes.status).toBe(201);

      // Stock is now 30
      const afterIssueItem = await request(app)
        .get(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(afterIssueItem.body.data.currentStock).toBe('30.00');
    });

    it('rejects issue exceeding available stock and leaves stock unmodified', async () => {
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'OFFICE', name: 'Office Supplies' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'PAPER-A4', name: 'Paper A4 Ream', categoryId: catId, unit: 'ream' });
      const itemId = itemRes.body.data.id;

      // Receipt 5 reams
      await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [{ itemId, quantity: '5.00', unitPrice: '75000.00' }],
        });

      // Request 10 reams (exceeds 5)
      const issueRes = await request(app)
        .post('/api/v1/inventory/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          department: 'FRONT_DESK',
          items: [{ itemId, quantity: '10.00' }],
        });
      expect(issueRes.status).toBe(409);
      expect(issueRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Stock remains exactly 5.00
      const checkItem = await request(app)
        .get(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkItem.body.data.currentStock).toBe('5.00');
    });
  });

  describe('6. Concurrency Simulation & Negative Stock Prevention', () => {
    it('handles concurrent issue requests without negative stock', async () => {
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'LIMITED', name: 'Limited Stock Goods' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'RARE-TEA', name: 'Special Rare Tea', categoryId: catId, unit: 'pack' });
      const itemId = itemRes.body.data.id;

      // Receipt 10 packs
      await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({
          items: [{ itemId, quantity: '10.00', unitPrice: '100000.00' }],
        });

      // Fire 3 simultaneous issue requests of 6 packs each (Total requested: 18, Available: 10)
      const results = await Promise.all([
        request(app)
          .post('/api/v1/inventory/issues')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('X-CSRF-Protection', '1')
          .send({ department: 'BAR', items: [{ itemId, quantity: '6.00' }] }),
        request(app)
          .post('/api/v1/inventory/issues')
          .set('Authorization', `Bearer ${managerToken}`)
          .set('X-CSRF-Protection', '1')
          .send({ department: 'VIP_LOUNGE', items: [{ itemId, quantity: '6.00' }] }),
        request(app)
          .post('/api/v1/inventory/issues')
          .set('Authorization', `Bearer ${housekeepingToken}`)
          .set('X-CSRF-Protection', '1')
          .send({ department: 'PRESIDENTIAL_SUITE', items: [{ itemId, quantity: '6.00' }] }),
      ]);

      const successCount = results.filter((r) => r.status === 201).length;
      const failureCount = results.filter((r) => r.status === 409).length;

      // Exactly ONE request can succeed (reducing stock from 10 to 4), the other two must fail with INSUFFICIENT_STOCK!
      expect(successCount).toBe(1);
      expect(failureCount).toBe(2);

      // Verify final stock is exactly 4.00, never negative
      const checkItem = await request(app)
        .get(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkItem.body.data.currentStock).toBe('4.00');
    });
  });

  describe('7. Multi-Tenant Scope & Hotel Isolation', () => {
    it('strictly prevents accessing or mutating items across hotels', async () => {
      // Hotel A creates category and item
      const catRes = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'HOTEL-A-CAT', name: 'Hotel A Category' });
      const catId = catRes.body.data.id;

      const itemRes = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ code: 'HOTEL-A-ITEM', name: 'Hotel A Item', categoryId: catId, unit: 'piece' });
      const itemId = itemRes.body.data.id;

      // Hotel B Admin tries to view Hotel A's item -> 404 NOT FOUND
      const getRes = await request(app)
        .get(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${otherHotelAdminToken}`);
      expect(getRes.status).toBe(404);

      // Hotel B Admin tries to patch Hotel A's item -> 404 NOT FOUND
      const patchRes = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${otherHotelAdminToken}`)
        .set('X-CSRF-Protection', '1')
        .send({ name: 'Hijacked Item' });
      expect(patchRes.status).toBe(404);

      // Hotel B items list does NOT contain Hotel A's item
      const listRes = await request(app)
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${otherHotelAdminToken}`);
      expect(listRes.body.data.items).toHaveLength(0);
    });
  });

  describe('8. Swagger / OpenAPI Documentation Verification', () => {
    it('includes all inventory endpoints and schemas in the OpenAPI document', () => {
      const paths = openApiDocument.paths as Record<string, unknown>;
      const schemas = openApiDocument.components.schemas as Record<string, unknown>;

      // Expected inventory paths
      const expectedPaths = [
        '/inventory/summary',
        '/inventory/low-stock',
        '/inventory/categories',
        '/inventory/categories/{id}',
        '/inventory/categories/{id}/deactivate',
        '/inventory/suppliers',
        '/inventory/suppliers/{id}',
        '/inventory/suppliers/{id}/deactivate',
        '/inventory/items',
        '/inventory/items/{id}',
        '/inventory/items/{id}/deactivate',
        '/inventory/receipts',
        '/inventory/receipts/{id}',
        '/inventory/issues',
        '/inventory/issues/{id}',
        '/inventory/adjustments',
        '/inventory/movements',
      ];

      for (const p of expectedPaths) {
        expect(paths, `Missing path ${p} in OpenAPI document`).toHaveProperty(p);
      }

      // Expected inventory schemas
      const expectedSchemas = [
        'InventoryCategory',
        'CreateInventoryCategory',
        'UpdateInventoryCategory',
        'Supplier',
        'CreateSupplier',
        'UpdateSupplier',
        'InventoryItem',
        'CreateInventoryItem',
        'UpdateInventoryItem',
        'StockReceipt',
        'CreateStockReceipt',
        'StockIssue',
        'CreateStockIssue',
        'StockAdjustment',
        'CreateStockAdjustment',
        'InventoryMovement',
        'InventorySummary',
      ];

      for (const s of expectedSchemas) {
        expect(schemas, `Missing schema ${s} in OpenAPI document`).toHaveProperty(s);
      }
    });
  });
});
