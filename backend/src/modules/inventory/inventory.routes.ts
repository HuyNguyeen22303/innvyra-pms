import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { InventoryService } from './inventory.service.js';
import { inventoryController } from './inventory.controller.js';
import { inventoryPermissions } from './inventory.types.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
  listCategoriesSchema,
  createSupplierSchema,
  updateSupplierSchema,
  supplierIdSchema,
  listSuppliersSchema,
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
  listItemsSchema,
  createReceiptSchema,
  receiptIdSchema,
  listReceiptsSchema,
  createIssueSchema,
  issueIdSchema,
  listIssuesSchema,
  createAdjustmentSchema,
  listMovementsSchema,
  lowStockSchema,
} from './inventory.schema.js';

export function inventoryRoutes(service: InventoryService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = inventoryController(service);

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.use(authenticate(auth));

  // --- Summary & Low stock ---
  router.get(
    '/summary',
    authorizeRoles(...inventoryPermissions.summaryRead),
    controller.getSummary,
  );

  router.get(
    '/low-stock',
    authorizeRoles(...inventoryPermissions.lowStockRead),
    validate(lowStockSchema),
    controller.getLowStock,
  );

  // --- Categories ---
  router.post(
    '/categories',
    authorizeRoles(...inventoryPermissions.categoryWrite),
    csrfProtection(env),
    validate(createCategorySchema),
    controller.createCategory,
  );

  router.get(
    '/categories',
    authorizeRoles(...inventoryPermissions.categoryRead),
    validate(listCategoriesSchema),
    controller.getCategories,
  );

  router.get(
    '/categories/:id',
    authorizeRoles(...inventoryPermissions.categoryRead),
    validate(categoryIdSchema),
    controller.getCategoryById,
  );

  router.patch(
    '/categories/:id',
    authorizeRoles(...inventoryPermissions.categoryWrite),
    csrfProtection(env),
    validate(updateCategorySchema),
    controller.updateCategory,
  );

  router.patch(
    '/categories/:id/deactivate',
    authorizeRoles(...inventoryPermissions.categoryWrite),
    csrfProtection(env),
    validate(categoryIdSchema),
    controller.deactivateCategory,
  );

  // --- Suppliers ---
  router.post(
    '/suppliers',
    authorizeRoles(...inventoryPermissions.supplierWrite),
    csrfProtection(env),
    validate(createSupplierSchema),
    controller.createSupplier,
  );

  router.get(
    '/suppliers',
    authorizeRoles(...inventoryPermissions.supplierRead),
    validate(listSuppliersSchema),
    controller.getSuppliers,
  );

  router.get(
    '/suppliers/:id',
    authorizeRoles(...inventoryPermissions.supplierRead),
    validate(supplierIdSchema),
    controller.getSupplierById,
  );

  router.patch(
    '/suppliers/:id',
    authorizeRoles(...inventoryPermissions.supplierWrite),
    csrfProtection(env),
    validate(updateSupplierSchema),
    controller.updateSupplier,
  );

  router.patch(
    '/suppliers/:id/deactivate',
    authorizeRoles(...inventoryPermissions.supplierWrite),
    csrfProtection(env),
    validate(supplierIdSchema),
    controller.deactivateSupplier,
  );

  // --- Items ---
  router.post(
    '/items',
    authorizeRoles(...inventoryPermissions.itemWrite),
    csrfProtection(env),
    validate(createItemSchema),
    controller.createItem,
  );

  router.get(
    '/items',
    authorizeRoles(...inventoryPermissions.itemRead),
    validate(listItemsSchema),
    controller.getItems,
  );

  router.get(
    '/items/:id',
    authorizeRoles(...inventoryPermissions.itemRead),
    validate(itemIdSchema),
    controller.getItemById,
  );

  router.patch(
    '/items/:id',
    authorizeRoles(...inventoryPermissions.itemWrite),
    csrfProtection(env),
    validate(updateItemSchema),
    controller.updateItem,
  );

  router.patch(
    '/items/:id/deactivate',
    authorizeRoles(...inventoryPermissions.itemWrite),
    csrfProtection(env),
    validate(itemIdSchema),
    controller.deactivateItem,
  );

  // --- Receipts ---
  router.post(
    '/receipts',
    authorizeRoles(...inventoryPermissions.receiptWrite),
    csrfProtection(env),
    validate(createReceiptSchema),
    controller.createReceipt,
  );

  router.get(
    '/receipts',
    authorizeRoles(...inventoryPermissions.receiptRead),
    validate(listReceiptsSchema),
    controller.getReceipts,
  );

  router.get(
    '/receipts/:id',
    authorizeRoles(...inventoryPermissions.receiptRead),
    validate(receiptIdSchema),
    controller.getReceiptById,
  );

  // --- Issues ---
  router.post(
    '/issues',
    authorizeRoles(...inventoryPermissions.issueWrite),
    csrfProtection(env),
    validate(createIssueSchema),
    controller.createIssue,
  );

  router.get(
    '/issues',
    authorizeRoles(...inventoryPermissions.issueRead),
    validate(listIssuesSchema),
    controller.getIssues,
  );

  router.get(
    '/issues/:id',
    authorizeRoles(...inventoryPermissions.issueRead),
    validate(issueIdSchema),
    controller.getIssueById,
  );

  // --- Adjustments ---
  router.post(
    '/adjustments',
    authorizeRoles(...inventoryPermissions.adjustmentWrite),
    csrfProtection(env),
    validate(createAdjustmentSchema),
    controller.createAdjustment,
  );

  // --- Movements ---
  router.get(
    '/movements',
    authorizeRoles(...inventoryPermissions.movementRead),
    validate(listMovementsSchema),
    controller.getMovements,
  );

  return router;
}
