import { apiClient } from './axiosClient.ts';
import { formatInventoryQuantity } from '../utils/inventoryQuantity.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  InventoryCategoryView,
  SupplierView,
  InventoryItemView,
  StockReceiptView,
  StockIssueView,
  StockAdjustmentView,
  InventoryMovementView,
  InventorySummary,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryParams,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryParams,
  CreateItemDto,
  UpdateItemDto,
  ItemQueryParams,
  CreateReceiptDto,
  ReceiptQueryParams,
  CreateIssueDto,
  IssueQueryParams,
  CreateAdjustmentDto,
  MovementQueryParams,
  LowStockQueryParams,
} from '../types/inventory.types.ts';

// Helper to remove undefined, null or empty string keys to strictly conform to backend Zod schemas
const cleanParams = <T extends Record<string, any>>(params?: T): Partial<T> | undefined => {
  if (!params) return undefined;
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      cleaned[key] = val;
    }
  }
  return cleaned as Partial<T>;
};

export const getInventoryErrorMessage = (error: any, fallbackMessage: string): string => {
  const code = error?.response?.data?.error?.code;
  const message = error?.response?.data?.error?.message || error?.response?.data?.message;

  switch (code) {
    case 'PREPARATION_EXCEEDS_CAPACITY': return 'Số người lớn hoặc trẻ em cần chuẩn bị vượt sức chứa của hạng phòng.';
    case 'ITEM_UNIT_IN_USE': return 'Vật tư đã có nhập/xuất nên không thể đổi đơn vị tính. Hãy tạo mã vật tư riêng cho đơn vị mới.';
    case 'MATERIAL_NOT_CONSUMABLE': return 'Chỉ chọn vật tư tiêu hao đang hoạt động. Kiểm tra lại phân loại hoặc định mức.';
    case 'HOUSEKEEPING_ATTEMPT_CHANGED': return 'Lượt dọn đã thay đổi. Vui lòng tải lại nhiệm vụ trước khi gửi.';
    case 'IDEMPOTENCY_CONFLICT': return 'Thao tác này đã được ghi nhận với dữ liệu khác. Tải lại danh sách để kiểm tra trước khi thử lại.';
    case 'SUPPLIER_PAYMENT_EXCEEDS_BALANCE': return 'Số tiền trả vượt quá số còn phải trả của phiếu nhập.';
    case 'RECEIPT_UNRECONCILED': return 'Cần đối soát lịch sử thanh toán của phiếu nhập trước.';
    case 'RECEIPT_ALREADY_RECONCILED': return 'Phiếu đã được đối soát. Vui lòng tải lại thông tin thanh toán.';
    case 'PAYMENT_DATE_IN_FUTURE': return 'Ngày trả tiền không được ở tương lai.';
    case 'DUPLICATE_MATERIAL': return 'Mỗi vật tư chỉ được chọn một lần trong định mức.';
    case 'CATEGORY_CODE_EXISTS':
      return 'Mã danh mục đã tồn tại trong khách sạn.';
    case 'CATEGORY_NOT_FOUND':
      return 'Không tìm thấy danh mục hoặc danh mục đã bị ngừng hoạt động.';
    case 'CATEGORY_IN_USE':
      return 'Không thể ngừng hoạt động danh mục vì vẫn còn vật tư đang thuộc danh mục này.';
    case 'SUPPLIER_CODE_EXISTS':
      return 'Mã nhà cung cấp đã tồn tại trong khách sạn.';
    case 'SUPPLIER_NOT_FOUND':
      return 'Không tìm thấy nhà cung cấp.';
    case 'SUPPLIER_INACTIVE':
      return 'Nhà cung cấp đã ngừng hoạt động, không thể thực hiện giao dịch.';
    case 'ITEM_CODE_EXISTS':
      return 'Mã vật tư đã tồn tại trong khách sạn.';
    case 'ITEM_NOT_FOUND':
      return 'Không tìm thấy vật tư.';
    case 'ITEM_INACTIVE':
      return 'Vật tư đang bị ngừng hoạt động, không thể nhập/xuất/kiểm kê.';
    case 'INSUFFICIENT_STOCK':
      if (Array.isArray(error?.response?.data?.error?.details)) {
        const detail = (path:string) => error.response.data.error.details.find((row:{path:string;message:string})=>row.path===path)?.message;
        if (detail('itemName')) return `Không đủ ${detail('itemName')}: còn ${formatInventoryQuantity(detail('available'))}, cần ${formatInventoryQuantity(detail('requested'))} ${detail('unit')??''}.`;
      }
      return message || 'Tồn kho khả dụng không đủ để thực hiện xuất kho.';
    case 'RECEIPT_NUMBER_EXISTS':
      return 'Mã số phiếu nhập kho đã tồn tại.';
    case 'ISSUE_NUMBER_EXISTS':
      return 'Mã số phiếu xuất kho đã tồn tại.';
    case 'ADJUSTMENT_NUMBER_EXISTS':
      return 'Mã số phiếu điều chỉnh đã tồn tại.';
    default:
      if (error?.response?.status === 403) {
        return 'Bạn không có quyền thực hiện thao tác này.';
      }
      return message || fallbackMessage;
  }
};

