import { Empty } from 'antd';
import dayjs from 'dayjs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
  type AxisDomain,
} from 'recharts';
import './ReportCharts.css';

type TrendPoint = { date: string };

interface TrendSeries<T> {
  dataKey: Extract<keyof T, string>;
  label: string;
  color: string;
  dashed?: boolean;
}

interface ReportTrendChartProps<T extends TrendPoint> {
  label: string;
  data: readonly T[];
  series: readonly TrendSeries<T>[];
  groupBy: 'day' | 'month';
  formatTick: (value: number) => string;
  describePoint: (point: T) => { label: string; value: string }[];
  domain?: AxisDomain;
}

const automaticDomain: AxisDomain = ['auto', 'auto'];
const tickStyle = { fill: '#52645f', fontSize: 11 };

function ReportDateAxis({ data, groupBy }: { data: readonly TrendPoint[]; groupBy: 'day' | 'month' }) {
  const plot = usePlotArea();
  const labelSpacing = groupBy === 'month' ? 64 : 50;
  const tickCount = Math.min(data.length, Math.max(2, Math.floor((plot?.width ?? 0) / labelSpacing)));
  const step = (data.length - 1) / Math.max(1, tickCount - 1);
  const ticks = Array.from({ length: tickCount }, (_, index) => data[Math.round(index * step)].date);

  return (
    <XAxis
      dataKey="date"
      tickFormatter={(date: string) => dayjs(date).format(groupBy === 'month' ? 'MM/YYYY' : 'DD/MM')}
      ticks={ticks}
      interval={0}
      tick={tickStyle}
      axisLine={false}
      tickLine={false}
      tickMargin={8}
      padding={{ left: 6, right: 6 }}
    />
  );
}

export function ReportTrendChart<T extends TrendPoint>({
  label,
  data,
  series,
  groupBy,
  formatTick,
  describePoint,
  domain = automaticDomain,
}: ReportTrendChartProps<T>) {
  if (!data.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu biểu đồ" />;
  }

  return (
    <div className="report-trend">
      <ul className="report-trend__legend">
        {series.map(({ dataKey, label: seriesLabel, color, dashed }) => (
          <li key={dataKey}>
            <span aria-hidden="true" style={{ borderColor: color, borderTopStyle: dashed ? 'dashed' : 'solid' }} />
            {seriesLabel}
          </li>
        ))}
      </ul>
      <LineChart
        className="report-trend__plot"
        style={{ width: '100%', height: 'var(--report-chart-height)' }}
        responsive
        accessibilityLayer
        title={label}
        desc="Dùng phím mũi tên trái và phải để xem số liệu từng mốc."
        data={data}
        margin={{ top: 12, right: 18, bottom: 0, left: 2 }}
      >
        <CartesianGrid vertical={false} stroke="#e1eae5" strokeDasharray="3 4" />
        <ReportDateAxis data={data} groupBy={groupBy} />
        <YAxis
          width="auto"
          domain={domain}
          tickFormatter={formatTick}
          tick={tickStyle}
          axisLine={false}
          tickLine={false}
          tickMargin={7}
        />
        <ReferenceLine y={0} ifOverflow="extendDomain" stroke="#82958b" />
        <Tooltip
          filterNull={false}
          isAnimationActive={false}
          cursor={{ stroke: '#82958b', strokeDasharray: '3 4' }}
          content={({ active, label: date }) => {
            const point = active ? data.find((item) => item.date === date) : undefined;
            if (!point) return null;
            return (
              <div className="report-trend__tooltip" role="status">
                <strong>{dayjs(point.date).format(groupBy === 'month' ? '[Tháng] MM/YYYY' : 'DD/MM/YYYY')}</strong>
                <dl>
                  {describePoint(point).map(({ label: metric, value }) => (
                    <div key={metric}><dt>{metric}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              </div>
            );
          }}
        />
        {series.map(({ dataKey, label: seriesLabel, color, dashed }) => (
          <Line
            key={dataKey}
            dataKey={dataKey}
            name={seriesLabel}
            type="linear"
            connectNulls={false}
            isAnimationActive={false}
            stroke={color}
            strokeWidth={2.5}
            strokeDasharray={dashed ? '6 4' : undefined}
            dot={({ index, cx, cy }) => {
              if (cx == null || cy == null) return null;
              const isolated = data[index - 1]?.[dataKey] == null && data[index + 1]?.[dataKey] == null;
              return data.length <= 12 || isolated ? <circle cx={cx} cy={cy} r={2.5} fill={color} /> : null;
            }}
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </div>
  );
}
