import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  message,
  Typography,
  Card,
  Row,
  Col,
  Divider,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import type {
  StockReceiptView,
  CreateReceiptDto,
  CreateReceiptItemDto,
  InventoryItemView,
} from '../../../types/inventory.types.ts';
import { ReceiptDetailModal } from './ReceiptDetailModal.tsx';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface FormLineItem {
  key: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export const InventoryReceiptsTab: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Filter States
  const [supplierFilter, setSupplierFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Detail Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<StockReceiptView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [receiptLines, setReceiptLines] = useState<FormLineItem[]>([
    { key: 'line-1', itemId: '', quantity: 1, unitPrice: 0, notes: '' },
  ]);

  // Query Suppliers for filter & dropdown
  const { data: suppliersRes } = useQuery({
    queryKey: ['inventory', 'suppliers', 'all-active'],
    queryFn: () => inventoryApi.getSuppliers({ page: 1, limit: 100, isActive: true }),
  });
  const suppliers = suppliersRes?.data?.items || [];

  // Query Items for line item selection
  const { data: itemsRes } = useQuery({
    queryKey: ['inventory', 'items', 'all-active'],
    queryFn: () => inventoryApi.getItems({ page: 1, limit: 100, isActive: true }),
  });
  const activeItems = itemsRes?.data?.items || [];
  const itemMap = new Map<string, InventoryItemView>(activeItems.map((item) => [item.id, item]));

  // Query Receipts
  const startDate = dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined;
  const endDate = dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined;

  const {
    data: receiptsRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'receipts', page, pageSize, supplierFilter, startDate, endDate],
    queryFn: () =>
      inventoryApi.getReceipts({
        page,
        limit: pageSize,
        supplierId: supplierFilter || undefined,
        startDate,
        endDate,
      }),
  });

  const receiptList = receiptsRes?.data?.items || [];
  const total = receiptsRes?.data?.pagination?.total || 0;

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreateReceiptDto) => inventoryApi.createReceipt(dto),
    onSuccess: () => {
      message.success('Đã lập phiếu nhập kho và cập nhật tồn kho thành công!');
      setIsCreateOpen(false);
      createForm.resetFields();
      setReceiptLines([{ key: 'line-1', itemId: '', quantity: 1, unitPrice: 0, notes: '' }]);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(getInventoryErrorMessage(err, 'Không thể lập phiếu nhập kho.'));
    },
  });

  // Calculate total amount preview
  const estimatedTotal = receiptLines.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  // Line item change handlers
  const handleItemSelect = (index: number, itemId: string) => {
    // Check if item already exists in other lines
    const existingIndex = receiptLines.findIndex((l, i) => i !== index && l.itemId === itemId);
    if (existingIndex >= 0) {
      // Merge into existing line
      const currentLineQty = receiptLines[index]?.quantity || 1;
      const targetItem = itemMap.get(itemId);
      const updated = [...receiptLines];
      updated[existingIndex].quantity = (Number(updated[existingIndex].quantity) || 0) + currentLineQty;
      // remove current duplicate line
      updated.splice(index, 1);
      setReceiptLines(updated);
      message.info(`Vật tư "${targetItem?.name || ''}" đã có trong phiếu, đã tự động gộp số lượng!`);
      return;
    }

    const updated = [...receiptLines];
    updated[index].itemId = itemId;
    setReceiptLines(updated);
  };

  const handleLineChange = (index: number, field: keyof FormLineItem, value: any) => {
    const updated = [...receiptLines];
    updated[index] = { ...updated[index], [field]: value };
    setReceiptLines(updated);
  };

  const handleAddLine = () => {
    setReceiptLines([
      ...receiptLines,
      {
        key: `line-${Date.now()}-${Math.random()}`,
        itemId: '',
        quantity: 1,
        unitPrice: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (receiptLines.length === 1) {
      message.warning('Phiếu nhập kho phải có ít nhất 1 mặt hàng.');
      return;
    }
    const updated = [...receiptLines];
    updated.splice(index, 1);
    setReceiptLines(updated);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();

      // Validate lines
      if (receiptLines.length === 0) {
        message.error('Vui lòng thêm ít nhất một mặt hàng nhập kho');
        return;
      }

      for (let i = 0; i < receiptLines.length; i++) {
        const line = receiptLines[i];
        if (!line.itemId) {
          message.error(`Dòng ${i + 1}: Vui lòng chọn mặt hàng vật tư`);
          return;
        }
        if (!line.quantity || Number(line.quantity) <= 0) {
          message.error(`Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0`);
          return;
        }
      }

      // Aggregate duplicate items just in case
      const aggregated = new Map<string, { quantity: number; unitPrice: number; notes?: string }>();
      for (const line of receiptLines) {
        const existing = aggregated.get(line.itemId);
        if (existing) {
          existing.quantity += Number(line.quantity);
          if (line.notes) {
            existing.notes = existing.notes ? `${existing.notes}; ${line.notes}` : line.notes;
          }
        } else {
          aggregated.set(line.itemId, {
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice) || 0,
            notes: line.notes?.trim() || undefined,
          });
        }
      }

      const itemsDto: CreateReceiptItemDto[] = Array.from(aggregated.entries()).map(
        ([itemId, val]) => ({
          itemId,
          quantity: val.quantity.toFixed(2),
          unitPrice: val.unitPrice.toFixed(2),
          notes: val.notes || null,
        }),
      );

      const dto: CreateReceiptDto = {
        receiptNumber: values.receiptNumber?.trim() || undefined,
        supplierId: values.supplierId || null,
        receiptDate: values.receiptDate ? values.receiptDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes?.trim() || null,
        items: itemsDto,
      };

      createMutation.mutate(dto);
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<StockReceiptView> = [
    {
      title: 'Mã số phiếu',
      dataIndex: 'receiptNumber',
      key: 'receiptNumber',
      width: 160,
      render: (num) => <Text strong copyable style={{ whiteSpace: 'nowrap' }}>{num}</Text>,
    },
    {
      title: 'Ngày nhập kho',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      width: 130,
      render: (date) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dayjs(date).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: ['supplier', 'name'],
      key: 'supplierName',
      width: 220,
      render: (name, record) =>
        record.supplier ? (
          <div style={{ whiteSpace: 'nowrap' }}>
            <Text strong>{name}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.supplier.code}
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>Nhập trực tiếp / Không NCC</Text>
        ),
    },
    {
      title: 'Tổng giá trị',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#1b4d3e', whiteSpace: 'nowrap' }}>
          {Number(amount).toLocaleString('vi-VN')} VNĐ
        </Text>
      ),
    },
    {
      title: 'Mặt hàng',
      key: 'itemsCount',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>{record.items?.length || 0} mặt hàng</Tag>
      ),
    },
    {
      title: 'Người lập',
      key: 'creator',
      width: 140,
      render: (_, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {record.creator?.fullName || record.creator?.username || '-'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      align: 'center',
      fixed: screens.xs ? false : 'right',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => {
            setSelectedReceipt(record);
            setIsDetailOpen(true);
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Filter and Action Bar */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={10}>
            <Select
              placeholder="Lọc theo Nhà cung cấp"
              value={supplierFilter}
              onChange={(val) => {
                setSupplierFilter(val);
                setPage(1);
              }}
              style={{ width: 220 }}
              allowClear
              options={suppliers.map((s) => ({
                label: `${s.name} (${s.code})`,
                value: s.id,
              }))}
            />

            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates);
                setPage(1);
              }}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              style={{ width: 250 }}
            />

            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
          </Space>

          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setReceiptLines([
                  { key: 'line-1', itemId: '', quantity: 1, unitPrice: 0, notes: '' },
                ]);
                setIsCreateOpen(true);
              }}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Lập phiếu nhập kho
            </Button>
          )}
        </Space>
      </Card>

      {/* Receipts Table */}
      <Table<StockReceiptView>
        columns={columns}
        dataSource={receiptList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
          showTotal: (totalCount) => `Tổng số: ${totalCount} phiếu nhập`,
        }}
        bordered
      />

      {/* Detail Modal */}
      <ReceiptDetailModal
        open={isDetailOpen}
        receipt={selectedReceipt}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedReceipt(null);
        }}
      />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <FileDoneOutlined style={{ color: '#1b4d3e' }} />
            <span>Lập Phiếu Nhập Kho Vật Tư</span>
          </Space>
        }
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={handleCreateSubmit}
        okText="Hoàn tất nhập kho"
        cancelText="Hủy bỏ"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        width={860}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 12 }}
          initialValues={{ receiptDate: dayjs() }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="supplierId"
                label="Nhà cung cấp (Tùy chọn)"
                extra="Để trống nếu là nguồn nhập khác hoặc mua lẻ trực tiếp"
              >
                <Select
                  placeholder="Chọn nhà cung cấp"
                  allowClear
                  options={suppliers.map((s) => ({
                    label: `${s.name} (${s.code})`,
                    value: s.id,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="receiptDate"
                label="Ngày nhập kho"
                rules={[{ required: true, message: 'Chọn ngày nhập' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="receiptNumber"
                label="Số phiếu nhập"
                extra="Tự sinh nếu để trống"
              >
                <Input placeholder="Ví dụ: PNK-20261019-01" maxLength={50} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú chung">
            <Input placeholder="Số hóa đơn VAT, đơn vị giao hàng, biên bản bàn giao..." maxLength={500} />
          </Form.Item>

          <Divider style={{ margin: '12px 0 16px 0' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text strong style={{ fontSize: 14 }}>
              Danh sách vật tư nhập kho ({receiptLines.length} mặt hàng)
            </Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddLine}
            >
              Thêm dòng
            </Button>
          </div>

          {/* Line items dynamic list */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px',
              backgroundColor: '#f8fafc',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {receiptLines.map((line, idx) => {
              const selectedItem = itemMap.get(line.itemId);
              const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

              return (
                <Row
                  key={line.key}
                  gutter={8}
                  align="middle"
                  style={{
                    marginBottom: idx < receiptLines.length - 1 ? 10 : 0,
                    paddingBottom: idx < receiptLines.length - 1 ? 10 : 0,
                    borderBottom:
                      idx < receiptLines.length - 1 ? '1px dashed #e2e8f0' : 'none',
                  }}
                >
                  <Col xs={24} sm={8}>
                    <Select
                      placeholder="Chọn vật tư..."
                      value={line.itemId || undefined}
                      onChange={(val) => handleItemSelect(idx, val)}
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      options={activeItems.map((item) => ({
                        label: `${item.name} (${item.code}) [${item.unit}]`,
                        value: item.id,
                      }))}
                    />
                  </Col>

                  <Col xs={12} sm={4}>
                    <InputNumber
                      min={0.01}
                      step={1}
                      precision={2}
                      placeholder="Số lượng"
                      value={line.quantity}
                      onChange={(val) =>
                        handleLineChange(idx, 'quantity', val !== null ? Number(val) : 0)
                      }
                      style={{ width: '100%' }}
                      addonAfter={selectedItem?.unit || 'ĐVT'}
                    />
                  </Col>

                  <Col xs={12} sm={4}>
                    <InputNumber
                      min={0}
                      step={1000}
                      placeholder="Đơn giá"
                      value={line.unitPrice}
                      onChange={(val) =>
                        handleLineChange(idx, 'unitPrice', val !== null ? Number(val) : 0)
                      }
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col xs={18} sm={4}>
                    <div style={{ textAlign: 'right', paddingRight: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Thành tiền:</Text>
                      <br />
                      <Text strong style={{ color: '#1b4d3e' }}>
                        {lineTotal.toLocaleString('vi-VN')} đ
                      </Text>
                    </div>
                  </Col>

                  <Col xs={4} sm={3}>
                    <Input
                      placeholder="Ghi chú dòng"
                      value={line.notes}
                      onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                    />
                  </Col>

                  <Col xs={2} sm={1} style={{ textAlign: 'center' }}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => handleRemoveLine(idx)}
                    />
                  </Col>
                </Row>
              );
            })}
          </div>

          {/* Footer Total Summary preview */}
          <div
            style={{
              marginTop: 12,
              padding: '12px 16px',
              backgroundColor: '#e6f4ea',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Text type="secondary">Tổng giá trị phiếu nhập (ước tính):</Text>
            </div>
            <div>
              <Text strong style={{ fontSize: 18, color: '#1b4d3e' }}>
                {estimatedTotal.toLocaleString('vi-VN')} VNĐ
              </Text>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
