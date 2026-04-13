"use client";

import { useState } from "react";

interface HeatmapChartProps {
  data: number[][];
  rowLabels: string[];
  colLabels: string[];
  color?: string;
}

export function HeatmapChart({
  data,
  rowLabels,
  colLabels,
  color = "#3b82f6",
}: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Không có dữ liệu
      </div>
    );
  }

  const allValues = data.flat();
  const maxValue = Math.max(...allValues) || 1;

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 59, g: 130, b: 246 };
  }

  const rgb = hexToRgb(color);

  function cellColor(value: number): string {
    if (value === 0) return "transparent";
    const intensity = value / maxValue;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(intensity * 0.85 + 0.1).toFixed(2)})`;
  }

  const cellSize = 20;
  const rowLabelWidth = 40;
  const colLabelHeight = 24;

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Column labels */}
        <div className="flex" style={{ paddingLeft: rowLabelWidth }}>
          {colLabels.map((label, ci) => (
            <div
              key={ci}
              className="text-center text-[9px] text-muted-foreground shrink-0"
              style={{ width: cellSize, height: colLabelHeight }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {data.map((row, ri) => (
          <div key={ri} className="flex items-center">
            {/* Row label */}
            <div
              className="shrink-0 text-right text-[10px] text-muted-foreground pr-1.5"
              style={{ width: rowLabelWidth }}
            >
              {rowLabels[ri] ?? ""}
            </div>
            {/* Cells */}
            {row.map((value, ci) => (
              <div
                key={ci}
                className="shrink-0 cursor-default rounded-sm border border-transparent relative"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cellColor(value),
                }}
                onMouseEnter={() => setTooltip({ row: ri, col: ci, value })}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 pl-10">
          <span className="text-[10px] text-muted-foreground">Ít</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">Nhiều</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none rounded border bg-popover px-2 py-1 text-xs shadow-md">
          <span className="text-muted-foreground">
            {rowLabels[tooltip.row]} {colLabels[tooltip.col]}:
          </span>{" "}
          <span className="font-medium">{tooltip.value} đơn</span>
        </div>
      )}
    </div>
  );
}
