import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { InventoryService } from './inventory.service.js';
import type {
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

function getScope(req: Request): InventoryScope {
  const { user } = requirePrincipal(req);
  return {
    hotelId: BigInt(user.hotelId),
    actorId: BigInt(user.id),
    role: user.role,
  };
}

export function inventoryController(service: InventoryService) {
  // Categories
  const createCategory: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateCategoryInput };
    const result = await service.createCategory(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Category created',
      data: result,
    });
  };

  const getCategories: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: CategoryQuery };
    const result = await service.getCategories(getScope(req), query);
    res.json({
      success: true,
      message: 'Categories retrieved',
      data: result,
    });
  };

  const getCategoryById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.getCategoryById(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Category retrieved',
      data: result,
    });
  };

  const updateCategory: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: UpdateCategoryInput;
    };
    const result = await service.updateCategory(getScope(req), BigInt(params.id), body);
    res.json({
      success: true,
      message: 'Category updated',
      data: result,
    });
  };

  const deactivateCategory: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.deactivateCategory(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Category deactivated',
      data: result,
    });
  };

  // Suppliers
  const createSupplier: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateSupplierInput };
    const result = await service.createSupplier(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Supplier created',
      data: result,
    });
  };

  const getSuppliers: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: SupplierQuery };
    const result = await service.getSuppliers(getScope(req), query);
    res.json({
      success: true,
      message: 'Suppliers retrieved',
      data: result,
    });
  };

  const getSupplierById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.getSupplierById(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Supplier retrieved',
      data: result,
    });
  };

  const updateSupplier: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: UpdateSupplierInput;
    };
    const result = await service.updateSupplier(getScope(req), BigInt(params.id), body);
    res.json({
      success: true,
      message: 'Supplier updated',
      data: result,
    });
  };

  const deactivateSupplier: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.deactivateSupplier(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Supplier deactivated',
      data: result,
    });
  };

  // Items
  const createItem: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateItemInput };
    const result = await service.createItem(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Inventory item created',
      data: result,
    });
  };

  const getItems: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: ItemQuery };
    const result = await service.getItems(getScope(req), query);
    res.json({
      success: true,
      message: 'Inventory items retrieved',
      data: result,
    });
  };

  const getItemById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.getItemById(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Inventory item retrieved',
      data: result,
    });
  };

  const updateItem: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: UpdateItemInput;
    };
    const result = await service.updateItem(getScope(req), BigInt(params.id), body);
    res.json({
      success: true,
      message: 'Inventory item updated',
      data: result,
    });
  };

  const deactivateItem: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.deactivateItem(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Inventory item deactivated',
      data: result,
    });
  };

  // Receipts
  const createReceipt: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateReceiptInput };
    const result = await service.createReceipt(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Stock receipt created',
      data: result,
    });
  };

  const getReceipts: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: ReceiptQuery };
    const result = await service.getReceipts(getScope(req), query);
    res.json({
      success: true,
      message: 'Stock receipts retrieved',
      data: result,
    });
  };

  const getReceiptById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.getReceiptById(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Stock receipt retrieved',
      data: result,
    });
  };

  // Issues
  const createIssue: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateIssueInput };
    const result = await service.createIssue(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Stock issue created',
      data: result,
    });
  };

  const getIssues: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: IssueQuery };
    const result = await service.getIssues(getScope(req), query);
    res.json({
      success: true,
      message: 'Stock issues retrieved',
      data: result,
    });
  };

  const getIssueById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.getIssueById(getScope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Stock issue retrieved',
      data: result,
    });
  };

  // Adjustments
  const createAdjustment: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateAdjustmentInput };
    const result = await service.createAdjustment(getScope(req), body);
    res.status(201).json({
      success: true,
      message: 'Stock adjustment created',
      data: result,
    });
  };

  // Movements
  const getMovements: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: MovementQuery };
    const result = await service.getMovements(getScope(req), query);
    res.json({
      success: true,
      message: 'Inventory movements retrieved',
      data: result,
    });
  };

  // Summary & Low Stock
  const getSummary: RequestHandler = async (req, res) => {
    const result = await service.getSummary(getScope(req));
    res.json({
      success: true,
      message: 'Inventory summary retrieved',
      data: result,
    });
  };

  const getLowStock: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: LowStockQuery };
    const result = await service.getLowStock(getScope(req), query);
    res.json({
      success: true,
      message: 'Low stock items retrieved',
      data: result,
    });
  };

  return {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deactivateCategory,
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    deactivateSupplier,
    createItem,
    getItems,
    getItemById,
    updateItem,
    deactivateItem,
    createReceipt,
    getReceipts,
    getReceiptById,
    createIssue,
    getIssues,
    getIssueById,
    createAdjustment,
    getMovements,
    getSummary,
    getLowStock,
  };
}
