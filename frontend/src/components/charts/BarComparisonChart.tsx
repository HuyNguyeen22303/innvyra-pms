import React, { useMemo } from 'react';
import { Typography, Tooltip, Empty } from 'antd';

const { Text } = Typography;

export interface BarComparisonItem {
  key: string;
  label: string;
  value1: number;
  value2: number;
  tooltipTitle?: string;
  tooltipText1?: string;
  tooltipText2?: string;
}

export interface BarComparisonChartProps {
  data: BarComparisonItem[];
  series1Label: string;
  series2Label: string;
  series1Color?: string;
  series2Color?: string;
  valueFormatter?: (val: number) => string;
  height?: number;
}

const defaultFormatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' Tỷ';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + ' Tr';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + ' k';
  return num.toLocaleString('vi-VN');
};

export const BarComparisonChart: React.FC<BarComparisonChartProps> = ({
  data,
  series1Label,
  series2Label,
  series1Color = '#1b4d3e',
  series2Color = '#1890ff',
  valueFormatter = defaultFormatNumber,
  height = 280,
}) => {
  const chartHeight = height;
  const padding = { top: 30, right: 24, bottom: 45, left: 85 };
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Calculate scales
  const maxValue = useMemo(() => {
    if (!data.length) return 100;
    const maxVal = Math.max(...data.flatMap((d) => [Math.max(0, d.value1), Math.max(0, d.value2)]));
    return maxVal <= 0 ? 100 : maxVal * 1.15; // 15% headroom
  }, [data]);

  const yTicks = useMemo(() => {
    const ticks = [0];
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      ticks.push((maxValue / steps) * i);
    }
    return ticks;
  }, [maxValue]);

  if (!data.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="Chưa có dữ liệu biểu đồ" />
      </div>
    );
  }

  // Minimum width per data item to prevent cramped bars
  const minItemWidth = 52;
  const computedInnerWidth = Math.max(data.length * minItemWidth, 600);
  const totalSvgWidth = computedInnerWidth + padding.left + padding.right;

  const itemSlotWidth = computedInnerWidth / data.length;
  const barWidth = Math.min(Math.max(itemSlotWidth * 0.32, 10), 22);
  const barGap = 4;

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      {/* Legend header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 12,
          paddingLeft: 4,
          paddingRight: 8,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: series1Color,
              display: 'inline-block',
            }}
          />
          <Text strong style={{ color: '#475569', whiteSpace: 'nowrap' }}>
            {series1Label}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: series2Color,
              display: 'inline-block',
            }}
          />
          <Text strong style={{ color: '#475569', whiteSpace: 'nowrap' }}>
            {series2Label}
          </Text>
        </div>
      </div>

      {/* Scrollable Chart Body */}
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          width: '100%',
          border: '1px solid #f1f5f9',
          borderRadius: 8,
          backgroundColor: '#fafcfa',
        }}
      >
        <svg
          width={totalSvgWidth}
          height={chartHeight}
          style={{ display: 'block', minWidth: '100%' }}
        >
          {/* Y Axis Grid lines & Tick Labels */}
          {yTicks.map((tickVal, idx) => {
            const yPos = padding.top + innerHeight - (tickVal / maxValue) * innerHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + computedInnerWidth}
                  y2={yPos}
                  stroke={idx === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeDasharray={idx === 0 ? undefined : '4 4'}
                  strokeWidth={idx === 0 ? 1.5 : 1}
                />
                <text
                  x={padding.left - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="#64748b"
                  fontWeight={500}
                >
                  {valueFormatter(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Bars & X Labels */}
          {data.map((item, idx) => {
            const slotCenterX = padding.left + idx * itemSlotWidth + itemSlotWidth / 2;
            const x1 = slotCenterX - barWidth - barGap / 2;
            const x2 = slotCenterX + barGap / 2;

            const val1Clamped = Math.max(0, item.value1);
            const val2Clamped = Math.max(0, item.value2);

            const bar1Height = (val1Clamped / maxValue) * innerHeight;
            const bar2Height = (val2Clamped / maxValue) * innerHeight;

            const y1 = padding.top + innerHeight - bar1Height;
            const y2 = padding.top + innerHeight - bar2Height;

            const tooltipContent = (
              <div style={{ padding: '4px 6px', fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#f8fafc' }}>
                  {item.tooltipTitle || item.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: series1Color,
                      display: 'inline-block',
                    }}
                  />
                  <span>
                    {series1Label}:{' '}
                    <strong>{item.tooltipText1 || valueFormatter(item.value1)}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: series2Color,
                      display: 'inline-block',
                    }}
                  />
                  <span>
                    {series2Label}:{' '}
                    <strong>{item.tooltipText2 || valueFormatter(item.value2)}</strong>
                  </span>
                </div>
              </div>
            );

            return (
              <Tooltip key={item.key} title={tooltipContent} color="#1e293b" placement="top">
                <g style={{ cursor: 'pointer' }} className="chart-bar-group">
                  {/* Subtle hover background highlight */}
                  <rect
                    x={slotCenterX - itemSlotWidth / 2 + 2}
                    y={padding.top}
                    width={itemSlotWidth - 4}
                    height={innerHeight}
                    fill="transparent"
                    className="hover-bg"
                    style={{ transition: 'fill 0.15s ease' }}
                  />

                  {/* Bar 1 */}
                  {bar1Height > 0 && (
                    <rect
                      x={x1}
                      y={y1}
                      width={barWidth}
                      height={bar1Height}
                      fill={series1Color}
                      rx={3}
                      ry={3}
                      style={{ transition: 'opacity 0.15s ease' }}
                    />
                  )}

                  {/* Bar 2 */}
                  {bar2Height > 0 && (
                    <rect
                      x={x2}
                      y={y2}
                      width={barWidth}
                      height={bar2Height}
                      fill={series2Color}
                      rx={3}
                      ry={3}
                      style={{ transition: 'opacity 0.15s ease' }}
                    />
                  )}

                  {/* X Axis Label */}
                  <text
                    x={slotCenterX}
                    y={padding.top + innerHeight + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#475569"
                    fontWeight={500}
                  >
                    {item.label}
                  </text>
                </g>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
