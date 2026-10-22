import React, { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Tabs,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Timeline,
  Alert,
  Tooltip,
  App as AntdApp,
  Table,
  DatePicker,
  Spin,
  Grid,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloseOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { DebouncedSearchInput } from "../../components/DebouncedSearchInput.tsx";
import { maintenanceApi } from "../../api/maintenance.api.ts";
import { roomsApi, roomTypesApi } from "../../api/rooms.api.ts";
import { employeesApi } from "../../api/employees.api.ts";
import { useAuthStore } from "../../store/authStore.ts";
import {
  getStaffDisplay,
  getMaintenanceActionDisplay,
  formatAuditNote,
  registerStaffMembers,
} from "../../utils/staffDirectory.ts";
import type {
  MaintenanceTicketItem,
  MaintenanceBlockItem,
  MaintenancePriority,
  MaintenanceTicketStatus,
  MaintenanceBlockStatus,
  CreateMaintenanceTicketDto,
  CreateMaintenanceBlockDto,
} from "../../types/operations.types.ts";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ResolveTicketModalProps {
  open: boolean;
  ticket: MaintenanceTicketItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}

const ResolveTicketModal: React.FC<ResolveTicketModalProps> = React.memo(
  ({ open, ticket, confirmLoading, onCancel, onConfirm }) => {
    const { message: appMessage } = AntdApp.useApp();
    const [notes, setNotes] = useState<string>("");
    const [prevOpen, setPrevOpen] = useState(open);

    if (open && !prevOpen) {
      setPrevOpen(true);
      setNotes("");
    } else if (!open && prevOpen) {
      setPrevOpen(false);
    }

    const handleOk = () => {
      if (!notes.trim()) {
        appMessage.error("Vui lòng nhập ghi chú kết quả sửa chữa!");
        return;
      }
      onConfirm(notes.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#722ed1" }} />
            <span>Báo cáo hoàn thành sửa chữa — Phiếu #{ticket?.id}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okText="Gửi báo cáo hoàn thành"
        cancelText="Đóng"
        confirmLoading={confirmLoading}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <Alert
            type="info"
            showIcon
            title="Báo cáo kỹ thuật"
            description="Sau khi gửi, phiếu sẽ chuyển sang RESOLVED (Đã sửa xong). Quản lý hoặc Giám sát sẽ kiểm tra nghiệm thu trước khi đóng phiếu."
          />

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              Ghi chú kết quả sửa chữa:{" "}
              <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="VD: Đã thay thế van cấp nước mới, kiểm tra áp lực nước bình thường, vệ sinh lưới lọc điều hòa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  },
);

interface CancelTicketModalProps {
  open: boolean;
  ticket: MaintenanceTicketItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const CancelTicketModal: React.FC<CancelTicketModalProps> = React.memo(
  ({ open, ticket, confirmLoading, onCancel, onConfirm }) => {
    const { message: appMessage } = AntdApp.useApp();
    const [reason, setReason] = useState<string>("");
    const [prevOpen, setPrevOpen] = useState(open);

    if (open && !prevOpen) {
      setPrevOpen(true);
      setReason("");
    } else if (!open && prevOpen) {
      setPrevOpen(false);
    }

    const handleOk = () => {
      if (!reason.trim()) {
        appMessage.error("Vui lòng nhập lý do hủy phiếu sự cố!");
        return;
      }
      onConfirm(reason.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
            <span>Hủy phiếu sự cố #{ticket?.id}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okText="Xác nhận Hủy phiếu"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={confirmLoading}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              Lý do hủy phiếu: <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="VD: Khách báo nhầm, sự cố tự khắc phục, tạo trùng phiếu..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  },
);

interface ReleaseBlockModalProps {
  open: boolean;
  block: MaintenanceBlockItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}

const ReleaseBlockModal: React.FC<ReleaseBlockModalProps> = React.memo(
  ({ open, block, confirmLoading, onCancel, onConfirm }) => {
    const { message: appMessage } = AntdApp.useApp();
    const [notes, setNotes] = useState<string>("");
    const [prevOpen, setPrevOpen] = useState(open);

    if (open && !prevOpen) {
      setPrevOpen(true);
      setNotes("");
    } else if (!open && prevOpen) {
      setPrevOpen(false);
    }

    const handleOk = () => {
      if (!notes.trim()) {
        appMessage.error("Vui lòng nhập ghi chú xác nhận an toàn kỹ thuật!");
        return;
      }
      onConfirm(notes.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <UnlockOutlined style={{ color: "#52c41a" }} />
            <span>Mở khóa phòng Bảo trì — Phòng #{block?.room.roomNumber}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okText="Xác nhận Mở khóa"
        cancelText="Đóng"
        confirmLoading={confirmLoading}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <Alert
            type="info"
            showIcon
            title="Nghiệp vụ giải phóng bảo trì"
            description="Khi xác nhận mở khóa: Hệ thống sẽ khôi phục trạng thái vật lý ACTIVE cho phòng. Đồng thời phòng sẽ tự động chuyển sang trạng thái DIRTY và kích hoạt một nhiệm vụ Buồng phòng để nhân viên làm vệ sinh sạch sẽ trước khi đón khách."
          />

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              Ghi chú xác nhận an toàn kỹ thuật:{" "}
              <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="VD: Kiểm tra toàn bộ thiết bị điện, nước, điều hòa hoạt động an toàn; đã bàn giao chìa khóa cho buồng phòng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  },
);

interface CancelBlockModalProps {
  open: boolean;
  block: MaintenanceBlockItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const CancelBlockModal: React.FC<CancelBlockModalProps> = React.memo(
  ({ open, block, confirmLoading, onCancel, onConfirm }) => {
    const { message: appMessage } = AntdApp.useApp();
    const [reason, setReason] = useState<string>("");
    const [prevOpen, setPrevOpen] = useState(open);

    if (open && !prevOpen) {
      setPrevOpen(true);
      setReason("");
    } else if (!open && prevOpen) {
      setPrevOpen(false);
    }

    const handleOk = () => {
      if (!reason.trim()) {
        appMessage.error("Vui lòng nhập lý do hủy lệnh bảo trì!");
        return;
      }
      onConfirm(reason.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
            <span>Hủy lệnh Bảo trì tương lai — Lệnh BLK#{block?.id}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okText="Xác nhận Hủy lệnh"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={confirmLoading}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              Lý do hủy lệnh bảo trì:{" "}
              <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="VD: Hoãn kế hoạch nâng cấp, ưu tiên phục vụ đoàn khách lớn..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  },
);

// Dynamic Technician Options loaded from employeesApi

const renderPriorityTag = (p: MaintenancePriority) => {
  switch (p) {
    case "CRITICAL":
      return (
        <Tag color="#ff4d4f" style={{ fontWeight: 700 }}>
          <ExclamationCircleOutlined /> Khẩn cấp
        </Tag>
      );
    case "HIGH":
      return (
        <Tag color="#fa8c16" style={{ fontWeight: 600 }}>
          Ưu tiên cao
        </Tag>
      );
    case "NORMAL":
      return <Tag color="#1677ff">Bình thường</Tag>;
    case "LOW":
      return <Tag color="#8c8c8c">Thấp</Tag>;
    default:
      return <Tag>{p}</Tag>;
  }
};

const renderTicketStatusTag = (s: MaintenanceTicketStatus) => {
  switch (s) {
    case "OPEN":
      return <Tag color="error">Mới báo cáo (OPEN)</Tag>;
    case "ASSIGNED":
      return <Tag color="warning">Đã phân công (ASSIGNED)</Tag>;
    case "IN_PROGRESS":
      return <Tag color="processing">Đang sửa chữa (IN_PROGRESS)</Tag>;
    case "RESOLVED":
      return <Tag color="purple">Đã sửa xong (RESOLVED)</Tag>;
    case "CLOSED":
      return <Tag color="success">Đã nghiệm thu (CLOSED)</Tag>;
    case "CANCELLED":
      return <Tag color="default">Đã hủy</Tag>;
    default:
      return <Tag>{s}</Tag>;
  }
};

const renderBlockStatusTag = (s: MaintenanceBlockStatus) => {
  switch (s) {
    case "ACTIVE":
      return (
        <Tag color="error" icon={<LockOutlined />}>
          Đang khóa sửa chữa (ACTIVE)
        </Tag>
      );
    case "SCHEDULED":
      return (
        <Tag color="warning" icon={<ClockCircleOutlined />}>
          Đã lên lịch (SCHEDULED)
        </Tag>
      );
    case "RELEASED":
      return (
        <Tag color="success" icon={<UnlockOutlined />}>
          Đã mở khóa (RELEASED)
        </Tag>
      );
    case "CANCELLED":
      return <Tag color="default">Đã hủy</Tag>;
    default:
      return <Tag>{s}</Tag>;
  }
};

export const MaintenancePage: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdminOrManager = ["ADMIN", "MANAGER"].includes(user?.role || "");
  const canReportTicket = [
    "ADMIN",
    "MANAGER",
    "RECEPTIONIST",
    "HOUSEKEEPING",
    "TECHNICIAN",
  ].includes(user?.role || "");
  const canManageBlocks = isAdminOrManager;

  // Tabs state
  const [activeTab, setActiveTab] = useState<string>("tickets");

  // Filter States for Tickets
  const [ticketSearch, setTicketSearch] = useState<string>("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<
    MaintenanceTicketStatus | undefined
  >(undefined);
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<
    MaintenancePriority | undefined
  >(undefined);
  const [ticketPageSize, setTicketPageSize] = useState<number>(10);

  // Filter States for Blocks
  const [blockStatusFilter, setBlockStatusFilter] = useState<
    MaintenanceBlockStatus | undefined
  >(undefined);
  const [blockPageSize, setBlockPageSize] = useState<number>(10);

  // Detail Drawers
  const [selectedTicketForDetail, setSelectedTicketForDetail] =
    useState<MaintenanceTicketItem | null>(null);
  const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState<boolean>(false);
  const [selectedBlockForDetail, setSelectedBlockForDetail] =
    useState<MaintenanceBlockItem | null>(null);
  const [isBlockDrawerOpen, setIsBlockDrawerOpen] = useState<boolean>(false);

  // Modals
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] =
    useState<boolean>(false);
  const [isAssignTicketModalOpen, setIsAssignTicketModalOpen] =
    useState<boolean>(false);
  const [isResolveTicketModalOpen, setIsResolveTicketModalOpen] =
    useState<boolean>(false);
  const [isCloseTicketModalOpen, setIsCloseTicketModalOpen] =
    useState<boolean>(false);
  const [isCancelTicketModalOpen, setIsCancelTicketModalOpen] =
    useState<boolean>(false);

  const [isCreateBlockModalOpen, setIsCreateBlockModalOpen] =
    useState<boolean>(false);
  const [isReleaseBlockModalOpen, setIsReleaseBlockModalOpen] =
    useState<boolean>(false);
  const [isCancelBlockModalOpen, setIsCancelBlockModalOpen] =
    useState<boolean>(false);

  // Action targets
  const [actionTicket, setActionTicket] =
    useState<MaintenanceTicketItem | null>(null);
  const [actionBlock, setActionBlock] = useState<MaintenanceBlockItem | null>(
    null,
  );

  // Forms
  const [createTicketForm] = Form.useForm();
  const [createBlockForm] = Form.useForm();
  // Dynamic Technicians Query (GET /employees?role=TECHNICIAN&isActive=true)
  const { data: techniciansRes } = useQuery({
    queryKey: ["employees", { role: "TECHNICIAN", isActive: true }],
    queryFn: () =>
      employeesApi.list({ role: "TECHNICIAN", isActive: true, limit: 100 }),
    staleTime: 60000,
  });

  useEffect(() => {
    if (techniciansRes?.data?.items) {
      registerStaffMembers(techniciansRes.data.items);
    }
  }, [techniciansRes]);

  const technicianOptions = useMemo(() => {
    const items = techniciansRes?.data?.items || [];
    if (items.length === 0) {
      return [{ value: "", label: "Chưa có kỹ thuật viên đang hoạt động" }];
    }
    return items.map((tech) => ({
      value: String(tech.id),
      label: `${tech.fullName} (Kỹ thuật viên - ID: ${tech.id})`,
      role: tech.role,
    }));
  }, [techniciansRes]);

  const [assignTechId, setAssignTechId] = useState<string>("");

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------

  // 1. Maintenance Tickets list
  const {
    data: ticketsRes,
    isLoading: isTicketsLoading,
    refetch: refetchTickets,
  } = useQuery({
    // Room numbers are not part of the backend ticket `search` (it only looks
    // at title/description), so the whole filtered list is fetched once and the
    // keyword is matched against title, description and room number in the
    // browser. Typing in the search box therefore never issues a request.
    queryKey: ["maintenance-tickets", ticketStatusFilter, ticketPriorityFilter],
    queryFn: () =>
      maintenanceApi.getAllTickets({
        status: ticketStatusFilter,
        priority: ticketPriorityFilter,
        sortBy: "reportedAt",
      }),
    staleTime: 10000,
    // Keep the current rows while a status/priority change is in flight instead
    // of blanking the table and remounting every row.
    placeholderData: keepPreviousData,
  });

  // 2. Maintenance Blocks list
  const {
    data: blocksRes,
    isLoading: isBlocksLoading,
    refetch: refetchBlocks,
  } = useQuery({
    queryKey: ["maintenance-blocks", blockStatusFilter],
    queryFn: () =>
      maintenanceApi.getBlocks({
        limit: 100,
        status: blockStatusFilter,
      }),
    staleTime: 10000,
  });

  // 3. Physical Rooms list for select dropdowns
  const { data: roomsRes } = useQuery({
    queryKey: ["rooms-all-lookup"],
    queryFn: () => roomsApi.getAll({ limit: 100 }),
    staleTime: 30000,
  });

  // 4. Room Types list for metadata enrichment
  const { data: roomTypesRes } = useQuery({
    queryKey: ["room-types-lookup"],
    queryFn: () => roomTypesApi.getAll(),
    staleTime: 60000,
  });

  // 5. Ticket detail query
  const {
    data: ticketDetailRes,
    isLoading: isTicketDetailLoading,
    refetch: refetchTicketDetail,
  } = useQuery({
    queryKey: ["ticket-detail", selectedTicketForDetail?.id],
    queryFn: () =>
      selectedTicketForDetail?.id
        ? maintenanceApi.getTicketById(selectedTicketForDetail.id)
        : Promise.resolve({ success: true, message: "", data: null as any }),
    enabled: !!selectedTicketForDetail?.id && isTicketDrawerOpen,
  });

  // 6. Block detail query
  const {
    data: blockDetailRes,
    isLoading: isBlockDetailLoading,
    refetch: refetchBlockDetail,
  } = useQuery({
    queryKey: ["block-detail", selectedBlockForDetail?.id],
    queryFn: () =>
      selectedBlockForDetail?.id
        ? maintenanceApi.getBlockById(selectedBlockForDetail.id)
        : Promise.resolve({ success: true, message: "", data: null as any }),
    enabled: !!selectedBlockForDetail?.id && isBlockDrawerOpen,
  });

  const ticketList: MaintenanceTicketItem[] = useMemo(
    () => (Array.isArray(ticketsRes) ? ticketsRes : []),
    [ticketsRes]
  );

  // The backend ticket `search` only covers title/description, so match the
  // keyword against the room number here as well (and support partial room
  // numbers such as "10" matching 101, 102, ...).
  const normalizedTicketSearch = ticketSearch.trim().toLowerCase();
  const searchedTickets = useMemo(() => {
    if (!normalizedTicketSearch) return ticketList;

    return ticketList.filter((ticket) => {
      const haystack = `${ticket.title} ${ticket.description} ${
        ticket.room?.roomNumber ?? ""
      }`.toLowerCase();
      return haystack.includes(normalizedTicketSearch);
    });
  }, [ticketList, normalizedTicketSearch]);

  // Defer the grid payload so a keydown arriving mid-render can interrupt it.
  const deferredTickets = useDeferredValue(searchedTickets);
  const tableTickets =
    deferredTickets.length > 0 ? deferredTickets : searchedTickets;

  const rawBlocks = blocksRes?.data;
  const blockList: MaintenanceBlockItem[] = useMemo(
    () =>
      Array.isArray(rawBlocks)
        ? rawBlocks
        : (rawBlocks as any)?.items || [],
    [rawBlocks]
  );

  const rawRooms = roomsRes?.data;
  const roomList = Array.isArray(rawRooms)
    ? rawRooms
    : (rawRooms as any)?.items || [];

  const rawRoomTypes = roomTypesRes?.data;
  const roomTypesList = Array.isArray(rawRoomTypes)
    ? rawRoomTypes
    : (rawRoomTypes as any)?.items || [];

  const getRoomTypeName = (roomTypeId: string) => {
    const found = roomTypesList.find(
      (rt: any) => String(rt.id) === String(roomTypeId),
    );
    return found ? found.name : `Hạng #${roomTypeId}`;
  };

  // ----------------------------------------------------
  // MUTATIONS - TICKETS
  // ----------------------------------------------------

  const createTicketMutation = useMutation({
    mutationFn: (dto: CreateMaintenanceTicketDto) =>
      maintenanceApi.createTicket(dto),
    onSuccess: () => {
      appMessage.success("Đã báo cáo sự cố kỹ thuật thành công!");
      setIsCreateTicketModalOpen(false);
      createTicketForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể tạo phiếu sự cố.",
      );
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      maintenanceApi.assignTicket(id, { staffId }),
    onSuccess: () => {
      appMessage.success("Phân công kỹ thuật viên thành công!");
      setIsAssignTicketModalOpen(false);
      setActionTicket(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      if (selectedTicketForDetail) refetchTicketDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể phân công kỹ thuật viên.",
      );
    },
  });

  const startRepairMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.startRepair(id),
    onSuccess: () => {
      appMessage.success("Đã bắt đầu sửa chữa! Trạng thái phiếu: IN_PROGRESS.");
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      if (selectedTicketForDetail) refetchTicketDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể bắt đầu sửa chữa.",
      );
    },
  });

  // Stable mutate handle: the mutation observer object itself changes identity
  // on every render, which would invalidate memoized table columns.
  const { mutate: startRepair, isPending: isStartingRepair } = startRepairMutation;

  const resolveTicketMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      maintenanceApi.resolveTicket(id, { resolutionNotes: notes }),
    onSuccess: () => {
      appMessage.success(
        "Đã báo cáo hoàn thành sửa chữa! Trạng thái phiếu: RESOLVED.",
      );
      setIsResolveTicketModalOpen(false);
      setActionTicket(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      if (selectedTicketForDetail) refetchTicketDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể báo cáo hoàn thành.",
      );
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.closeTicket(id),
    onSuccess: () => {
      appMessage.success(
        "Nghiệm thu & Đóng phiếu sự cố thành công! Trạng thái: CLOSED.",
      );
      setIsCloseTicketModalOpen(false);
      setActionTicket(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      if (selectedTicketForDetail) refetchTicketDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể đóng phiếu sự cố.",
      );
    },
  });

  const cancelTicketMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      maintenanceApi.cancelTicket(id, { cancellationReason: reason }),
    onSuccess: () => {
      appMessage.info("Đã hủy phiếu sự cố.");
      setIsCancelTicketModalOpen(false);
      setActionTicket(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      if (selectedTicketForDetail) refetchTicketDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể hủy phiếu sự cố.",
      );
    },
  });

  // ----------------------------------------------------
  // MUTATIONS - BLOCKS
  // ----------------------------------------------------

  const createBlockMutation = useMutation({
    mutationFn: (dto: CreateMaintenanceBlockDto) =>
      maintenanceApi.createBlock(dto),
    onSuccess: () => {
      appMessage.success("Đã tạo lệnh khóa phòng bảo trì thành công!");
      setIsCreateBlockModalOpen(false);
      createBlockForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["maintenance-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      const details = err.response?.data?.details;
      let detailMsg =
        Array.isArray(details) && details.length > 0
          ? details[0].message
          : null;
      if (detailMsg === "Use a half-open interval of 1–365 nights") {
        detailMsg =
          "Khoảng thời gian khóa phòng phải từ 1 đến 365 đêm (Ngày kết thúc phải sau Ngày bắt đầu ít nhất 1 ngày).";
      }
      appMessage.error(
        detailMsg ||
          err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể tạo lệnh khóa phòng.",
      );
    },
  });

  const releaseBlockMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      maintenanceApi.releaseBlock(id, { notes }),
    onSuccess: () => {
      appMessage.success(
        "Mở khóa phòng thành công! Phòng đã chuyển sang DIRTY và tạo việc dọn dẹp buồng phòng.",
      );
      setIsReleaseBlockModalOpen(false);
      setActionBlock(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["housekeeping-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dirty-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (selectedBlockForDetail) refetchBlockDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể mở khóa phòng.",
      );
    },
  });

  const cancelBlockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      maintenanceApi.cancelBlock(id, { reason }),
    onSuccess: () => {
      appMessage.info("Đã hủy lệnh bảo trì đã lên lịch tương lai.");
      setIsCancelBlockModalOpen(false);
      setActionBlock(null);
      queryClient.invalidateQueries({ queryKey: ["maintenance-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (selectedBlockForDetail) refetchBlockDetail();
    },
    onError: (err: any) => {
      appMessage.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "Không thể hủy lệnh bảo trì.",
      );
    },
  });

  // Priority Tag Renderers



  // ----------------------------------------------------
  // TABLE COLUMNS - TICKETS
  // ----------------------------------------------------

  const ticketColumns = useMemo<ColumnsType<MaintenanceTicketItem>>(() => [
    {
      title: "Mã phiếu",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: string) => (
        <Text code style={{ whiteSpace: "nowrap" }}>
          #{id}
        </Text>
      ),
    },
    {
      title: "Phòng",
      dataIndex: "room",
      key: "room",
      width: 140,
      render: (r: any) => (
        <Space size={4} style={{ whiteSpace: "nowrap" }}>
          <HomeOutlined style={{ color: "#1b4d3e" }} />
          <Text strong style={{ color: "#1b4d3e", fontSize: 15 }}>
            #{r.roomNumber}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (T.{r.floorNumber})
          </Text>
        </Space>
      ),
    },
    {
      title: "Tiêu đề sự cố & Mô tả",
      key: "titleDesc",
      width: 260,
      render: (_, record) => (
        <div style={{ maxWidth: 240 }}>
          <Text
            strong
            ellipsis={{ tooltip: record.title }}
            style={{ display: "block", fontSize: 14, color: "#262626" }}
          >
            {record.title}
          </Text>
          <Paragraph
            ellipsis={{ rows: 1 }}
            type="secondary"
            style={{ fontSize: 12, margin: "4px 0 0 0" }}
          >
            {record.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: "Mức độ ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 130,
      render: (p: any) => (
        <div style={{ whiteSpace: "nowrap" }}>{renderPriorityTag(p)}</div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 180,
      render: (s: any) => (
        <div style={{ whiteSpace: "nowrap" }}>{renderTicketStatusTag(s)}</div>
      ),
    },
    {
      title: "Kỹ thuật viên",
      dataIndex: "assignedTo",
      key: "assignedTo",
      width: 210,
      render: (staffId: string | null) => {
        if (!staffId)
          return (
            <Tag color="orange" style={{ whiteSpace: "nowrap" }}>
              Chưa phân công
            </Tag>
          );
        const staff = getStaffDisplay(staffId, user);
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              minWidth: 0,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <Space size={4} style={{ minWidth: 0, maxWidth: "100%" }}>
              <UserOutlined style={{ color: "#1b4d3e", flexShrink: 0 }} />
              <Text
                strong
                ellipsis={{ tooltip: staff.fullName }}
                style={{
                  color: "#1b4d3e",
                  display: "block",
                  minWidth: 0,
                  maxWidth: 160,
                }}
              >
                {staff.fullName}
              </Text>
            </Space>
            <Tooltip title={staff.roleTitle}>
              <Tag
                color={staff.color}
                style={{
                  fontSize: 10,
                  margin: 0,
                  padding: "0 4px",
                  lineHeight: "18px",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {staff.roleTitle}
              </Tag>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "Thời gian báo",
      dataIndex: "reportedAt",
      key: "reportedAt",
      width: 150,
      render: (date: string) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {dayjs(date).format("DD/MM/YYYY HH:mm")}
        </span>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 180,
      fixed: screens.xs ? false : "right",
      render: (_, record) => {
        const isAssignedToMe = String(record.assignedTo) === String(user?.id);

        return (
          <Space size={6} wrap>
            <Tooltip title="Xem chi tiết & lịch sử dòng thời gian">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedTicketForDetail(record);
                  setIsTicketDrawerOpen(true);
                }}
              />
            </Tooltip>

            {isAdminOrManager &&
              ["OPEN", "ASSIGNED"].includes(record.status) && (
                <Tooltip title="Phân công kỹ thuật viên">
                  <Button
                    size="small"
                    icon={<UserSwitchOutlined />}
                    onClick={() => {
                      setActionTicket(record);
                      setAssignTechId(
                        record.assignedTo
                          ? String(record.assignedTo)
                          : technicianOptions[0]?.value || "",
                      );
                      setIsAssignTicketModalOpen(true);
                    }}
                  />
                </Tooltip>
              )}

            {record.status === "ASSIGNED" &&
              (isAssignedToMe || isAdminOrManager) && (
                <Tooltip title="Bắt đầu sửa chữa (chuyển sang IN_PROGRESS)">
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    style={{ background: "#1b4d3e", borderColor: "#1b4d3e" }}
                    loading={isStartingRepair}
                    onClick={() => startRepair(record.id)}
                  >
                    Bắt đầu
                  </Button>
                </Tooltip>
              )}

            {record.status === "IN_PROGRESS" &&
              (isAssignedToMe || isAdminOrManager) && (
                <Tooltip title="Báo cáo hoàn thành sửa chữa (chuyển sang RESOLVED)">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ background: "#722ed1", borderColor: "#722ed1" }}
                    onClick={() => {
                      setActionTicket(record);
                      setIsResolveTicketModalOpen(true);
                    }}
                  >
                    Báo xong
                  </Button>
                </Tooltip>
              )}

            {isAdminOrManager && record.status === "RESOLVED" && (
              <Tooltip title="Nghiệm thu và đóng phiếu (CLOSED)">
                <Button
                  size="small"
                  type="primary"
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setActionTicket(record);
                    setIsCloseTicketModalOpen(true);
                  }}
                >
                  Đóng phiếu
                </Button>
              </Tooltip>
            )}

            {isAdminOrManager &&
              ["OPEN", "ASSIGNED"].includes(record.status) && (
                <Tooltip title="Hủy phiếu">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setActionTicket(record);
                      setIsCancelTicketModalOpen(true);
                    }}
                  />
                </Tooltip>
              )}
          </Space>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdminOrManager, renderPriorityTag, renderTicketStatusTag, screens, setIsAssignTicketModalOpen, setIsCancelTicketModalOpen, setIsCloseTicketModalOpen, setIsResolveTicketModalOpen, setIsTicketDrawerOpen, setSelectedTicketForDetail, setActionTicket, startRepair, isStartingRepair, technicianOptions, user]);

  // ----------------------------------------------------
  // TABLE COLUMNS - BLOCKS
  // ----------------------------------------------------

  const blockColumns = useMemo<ColumnsType<MaintenanceBlockItem>>(() => [
    {
      title: "Mã lệnh",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: string) => (
        <Text code style={{ whiteSpace: "nowrap" }}>
          BLK#{id}
        </Text>
      ),
    },
    {
      title: "Phòng",
      dataIndex: "room",
      key: "room",
      width: 140,
      render: (r: any) => (
        <Space size={4} style={{ whiteSpace: "nowrap" }}>
          <HomeOutlined style={{ color: "#1b4d3e" }} />
          <Text strong style={{ color: "#1b4d3e", fontSize: 15 }}>
            #{r.roomNumber}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (T.{r.floorNumber})
          </Text>
        </Space>
      ),
    },
    {
      title: "Khoảng thời gian khóa",
      key: "dates",
      width: 230,
      render: (_, record) => {
        const start = dayjs(record.startDate);
        const end = dayjs(record.endDate);
        const nights = end.diff(start, "day");
        return (
          <div style={{ whiteSpace: "nowrap" }}>
            <Text strong>
              {start.format("DD/MM/YYYY")} ➔ {end.format("DD/MM/YYYY")}
            </Text>
            <div>
              <Tag color="cyan">{nights} đêm giữ chỗ</Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: "Lý do khóa bảo trì",
      dataIndex: "reason",
      key: "reason",
      width: 250,
      render: (reason: string, record) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <Paragraph ellipsis={{ rows: 1 }} style={{ margin: 0 }}>
            {reason}
          </Paragraph>
          {record.maintenanceTicketId && (
            <Tag color="purple" style={{ marginTop: 4 }}>
              Liên kết Phiếu #{record.maintenanceTicketId}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 200,
      render: (s: any) => (
        <div style={{ whiteSpace: "nowrap" }}>{renderBlockStatusTag(s)}</div>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      fixed: screens.xs ? false : "right",
      render: (_, record) => (
        <Space size={6} style={{ whiteSpace: "nowrap" }}>
          <Tooltip title="Xem chi tiết & lịch sử dòng thời gian">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedBlockForDetail(record);
                setIsBlockDrawerOpen(true);
              }}
            />
          </Tooltip>

          {canManageBlocks &&
            ["ACTIVE", "SCHEDULED"].includes(record.status) && (
              <Tooltip title="Nghiệm thu kỹ thuật & Mở khóa phòng (Phòng tự động chuyển sang DIRTY)">
                <Button
                  size="small"
                  type="primary"
                  icon={<UnlockOutlined />}
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                  onClick={() => {
                    setActionBlock(record);
                    setIsReleaseBlockModalOpen(true);
                  }}
                >
                  Mở khóa
                </Button>
              </Tooltip>
            )}

          {canManageBlocks && record.status === "SCHEDULED" && (
            <Tooltip title="Hủy lệnh bảo trì tương lai">
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setActionBlock(record);
                  setIsCancelBlockModalOpen(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canManageBlocks, screens, setIsBlockDrawerOpen, setIsCancelBlockModalOpen, setIsReleaseBlockModalOpen, setSelectedBlockForDetail, setActionBlock]);

  // Counts for KPI (follow the same filters/search as the table above)
  const openTickets = searchedTickets.filter((t) => t.status === "OPEN").length;
  const inProgressTickets = searchedTickets.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED",
  ).length;
  const resolvedTickets = searchedTickets.filter(
    (t) => t.status === "RESOLVED",
  ).length;
  const closedTickets = searchedTickets.filter((t) => t.status === "CLOSED").length;

  const activeBlocks = blockList.filter((b) => b.status === "ACTIVE").length;
  const scheduledBlocks = blockList.filter(
    (b) => b.status === "SCHEDULED",
  ).length;
  const releasedBlocks = blockList.filter(
    (b) => b.status === "RELEASED",
  ).length;

  // Memoized tab pane: the element identity only changes when the values it
  // actually reads change, so unrelated page state (other tab, filters,
  // modals) no longer re-renders this subtree.
  const maintenanceTicketsPane = useMemo(
    () => (
                <div>
                  {/* KPI Cards */}
                  <Row
                    gutter={[16, 16]}
                    className="pms-kpi-row"
                    style={{ marginBottom: 20 }}
                  >
                    <Col xs={12} sm={6}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#fff2f0",
                          border: "1px solid #ffccc7",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Mới báo cáo (OPEN)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#cf1322" }}
                        >
                          {openTickets}
                        </Title>
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#e6f7ff",
                          border: "1px solid #91d5ff",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đang xử lý (IN_PROGRESS)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#096dd9" }}
                        >
                          {inProgressTickets}
                        </Title>
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#f9f0ff",
                          border: "1px solid #d3adf7",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đã sửa xong (RESOLVED)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#722ed1" }}
                        >
                          {resolvedTickets}
                        </Title>
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#f6ffed",
                          border: "1px solid #b7eb8f",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đã nghiệm thu (CLOSED)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#389e0d" }}
                        >
                          {closedTickets}
                        </Title>
                      </Card>
                    </Col>
                  </Row>

                  {/* Filter Toolbar */}
                  <Card style={{ marginBottom: 16, borderRadius: 8 }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} sm={8}>
                        <DebouncedSearchInput
                          placeholder="Tìm theo tiêu đề, mô tả hoặc số phòng..."
                          prefix={<SearchOutlined />}
                          value={ticketSearch}
                          onChange={(val) => setTicketSearch(val)}
                          allowClear
                        />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Select
                          placeholder="Lọc theo trạng thái phiếu..."
                          style={{ width: "100%" }}
                          allowClear
                          value={ticketStatusFilter}
                          onChange={(v: any) =>
                            setTicketStatusFilter(
                              !v || v === "ALL" ? undefined : v,
                            )
                          }
                          options={[
                            { value: "ALL", label: "Tất cả trạng thái phiếu" },
                            { value: "OPEN", label: "🔴 Mới báo cáo (OPEN)" },
                            {
                              value: "ASSIGNED",
                              label: "🟠 Đã phân công (ASSIGNED)",
                            },
                            {
                              value: "IN_PROGRESS",
                              label: "🔵 Đang sửa chữa (IN_PROGRESS)",
                            },
                            {
                              value: "RESOLVED",
                              label: "🟣 Đã sửa xong (RESOLVED)",
                            },
                            {
                              value: "CLOSED",
                              label: "🟢 Đã nghiệm thu (CLOSED)",
                            },
                            { value: "CANCELLED", label: "⚪ Đã hủy" },
                          ]}
                        />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Select
                          placeholder="Lọc mức độ ưu tiên..."
                          style={{ width: "100%" }}
                          allowClear
                          value={ticketPriorityFilter}
                          onChange={(v: any) =>
                            setTicketPriorityFilter(
                              !v || v === "ALL" ? undefined : v,
                            )
                          }
                          options={[
                            { value: "ALL", label: "Tất cả mức độ ưu tiên" },
                            { value: "CRITICAL", label: "🔴 Khẩn cấp" },
                            { value: "HIGH", label: "🟠 Ưu tiên cao" },
                            { value: "NORMAL", label: "🔵 Bình thường" },
                            { value: "LOW", label: "⚪ Thấp" },
                          ]}
                        />
                      </Col>
                    </Row>
                  </Card>

                  {/* Table */}
                  <Card style={{ borderRadius: 8 }}>
                    <Table
                      columns={ticketColumns}
                      dataSource={tableTickets}
                      rowKey="id"
                      loading={isTicketsLoading}
                      scroll={{ x: 1320 }}
                      pagination={{
                        pageSize: ticketPageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        onChange: (_page, size) => setTicketPageSize(size),
                      }}
                    />
                  </Card>
                </div>
    ),
    [closedTickets, inProgressTickets, isTicketsLoading, openTickets, resolvedTickets, setTicketPriorityFilter, setTicketSearch, setTicketStatusFilter, tableTickets, ticketColumns, ticketPageSize, ticketPriorityFilter, ticketSearch, ticketStatusFilter]
  );

  // Memoized tab pane: the element identity only changes when the values it
  // actually reads change, so unrelated page state (other tab, filters,
  // modals) no longer re-renders this subtree.
  const maintenanceBlocksPane = useMemo(
    () => (
                <div>
                  {/* KPI Cards */}
                  <Row
                    gutter={[16, 16]}
                    className="pms-kpi-row"
                    style={{ marginBottom: 20 }}
                  >
                    <Col xs={24} sm={8}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#fff2f0",
                          border: "1px solid #ffccc7",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đang khóa kỹ thuật (ACTIVE)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#cf1322" }}
                        >
                          {activeBlocks}
                        </Title>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#fffbe6",
                          border: "1px solid #ffe58f",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đã lên lịch tương lai (SCHEDULED)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#d48806" }}
                        >
                          {scheduledBlocks}
                        </Title>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card
                        variant="borderless"
                        className="pms-kpi-card"
                        style={{
                          height: "100%",
                          background: "#f6ffed",
                          border: "1px solid #b7eb8f",
                          borderRadius: 8,
                        }}
                        styles={{
                          body: {
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          },
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đã mở khóa an toàn (RELEASED)
                        </Text>
                        <Title
                          level={2}
                          style={{ margin: "8px 0 0", color: "#389e0d" }}
                        >
                          {releasedBlocks}
                        </Title>
                      </Card>
                    </Col>
                  </Row>

                  {/* Filter Toolbar */}
                  <Card style={{ marginBottom: 16, borderRadius: 8 }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} sm={12}>
                        <Select
                          placeholder="Lọc theo trạng thái lệnh khóa..."
                          style={{ width: "100%" }}
                          allowClear
                          value={blockStatusFilter}
                          onChange={(v: any) =>
                            setBlockStatusFilter(
                              !v || v === "ALL" ? undefined : v,
                            )
                          }
                          options={[
                            { value: "ALL", label: "Tất cả lệnh khóa" },
                            {
                              value: "ACTIVE",
                              label: "🔴 Đang khóa kỹ thuật (ACTIVE)",
                            },
                            {
                              value: "SCHEDULED",
                              label: "🟠 Đã lên lịch tương lai (SCHEDULED)",
                            },
                            {
                              value: "RELEASED",
                              label: "🟢 Đã mở khóa an toàn (RELEASED)",
                            },
                            { value: "CANCELLED", label: "⚪ Đã hủy" },
                          ]}
                        />
                      </Col>
                    </Row>
                  </Card>

                  {/* Table */}
                  <Card style={{ borderRadius: 8 }}>
                    <Table
                      columns={blockColumns}
                      dataSource={blockList}
                      rowKey="id"
                      loading={isBlocksLoading}
                      scroll={{ x: 1080 }}
                      pagination={{
                        pageSize: blockPageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50"],
                        onChange: (_page, size) => setBlockPageSize(size),
                      }}
                    />
                  </Card>
                </div>
    ),
    [activeBlocks, blockColumns, blockList, blockPageSize, blockStatusFilter, isBlocksLoading, releasedBlocks, scheduledBlocks, setBlockStatusFilter]
  );

  return (
    <div style={{ padding: "0 8px 32px 8px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: "#1b4d3e" }}>
            Bảo trì & Khóa phòng Kỹ thuật (Maintenance Operations)
          </Title>
          <Text type="secondary">
            Xử lý sự cố trang thiết bị phòng, tiếp nhận sửa chữa và quản lý lệnh
            khóa phòng bảo trì.
          </Text>
        </div>

        <Space
          wrap
          size={[8, 8]}
          style={{ width: screens.xs ? "100%" : "auto" }}
        >
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchTickets();
              refetchBlocks();
              appMessage.info("Đã làm mới dữ liệu bảo trì.");
            }}
          >
            Làm mới
          </Button>

          {canReportTicket && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: "#fa8c16", borderColor: "#fa8c16" }}
              onClick={() => {
                createTicketForm.resetFields();
                setIsCreateTicketModalOpen(true);
              }}
            >
              Báo cáo sự cố mới
            </Button>
          )}

          {canManageBlocks && (
            <Button
              type="primary"
              icon={<LockOutlined />}
              style={{ background: "#1b4d3e", borderColor: "#1b4d3e" }}
              onClick={() => {
                createBlockForm.resetFields();
                setIsCreateBlockModalOpen(true);
              }}
            >
              Khóa phòng bảo trì
            </Button>
          )}
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        items={[
          // TAB 1: TICKETS
          {
            key: "tickets",
            label: (
              <span>
                <ToolOutlined /> Phiếu sự cố kỹ thuật ({searchedTickets.length})
              </span>
            ),
            children: maintenanceTicketsPane,
          },

          // TAB 2: BLOCKS
          {
            key: "blocks",
            label: (
              <span>
                <LockOutlined /> Lệnh khóa phòng bảo trì ({blockList.length})
              </span>
            ),
            children: maintenanceBlocksPane,
          },
        ]}
      />

      {/* ---------------------------------------------------- */}
      {/* CREATE TICKET MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: "#fa8c16" }} />
            <span>Báo cáo sự cố kỹ thuật phòng</span>
          </Space>
        }
        open={isCreateTicketModalOpen}
        onCancel={() => {
          setIsCreateTicketModalOpen(false);
          createTicketForm.resetFields();
        }}
        onOk={() => createTicketForm.submit()}
        okText="Gửi báo cáo"
        cancelText="Hủy"
        confirmLoading={createTicketMutation.isPending}
      >
        <Form
          form={createTicketForm}
          layout="vertical"
          initialValues={{ priority: "NORMAL" }}
          onFinish={(values) =>
            createTicketMutation.mutate({
              roomId: values.roomId,
              title: values.title.trim(),
              description: values.description.trim(),
              priority: values.priority,
            })
          }
        >
          <Form.Item
            name="roomId"
            label="Chọn phòng xảy ra sự cố"
            rules={[{ required: true, message: "Vui lòng chọn số phòng" }]}
          >
            <Select
              placeholder="Chọn số phòng..."
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={roomList.map((r: any) => ({
                value: String(r.id),
                label: `Phòng #${r.roomNumber} (Tầng ${r.floorNumber} - ${getRoomTypeName(r.roomTypeId)}) [${r.physicalStatus}]`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="Tiêu đề sự cố"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề sự cố" }]}
          >
            <Input
              placeholder="VD: Điều hòa không lạnh, Vòi sen bị rỉ nước, Cửa ban công kẹt..."
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Mức độ ưu tiên"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: "CRITICAL",
                  label:
                    "🔴 Khẩn cấp (Cháy chập, ngập nước, sự cố nghiêm trọng)",
                },
                {
                  value: "HIGH",
                  label: "🟠 Ưu tiên cao (Khách đang ở phòng phản ánh)",
                },
                {
                  value: "NORMAL",
                  label: "🔵 Bình thường (Bảo dưỡng định kỳ)",
                },
                { value: "LOW", label: "⚪ Thấp (Vết trầy xước nhẹ)" },
              ]}
            />
          </Form.Item>

          <div style={{ paddingBottom: 16 }}>
            <Form.Item
              name="description"
              label="Mô tả chi tiết sự cố"
              rules={[
                { required: true, message: "Vui lòng mô tả chi tiết sự cố" },
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Mô tả hiện tượng, vị trí chính xác và thời điểm phát hiện sự cố..."
                maxLength={2000}
                showCount
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* ASSIGN TICKET MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <UserSwitchOutlined style={{ color: "#1b4d3e" }} />
            <span>Phân công Kỹ thuật viên — Phiếu #{actionTicket?.id}</span>
          </Space>
        }
        open={isAssignTicketModalOpen}
        onCancel={() => {
          setIsAssignTicketModalOpen(false);
          setActionTicket(null);
        }}
        onOk={() => {
          if (actionTicket) {
            assignTicketMutation.mutate({
              id: actionTicket.id,
              staffId: assignTechId,
            });
          }
        }}
        okText="Xác nhận phân công"
        cancelText="Đóng"
        confirmLoading={assignTicketMutation.isPending}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <Alert
            type="info"
            showIcon
            title="Chính sách phân công kỹ thuật"
            description="Chỉ nhân viên thuộc vai trò Kỹ thuật (TECHNICIAN), Quản lý (MANAGER) hoặc Quản trị viên (ADMIN) mới hợp lệ để tiếp nhận sửa chữa."
          />

          <div>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              Chọn kỹ thuật viên phụ trách:{" "}
              <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Select
              value={assignTechId}
              onChange={(val) => setAssignTechId(val)}
              style={{ width: "100%" }}
              options={technicianOptions}
            />
          </div>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* RESOLVE TICKET MODAL */}
      {/* ---------------------------------------------------- */}
      <ResolveTicketModal
        open={isResolveTicketModalOpen}
        ticket={actionTicket}
        confirmLoading={resolveTicketMutation.isPending}
        onCancel={() => {
          setIsResolveTicketModalOpen(false);
          setActionTicket(null);
        }}
        onConfirm={(notes) => {
          if (actionTicket) {
            resolveTicketMutation.mutate({ id: actionTicket.id, notes });
          }
        }}
      />

      {/* ---------------------------------------------------- */}
      {/* CLOSE TICKET MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>Nghiệm thu & Đóng phiếu sự cố #{actionTicket?.id}</span>
          </Space>
        }
        open={isCloseTicketModalOpen}
        onCancel={() => {
          setIsCloseTicketModalOpen(false);
          setActionTicket(null);
        }}
        onOk={() => {
          if (actionTicket) {
            closeTicketMutation.mutate(actionTicket.id);
          }
        }}
        okText="Xác nhận Đóng phiếu"
        cancelText="Hủy"
        confirmLoading={closeTicketMutation.isPending}
      >
        <Space
          orientation="vertical"
          size={16}
          style={{ width: "100%", marginTop: 8 }}
        >
          <Alert
            type="success"
            showIcon
            title="Nghiệm thu kỹ thuật"
            description="Xác nhận chất lượng sửa chữa đạt tiêu chuẩn vận hành an toàn. Phiếu sự cố sẽ được đóng chính thức (CLOSED)."
          />

          {actionTicket && (
            <Card
              size="small"
              style={{ background: "#fafafa", borderRadius: 8 }}
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Số phòng:{" "}
                </Text>
                <Tag color="#1b4d3e" style={{ fontWeight: 600 }}>
                  #{actionTicket.room.roomNumber}
                </Tag>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tiêu đề sự cố:{" "}
                </Text>
                <Text strong>{actionTicket.title}</Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Mô tả ban đầu:{" "}
                </Text>
                <div>
                  <Text>{actionTicket.description}</Text>
                </div>
              </div>
              {actionTicket.resolutionNotes && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "#f6ffed",
                    border: "1px solid #b7eb8f",
                    borderRadius: 6,
                  }}
                >
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 12,
                      display: "block",
                      color: "#389e0d",
                      fontWeight: 600,
                    }}
                  >
                    🔧 Kết quả xử lý từ Kỹ thuật viên:
                  </Text>
                  <Text>{actionTicket.resolutionNotes}</Text>
                </div>
              )}
            </Card>
          )}
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* CANCEL TICKET MODAL */}
      {/* ---------------------------------------------------- */}
      <CancelTicketModal
        open={isCancelTicketModalOpen}
        ticket={actionTicket}
        confirmLoading={cancelTicketMutation.isPending}
        onCancel={() => {
          setIsCancelTicketModalOpen(false);
          setActionTicket(null);
        }}
        onConfirm={(reason) => {
          if (actionTicket) {
            cancelTicketMutation.mutate({ id: actionTicket.id, reason });
          }
        }}
      />

      {/* ---------------------------------------------------- */}
      {/* CREATE BLOCK MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: "#1b4d3e" }} />
            <span>Tạo lệnh Khóa phòng Bảo trì (Maintenance Block)</span>
          </Space>
        }
        open={isCreateBlockModalOpen}
        onCancel={() => {
          setIsCreateBlockModalOpen(false);
          createBlockForm.resetFields();
        }}
        onOk={() => createBlockForm.submit()}
        okText="Tạo lệnh khóa"
        cancelText="Hủy"
        confirmLoading={createBlockMutation.isPending}
      >
        <Alert
          type="warning"
          showIcon
          title="Chính sách khóa phòng kỹ thuật"
          description="Khoảng ngày khóa sẽ loại trừ số lượng phòng này khỏi kho tồn bán phòng (Availability). Phòng không được có khách đang lưu trú."
          style={{ marginBottom: 16 }}
        />

        <Form
          form={createBlockForm}
          layout="vertical"
          onFinish={(values) => {
            const [start, end] = values.dateRange;
            createBlockMutation.mutate({
              roomId: values.roomId,
              startDate: start.format("YYYY-MM-DD"),
              endDate: end.format("YYYY-MM-DD"),
              reason: values.reason.trim(),
              maintenanceTicketId: values.maintenanceTicketId || undefined,
            });
          }}
        >
          <Form.Item
            name="roomId"
            label="Chọn phòng cần khóa bảo trì"
            rules={[{ required: true, message: "Vui lòng chọn số phòng" }]}
          >
            <Select
              placeholder="Chọn số phòng..."
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={roomList.map((r: any) => ({
                value: String(r.id),
                label: `Phòng #${r.roomNumber} (Tầng ${r.floorNumber} - ${getRoomTypeName(r.roomTypeId)}) [${r.physicalStatus}]`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Khoảng thời gian khóa phòng [Ngày bắt đầu - Ngày kết thúc)"
            extra="Quy tắc tính đêm phòng: Tối thiểu là 1 đêm (Ví dụ: Từ 15/10/2026 đến 16/10/2026)."
            rules={[
              { required: true, message: "Vui lòng chọn khoảng ngày bảo trì" },
              {
                validator: async (_, value) => {
                  if (value && value[0] && value[1]) {
                    if (value[0].isSame(value[1], "day")) {
                      return Promise.reject(
                        new Error(
                          "Khoảng thời gian khóa tối thiểu là 1 đêm (Ngày kết thúc phải sau Ngày bắt đầu ít nhất 1 ngày)!",
                        ),
                      );
                    }
                  }
                },
              },
            ]}
          >
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              disabledDate={(current) =>
                current && current < dayjs().startOf("day")
              }
            />
          </Form.Item>

          <Form.Item
            name="maintenanceTicketId"
            label="Liên kết Phiếu sự cố kỹ thuật (tùy chọn)"
          >
            <Select
              placeholder="Chọn phiếu sự cố liên quan..."
              allowClear
              options={ticketList
                .filter((t) =>
                  ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(t.status),
                )
                .map((t) => ({
                  value: String(t.id),
                  label: `Phiếu #${t.id} - Phòng #${t.room.roomNumber}: ${t.title}`,
                }))}
            />
          </Form.Item>

          <div style={{ paddingBottom: 16 }}>
            <Form.Item
              name="reason"
              label="Lý do khóa phòng bảo trì"
              rules={[
                { required: true, message: "Vui lòng nhập lý do khóa bảo trì" },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="VD: Sơn sửa lại tường phòng, thay thế sàn gỗ mục, nâng cấp hệ thống điều hòa trung tâm..."
                maxLength={2000}
                showCount
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* RELEASE BLOCK MODAL */}
      {/* ---------------------------------------------------- */}
      <ReleaseBlockModal
        open={isReleaseBlockModalOpen}
        block={actionBlock}
        confirmLoading={releaseBlockMutation.isPending}
        onCancel={() => {
          setIsReleaseBlockModalOpen(false);
          setActionBlock(null);
        }}
        onConfirm={(notes) => {
          if (actionBlock) {
            releaseBlockMutation.mutate({ id: actionBlock.id, notes });
          }
        }}
      />

      {/* ---------------------------------------------------- */}
      {/* CANCEL BLOCK MODAL */}
      {/* ---------------------------------------------------- */}
      <CancelBlockModal
        open={isCancelBlockModalOpen}
        block={actionBlock}
        confirmLoading={cancelBlockMutation.isPending}
        onCancel={() => {
          setIsCancelBlockModalOpen(false);
          setActionBlock(null);
        }}
        onConfirm={(reason) => {
          if (actionBlock) {
            cancelBlockMutation.mutate({ id: actionBlock.id, reason });
          }
        }}
      />

      {/* ---------------------------------------------------- */}
      {/* TICKET DETAIL DRAWER */}
      {/* ---------------------------------------------------- */}
      <Drawer
        title={
          <Space>
            <ToolOutlined style={{ color: "#fa8c16" }} />
            <span>Chi tiết Phiếu sự cố #{selectedTicketForDetail?.id}</span>
          </Space>
        }
        placement="right"
        size={560}
        open={isTicketDrawerOpen}
        onClose={() => {
          setIsTicketDrawerOpen(false);
          setSelectedTicketForDetail(null);
        }}
      >
        {isTicketDetailLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Spin size="large" />
          </div>
        ) : ticketDetailRes?.data ? (
          <div>
            <Card
              size="small"
              style={{
                marginBottom: 20,
                borderRadius: 8,
                background: "#fafafa",
              }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Số phòng:
                  </Text>
                  <div>
                    <Tag
                      color="#1b4d3e"
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        padding: "2px 8px",
                      }}
                    >
                      #{ticketDetailRes.data.room.roomNumber}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trạng thái:
                  </Text>
                  <div>
                    {renderTicketStatusTag(ticketDetailRes.data.status)}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Tiêu đề sự cố:
                  </Text>
                  <div>
                    <Text strong>{ticketDetailRes.data.title}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Mức độ ưu tiên:
                  </Text>
                  <div>{renderPriorityTag(ticketDetailRes.data.priority)}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Kỹ thuật viên phụ trách:
                  </Text>
                  <div>
                    {ticketDetailRes.data.assignedTo ? (
                      (() => {
                        const staff = getStaffDisplay(
                          ticketDetailRes.data.assignedTo,
                          user,
                        );
                        return (
                          <Space size={4}>
                            <Text strong style={{ color: "#1b4d3e" }}>
                              {staff.fullName}
                            </Text>
                            <Tag color={staff.color} style={{ fontSize: 11 }}>
                              {staff.roleTitle}
                            </Tag>
                          </Space>
                        );
                      })()
                    ) : (
                      <Tag color="orange">Chưa phân công</Tag>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Thời gian báo:
                  </Text>
                  <div>
                    {dayjs(ticketDetailRes.data.reportedAt).format(
                      "DD/MM/YYYY HH:mm",
                    )}
                  </div>
                </Col>
              </Row>
            </Card>

            <Title level={5} style={{ marginBottom: 16 }}>
              Dòng thời gian kiểm toán
            </Title>
            {ticketDetailRes.data.history &&
            ticketDetailRes.data.history.length > 0 ? (
              <Timeline
                items={ticketDetailRes.data.history.map((log) => {
                  const actionMeta = getMaintenanceActionDisplay(log.action);
                  const actor = getStaffDisplay(log.actorId, user);
                  const isClosed =
                    log.toStatus === "CLOSED" || log.action === "TICKET_CLOSE";
                  const isCancel =
                    log.toStatus === "CANCELLED" ||
                    log.action === "TICKET_CANCEL";
                  const timelineColor = isClosed
                    ? "green"
                    : isCancel
                      ? "red"
                      : "blue";

                  return {
                    color: timelineColor,
                    children: (
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Tag
                            color={actionMeta.color}
                            style={{ margin: 0, fontWeight: 600 }}
                          >
                            {actionMeta.label}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(log.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                          </Text>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#595959",
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>Người thực hiện:</span>
                          <Text strong>{actor.fullName}</Text>
                          <Tag
                            color={actor.color}
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            {actor.roleTitle}
                          </Tag>
                        </div>
                        {log.notes && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: "6px 10px",
                              background: "#fafafa",
                              borderRadius: 4,
                              fontSize: 12,
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
              <Text type="secondary">Chưa có lịch sử</Text>
            )}
          </div>
        ) : null}
      </Drawer>

      {/* ---------------------------------------------------- */}
      {/* BLOCK DETAIL DRAWER */}
      {/* ---------------------------------------------------- */}
      <Drawer
        title={
          <Space>
            <LockOutlined style={{ color: "#1b4d3e" }} />
            <span>
              Chi tiết Lệnh khóa phòng BLK#{selectedBlockForDetail?.id}
            </span>
          </Space>
        }
        placement="right"
        size={560}
        open={isBlockDrawerOpen}
        onClose={() => {
          setIsBlockDrawerOpen(false);
          setSelectedBlockForDetail(null);
        }}
      >
        {isBlockDetailLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Spin size="large" />
          </div>
        ) : blockDetailRes?.data ? (
          <div>
            <Card
              size="small"
              style={{
                marginBottom: 20,
                borderRadius: 8,
                background: "#fafafa",
              }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Số phòng:
                  </Text>
                  <div>
                    <Tag
                      color="#1b4d3e"
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        padding: "2px 8px",
                      }}
                    >
                      #{blockDetailRes.data.room.roomNumber}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trạng thái:
                  </Text>
                  <div>{renderBlockStatusTag(blockDetailRes.data.status)}</div>
                </Col>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Thời gian khóa phòng:
                  </Text>
                  <div>
                    <Text strong>
                      {dayjs(blockDetailRes.data.startDate).format(
                        "DD/MM/YYYY",
                      )}{" "}
                      ➔{" "}
                      {dayjs(blockDetailRes.data.endDate).format("DD/MM/YYYY")}
                    </Text>
                  </div>
                </Col>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Lý do bảo trì:
                  </Text>
                  <div>
                    <Text>{blockDetailRes.data.reason}</Text>
                  </div>
                </Col>
                {blockDetailRes.data.releaseNotes && (
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ghi chú nghiệm thu mở khóa:
                    </Text>
                    <div>
                      <Text strong style={{ color: "#389e0d" }}>
                        {blockDetailRes.data.releaseNotes}
                      </Text>
                    </div>
                  </Col>
                )}
              </Row>
            </Card>

            <Title level={5} style={{ marginBottom: 16 }}>
              Dòng thời gian kiểm toán
            </Title>
            {blockDetailRes.data.history &&
            blockDetailRes.data.history.length > 0 ? (
              <Timeline
                items={blockDetailRes.data.history.map((log) => {
                  const actionMeta = getMaintenanceActionDisplay(log.action);
                  const actor = getStaffDisplay(log.actorId, user);
                  const isReleased =
                    log.toStatus === "RELEASED" ||
                    log.action === "BLOCK_RELEASE";
                  const isCancel =
                    log.toStatus === "CANCELLED" ||
                    log.action === "BLOCK_CANCEL";
                  const timelineColor = isReleased
                    ? "green"
                    : isCancel
                      ? "red"
                      : "blue";

                  return {
                    color: timelineColor,
                    children: (
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Tag
                            color={actionMeta.color}
                            style={{ margin: 0, fontWeight: 600 }}
                          >
                            {actionMeta.label}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(log.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                          </Text>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#595959",
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>Người thực hiện:</span>
                          <Text strong>{actor.fullName}</Text>
                          <Tag
                            color={actor.color}
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            {actor.roleTitle}
                          </Tag>
                        </div>
                        {log.notes && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: "6px 10px",
                              background: "#fafafa",
                              borderRadius: 4,
                              fontSize: 12,
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
              <Text type="secondary">Chưa có lịch sử</Text>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};
