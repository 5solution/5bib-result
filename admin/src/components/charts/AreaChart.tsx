"use client";

import { useRef, useState } from "react";

interface DataPoint {
  date: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
}

export function AreaChart({ data, height = 200, color = "#3b82f6" }: AreaChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Không có dữ liệu
      </div>
    );
  }

  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 36;
  const width = 600; // viewBox width, scales with container
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const minVal = 0;
  const maxVal = Math.max(...values) * 1.1 || 1;

  const xStep = chartWidth / Math.max(data.length - 1, 1);

  const toX = (i: number) => paddingLeft + i * xStep;
  const toY = (v: number) =>
    paddingTop + chartHeight - ((v - minVal) / (maxVal - minVal)) * chartHeight;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));

  // Build SVG path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

  // Y axis labels
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = minVal + ((maxVal - minVal) * i) / yTicks;
    return { v, y: toY(v) };
  });

  // X axis labels — show up to 6 evenly spaced
  const xLabelCount = Math.min(data.length, 6);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i * (data.length - 1)) / Math.max(xLabelCount - 1, 1))
  );

  function formatYLabel(v: number): string {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
    return v.toFixed(0);
  }

  function formatTooltipValue(v: number): string {
    return new Intl.NumberFormat("vi-VN").format(Math.round(v)) + " đ";
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;

    // Find nearest point
    let nearest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });

    setTooltip({
      x: points[nearest].x,
      y: points[nearest].y,
      point: data[nearest],
    });
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={`area-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y grid lines and labels */}
        {yLabels.map(({ v, y }, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.5"
            >
              {formatYLabel(v)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#area-grad-${color.replace("#", "")})`}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X axis labels */}
        {xLabelIndices.map((idx) => (
          <text
            key={idx}
            x={toX(idx)}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            opacity="0.5"
          >
            {data[idx].date}
          </text>
        ))}

        {/* Tooltip dot */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              y1={paddingTop}
              x2={tooltip.x}
              y2={paddingTop + chartHeight}
              stroke={color}
              strokeOpacity="0.3"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r="4"
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <p className="font-medium text-foreground">{tooltip.point.date}</p>
          <p className="text-muted-foreground">{formatTooltipValue(tooltip.point.value)}</p>
        </div>
      )}
    </div>
  );
}
