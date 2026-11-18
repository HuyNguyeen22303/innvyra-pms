import React from 'react';
import { Modal, Typography, Divider, Row, Col, Tag, Button, Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PaymentRecord, FolioDetailItem } from '../../../types/billing.types.ts';
import { getStaffDisplay } from '../../../utils/staffDirectory.ts';
import { ownHotelApi } from '../../../api/hotels.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import { formatFolioMoney } from '../../../utils/folioSettlement.ts';

const { Title, Text } = Typography;

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  folio: FolioDetailItem | null;
  guestName?: string;
  roomNumber?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  open,
  onClose,
  payment,
  folio,
  guestName,
  roomNumber,
}) => {
  const user = useAuthStore((state) => state.user);
  const hotelQuery = useQuery({
    queryKey: ['receipt-hotel-profile', user?.hotelId, user?.id],
    queryFn: ({ signal }) => ownHotelApi.get(signal),
    enabled: open && !!payment && !!user?.hotelId,
    staleTime: 0,
  });
  const hotel = hotelQuery.data?.id === user?.hotelId ? hotelQuery.data : undefined;
  const hotelReady = !!hotel && hotelQuery.isSuccess && !hotelQuery.isFetching;
  const hotelContact = [
    hotel?.address?.trim() ? `Địa chỉ: ${hotel.address.trim()}` : null,
    hotel?.contactPhone?.trim() ? `Điện thoại: ${hotel.contactPhone.trim()}` : null,
    hotel?.contactEmail?.trim() ? `Email: ${hotel.contactEmail.trim()}` : null,
  ].filter(Boolean).join(' — ');
  if (!payment) return null;

  const staff = getStaffDisplay(payment.processedBy);

  const formattedAmount = formatFolioMoney(payment.amount);

  const handlePrint = () => {
    if (hotelReady) window.print();
  };

  const isRefund = payment.paymentType === 'REFUND';
  const isDeposit = payment.paymentType === 'DEPOSIT';
  const titleType = isRefund
    ? 'PHIẾU HOÀN TIỀN (REFUND RECEIPT)'
    : isDeposit
    ? 'PHIẾU THU TIỀN ĐẶT CỌC (DEPOSIT RECEIPT)'
    : 'PHIẾU THU TIỀN (PAYMENT RECEIPT)';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={650}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
          onClick={handlePrint}
          disabled={!hotelReady}
        >
          In phiếu thu
        </Button>,
      ]}
    >
      <div id="receipt-print-area" style={{ padding: '16px 8px', color: '#0f172a' }}>
        {/* Hotel Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          {hotelReady ? <>
            <Title level={4} style={{ margin: 0, color: '#1b4d3e', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
              {hotel.name}
            </Title>
            {hotelContact && <Text type="secondary" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{hotelContact}</Text>}
          </> : hotelQuery.isError ? <Alert type="error" showIcon
            title="Chưa tải được thông tin khách sạn để in phiếu"
            action={<Button onClick={() => void hotelQuery.refetch()}>Thử lại</Button>} />
            : <Spin description="Đang tải thông tin khách sạn..." />}
          <Divider style={{ margin: '14px 0 10px 0' }} />
          <Title level={3} style={{ margin: '8px 0 4px 0', color: isRefund ? '#cf1322' : '#1b4d3e' }}>
            {titleType}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Mã giao dịch: <Text strong style={{ fontFamily: 'monospace' }}>#{payment.id}</Text> | Ngày lập:{' '}
            {dayjs(payment.processedAt).format('DD/MM/YYYY HH:mm:ss')}
          </Text>
        </div>

        {/* Transaction Summary Info */}
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 16,
            background: '#fafafa',
            marginBottom: 20,
          }}
        >
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Sổ công nợ Folio:</Text>
              <div>
                <Tag color="#1b4d3e" style={{ fontWeight: 600 }}>
                  FOLIO #{folio?.id || payment.folioId}
                </Tag>
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Mã đơn đặt phòng:</Text>
              <div>
                <Text strong style={{ color: '#1b4d3e' }}>
                  #{folio?.reservationId || 'N/A'}
                </Text>
              </div>
            </Col>

            {guestName && (
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Khách hàng nộp tiền:</Text>
                <div>
                  <Text strong>{guestName}</Text>
                </div>
              </Col>
            )}

            {roomNumber && (
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Phòng:</Text>
                <div>
                  <Tag color="blue" style={{ fontWeight: 600 }}>#{roomNumber}</Tag>
                </div>
              </Col>
            )}

            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Hình thức thanh toán:</Text>
              <div>
                <Tag color={payment.paymentMethod === 'CASH' ? 'green' : 'blue'}>
                  {payment.paymentMethod === 'CASH' ? '💵 Tiền mặt (Cash)' : '💳 Chuyển khoản (Bank Transfer)'}
                </Tag>
              </div>
            </Col>

            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Trạng thái giao dịch:</Text>
              <div>
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {payment.status} — ĐÃ XÁC NHẬN
                </Tag>
              </div>
            </Col>

            {payment.referenceNumber && (
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>Mã tham chiếu ngân hàng:</Text>
                <div>
                  <Text code style={{ fontSize: 13, fontWeight: 600 }}>
                    {payment.referenceNumber}
                  </Text>
                </div>
              </Col>
            )}

            {payment.reason && (
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>Lý do / Nội dung giao dịch:</Text>
                <div>
                  <Text>{payment.reason}</Text>
                </div>
              </Col>
            )}
          </Row>
        </div>

        {/* Amount Box */}
        <div
          className="receipt-amount"
          style={{
            padding: '16px 20px',
            background: isRefund ? '#fff1f0' : '#f6ffed',
            border: `1px solid ${isRefund ? '#ffa39e' : '#b7eb8f'}`,
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <div>
            <Text strong style={{ fontSize: 14, color: isRefund ? '#cf1322' : '#389e0d' }}>
              {isRefund ? 'TỔNG SỐ TIỀN HOÀN TRẢ:' : 'TỔNG SỐ TIỀN THỰC THU:'}
            </Text>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Đơn vị tiền tệ: Việt Nam Đồng (VND)</div>
          </div>
          <div>
            <Title className={`receipt-amount-value${formattedAmount.length > 18 ? ' receipt-amount-value--long' : ''}`} level={2} style={{ margin: 0, color: isRefund ? '#cf1322' : '#1b4d3e', fontWeight: 700 }}>
              {formattedAmount}
            </Title>
          </div>
        </div>

        {/* Signatures */}
        <Row className="receipt-signatures" gutter={24} style={{ marginTop: 24, textAlign: 'center' }}>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 50 }}>
              Khách hàng nộp / nhận tiền
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              (Ký và ghi rõ họ tên)
            </Text>
          </Col>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 50 }}>
              Nhân viên thu ngân thực hiện
            </Text>
            <div>
              <Text strong style={{ color: '#1b4d3e' }}>
                {staff.fullName}
              </Text>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>({staff.roleTitle})</div>
            </div>
          </Col>
        </Row>

        {/* Footer Disclaimer */}
        <Divider style={{ margin: '24px 0 12px 0' }} />
        <div style={{ textAlign: 'center', fontSize: 11, color: '#8c8c8c' }}>
          * Lưu ý: Đây là chứng từ biên nhận nội bộ xác nhận tiền đã nộp vào quỹ khách sạn, không thay thế hóa đơn tài chính (VAT).
        </div>
      </div>
    </Modal>
  );
};
