import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Tabs,
  Badge,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Radio,
  Timeline,
  Alert,
  Tooltip,
  message,
  Empty,
  Spin,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  WarningOutlined,
  UserSwitchOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { housekeepingApi } from '../../api/housekeeping.api.ts';
import { roomTypesApi } from '../../api/rooms.api.ts';
import { employeesApi } from '../../api/employees.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import {
  getStaffDisplay,
  getHousekeepingActionDisplay,
  formatAuditNote,
  registerStaffMembers,
} from '../../utils/staffDirectory.ts';
import type {
  HousekeepingTaskItem,
  HousekeepingPriority,
  HousekeepingTaskStatus,
  DirtyRoomItem,
  CreateHousekeepingTaskDto,
  InspectHousekeepingTaskDto,
} from '../../types/operations.types.ts';

const { Title, Text, Paragraph } = Typography;

// Dynamic Housekeeping Staff Options loaded from employeesApi

export const HousekeepingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(user?.role || '');
  const canCreateTask = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');

  // UI States
  const [activeTab, setActiveTab] = useState<string>('kanban');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<HousekeepingTaskItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  // Selected Task for Actions
  const [actionTask, setActionTask] = useState<HousekeepingTaskItem | null>(null);

  // Forms
  const [createForm] = Form.useForm();
  // Dynamic Housekeeping Staff Query (GET /employees?role=HOUSEKEEPING&isActive=true)
  const { data: housekeepingStaffRes } = useQuery({
    queryKey: ['employees', { role: 'HOUSEKEEPING', isActive: true }],
    queryFn: () => employeesApi.list({ role: 'HOUSEKEEPING', isActive: true, limit: 100 }),
    staleTime: 60000,
  });

  useEffect(() => {
    if (housekeepingStaffRes?.data?.items) {
      registerStaffMembers(housekeepingStaffRes.data.items);
    }
  }, [housekeepingStaffRes]);

  const housekeepingOptions = useMemo(() => {
    const items = housekeepingStaffRes?.data?.items || [];
    if (items.length === 0) {
      return [{ value: '', label: 'Chưa có nhân viên buồng phòng đang hoạt động' }];
    }
    return items.map((staff) => ({
      value: String(staff.id),
      label: `${staff.fullName} (Buồng phòng - ID: ${staff.id})`,
      role: staff.role,
    }));
  }, [housekeepingStaffRes]);

  const [assignStaffId, setAssignStaffId] = useState<string>('');
  const [inspectPassed, setInspectPassed] = useState<boolean>(true);
  const [inspectNotes, setInspectNotes] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [completeNotes, setCompleteNotes] = useState<string>('');
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------

  // 1. All housekeeping tasks
  const {
    data: tasksRes,
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['housekeeping-tasks'],
    queryFn: () => housekeepingApi.getAll({ limit: 100 }),
    staleTime: 10000,
  });

  // 2. Dirty rooms queue
  const {
    data: dirtyRoomsRes,
    isLoading: isDirtyLoading,
    refetch: refetchDirtyRooms,
  } = useQuery({
    queryKey: ['dirty-rooms'],
    queryFn: () => housekeepingApi.getDirtyRooms({ limit: 100 }),
    staleTime: 10000,
  });

  // 3. Room types for metadata enrichment
  const { data: roomTypesRes } = useQuery({
    queryKey: ['room-types-lookup'],
    queryFn: () => roomTypesApi.getAll(),
    staleTime: 60000,
  });

  // 4. Detailed task with history
  const {
    data: taskDetailRes,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['housekeeping-task-detail', selectedTaskForDetail?.id],
    queryFn: () =>
      selectedTaskForDetail?.id
        ? housekeepingApi.getById(selectedTaskForDetail.id)
        : Promise.resolve({ success: true, message: '', data: null as any }),
    enabled: !!selectedTaskForDetail?.id && isDetailDrawerOpen,
  });

  const rawTasks = tasksRes?.data;
  const taskList: HousekeepingTaskItem[] = Array.isArray(rawTasks)
    ? rawTasks
    : (rawTasks as any)?.items || [];

  const rawDirty = dirtyRoomsRes?.data;
  const dirtyRoomList: DirtyRoomItem[] = Array.isArray(rawDirty)
    ? rawDirty
    : (rawDirty as any)?.items || [];

  const rawRoomTypes = roomTypesRes?.data;
  const roomTypesList = Array.isArray(rawRoomTypes)
    ? rawRoomTypes
    : (rawRoomTypes as any)?.items || [];

  const getRoomTypeName = (roomTypeId: string) => {
    const found = roomTypesList.find((rt: any) => String(rt.id) === String(roomTypeId));
    return found ? found.name : `Hạng #${roomTypeId}`;
  };

  const getStaffName = (staffId: string | number | null | undefined) => {
    if (!staffId) return null;
    const staff = getStaffDisplay(staffId, user);
    return staff.fullName;
  };

  // ----------------------------------------------------
  // MUTATIONS
  // ----------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (dto: CreateHousekeepingTaskDto) => housekeepingApi.create(dto),
    onSuccess: () => {
      message.success('Đã tạo nhiệm vụ dọn phòng thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dirty-rooms'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể tạo nhiệm vụ dọn phòng.');
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      housekeepingApi.assign(id, { staffId }),
    onSuccess: () => {
      message.success('Phân công nhân viên buồng phòng thành công!');
      setIsAssignModalOpen(false);
      setActionTask(null);
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      if (selectedTaskForDetail) refetchDetail();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể phân công nhân viên.');
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.start(id),
    onSuccess: () => {
      message.success('Đã bắt đầu dọn phòng! Trạng thái phòng: CLEANING.');
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (selectedTaskForDetail) refetchDetail();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể bắt đầu dọn phòng.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      housekeepingApi.complete(id, notes),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu nghiệm thu! Trạng thái phòng: INSPECTION.');
      setIsCompleteModalOpen(false);
      setCompleteNotes('');
      setActionTask(null);
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (selectedTaskForDetail) refetchDetail();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể hoàn thành dọn phòng.');
    },
  });

  const inspectMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: InspectHousekeepingTaskDto }) =>
      housekeepingApi.inspect(id, dto),
    onSuccess: (_, variables) => {
      if (variables.dto.passed) {
        message.success('Nghiệm thu ĐẠT! Phòng đã chuyển sang trạng thái READY (Sạch sẽ).');
      } else {
        message.warning('Đã từ chối nghiệm thu. Nhiệm vụ quay về PENDING và phòng về DIRTY.');
      }
      setIsInspectModalOpen(false);
      setInspectNotes('');
      setActionTask(null);
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dirty-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (selectedTaskForDetail) refetchDetail();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể ghi nhận kết quả nghiệm thu.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      housekeepingApi.cancel(id, { reason }),
    onSuccess: () => {
      message.info('Đã hủy nhiệm vụ dọn phòng. Phòng giữ nguyên trạng thái DIRTY.');
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActionTask(null);
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dirty-rooms'] });
      if (selectedTaskForDetail) refetchDetail();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể hủy nhiệm vụ.');
    },
  });

  // ----------------------------------------------------
  // KANBAN COLUMNS
  // ----------------------------------------------------

  const pendingTasks = taskList.filter((t) => t.status === 'PENDING');
  const inProgressTasks = taskList.filter((t) => t.status === 'IN_PROGRESS');
  const awaitingTasks = taskList.filter((t) => t.status === 'AWAITING_INSPECTION');
  const completedTasks = taskList.filter((t) => t.status === 'COMPLETED');

  // Priority Tag Renderer
  const renderPriorityTag = (priority: HousekeepingPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <Tag color="#ff4d4f" style={{ fontWeight: 600 }}>
            <ExclamationCircleOutlined /> Khẩn cấp
          </Tag>
        );
      case 'HIGH':
        return (
          <Tag color="#fa8c16" style={{ fontWeight: 600 }}>
            Ưu tiên cao
          </Tag>
        );
      case 'NORMAL':
        return <Tag color="#1677ff">Bình thường</Tag>;
      case 'LOW':
        return <Tag color="#8c8c8c">Ưu tiên thấp</Tag>;
      default:
        return <Tag>{priority}</Tag>;
    }
  };

  // Status Tag Renderer
  const renderStatusTag = (status: HousekeepingTaskStatus) => {
    switch (status) {
      case 'PENDING':
        return <Tag color="warning">Chờ xử lý (DIRTY)</Tag>;
      case 'IN_PROGRESS':
        return <Tag color="processing">Đang dọn (CLEANING)</Tag>;
      case 'AWAITING_INSPECTION':
        return <Tag color="purple">Chờ kiểm tra (INSPECTION)</Tag>;
      case 'COMPLETED':
        return <Tag color="success">Đã hoàn thành (READY)</Tag>;
      case 'CANCELLED':
        return <Tag color="default">Đã hủy</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // ----------------------------------------------------
  // DIRTY ROOMS TABLE COLUMNS
  // ----------------------------------------------------

  const dirtyRoomColumns: ColumnsType<DirtyRoomItem> = [
    {
      title: 'Số phòng',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      width: 140,
      render: (num: string) => (
        <Space orientation="horizontal" size={6}>
          <HomeOutlined style={{ color: '#1b4d3e', fontSize: 16 }} />
          <Text strong style={{ fontSize: 16, color: '#1b4d3e' }}>
            #{num}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Tầng',
      dataIndex: 'floorNumber',
      key: 'floorNumber',
      width: 100,
      render: (floor: number) => <Tag color="blue">Tầng {floor}</Tag>,
    },
    {
      title: 'Hạng phòng',
      dataIndex: 'roomTypeId',
      key: 'roomTypeId',
      render: (rtId: string) => <Text>{getRoomTypeName(rtId)}</Text>,
    },
    {
      title: 'Trạng thái Buồng phòng',
      dataIndex: 'housekeepingStatus',
      key: 'housekeepingStatus',
      width: 180,
      render: () => (
        <Badge
          status="error"
          text={<Text strong style={{ color: '#cf1322' }}>DIRTY: Cần dọn dẹp</Text>}
        />
      ),
    },
    {
      title: 'Trạng thái vận hành',
      dataIndex: 'physicalStatus',
      key: 'physicalStatus',
      width: 160,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>
          {status === 'ACTIVE' ? 'Vận hành tốt' : 'Bảo trì / Khóa'}
        </Tag>
      ),
    },
    {
      title: 'Nhiệm vụ buồng phòng',
      key: 'taskActive',
      width: 220,
      render: (_, record) => {
        const existingTask = taskList.find(
          (t) => String(t.roomId) === String(record.id) && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
        );
        if (existingTask) {
          return (
            <Space orientation="vertical" size={2}>
              {renderStatusTag(existingTask.status)}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {existingTask.assignedTo
                  ? `Người dọn: ${getStaffName(existingTask.assignedTo)}`
                  : 'Chưa phân công'}
              </Text>
            </Space>
          );
        }
        return <Text type="secondary">Chưa có lệnh dọn</Text>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_, record) => {
        const existingTask = taskList.find(
          (t) => String(t.roomId) === String(record.id) && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
        );
        if (existingTask) {
          return (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedTaskForDetail(existingTask);
                setIsDetailDrawerOpen(true);
              }}
            >
              Xem nhiệm vụ
            </Button>
          );
        }
        return canCreateTask ? (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
            onClick={() => {
              createForm.setFieldsValue({
                roomId: String(record.id),
                priority: 'NORMAL',
                notes: undefined,
              });
              setIsCreateModalOpen(true);
            }}
          >
            Tạo việc dọn
          </Button>
        ) : null;
      },
    },
  ];

  // ----------------------------------------------------
  // TASK CARD COMPONENT FOR KANBAN
  // ----------------------------------------------------

  const renderTaskCard = (task: HousekeepingTaskItem) => {
    const isAssignedToMe = String(task.assignedTo) === String(user?.id);
    const canStartOrComplete = isAssignedToMe || (isAdminOrManager && isAssignedToMe);

    return (
      <Card
        key={task.id}
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          border: '1px solid #e8e8e8',
          borderLeft:
            task.priority === 'URGENT'
              ? '4px solid #ff4d4f'
              : task.priority === 'HIGH'
              ? '4px solid #fa8c16'
              : '4px solid #1677ff',
        }}
      >
        {/* Header: Room & Priority */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space>
            <Tag color="#1b4d3e" style={{ fontSize: 14, fontWeight: 700, padding: '2px 8px' }}>
              #{task.room.roomNumber}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tầng {task.room.floorNumber}
            </Text>
          </Space>
          {renderPriorityTag(task.priority)}
        </div>

        {/* Room Type */}
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13, color: '#262626' }}>
            {getRoomTypeName(task.room.roomTypeId)}
          </Text>
        </div>

        {/* Assigned Staff */}
        <div style={{ marginBottom: 8 }}>
          <Space size={6} wrap>
            <UserOutlined style={{ color: task.assignedTo ? '#1b4d3e' : '#8c8c8c' }} />
            {task.assignedTo ? (() => {
              const staff = getStaffDisplay(task.assignedTo, user);
              return (
                <Space size={4}>
                  <Text strong style={{ fontSize: 12, color: '#1b4d3e' }}>
                    {staff.fullName}
                  </Text>
                  <Tag
                    color={staff.color}
                    style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '18px' }}
                  >
                    {staff.roleTitle}
                  </Tag>
                </Space>
              );
            })() : (
              <Tag color="orange" style={{ fontSize: 11 }}>
                Chưa phân công
              </Tag>
            )}
          </Space>
        </div>

        {/* Notes preview if any */}
        {task.notes && (
          <Paragraph
            ellipsis={{ rows: 2 }}
            type="secondary"
            style={{ fontSize: 12, marginBottom: 8, background: '#fafafa', padding: 6, borderRadius: 4 }}
          >
            💬 {task.notes}
          </Paragraph>
        )}

        {/* Timestamps */}
        <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>
          <div>Tạo: {dayjs(task.createdAt).format('DD/MM/YYYY HH:mm')}</div>
          {task.startedAt && <div>Bắt đầu: {dayjs(task.startedAt).format('DD/MM/YYYY HH:mm')}</div>}
          {task.completedAt && <div>Xong: {dayjs(task.completedAt).format('DD/MM/YYYY HH:mm')}</div>}
        </div>

        {/* Action Buttons Footer */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTaskForDetail(task);
              setIsDetailDrawerOpen(true);
            }}
          >
            Lịch sử
          </Button>

          {/* Contextual Action Buttons */}
          {task.status === 'PENDING' && (
            <Space size={4}>
              {isAdminOrManager && (
                <Tooltip title="Phân công nhân viên dọn phòng">
                  <Button
                    size="small"
                    icon={<UserSwitchOutlined />}
                    onClick={() => {
                      setActionTask(task);
                      setAssignStaffId(task.assignedTo ? String(task.assignedTo) : (housekeepingOptions[0]?.value || ''));
                      setIsAssignModalOpen(true);
                    }}
                  >
                    Phân công
                  </Button>
                </Tooltip>
              )}

              {canStartOrComplete && (
                <Tooltip title="Bắt đầu dọn phòng (chuyển sang CLEANING)">
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                    loading={startMutation.isPending}
                    onClick={() => startMutation.mutate(task.id)}
                  >
                    Bắt đầu
                  </Button>
                </Tooltip>
              )}

              {isAdminOrManager && (
                <Tooltip title="Hủy nhiệm vụ dọn phòng">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setActionTask(task);
                      setCancelReason('');
                      setIsCancelModalOpen(true);
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          )}

          {task.status === 'IN_PROGRESS' && (
            <Space size={4}>
              {canStartOrComplete && (
                <Tooltip title="Báo cáo hoàn thành & gửi yêu cầu nghiệm thu">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: '#722ed1', borderColor: '#722ed1' }}
                    onClick={() => {
                      setActionTask(task);
                      setCompleteNotes('');
                      setIsCompleteModalOpen(true);
                    }}
                  >
                    Báo dọn xong
                  </Button>
                </Tooltip>
              )}

              {isAdminOrManager && (
                <Tooltip title="Hủy nhiệm vụ dọn phòng">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setActionTask(task);
                      setCancelReason('');
                      setIsCancelModalOpen(true);
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          )}

          {task.status === 'AWAITING_INSPECTION' && (
            <Space size={4}>
              {isAdminOrManager ? (
                <Button
                  size="small"
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setActionTask(task);
                    setInspectPassed(true);
                    setInspectNotes('');
                    setIsInspectModalOpen(true);
                  }}
                >
                  Nghiệm thu
                </Button>
              ) : (
                <Tag color="purple">Chờ quản lý duyệt</Tag>
              )}
            </Space>
          )}

          {task.status === 'COMPLETED' && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Sẵn sàng (READY)
            </Tag>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: '0 8px 32px 8px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: '#1b4d3e' }}>
            Quản lý Buồng phòng (Housekeeping Operations)
          </Title>
          <Text type="secondary">
            Chu trình dọn dẹp vệ sinh: Chờ dọn (DIRTY) ➔ Đang dọn (CLEANING) ➔ Kiểm tra (INSPECTION) ➔ Đạt chuẩn (READY).
          </Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchTasks();
              refetchDirtyRooms();
              message.info('Đã làm mới dữ liệu buồng phòng.');
            }}
          >
            Làm mới
          </Button>

          {canCreateTask && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
              onClick={() => {
                createForm.resetFields();
                setIsCreateModalOpen(true);
              }}
            >
              Tạo việc dọn phòng
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
              Chờ dọn dẹp (Pending)
            </Text>
            <Title level={2} style={{ margin: '4px 0 0', color: '#d48806' }}>
              {pendingTasks.length}
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
              Đang làm vệ sinh (In-Progress)
            </Text>
            <Title level={2} style={{ margin: '4px 0 0', color: '#096dd9' }}>
              {inProgressTasks.length}
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
              Chờ nghiệm thu (Inspection)
            </Text>
            <Title level={2} style={{ margin: '4px 0 0', color: '#722ed1' }}>
              {awaitingTasks.length}
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
              Đã hoàn thành (Ready)
            </Text>
            <Title level={2} style={{ margin: '4px 0 0', color: '#389e0d' }}>
              {completedTasks.length}
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        type="card"
        items={[
          {
            key: 'kanban',
            label: (
              <span>
                <SyncOutlined /> Bảng tiến độ Kanban ({taskList.length})
              </span>
            ),
            children: (
              <div>
                {isTasksLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <Row gutter={[16, 16]}>
                    {/* Column 1: Pending */}
                    <Col xs={24} md={6}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <Badge status="warning" />
                            <Text strong>1. Chờ xử lý ({pendingTasks.length})</Text>
                          </Space>
                        }
                        style={{
                          background: '#fafafa',
                          borderRadius: 8,
                          minHeight: 500,
                          borderTop: '3px solid #faad14',
                        }}
                      >
                        {pendingTasks.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có phòng chờ dọn" />
                        ) : (
                          pendingTasks.map(renderTaskCard)
                        )}
                      </Card>
                    </Col>

                    {/* Column 2: In Progress */}
                    <Col xs={24} md={6}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <Badge status="processing" />
                            <Text strong>2. Đang dọn dẹp ({inProgressTasks.length})</Text>
                          </Space>
                        }
                        style={{
                          background: '#fafafa',
                          borderRadius: 8,
                          minHeight: 500,
                          borderTop: '3px solid #1677ff',
                        }}
                      >
                        {inProgressTasks.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có phòng đang dọn" />
                        ) : (
                          inProgressTasks.map(renderTaskCard)
                        )}
                      </Card>
                    </Col>

                    {/* Column 3: Awaiting Inspection */}
                    <Col xs={24} md={6}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <Badge color="#722ed1" />
                            <Text strong>3. Chờ kiểm tra ({awaitingTasks.length})</Text>
                          </Space>
                        }
                        style={{
                          background: '#fafafa',
                          borderRadius: 8,
                          minHeight: 500,
                          borderTop: '3px solid #722ed1',
                        }}
                      >
                        {awaitingTasks.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có phòng chờ duyệt" />
                        ) : (
                          awaitingTasks.map(renderTaskCard)
                        )}
                      </Card>
                    </Col>

                    {/* Column 4: Completed */}
                    <Col xs={24} md={6}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <Badge status="success" />
                            <Text strong>4. Đạt chuẩn (READY) ({completedTasks.length})</Text>
                          </Space>
                        }
                        style={{
                          background: '#fafafa',
                          borderRadius: 8,
                          minHeight: 500,
                          borderTop: '3px solid #52c41a',
                        }}
                      >
                        {completedTasks.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phòng hoàn tất" />
                        ) : (
                          completedTasks.slice(0, 15).map(renderTaskCard)
                        )}
                      </Card>
                    </Col>
                  </Row>
                )}
              </div>
            ),
          },
          {
            key: 'dirtyQueue',
            label: (
              <span>
                <WarningOutlined style={{ color: '#cf1322' }} /> Hàng đợi phòng bẩn ({dirtyRoomList.length})
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Danh sách các phòng vật lý đang ở trạng thái DIRTY trên hệ thống"
                  description="Phòng tự động chuyển sang DIRTY sau khi khách Check-out, Đổi phòng (Transfer), hoặc khi Lệnh bảo trì được giải phóng. Bạn có thể bấm 'Tạo việc dọn' để kích hoạt chu trình dọn dẹp cho phòng."
                  style={{ marginBottom: 16 }}
                />
                <Table
                  columns={dirtyRoomColumns}
                  dataSource={dirtyRoomList}
                  rowKey="id"
                  loading={isDirtyLoading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ---------------------------------------------------- */}
      {/* CREATE HOUSEKEEPING TASK MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: '#1b4d3e' }} />
            <span>Tạo nhiệm vụ dọn buồng phòng mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Tạo nhiệm vụ"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ priority: 'NORMAL' }}
          onFinish={(values) => {
            const payload: CreateHousekeepingTaskDto = {
              roomId: values.roomId,
              priority: values.priority,
              notes: values.notes?.trim() ? values.notes.trim() : undefined,
            };
            createMutation.mutate(payload);
          }}
        >
          <Form.Item
            name="roomId"
            label="Chọn phòng cần dọn (Chỉ hiển thị phòng DIRTY)"
            rules={[{ required: true, message: 'Vui lòng chọn phòng cần dọn dẹp' }]}
          >
            <Select
              placeholder="Chọn số phòng..."
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={dirtyRoomList.map((r) => ({
                value: String(r.id),
                label: `Phòng #${r.roomNumber} (Tầng ${r.floorNumber} - ${getRoomTypeName(r.roomTypeId)}) [DIRTY]`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Mức độ ưu tiên"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'URGENT', label: '🔴 Khẩn cấp (Ưu tiên khách check-in sớm)' },
                { value: 'HIGH', label: '🟠 Ưu tiên cao' },
                { value: 'NORMAL', label: '🔵 Bình thường' },
                { value: 'LOW', label: '⚪ Ưu tiên thấp' },
              ]}
            />
          </Form.Item>

          <div style={{ paddingBottom: 16 }}>
            <Form.Item name="notes" label="Ghi chú dọn phòng">
              <Input.TextArea
                rows={3}
                placeholder="VD: Khách yêu cầu thay toàn bộ drap giường mới, bổ sung thêm khăn tắm, trà cafe..."
                maxLength={2000}
                showCount
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* ASSIGN STAFF MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <UserSwitchOutlined style={{ color: '#1b4d3e' }} />
            <span>Phân công nhân viên buồng phòng — Phòng #{actionTask?.room.roomNumber}</span>
          </Space>
        }
        open={isAssignModalOpen}
        onCancel={() => {
          setIsAssignModalOpen(false);
          setActionTask(null);
        }}
        onOk={() => {
          if (actionTask) {
            assignMutation.mutate({ id: actionTask.id, staffId: assignStaffId });
          }
        }}
        okText="Xác nhận phân công"
        cancelText="Đóng"
        confirmLoading={assignMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type="info"
            showIcon
            message="Chính sách phân công"
            description="Chỉ nhân viên thuộc vai trò Buồng phòng (HOUSEKEEPING), Quản lý (MANAGER) hoặc Quản trị viên (ADMIN) mới hợp lệ để nhận nhiệm vụ."
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Chọn nhân viên phụ trách: <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <Select
              value={assignStaffId}
              onChange={(val) => setAssignStaffId(val)}
              style={{ width: '100%' }}
              options={housekeepingOptions}
            />
          </div>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* COMPLETE TASK MODAL (SUBMIT FOR INSPECTION) */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#722ed1' }} />
            <span>Hoàn thành dọn dẹp & Gửi kiểm tra — Phòng #{actionTask?.room.roomNumber}</span>
          </Space>
        }
        open={isCompleteModalOpen}
        onCancel={() => {
          setIsCompleteModalOpen(false);
          setActionTask(null);
        }}
        onOk={() => {
          if (actionTask) {
            completeMutation.mutate({
              id: actionTask.id,
              notes: completeNotes.trim() ? completeNotes.trim() : undefined,
            });
          }
        }}
        okText="Gửi nghiệm thu"
        cancelText="Hủy"
        confirmLoading={completeMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type="info"
            showIcon
            message="Xác nhận hoàn tất vệ sinh"
            description="Sau khi gửi, trạng thái phòng sẽ chuyển sang INSPECTION (Chờ kiểm tra). Quản lý hoặc Giám sát buồng phòng sẽ tiến hành nghiệm thu thực tế trước khi phòng chuyển thành READY."
          />

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Ghi chú công việc đã làm (tùy chọn):
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="VD: Đã hút bụi, khử khuẩn, thay mới toàn bộ chăn ga gối, kiểm tra minibar..."
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* INSPECTION MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: inspectPassed ? '#52c41a' : '#ff4d4f' }} />
            <span>Nghiệm thu chất lượng buồng phòng — Phòng #{actionTask?.room.roomNumber}</span>
          </Space>
        }
        open={isInspectModalOpen}
        onCancel={() => {
          setIsInspectModalOpen(false);
          setActionTask(null);
        }}
        onOk={() => {
          if (!inspectPassed && !inspectNotes.trim()) {
            message.error('Khi từ chối nghiệm thu, bắt buộc phải nhập lý do/yêu cầu dọn lại!');
            return;
          }
          if (actionTask) {
            inspectMutation.mutate({
              id: actionTask.id,
              dto: { passed: inspectPassed, notes: inspectNotes.trim() || undefined },
            });
          }
        }}
        okText={inspectPassed ? 'Xác nhận Đạt (Chuyển READY)' : 'Xác nhận Không đạt (Dọn lại)'}
        okButtonProps={{ danger: !inspectPassed }}
        cancelText="Đóng"
        confirmLoading={inspectMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type={inspectPassed ? 'success' : 'warning'}
            showIcon
            message="Quy chuẩn nghiệm thu buồng phòng"
            description={
              inspectPassed
                ? 'Nếu ĐẠT: Phòng sẽ ngay lập tức chuyển sang trạng thái READY (Sạch sẽ) và sẵn sàng đón khách nhận phòng.'
                : 'Nếu KHÔNG ĐẠT: Nhiệm vụ sẽ quay về trạng thái PENDING và phòng quay về DIRTY để nhân viên làm lại.'
            }
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Kết quả nghiệm thu:
            </Text>
            <Radio.Group
              value={inspectPassed}
              onChange={(e) => setInspectPassed(e.target.value)}
              size="middle"
            >
              <Radio.Button value={true} style={{ color: '#389e0d' }}>
                <CheckOutlined /> Đạt chuẩn (Pass)
              </Radio.Button>
              <Radio.Button value={false} style={{ color: '#cf1322' }}>
                <CloseOutlined /> Chưa đạt (Reject)
              </Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Ghi chú nghiệm thu {inspectPassed ? '(tùy chọn)' : <span style={{ color: '#ff4d4f' }}>* (Bắt buộc)</span>}:
            </Text>
            <Input.TextArea
              rows={3}
              placeholder={
                inspectPassed
                  ? 'Ghi chú kiểm tra (VD: Phòng thơm, đầy đủ vật phẩm, minibar niêm phong chuẩn)'
                  : 'Vui lòng nêu rõ lý do không đạt (VD: Bồn tắm còn vệt nước, chưa lau bụi bàn trang điểm)'
              }
              value={inspectNotes}
              onChange={(e) => setInspectNotes(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* CANCEL TASK MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Hủy nhiệm vụ buồng phòng — Phòng #{actionTask?.room.roomNumber}</span>
          </Space>
        }
        open={isCancelModalOpen}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setActionTask(null);
        }}
        onOk={() => {
          if (!cancelReason.trim()) {
            message.error('Vui lòng nhập lý do hủy nhiệm vụ!');
            return;
          }
          if (actionTask) {
            cancelMutation.mutate({ id: actionTask.id, reason: cancelReason.trim() });
          }
        }}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={cancelMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            message="Hành động hủy nhiệm vụ"
            description="Khi hủy, nhiệm vụ sẽ kết thúc và phòng vẫn duy trì trạng thái DIRTY. Thao tác này giải phóng vị trí nhiệm vụ hoạt động để có thể tạo nhiệm vụ khác sau này."
          />

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Lý do hủy nhiệm vụ: <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="VD: Kế hoạch thay đổi, phòng chuyển sang sửa chữa bảo trì, nhân viên phân công nhầm..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* TASK DETAIL & AUDIT LOG DRAWER */}
      {/* ---------------------------------------------------- */}
      <Drawer
        title={
          <Space>
            <HomeOutlined style={{ color: '#1b4d3e' }} />
            <span>Chi tiết Nhiệm vụ Buồng phòng #{selectedTaskForDetail?.id}</span>
          </Space>
        }
        placement="right"
        width={560}
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedTaskForDetail(null);
        }}
      >
        {isDetailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : taskDetailRes?.data ? (
          <div>
            {/* Overview Card */}
            <Card size="small" style={{ marginBottom: 20, borderRadius: 8, background: '#fafafa' }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Số phòng:</Text>
                  <div>
                    <Tag color="#1b4d3e" style={{ fontSize: 16, fontWeight: 700, padding: '2px 8px' }}>
                      #{taskDetailRes.data.room.roomNumber}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Trạng thái:</Text>
                  <div>{renderStatusTag(taskDetailRes.data.status)}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Hạng phòng:</Text>
                  <div>
                    <Text strong>{getRoomTypeName(taskDetailRes.data.room.roomTypeId)}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Mức độ ưu tiên:</Text>
                  <div>{renderPriorityTag(taskDetailRes.data.priority)}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Người được phân công:</Text>
                  <div>
                    {taskDetailRes.data.assignedTo ? (() => {
                      const staff = getStaffDisplay(taskDetailRes.data.assignedTo, user);
                      return (
                        <Space size={4}>
                          <Text strong style={{ color: '#1b4d3e' }}>{staff.fullName}</Text>
                          <Tag color={staff.color} style={{ fontSize: 11 }}>{staff.roleTitle}</Tag>
                        </Space>
                      );
                    })() : (
                      <Tag color="orange">Chưa phân công</Tag>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Thời điểm tạo:</Text>
                  <div>{dayjs(taskDetailRes.data.createdAt).format('DD/MM/YYYY HH:mm')}</div>
                </Col>
              </Row>
            </Card>

            {/* Audit Log Timeline */}
            <Title level={5} style={{ marginBottom: 16 }}>
              Dòng thời gian kiểm toán (Operations Audit Log)
            </Title>

            {taskDetailRes.data.history && taskDetailRes.data.history.length > 0 ? (
              <Timeline
                items={taskDetailRes.data.history.map((log) => {
                  const actionMeta = getHousekeepingActionDisplay(log.action);
                  const actor = getStaffDisplay(log.actorId, user);
                  const isSuccess = log.action.includes('PASSED') || log.toStatus === 'COMPLETED';
                  const isFailOrCancel = log.action.includes('FAILED') || log.action.includes('CANCEL');
                  const timelineColor = isSuccess ? 'green' : isFailOrCancel ? 'red' : 'blue';

                  return {
                    color: timelineColor,
                    children: (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tag color={actionMeta.color} style={{ margin: 0, fontWeight: 600 }}>
                            {actionMeta.label}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(log.createdAt).format('DD/MM/YYYY HH:mm:ss')}
                          </Text>
                        </div>

                        <div style={{ fontSize: 12, color: '#595959', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Người thực hiện:</span>
                          <Text strong>{actor.fullName}</Text>
                          <Tag color={actor.color} style={{ fontSize: 11, margin: 0 }}>
                            {actor.roleTitle}
                          </Tag>
                        </div>

                        {log.fromStatus && (
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                            Trạng thái: {log.fromStatus} ➔ <Tag color="blue">{log.toStatus}</Tag>
                          </div>
                        )}

                        {log.notes && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '6px 10px',
                              background: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              borderRadius: 4,
                              fontSize: 12,
                              color: '#262626',
                            }}
                          >
                            💬 {formatAuditNote(log.notes)}
                          </div>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="Chưa có dữ liệu lịch sử" />
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};
