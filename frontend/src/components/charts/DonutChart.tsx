import React from 'react';
import { Typography, Tooltip, Row, Col, Empty } from 'antd';

const { Text } = Typography;

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  title?: string;
  totalLabel?: string;
  size?: number;
  valueFormatter?: (val: number) => string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  totalLabel = 'Lượt đặt',
  size = 200,
  valueFormatter,
}) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (!data.length || total === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Empty description="Chưa có dữ liệu phân bổ" />
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const innerR = size * 0.28;

  let accumulatedAngle = -Math.PI / 2; // Start from 12 o'clock

  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);

    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    // Handle full circle edge case
    const path =
      d.value === total
        ? `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.001} ${cy - outerR} L ${cx - 0.001} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`
        : `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    const percent = ((d.value / total) * 100).toFixed(1);

    return {
      ...d,
      path,
      percent,
    };
  });

  return (
    <Row gutter={[24, 16]} align="middle">
      <Col xs={24} sm={10} style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size}>
            {slices.map((slice) => (
              <Tooltip
                key={slice.key}
                title={`${slice.label}: ${valueFormatter ? valueFormatter(slice.value) : slice.value.toLocaleString('vi-VN')} (${slice.percent}%)`}
                color="#1e293b"
              >
                <path
                  d={slice.path}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                />
              </Tooltip>
            ))}
          </svg>

          {/* Center Content */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              width: innerR * 1.8,
            }}
          >
            <div
              style={{
                fontSize: total >= 1_000_000 ? 14 : 20,
                fontWeight: 700,
                color: '#1b4d3e',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {valueFormatter ? valueFormatter(total) : total.toLocaleString('vi-VN')}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {totalLabel}
            </div>
          </div>
        </div>
      </Col>

      {/* Legend list */}
      <Col xs={24} sm={14}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slices.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 6,
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <Text ellipsis style={{ fontSize: 13, color: '#334155' }}>{item.label}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                  {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString('vi-VN')}
                </Text>
                <span
                  style={{
                    fontSize: 11,
                    color: '#64748b',
                    minWidth: 42,
                    textAlign: 'right',
                  }}
                >
                  {item.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Col>
    </Row>
  );
};
