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
  Alert,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  ExportOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import type {
  StockIssueView,
  CreateIssueDto,
  CreateIssueItemDto,
  InventoryItemView,
} from '../../../types/inventory.types.ts';
import { IssueDetailModal } from './IssueDetailModal.tsx';
import { DebouncedSearchInput } from '../../../components/DebouncedSearchInput.tsx';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface FormLineItem {
  key: string;
  itemId: string;
  quantity: number;
  notes?: string;
}

const COMMON_DEPARTMENTS = [
  'Housekeeping - Buồng phòng',
  'Maintenance / Technician - Kỹ thuật bảo trì',
  'Front Desk - Lễ tân',
  'F&B - Ẩm thực & Nhà hàng',
  'Laundry - Giặt là',
  'Security - An ninh',
  'Administration - Hành chính nhân sự',
];

export const InventoryIssuesTab: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = ['ADMIN', 'MANAGER', 'HOUSEKEEPING', 'TECHNICIAN'].includes(
    user?.role || '',
  );

  // Filter States
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Detail Modal State
  const [selectedIssue, setSelectedIssue] = useState<StockIssueView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issueLines, setIssueLines] = useState<FormLineItem[]>([
    { key: 'line-1', itemId: '', quantity: 1, notes: '' },
  ]);

  // Query Items for line item selection
  const { data: itemsRes } = useQuery({
    queryKey: ['inventory', 'items', 'all-active-for-issues'],
    queryFn: () => inventoryApi.getItems({ page: 1, limit: 100, isActive: true }),
  });
  const activeItems = itemsRes?.data?.items || [];
  const itemMap = new Map<string, InventoryItemView>(activeItems.map((item) => [item.id, item]));

  // Query Issues
  const startDate = dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined;
  const endDate = dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined;

  const {
    data: issuesRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'issues', page, pageSize, departmentFilter, startDate, endDate],
    queryFn: () =>
      inventoryApi.getIssues({
        page,
        limit: pageSize,
        department: departmentFilter || undefined,
        startDate,
        endDate,
      }),
  });

  const issueList = issuesRes?.data?.items || [];
  const total = issuesRes?.data?.pagination?.total || 0;

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreateIssueDto) => inventoryApi.createIssue(dto),
    onSuccess: () => {
      message.success('Đã xuất kho và cập nhật tồn kho thành công!');
      setIsCreateOpen(false);
      setErrorMessage(null);
      createForm.resetFields();
      setIssueLines([{ key: 'line-1', itemId: '', quantity: 1, notes: '' }]);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      const msg = getInventoryErrorMessage(err, 'Không thể lập phiếu xuất kho.');
      setErrorMessage(msg);
      message.error(msg);
      // NOTE: DO NOT close modal or reset form, so the user can easily adjust quantities!
    },
  });

  // Line item change handlers
  const handleItemSelect = (index: number, itemId: string) => {
    // Check if item already exists in other lines
    const existingIndex = issueLines.findIndex((l, i) => i !== index && l.itemId === itemId);
    if (existingIndex >= 0) {
      const currentLineQty = issueLines[index]?.quantity || 1;
      const targetItem = itemMap.get(itemId);
      const updated = [...issueLines];
      updated[existingIndex].quantity = (Number(updated[existingIndex].quantity) || 0) + currentLineQty;
      updated.splice(index, 1);
      setIssueLines(updated);
      message.info(`Vật tư "${targetItem?.name || ''}" đã có trong phiếu, đã tự động gộp số lượng!`);
      return;
    }

    const updated = [...issueLines];
    updated[index].itemId = itemId;
    setIssueLines(updated);
  };

  const handleLineChange = (index: number, field: keyof FormLineItem, value: any) => {
    const updated = [...issueLines];
    updated[index] = { ...updated[index], [field]: value };
    setIssueLines(updated);
  };

  const handleAddLine = () => {
    setIssueLines([
      ...issueLines,
      {
        key: `line-${Date.now()}-${Math.random()}`,
        itemId: '',
        quantity: 1,
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (issueLines.length === 1) {
      message.warning('Phiếu xuất kho phải có ít nhất 1 mặt hàng.');
      return;
    }
    const updated = [...issueLines];
    updated.splice(index, 1);
    setIssueLines(updated);
  };

  const handleCreateSubmit = async () => {
    try {
      setErrorMessage(null);
      const values = await createForm.validateFields();

      if (issueLines.length === 0) {
        message.error('Vui lòng thêm ít nhất một mặt hàng xuất kho');
        return;
      }

      for (let i = 0; i < issueLines.length; i++) {
        const line = issueLines[i];
        if (!line.itemId) {
          message.error(`Dòng ${i + 1}: Vui lòng chọn mặt hàng vật tư`);
          return;
        }
        if (!line.quantity || Number(line.quantity) <= 0) {
          message.error(`Dòng ${i + 1}: Số lượng xuất phải lớn hơn 0`);
          return;
        }

        // Warn if requested quantity exceeds current stock
        const itemInfo = itemMap.get(line.itemId);
        if (itemInfo) {
          const availableStock = parseFloat(itemInfo.currentStock) || 0;
          if (line.quantity > availableStock) {
            message.warning(
              `Cảnh báo: Dòng ${i + 1} (${itemInfo.name}) yêu cầu xuất ${line.quantity} trong khi tồn kho hiện tại chỉ có ${availableStock} ${itemInfo.unit}`,
            );
          }
        }
      }

      // Aggregate duplicate items if any
      const aggregated = new Map<string, { quantity: number; notes?: string }>();
      for (const line of issueLines) {
        const existing = aggregated.get(line.itemId);
        if (existing) {
          existing.quantity += Number(line.quantity);
          if (line.notes) {
            existing.notes = existing.notes ? `${existing.notes}; ${line.notes}` : line.notes;
          }
        } else {
          aggregated.set(line.itemId, {
            quantity: Number(line.quantity),
            notes: line.notes?.trim() || undefined,
          });
        }
      }

      const itemsDto: CreateIssueItemDto[] = Array.from(aggregated.entries()).map(
        ([itemId, val]) => ({
          itemId,
          quantity: val.quantity.toFixed(2),
          notes: val.notes || null,
        }),
      );

      const dto: CreateIssueDto = {
        issueNumber: values.issueNumber?.trim() || undefined,
        department: values.department.trim(),
        purpose: values.purpose?.trim() || null,
        issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes?.trim() || null,
        items: itemsDto,
      };

      createMutation.mutate(dto);
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<StockIssueView> = [
    {
      title: 'Mã số phiếu',
      dataIndex: 'issueNumber',
      key: 'issueNumber',
      width: 160,
      render: (num) => <Text strong copyable style={{ whiteSpace: 'nowrap' }}>{num}</Text>,
    },
    {
      title: 'Ngày xuất kho',
      dataIndex: 'issueDate',
      key: 'issueDate',
      width: 130,
      render: (date) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dayjs(date).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Bộ phận nhận',
      dataIndex: 'department',
      key: 'department',
      width: 180,
      render: (dept) => <Tag color="purple" style={{ whiteSpace: 'nowrap' }}>{dept}</Tag>,
    },
    {
      title: 'Mục đích sử dụng',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 240,
      render: (purpose) => (
        <Paragraph
          ellipsis={{ rows: 2, tooltip: purpose }}
          style={{ margin: 0, color: '#475569' }}
        >
          {purpose || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Mặt hàng',
      key: 'itemsCount',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Tag color="orange" style={{ whiteSpace: 'nowrap' }}>{record.items?.length || 0} mặt hàng</Tag>
      ),
    },
    {
      title: 'Người xuất',
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
            setSelectedIssue(record);
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
            <DebouncedSearchInput
              placeholder="Lọc theo phòng ban nhận..."
              value={departmentFilter}
              onChange={(val) => {
                setDepartmentFilter(val);
                setPage(1);
              }}
              style={{ width: 220 }}
              allowClear
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
                setErrorMessage(null);
                setIssueLines([
                  { key: 'line-1', itemId: '', quantity: 1, notes: '' },
                ]);
                setIsCreateOpen(true);
              }}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Lập phiếu xuất kho
            </Button>
          )}
        </Space>
      </Card>

      {/* Issues Table */}
      <Table<StockIssueView>
        columns={columns}
        dataSource={issueList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1080 }}
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
          showTotal: (totalCount) => `Tổng số: ${totalCount} phiếu xuất`,
        }}
        bordered
      />

      {/* Detail Modal */}
      <IssueDetailModal
        open={isDetailOpen}
        issue={selectedIssue}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedIssue(null);
        }}
      />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: '#1b4d3e' }} />
            <span>Lập Phiếu Xuất Kho Vật Tư</span>
          </Space>
        }
        open={isCreateOpen}
        onCancel={() => {
          setIsCreateOpen(false);
          setErrorMessage(null);
        }}
        onOk={handleCreateSubmit}
        okText="Hoàn tất xuất kho"
        cancelText="Hủy bỏ"
        confirmLoading={createMutation.isPending}
        destroyOnHidden={false}
        width={820}
      >
        {errorMessage && (
          <Alert
            title="Không thể thực hiện xuất kho"
            description={errorMessage}
            type="error"
            showIcon
            style={{ marginTop: 12, marginBottom: 12 }}
            closable
            onClose={() => setErrorMessage(null)}
          />
        )}

        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 12 }}
          initialValues={{ issueDate: dayjs() }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="department"
                label="Bộ phận / Phòng ban nhận"
                rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập bộ phận nhận' }]}
              >
                <Select
                  placeholder="Chọn hoặc nhập tên bộ phận..."
                  showSearch
                  allowClear
                  options={COMMON_DEPARTMENTS.map((dept) => ({
                    label: dept,
                    value: dept,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="issueDate"
                label="Ngày xuất kho"
                rules={[{ required: true, message: 'Chọn ngày xuất' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="issueNumber"
                label="Số phiếu xuất"
                extra="Tự sinh nếu để trống"
              >
                <Input placeholder="Ví dụ: PXK-20261019-01" maxLength={50} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="purpose" label="Mục đích sử dụng">
                <Input placeholder="Ví dụ: Thay thế đồ vải tầng 3, Phục vụ khách VIP..." maxLength={500} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="notes" label="Ghi chú thêm">
                <Input placeholder="Người nhận thực tế, yêu cầu đặc biệt..." maxLength={500} />
              </Form.Item>
            </Col>
          </Row>

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
              Danh sách vật tư yêu cầu xuất ({issueLines.length} mặt hàng)
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
            {issueLines.map((line, idx) => {
              const selectedItem = itemMap.get(line.itemId);
              const currentStockNum = selectedItem ? parseFloat(selectedItem.currentStock) || 0 : 0;
              const isOverStock = selectedItem && line.quantity > currentStockNum;

              return (
                <Row
                  key={line.key}
                  gutter={8}
                  align="middle"
                  style={{
                    marginBottom: idx < issueLines.length - 1 ? 10 : 0,
                    paddingBottom: idx < issueLines.length - 1 ? 10 : 0,
                    borderBottom:
                      idx < issueLines.length - 1 ? '1px dashed #e2e8f0' : 'none',
                  }}
                >
                  <Col xs={24} sm={11}>
                    <Select
                      placeholder="Chọn mặt hàng xuất..."
                      value={line.itemId || undefined}
                      onChange={(val) => handleItemSelect(idx, val)}
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      options={activeItems.map((item) => ({
                        label: `${item.name} (${item.code}) [Tồn: ${item.currentStock} ${item.unit}]`,
                        value: item.id,
                      }))}
                    />
                  </Col>

                  <Col xs={12} sm={5}>
                    <InputNumber
                      min={0.01}
                      step={1}
                      precision={2}
                      placeholder="Số lượng"
                      value={line.quantity}
                      onChange={(val) =>
                        handleLineChange(idx, 'quantity', val !== null ? Number(val) : 0)
                      }
                      status={isOverStock ? 'warning' : ''}
                      style={{ width: '100%' }}
                      addonAfter={selectedItem?.unit || 'ĐVT'}
                    />
                  </Col>

                  <Col xs={12} sm={4}>
                    <div style={{ paddingLeft: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Khả dụng:</Text>
                      <br />
                      <Text
                        strong
                        style={{
                          color: isOverStock ? '#b91c1c' : '#1b4d3e',
                          fontSize: 12,
                        }}
                      >
                        {selectedItem ? `${selectedItem.currentStock} ${selectedItem.unit}` : '-'}
                      </Text>
                    </div>
                  </Col>

                  <Col xs={20} sm={3}>
                    <Input
                      placeholder="Ghi chú"
                      value={line.notes}
                      onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                    />
                  </Col>

                  <Col xs={4} sm={1} style={{ textAlign: 'center' }}>
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
        </Form>
      </Modal>
    </div>
  );
};