export const inventoryApi = {
  // Summary & Low Stock
  getSummary: async (): Promise<ApiResponse<InventorySummary>> => {
    const response = await apiClient.get<ApiResponse<InventorySummary>>('/inventory/summary');
    return response.data;
  },

  getLowStock: async (
    params?: LowStockQueryParams,
  ): Promise<ApiResponse<PaginatedResult<InventoryItemView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<InventoryItemView>>>(
      '/inventory/low-stock',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  // Categories
  getCategories: async (
    params?: CategoryQueryParams,
  ): Promise<ApiResponse<PaginatedResult<InventoryCategoryView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<InventoryCategoryView>>>(
      '/inventory/categories',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  getCategoryById: async (id: string): Promise<ApiResponse<InventoryCategoryView>> => {
    const response = await apiClient.get<ApiResponse<InventoryCategoryView>>(
      `/inventory/categories/${id}`,
    );
    return response.data;
  },

  createCategory: async (dto: CreateCategoryDto): Promise<ApiResponse<InventoryCategoryView>> => {
    const response = await apiClient.post<ApiResponse<InventoryCategoryView>>(
      '/inventory/categories',
      dto,
    );
    return response.data;
  },

  updateCategory: async (
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<ApiResponse<InventoryCategoryView>> => {
    const response = await apiClient.patch<ApiResponse<InventoryCategoryView>>(
      `/inventory/categories/${id}`,
      dto,
    );
    return response.data;
  },

  deactivateCategory: async (id: string): Promise<ApiResponse<InventoryCategoryView>> => {
    const response = await apiClient.patch<ApiResponse<InventoryCategoryView>>(
      `/inventory/categories/${id}/deactivate`,
    );
    return response.data;
  },

  // Suppliers
  getSuppliers: async (
    params?: SupplierQueryParams,
  ): Promise<ApiResponse<PaginatedResult<SupplierView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<SupplierView>>>(
      '/inventory/suppliers',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  getSupplierById: async (id: string): Promise<ApiResponse<SupplierView>> => {
    const response = await apiClient.get<ApiResponse<SupplierView>>(`/inventory/suppliers/${id}`);
    return response.data;
  },

  createSupplier: async (dto: CreateSupplierDto): Promise<ApiResponse<SupplierView>> => {
    const response = await apiClient.post<ApiResponse<SupplierView>>('/inventory/suppliers', dto);
    return response.data;
  },

  updateSupplier: async (
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<ApiResponse<SupplierView>> => {
    const response = await apiClient.patch<ApiResponse<SupplierView>>(
      `/inventory/suppliers/${id}`,
      dto,
    );
    return response.data;
  },

  deactivateSupplier: async (id: string): Promise<ApiResponse<SupplierView>> => {
    const response = await apiClient.patch<ApiResponse<SupplierView>>(
      `/inventory/suppliers/${id}/deactivate`,
    );
    return response.data;
  },

  // Items
  getItems: async (
    params?: ItemQueryParams,
  ): Promise<ApiResponse<PaginatedResult<InventoryItemView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<InventoryItemView>>>(
      '/inventory/items',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  getItemById: async (id: string): Promise<ApiResponse<InventoryItemView>> => {
    const response = await apiClient.get<ApiResponse<InventoryItemView>>(`/inventory/items/${id}`);
    return response.data;
  },

  createItem: async (dto: CreateItemDto): Promise<ApiResponse<InventoryItemView>> => {
    const response = await apiClient.post<ApiResponse<InventoryItemView>>('/inventory/items', dto);
    return response.data;
  },

  updateItem: async (
    id: string,
    dto: UpdateItemDto,
  ): Promise<ApiResponse<InventoryItemView>> => {
    const response = await apiClient.patch<ApiResponse<InventoryItemView>>(
      `/inventory/items/${id}`,
      dto,
    );
    return response.data;
  },

  deactivateItem: async (id: string): Promise<ApiResponse<InventoryItemView>> => {
    const response = await apiClient.patch<ApiResponse<InventoryItemView>>(
      `/inventory/items/${id}/deactivate`,
    );
    return response.data;
  },

  // Receipts
  getReceipts: async (
    params?: ReceiptQueryParams,
  ): Promise<ApiResponse<PaginatedResult<StockReceiptView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<StockReceiptView>>>(
      '/inventory/receipts',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  getReceiptById: async (id: string): Promise<ApiResponse<StockReceiptView>> => {
    const response = await apiClient.get<ApiResponse<StockReceiptView>>(`/inventory/receipts/${id}`);
    return response.data;
  },

  createReceipt: async (dto: CreateReceiptDto): Promise<ApiResponse<StockReceiptView>> => {
    const response = await apiClient.post<ApiResponse<StockReceiptView>>(
      '/inventory/receipts',
      dto,
    );
    return response.data;
  },

  // Issues
  getIssues: async (
    params?: IssueQueryParams,
  ): Promise<ApiResponse<PaginatedResult<StockIssueView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<StockIssueView>>>(
      '/inventory/issues',
      { params: cleanParams(params) },
    );
    return response.data;
  },

  getIssueById: async (id: string): Promise<ApiResponse<StockIssueView>> => {
    const response = await apiClient.get<ApiResponse<StockIssueView>>(`/inventory/issues/${id}`);
    return response.data;
  },

  createIssue: async (dto: CreateIssueDto): Promise<ApiResponse<StockIssueView>> => {
    const response = await apiClient.post<ApiResponse<StockIssueView>>('/inventory/issues', dto);
    return response.data;
  },

  // Adjustments
  createAdjustment: async (dto: CreateAdjustmentDto): Promise<ApiResponse<StockAdjustmentView>> => {
    const response = await apiClient.post<ApiResponse<StockAdjustmentView>>(
      '/inventory/adjustments',
      dto,
    );
    return response.data;
  },

  // Movements
  getMovements: async (
    params?: MovementQueryParams,
  ): Promise<ApiResponse<PaginatedResult<InventoryMovementView>>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResult<InventoryMovementView>>>(
      '/inventory/movements',
      { params: cleanParams(params) },
    );
    return response.data;
  },
};
