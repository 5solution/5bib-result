"use client";

import { useState } from "react";

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  formatValue?: (v: number) => string;
}

function defaultFormat(v: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(v));
}

export function DonutChart({
  data,
  size = 180,
  thickness = 36,
  formatValue = defaultFormat,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Không có dữ liệu
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = r - thickness;
  const circumference = 2 * Math.PI * r;

  // Build slices as SVG arcs
  let cumulativeAngle = -Math.PI / 2; // start at top

  const slices = data.map((item, i) => {
    const fraction = item.value / total;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      "Z",
    ].join(" ");

    return { path, item, fraction, index: i };
  });

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map(({ path, item, index }) => (
            <path
              key={index}
              d={path}
              fill={item.color}
              opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.5}
              stroke="transparent"
              strokeWidth="2"
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hovered ? (
            <>
              <span className="text-xs font-medium leading-tight text-foreground max-w-[80px] truncate">
                {hovered.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {((hovered.value / total) * 100).toFixed(1)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Total</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-xs cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate max-w-[100px]" title={item.label}>
              {item.label}
            </span>
            <span className="font-medium tabular-nums">{((item.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
