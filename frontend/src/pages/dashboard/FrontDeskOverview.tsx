import { CheckCircleOutlined, LoginOutlined, LogoutOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import type { DashboardReport, ReservationSeriesItem } from '../../types/reports.types.ts';
import type { StaySummaryItem } from '../../types/stays.types.ts';
import './frontDeskOverview.css';

const { Title, Text } = Typography;

type TodayTasksProps = {
  date: string;
  snapshot?: DashboardReport;
  snapshotPending: boolean;
  snapshotFailed: boolean;
  stays: StaySummaryItem[];
  stayTotal?: number;
  staysFailed: boolean;
  onRetrySnapshot: () => void;
  onRetryStays: () => void;
};

export function TodayTasks({
  date, snapshot, snapshotPending, snapshotFailed, stays, stayTotal, staysFailed,
  onRetrySnapshot, onRetryStays,
}: TodayTasksProps) {
  const metrics = [
    { label: 'Chờ nhận phòng', tone: 'arrivals', count: snapshot?.reservations.expectedArrivals, icon: <LoginOutlined /> },
    { label: 'Đến hạn trả', tone: 'departures', count: stayTotal, icon: <LogoutOutlined /> },
    { label: 'Cần dọn', tone: 'dirty', count: snapshot?.rooms?.dirty, icon: <ToolOutlined /> },
    { label: 'Sẵn sàng', tone: 'ready', count: snapshot?.rooms?.ready, icon: <CheckCircleOutlined /> },
  ];
  const dueStaysUrl = `/stays?scheduledCheckOutDate=${date}`;

  return (
    <section className="front-desk-section" aria-labelledby="front-desk-today">
      <div className="front-desk-heading">
        <Title id="front-desk-today" level={4}>Việc cần xử lý hôm nay</Title>
        <Text type="secondary"><time dateTime={date}>{dayjs(date).format('DD/MM/YYYY')}</time></Text>
      </div>
      <dl className="front-desk-metrics" aria-busy={snapshotPending || (stayTotal === undefined && !staysFailed)}>
        {metrics.map(({ label, tone, count, icon }) => (
          <div key={label} className={`front-desk-metric front-desk-metric--${tone}`}>
            <dt><span aria-hidden="true">{icon}</span>{label}</dt>
            <dd>
              <strong>{count ?? '—'}</strong>
              <Text type="secondary">{count === undefined ? 'Chưa có số liệu' : 'phòng'}</Text>
            </dd>
          </div>
        ))}
      </dl>
      {snapshotFailed && (
        <Alert
          type="error"
          showIcon
          title="Chưa tải được số liệu vận hành hôm nay"
          action={<Button size="small" onClick={onRetrySnapshot}>Thử lại</Button>}
        />
      )}
      <Card size="small">
        <div className="front-desk-card-heading">
          <Title level={5}>Đến hạn trả hôm nay</Title>
          {stayTotal !== undefined && stayTotal > stays.length && (
            <Link to={dueStaysUrl}>Xem tất cả ({stayTotal})</Link>
          )}
        </div>
        {staysFailed ? (
          <Alert
            type="error"
            showIcon
            title="Chưa tải được danh sách trả phòng"
            action={<Button size="small" onClick={onRetryStays}>Thử lại</Button>}
          />
        ) : stayTotal === undefined ? (
          <div className="front-desk-loading"><Spin size="small" description="Đang tải danh sách trả phòng" /></div>
        ) : stays.length === 0 ? (
          <Text type="secondary">Không có phòng đang ở đến hạn trả hôm nay.</Text>
        ) : (
          <ul className="front-desk-stays">
            {stays.map((stay) => (
              <li key={stay.stayId}>
                <Text strong className="front-desk-room">Phòng {stay.room.roomNumber}</Text>
                <span>{stay.bookerGuest?.fullName || 'Khách lưu trú'}</span>
                <Link
                  to={`${dueStaysUrl}&stayId=${stay.stayId}`}
                  aria-label={`Mở lưu trú phòng ${stay.room.roomNumber}`}
                >
                  Mở lưu trú
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

const scheduleSeries = [
  { metric: 'expectedArrivals', label: 'Dự kiến nhận', tone: 'arrivals' },
  { metric: 'expectedDepartures', label: 'Dự kiến trả', tone: 'departures' },
] as const;

export function RoomSchedule({ days, series, failed, onRetry }: {
  days?: number;
  series?: ReservationSeriesItem[];
  failed: boolean;
  onRetry: () => void;
}) {
  const maxRooms = Math.max(1, ...(series ?? []).flatMap((row) =>
    scheduleSeries.map(({ metric }) => row[metric]),
  ));

  return (
    <section className="front-desk-section" aria-labelledby="front-desk-schedule">
      <Card size="small">
        <div className="front-desk-card-heading">
          <div>
            <Title id="front-desk-schedule" level={5}>Lịch nhận và trả phòng</Title>
            {days && <Text type="secondary">{days} ngày kể từ hôm nay</Text>}
          </div>
          {series && !failed && (
            <div className="front-desk-legend" aria-hidden="true">
              {scheduleSeries.map(({ label, tone }) => (
                <span key={tone} className={`front-desk-legend--${tone}`}>{label}</span>
              ))}
            </div>
          )}
        </div>
        {failed ? (
          <Alert
            type="error"
            showIcon
            title="Chưa tải được lịch nhận và trả phòng"
            action={<Button size="small" onClick={onRetry}>Thử lại</Button>}
          />
        ) : !series ? (
          <div className="front-desk-loading"><Spin size="small" description="Đang tải lịch nhận và trả phòng" /></div>
        ) : series.length === 0 ? (
          <Text type="secondary">Chưa có dữ liệu lịch phòng cho kỳ này.</Text>
        ) : (
          <ul className="front-desk-schedule">
            {series.map((row, index) => (
              <li key={row.date}>
                <div className="front-desk-schedule-date">
                  <time dateTime={row.date}>{dayjs(row.date).format('DD/MM')}</time>
                  {index === 0 && <small>Hôm nay</small>}
                </div>
                <div className="front-desk-bars">
                  {scheduleSeries.map(({ metric, label, tone }) => (
                    <div key={metric} className={`front-desk-bar front-desk-bar--${tone}`}>
                      <span className="front-desk-sr-only">{label}</span>
                      <span className="front-desk-track" aria-hidden="true">
                        <span style={{ width: `${row[metric] / maxRooms * 100}%` }} />
                      </span>
                      <span className="front-desk-bar-value">{row[metric]}<span className="front-desk-sr-only"> phòng</span></span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
