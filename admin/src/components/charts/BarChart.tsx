"use client";

interface BarItem {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarItem[];
  maxValue?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

function defaultFormat(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B đ";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + "M đ";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K đ";
  return new Intl.NumberFormat("vi-VN").format(Math.round(v));
}

export function BarChart({
  data,
  maxValue,
  color = "#3b82f6",
  formatValue = defaultFormat,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Không có dữ liệu
      </div>
    );
  }

  const max = maxValue ?? (Math.max(...data.map((d) => d.value)) || 1);

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, 0);
        return (
          <div key={i} className="flex items-center gap-3">
            {/* Label */}
            <div
              className="w-36 shrink-0 truncate text-right text-xs text-muted-foreground"
              title={item.label}
            >
              {item.label}
            </div>
            {/* Bar */}
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 rounded-full bg-muted/40" style={{ height: 8 }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
                {formatValue(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
