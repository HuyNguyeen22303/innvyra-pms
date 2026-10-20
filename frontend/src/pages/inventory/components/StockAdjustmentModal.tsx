import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  Space,
  Alert,
  Tag,
  Descriptions,
  App as AntdApp,
} from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormOutlined, AlertOutlined } from '@ant-design/icons';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import type { InventoryItemView, CreateAdjustmentDto } from '../../../types/inventory.types.ts';

const { Text } = Typography;

interface StockAdjustmentModalProps {
  open: boolean;
  item: InventoryItemView | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  open,
  item,
  onClose,
  onSuccess,
}) => {
  const { message: appMessage } = AntdApp.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const watchedActualQty = Form.useWatch('actualQuantity', form);

  useEffect(() => {
    if (open && item) {
      const currentStockNum = parseFloat(item.currentStock) || 0;
      form.setFieldsValue({
        systemQuantity: item.currentStock,
        actualQuantity: currentStockNum,
        reason: '',
        adjustmentNumber: '',
      });
    } else {
      form.resetFields();
    }
  }, [open, item, form]);

  const currentSystemStock = item ? parseFloat(item.currentStock) || 0 : 0;
  const actualQtyNum =
    watchedActualQty !== undefined && watchedActualQty !== null && watchedActualQty !== ''
      ? Number(watchedActualQty)
      : null;
  const diff = actualQtyNum !== null && !isNaN(actualQtyNum) ? actualQtyNum - currentSystemStock : 0;

  const adjustmentMutation = useMutation({
    mutationFn: (dto: CreateAdjustmentDto) => inventoryApi.createAdjustment(dto),
    onSuccess: () => {
      appMessage.success('Đã cập nhật biên bản kiểm kê và điều chỉnh tồn kho thành công!');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      form.resetFields();
      onClose();
      onSuccess?.();
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể thực hiện điều chỉnh tồn kho.'));
    },
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!item) return;

      const dto: CreateAdjustmentDto = {
        itemId: item.id,
        actualQuantity: Number(values.actualQuantity).toFixed(2),
        reason: values.reason.trim(),
        adjustmentNumber: values.adjustmentNumber?.trim() || undefined,
      };

      adjustmentMutation.mutate(dto);
    } catch {
      // Form validation error
    }
  };

  return (
    <Modal
      title={
        <Space>
          <FormOutlined style={{ color: '#1b4d3e' }} />
          <span>Kiểm kê & Điều chỉnh Tồn kho</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Xác nhận điều chỉnh"
      cancelText="Hủy bỏ"
      confirmLoading={adjustmentMutation.isPending}
      destroyOnHidden
      width={560}
    >
      {item && (
        <div style={{ marginTop: 12 }}>
          <Descriptions
            bordered
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'code',
                label: 'Mã vật tư',
                children: <Text strong>{item.code}</Text>,
              },
              {
                key: 'unit',
                label: 'Đơn vị tính',
                children: item.unit,
              },
              {
                key: 'name',
                label: 'Tên vật tư',
                span: 2,
                children: item.name,
              },
              {
                key: 'systemStock',
                label: 'Tồn hệ thống',
                children: (
                  <Text strong style={{ fontSize: 15, color: '#1b4d3e' }}>
                    {item.currentStock} {item.unit}
                  </Text>
                ),
              },
              {
                key: 'diff',
                label: 'Chênh lệch',
                children: (
                  <Tag
                    color={
                      diff === 0 ? 'default' : diff > 0 ? 'success' : 'error'
                    }
                    style={{ fontWeight: 600, fontSize: 13 }}
                  >
                    {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} {item.unit}
                  </Tag>
                ),
              },
            ]}
          />

          <Alert
            title="Lưu ý nghiệp vụ kiểm kê"
            description="Số lượng thực tế sau khi xác nhận sẽ trở thành số lượng tồn kho mới của vật tư. Hệ thống sẽ tự động ghi nhận một giao dịch biến động kiểm kê (ADJUSTMENT)."
            type="info"
            showIcon
            icon={<AlertOutlined />}
            style={{ marginBottom: 16, fontSize: 13 }}
          />

          <Form form={form} layout="vertical">
            <Form.Item
              name="actualQuantity"
              label="Số lượng thực tế kiểm kê"
              rules={[
                { required: true, message: 'Vui lòng nhập số lượng thực tế kiểm kê' },
                {
                  validator: async (_, value) => {
                    if (value === null || value === undefined || value === '') {
                      return Promise.reject(new Error('Vui lòng nhập số lượng'));
                    }
                    const num = Number(value);
                    if (isNaN(num) || num < 0) {
                      return Promise.reject(new Error('Số lượng phải lớn hơn hoặc bằng 0'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={1}
                precision={2}
                placeholder="Nhập số lượng đếm được thực tế trong kho"
              />
            </Form.Item>

            <Form.Item
              name="reason"
              label="Lý do điều chỉnh (Bắt buộc)"
              rules={[
                { required: true, message: 'Vui lòng ghi rõ lý do kiểm kê/điều chỉnh' },
                { max: 500, message: 'Lý do không được vượt quá 500 ký tự' },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="Ví dụ: Kiểm kê định kỳ cuối tháng, hao hụt hư hỏng do vận chuyển, v.v."
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="adjustmentNumber"
              label="Mã số biên bản kiểm kê (Tùy chọn)"
              extra="Nếu để trống, hệ thống sẽ tự động tạo mã theo định dạng ADJ-YYYYMMDD-XXXXX"
            >
              <Input placeholder="Ví dụ: BBKK-2026-T10" maxLength={50} />
            </Form.Item>
          </Form>
        </div>
      )}
    </Modal>
  );
};
