import React, { useState, useMemo } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  DatePicker,
  Select,
  Tag,
  Row,
  Col,
  Drawer,
  Descriptions,
  Badge,
  Alert,
  Spin,
  Empty,
  Collapse,
  Grid,
} from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  HomeOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  LoginOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { roomsApi, roomTypesApi } from '../../api/rooms.api.ts';
import { staysApi } from '../../api/stays.api.ts';
import { reservationsApi } from '../../api/reservations.api.ts';
import { maintenanceApi } from '../../api/maintenance.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type { RoomItem, RoomTypeItem } from '../../types/rooms.types.ts';
import type { StaySummaryItem } from '../../types/stays.types.ts';
import type { ReservationSummaryItem } from '../../types/reservations.types.ts';
import type { MaintenanceBlockItem } from '../../types/operations.types.ts';

dayjs.extend(isBetween);

const { Title, Text } = Typography;

export const RoomMatrixPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const userRole = user?.role || '';
  const canReadStays = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'].includes(userRole);
  const canReadMaintenance = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'TECHNICIAN'].includes(userRole);

  // Date Navigation State: Default 7 days from today
  const [startDate, setStartDate] = useState<Dayjs>(() => dayjs().startOf('day'));
  const daysCount = 7;

  // Selected cell for Detail Drawer
  const [selectedCell, setSelectedCell] = useState<{
    room: RoomItem;
    date: Dayjs;
    stay?: StaySummaryItem;
    block?: MaintenanceBlockItem;
  } | null>(null);

  // Filters State
  const [floorFilter, setFloorFilter] = useState<number | 'ALL'>('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string | 'ALL'>('ALL');

  // Dates array [D0, D1, D2, D3, D4, D5, D6]
  const dateColumns = useMemo(() => {
    const list: Dayjs[] = [];
    for (let i = 0; i < daysCount; i++) {
      list.push(startDate.add(i, 'day'));
    }
    return list;
  }, [startDate, daysCount]);

  // 1. Fetch Rooms (All 6 roles have read access)
  const {
    data: roomsRes,
    isLoading: isRoomsLoading,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: () => roomsApi.getAll({ limit: 100 }),
    staleTime: 60000,
  });

  const roomsList: RoomItem[] = useMemo(() => {
    const raw = roomsRes?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  }, [roomsRes]);

  // 2. Fetch Room Types (All 6 roles)
  const { data: roomTypesRes } = useQuery({
    queryKey: ['room-types-all'],
    queryFn: () => roomTypesApi.getAll({ limit: 100 }),
    staleTime: 60000,
  });

  const roomTypesList: RoomTypeItem[] = useMemo(() => {
    const raw = roomTypesRes?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  }, [roomTypesRes]);

  const roomTypeMap = useMemo(() => {
    const map = new Map<string, RoomTypeItem>();
    roomTypesList.forEach((rt) => map.set(String(rt.id), rt));
    return map;
  }, [roomTypesList]);

  // 3. Fetch Stays (Only for authorized roles)
  const { data: staysRes } = useQuery({
    queryKey: ['stays-checked-in'],
    queryFn: () => staysApi.getAll({ status: 'CHECKED_IN', limit: 100 }),
    enabled: canReadStays,
    staleTime: 30000,
  });

  const activeStaysList: StaySummaryItem[] = useMemo(() => {
    const raw = staysRes?.data?.items;
    return Array.isArray(raw) ? raw : [];
  }, [staysRes]);

  // 4. Fetch Maintenance Blocks (Only for authorized roles)
  const { data: blocksRes } = useQuery({
    queryKey: ['maintenance-blocks-active'],
    queryFn: () => maintenanceApi.getBlocks({ status: 'ACTIVE', limit: 100 }),
    enabled: canReadMaintenance,
    staleTime: 30000,
  });

  const activeBlocksList: MaintenanceBlockItem[] = useMemo(() => {
    const raw = blocksRes?.data?.items;
    return Array.isArray(raw) ? raw : [];
  }, [blocksRes]);

  // 5. Fetch Reservations for Unassigned Bookings Check
  const { data: reservationsRes } = useQuery({
    queryKey: ['reservations-confirmed-matrix'],
    queryFn: () => reservationsApi.getAll({ status: 'CONFIRMED', limit: 50 }),
    enabled: canReadStays,
    staleTime: 60000,
  });

  const confirmedReservations: ReservationSummaryItem[] = useMemo(() => {
    const raw = reservationsRes?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  }, [reservationsRes]);

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return roomsList.filter((room) => {
      if (floorFilter !== 'ALL' && room.floorNumber !== floorFilter) return false;
      if (roomTypeFilter !== 'ALL' && String(room.roomTypeId) !== String(roomTypeFilter)) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'READY' && room.housekeepingStatus !== 'READY') return false;
        if (statusFilter === 'DIRTY' && room.housekeepingStatus !== 'DIRTY') return false;
        if (statusFilter === 'MAINTENANCE' && room.physicalStatus !== 'MAINTENANCE') return false;
      }
      return true;
    });
  }, [roomsList, floorFilter, roomTypeFilter, statusFilter]);

  // Distinct floors for filter
  const floors = useMemo(() => {
    const set = new Set<number>();
    roomsList.forEach((r) => set.add(r.floorNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [roomsList]);

  // Helper to determine status of Room on a specific Date
  const getCellStatus = (room: RoomItem, date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const isToday = date.isSame(dayjs(), 'day');

    // 1. Check Maintenance Block: [startDate, endDate)
    const block = activeBlocksList.find((b) => {
      if (String(b.roomId) !== String(room.id)) return false;
      return (dateStr >= b.startDate && dateStr < b.endDate) || (dateStr === b.startDate && b.status === 'ACTIVE');
    });

    if (block) {
      return {
        type: 'BLOCK' as const,
        label: 'Khóa bảo trì',
        color: '#ff4d4f',
        bgColor: '#fff1f0',
        borderColor: '#ffa39e',
        block,
      };
    }

    // 2. Check Active In-House Stay (For dates >= checkin date and stay is currently checked in)
    const stay = activeStaysList.find((s) => {
      if (String(s.room?.id) !== String(room.id)) return false;
      const checkinDateStr = dayjs(s.actualCheckinAt).format('YYYY-MM-DD');
      return dateStr >= checkinDateStr;
    });

    if (stay) {
      return {
        type: 'STAY' as const,
        label: stay.bookerGuest?.fullName || 'Đang lưu trú',
        code: stay.confirmationCode,
        color: '#1b4d3e',
        bgColor: '#e6f7ef',
        borderColor: '#95de64',
        stay,
      };
    }

    // 3. For Today: show room's current housekeeping status snapshot
    if (isToday) {
      if (room.physicalStatus === 'MAINTENANCE') {
        return {
          type: 'ROOM_SNAPSHOT' as const,
          label: 'Phòng bảo trì',
          color: '#d46b08',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        };
      }
      if (room.housekeepingStatus === 'READY') {
        return {
          type: 'ROOM_SNAPSHOT' as const,
          label: 'Sẵn sàng (Clean)',
          color: '#389e0d',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        };
      }
      if (room.housekeepingStatus === 'DIRTY') {
        return {
          type: 'ROOM_SNAPSHOT' as const,
          label: 'Chờ dọn (Dirty)',
          color: '#cf1322',
          bgColor: '#fff1f0',
          borderColor: '#ffa39e',
        };
      }
      if (room.housekeepingStatus === 'CLEANING') {
        return {
          type: 'ROOM_SNAPSHOT' as const,
          label: 'Đang dọn dẹp',
          color: '#096dd9',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff',
        };
      }
      return {
        type: 'ROOM_SNAPSHOT' as const,
        label: 'Chờ kiểm tra',
        color: '#722ed1',
        bgColor: '#f9f0ff',
        borderColor: '#d3adf7',
      };
    }

    // 4. Default: No stay/block recorded for this date
    return {
      type: 'VACANT' as const,
      label: 'Trống / Chưa có booking',
      color: '#64748b',
      bgColor: '#ffffff',
      borderColor: '#e2e8f0',
    };
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            <CalendarOutlined style={{ marginRight: 8, color: '#1b4d3e' }} />
            Sơ Đồ Phòng Theo Thời Gian (Room Matrix)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Bảng ma trận trực quan trạng thái lưu trú, đặt phòng và khóa phòng theo từng ngày.
          </Text>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => refetchRooms()}>
            Làm mới
          </Button>
          <Button
            onClick={() => setStartDate(dayjs().startOf('day'))}
            style={{ borderColor: '#1b4d3e', color: '#1b4d3e' }}
          >
            Hôm nay
          </Button>
          <Button.Group>
            <Button icon={<LeftOutlined />} onClick={() => setStartDate((d) => d.subtract(7, 'day'))}>
              Tuần trước
            </Button>
            <Button icon={<RightOutlined />} onClick={() => setStartDate((d) => d.add(7, 'day'))}>
              Tuần sau
            </Button>
          </Button.Group>
          <DatePicker
            value={startDate}
            onChange={(val) => {
              if (val) setStartDate(val.startOf('day'));
            }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
        </Space>
      </div>

      {/* Role-based Data Notice */}
      {!canReadStays && (
        <Alert
          type="info"
          showIcon
          message="Chế độ xem sơ đồ phòng vận hành"
          description="Tài khoản của bạn hiển thị sơ đồ phòng vật lý và lệnh bảo trì. Chi tiết đơn đặt phòng và hồ sơ khách hàng chỉ dành cho Lễ tân, Quản lý và Kế toán."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Row gutter={[10, 10]} align="middle">
          <Col xs={24} sm={12} md={8} lg={5}>
            <Select
              style={{ width: '100%' }}
              value={floorFilter}
              onChange={(val) => setFloorFilter(val)}
              options={[
                { value: 'ALL', label: 'Tất cả các tầng' },
                ...floors.map((f) => ({ value: f, label: `Tầng ${f}` })),
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              style={{ width: '100%' }}
              value={roomTypeFilter}
              onChange={(val) => setRoomTypeFilter(val)}
              options={[
                { value: 'ALL', label: 'Tất cả hạng phòng' },
                ...roomTypesList.map((rt) => ({ value: String(rt.id), label: `${rt.name} (${rt.code})` })),
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={5}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'READY', label: '● Phòng sạch (Ready)' },
                { value: 'DIRTY', label: '● Phòng bẩn (Dirty)' },
                { value: 'MAINTENANCE', label: '● Đang bảo trì' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={24} lg={8} style={{ textAlign: screens.lg ? 'right' : 'left' }}>
            <Space size={6} wrap>
              <Tag color="success">● Có khách</Tag>
              <Tag color="error">● Khóa bảo trì</Tag>
              <Tag color="cyan">● Sẵn sàng</Tag>
              <Tag color="default">○ Trống</Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Matrix Table */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}
      >
        {isRoomsLoading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin size="large" tip="Đang nạp sơ đồ ma trận phòng..." />
          </div>
        ) : filteredRooms.length === 0 ? (
          <Empty description="Không có phòng nào phù hợp với bộ lọc." style={{ padding: 50 }} />
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 880,
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th
                    style={{
                      padding: '12px 16px',
                      width: 180,
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f8fafc',
                      zIndex: 2,
                      borderRight: '2px solid #e2e8f0',
                    }}
                  >
                    <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                      Phòng / Hạng phòng
                    </Text>
                  </th>
                  {dateColumns.map((colDate) => {
                    const isToday = colDate.isSame(dayjs(), 'day');
                    const isWeekend = colDate.day() === 0 || colDate.day() === 6;
                    return (
                      <th
                        key={colDate.format('YYYY-MM-DD')}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          borderRight: '1px solid #e2e8f0',
                          backgroundColor: isToday ? '#e6f7ef' : isWeekend ? '#f1f5f9' : '#f8fafc',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isToday ? 700 : 600,
                            color: isToday ? '#1b4d3e' : '#475569',
                          }}
                        >
                          {colDate.format('DD/MM')}
                        </div>
                        <div style={{ fontSize: 11, color: isToday ? '#1b4d3e' : '#64748b' }}>
                          {isToday ? 'Hôm nay' : `Thứ ${colDate.day() === 0 ? 'CN' : colDate.day() + 1}`}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const roomType = roomTypeMap.get(String(room.roomTypeId));
                  return (
                    <tr
                      key={room.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {/* Fixed Room info column */}
                      <td
                        style={{
                          padding: '10px 16px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: '#ffffff',
                          zIndex: 1,
                          borderRight: '2px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <Text strong style={{ fontSize: 14, color: '#1b4d3e' }}>
                              #{room.roomNumber}
                            </Text>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Tầng {room.floorNumber} • {roomType?.name || 'Standard'}
                            </div>
                          </div>
                          <Badge
                            status={
                              room.physicalStatus === 'MAINTENANCE'
                                ? 'error'
                                : room.housekeepingStatus === 'READY'
                                ? 'success'
                                : 'warning'
                            }
                          />
                        </div>
                      </td>

                      {/* Date Cells */}
                      {dateColumns.map((colDate) => {
                        const cell = getCellStatus(room, colDate);
                        const isToday = colDate.isSame(dayjs(), 'day');

                        return (
                          <td
                            key={colDate.format('YYYY-MM-DD')}
                            onClick={() =>
                              setSelectedCell({
                                room,
                                date: colDate,
                                stay: cell.stay,
                                block: cell.block,
                              })
                            }
                            style={{
                              padding: 6,
                              borderRight: '1px solid #e2e8f0',
                              backgroundColor: isToday ? '#fafafa' : '#ffffff',
                              cursor: 'pointer',
                              verticalAlign: 'top',
                            }}
                          >
                            <div
                              style={{
                                padding: '6px 8px',
                                minHeight: 46,
                                borderRadius: 6,
                                backgroundColor: cell.bgColor,
                                border: `1px solid ${cell.borderColor}`,
                                fontSize: 11,
                                color: cell.color,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cell.label}
                              </div>
                              {cell.code && (
                                <div style={{ fontSize: 10, color: '#0f2922', opacity: 0.8 }}>
                                  #{cell.code}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Unassigned Reservations Section (Complies with requirement) */}
      {canReadStays && (
        <Collapse
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}
          items={[
            {
              key: 'unassigned-reservations',
              label: (
                <Space>
                  <ApartmentOutlined style={{ color: '#1b4d3e' }} />
                  <Text strong style={{ color: '#1b4d3e' }}>
                    Đơn Đặt Phòng Chưa Gán Phòng Vật Lý ({confirmedReservations.length} đơn)
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (Khách đã xác nhận đặt nhưng chưa chỉ định số phòng cụ thể trước khi check-in)
                  </Text>
                </Space>
              ),
              children:
                confirmedReservations.length === 0 ? (
                  <Text type="secondary">Tất cả các đơn đặt phòng hiện đều đã được gán hoặc đã hoàn tất thủ tục.</Text>
                ) : (
                  <Row gutter={[12, 12]}>
                    {confirmedReservations.slice(0, 8).map((r) => (
                      <Col xs={24} sm={12} md={8} lg={6} key={r.id}>
                        <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                              {r.bookerGuest?.fullName}
                            </Text>
                            <Tag color="cyan">#{r.confirmationCode}</Tag>
                          </div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                            {r.totalRooms} phòng • {dayjs(r.checkInDate).format('DD/MM')} ➔ {dayjs(r.checkOutDate).format('DD/MM')} ({r.totalNights} đêm)
                          </Text>
                          <Button
                            size="small"
                            type="primary"
                            icon={<LoginOutlined />}
                            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e', width: '100%', fontSize: 12 }}
                            onClick={() => navigate(`/stays?tab=arrivals&reservationId=${r.id}`)}
                          >
                            Gán phòng & Check-in
                          </Button>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ),
            },
          ]}
        />
      )}

      {/* Cell Detail Drawer */}
      <Drawer
        title={
          selectedCell ? (
            <Space>
              <HomeOutlined style={{ color: '#1b4d3e' }} />
              <span>
                Phòng #{selectedCell.room.roomNumber} — Ngày {selectedCell.date.format('DD/MM/YYYY')}
              </span>
            </Space>
          ) : (
            'Chi tiết ô phòng'
          )
        }
        open={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        width={screens.xs ? '100%' : 420}
      >
        {selectedCell && (
          <div>
            <Descriptions title="Thông tin phòng" column={1} bordered size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Số phòng">
                <strong>#{selectedCell.room.roomNumber}</strong> (Tầng {selectedCell.room.floorNumber})
              </Descriptions.Item>
              <Descriptions.Item label="Hạng phòng">
                {roomTypeMap.get(String(selectedCell.room.roomTypeId))?.name || 'Standard'}
              </Descriptions.Item>
              <Descriptions.Item label="Tình trạng buồng">
                <Tag color="cyan">{selectedCell.room.housekeepingStatus}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tình trạng vật lý">
                <Tag color={selectedCell.room.physicalStatus === 'ACTIVE' ? 'green' : 'red'}>
                  {selectedCell.room.physicalStatus}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedCell.stay ? (
              <div style={{ padding: 14, backgroundColor: '#e6f7ef', borderRadius: 6, border: '1px solid #95de64', marginBottom: 20 }}>
                <Title level={5} style={{ margin: 0, color: '#1b4d3e' }}>
                  <CheckCircleOutlined style={{ marginRight: 6 }} /> Khách Đang Lưu Trú
                </Title>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Khách hàng:</strong> {selectedCell.stay.bookerGuest?.fullName}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Mã đặt phòng:</strong> #{selectedCell.stay.confirmationCode}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Nhận phòng lúc:</strong> {dayjs(selectedCell.stay.actualCheckinAt).format('DD/MM/YYYY HH:mm')}
                  </p>
                </div>
                <Button
                  type="primary"
                  size="small"
                  style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e', marginTop: 10 }}
                  onClick={() => {
                    setSelectedCell(null);
                    navigate('/stays');
                  }}
                >
                  Đến trang Quản lý Lưu trú
                </Button>
              </div>
            ) : selectedCell.block ? (
              <div style={{ padding: 14, backgroundColor: '#fff1f0', borderRadius: 6, border: '1px solid #ffa39e', marginBottom: 20 }}>
                <Title level={5} style={{ margin: 0, color: '#cf1322' }}>
                  <ToolOutlined style={{ marginRight: 6 }} /> Lệnh Khóa Phòng Bảo Trì
                </Title>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Lý do khóa:</strong> {selectedCell.block.reason}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Thời gian:</strong> {selectedCell.block.startDate} ➔ {selectedCell.block.endDate}
                  </p>
                </div>
                <Button
                  danger
                  size="small"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setSelectedCell(null);
                    navigate('/maintenance');
                  }}
                >
                  Đến trang Bảo trì Kỹ thuật
                </Button>
              </div>
            ) : (
              <Alert
                type="info"
                showIcon
                message="Trống / Chưa có booking"
                description={
                  selectedCell.date.isSame(dayjs(), 'day')
                    ? `Hôm nay phòng đang ở trạng thái ${selectedCell.room.housekeepingStatus} và sẵn sàng phục vụ theo quy định vận hành.`
                    : 'Không có thông tin đặt phòng hoặc lệnh bảo trì cho ngày này.'
                }
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
