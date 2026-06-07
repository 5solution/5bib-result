"use client";

/**
 * F-069 Merchant Portal — hand-rolled SVG charts + time controls
 * (ported from mp-charts.jsx). Zero chart deps. Typed data props.
 */
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { fmt } from "@/lib/mp/fmt";
import { t, type Lang } from "@/lib/mp/i18n";

export const CH = {
  blue: "#1D49FF",
  energy: "#EA580C",
  green: "#166534",
  magenta: "#FF0E65",
  grid: "#EDEAE4",
  axis: "#A8A29E",
  text: "#57534E",
  textSubtle: "#78716C",
  sky: "#1FAAFF",
};

// ============================================================
// Generic data point shapes
// ============================================================
export interface AreaPoint {
  label: string;
  count: number;
  fullLabel?: string;
}
export interface MultiLinePoint {
  label: string;
  fullLabel?: string;
  [key: string]: number | string | undefined;
}
export interface BarItem {
  name: string;
  count: number;
}
export interface DonutItem {
  key: string;
  vi: string;
  en: string;
  count: number;
}
export interface LineSeries {
  key: string;
  color: string;
  label: string;
}

// ---------- axis tick helpers ----------
function xTicks(data: { label: string }[]): { i: number; label: string }[] {
  const n = data.length;
  if (n <= 1) return data.map((d, i) => ({ i, label: d.label }));
  const target = Math.min(7, n);
  const step = Math.max(1, Math.round((n - 1) / (target - 1)));
  const out: { i: number; label: string }[] = [];
  for (let i = 0; i < n; i += step) out.push({ i, label: data[i].label });
  if (out[out.length - 1].i !== n - 1) out.push({ i: n - 1, label: data[n - 1].label });
  return out;
}
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// ---------- tooltip ----------
function Tooltip({
  width,
  cx,
  cyTop,
  children,
}: {
  width: number;
  cx: number;
  cyTop: number;
  children: ReactNode;
}) {
  const leftPct = (cx / width) * 100;
  const flip = leftPct > 62;
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(${leftPct}% + ${flip ? -12 : 12}px)`,
        top: cyTop + 4,
        transform: flip ? "translateX(-100%)" : "none",
        background: "#fff",
        border: "1px solid var(--5s-border)",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg)",
        padding: "8px 12px",
        pointerEvents: "none",
        minWidth: 130,
        zIndex: 5,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// AreaChart — single series, gradient fill, hover crosshair
// ============================================================
export function AreaChart({
  data,
  width = 760,
  height = 240,
  lang = "vi",
  color = CH.blue,
  unit = "",
  valueFmt,
}: {
  data: AreaPoint[];
  width?: number;
  height?: number;
  lang?: Lang;
  color?: string;
  unit?: "" | "vnd";
  valueFmt?: (v: number) => string;
}) {
  const pad = { l: 52, r: 16, t: 16, b: 30 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const [hi, setHi] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (data.length === 0) {
    return <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: CH.textSubtle }}>{t("no_data", lang)}</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = niceCeil(max);
  const n = data.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;
  const fmtV = valueFmt || ((v: number) => fmt.num(v, lang));

  const linePts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(" ");
  const areaPath = `M ${pad.l},${pad.t + ih} L ${data.map((d, i) => `${x(i)},${y(d.count)}`).join(" L ")} L ${pad.l + iw},${pad.t + ih} Z`;
  const ticks = xTicks(data);
  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);
  const gid = `ag-${color.replace("#", "")}`;

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (width / r.width);
    let idx = Math.round(((px - pad.l) / iw) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHi(idx);
  };

  return (
    <div style={{ position: "relative" }}>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLines.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke={CH.grid} strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
              {unit === "vnd" ? fmt.vndShort(v) : fmt.num(v, lang)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={`url(#${gid})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((tk, i) => (
          <text key={i} x={x(tk.i)} y={height - 8} textAnchor="middle" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
            {tk.label}
          </text>
        ))}
        {hi != null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={pad.t + ih} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={x(hi)} cy={y(data[hi].count)} r="5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hi != null && (
        <Tooltip width={width} cx={x(hi)} cyTop={pad.t}>
          <div style={{ fontSize: 11, color: CH.textSubtle, marginBottom: 3 }}>{data[hi].fullLabel || data[hi].label}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, color: CH.text }}>{fmtV(data[hi].count)}</div>
        </Tooltip>
      )}
    </div>
  );
}

// ============================================================
// MultiLineChart — GMV / Fee / Net, legend, hover shows all
// ============================================================
export function MultiLineChart({
  data,
  width = 760,
  height = 260,
  lang = "vi",
  series,
}: {
  data: MultiLinePoint[];
  width?: number;
  height?: number;
  lang?: Lang;
  series: LineSeries[];
}) {
  const pad = { l: 56, r: 16, t: 16, b: 30 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const [hi, setHi] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const val = (d: MultiLinePoint, k: string): number => Number(d[k] ?? 0);
  if (data.length === 0) {
    return <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: CH.textSubtle }}>{t("no_data", lang)}</div>;
  }
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => val(d, s.key))));
  const niceMax = niceCeil(max);
  const n = data.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;
  const ticks = xTicks(data);
  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (width / r.width);
    const idx = Math.round(((px - pad.l) / iw) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, idx)));
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: CH.text }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        {yLines.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke={CH.grid} strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
              {fmt.vndShort(v)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.key}
            points={data.map((d, i) => `${x(i)},${y(val(d, s.key))}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {ticks.map((tk, i) => (
          <text key={i} x={x(tk.i)} y={height - 8} textAnchor="middle" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
            {tk.label}
          </text>
        ))}
        {hi != null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={pad.t + ih} stroke={CH.axis} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hi)} cy={y(val(data[hi], s.key))} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.5" />
            ))}
          </g>
        )}
      </svg>
      {hi != null && (
        <Tooltip width={width} cx={x(hi)} cyTop={pad.t}>
          <div style={{ fontSize: 11, color: CH.textSubtle, marginBottom: 5 }}>{data[hi].fullLabel || data[hi].label}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flex: "0 0 auto" }} />
              <span style={{ fontSize: 11, color: CH.textSubtle, flex: 1 }}>{s.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: CH.text }}>{fmt.vnd(val(data[hi], s.key), lang)}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

// ============================================================
// HBars — horizontal bar breakdown (by course)
// ============================================================
export function HBars({ items, lang = "vi", color = CH.blue }: { items: BarItem[]; lang?: Lang; color?: string }) {
  const total = items.reduce((a, b) => a + b.count, 0) || 1;
  const max = Math.max(...items.map((i) => i.count), 1);
  const [hi, setHi] = useState<number | null>(null);
  if (items.length === 0) {
    return <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: CH.textSubtle }}>{t("no_data", lang)}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it, i) => {
        const pct = (it.count / total) * 100;
        const w = (it.count / max) * 100;
        const on = hi === i;
        return (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: CH.text }}>{it.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: CH.text }}>
                {fmt.num(it.count, lang)} <span style={{ color: CH.textSubtle }}>· {pct.toFixed(1)}%</span>
              </span>
            </div>
            <div style={{ height: 10, background: "#F1EFEA", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  width: w + "%",
                  height: "100%",
                  background: on ? CH.magenta : color,
                  borderRadius: 99,
                  transition: "width .5s var(--ease-out-expo), background .15s",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Donut — ticket type breakdown with legend + hover
// ============================================================
export function Donut({ items, lang = "vi", size = 168 }: { items: DonutItem[]; lang?: Lang; size?: number }) {
  const palette = [CH.blue, CH.sky, CH.magenta, CH.energy, "#7C3AED", CH.green];
  const total = items.reduce((a, b) => a + b.count, 0) || 1;
  const [hi, setHi] = useState<number | null>(null);
  const r = size / 2;
  const ir = r * 0.62;
  const cx = r;
  const cy = r;
  const segs = items.map((it, i) => {
    const frac = it.count / total;
    // cumulative start fraction = sum of all preceding items
    const before = items.slice(0, i).reduce((a, b) => a + b.count, 0) / total;
    const a0 = before * 2 * Math.PI - Math.PI / 2;
    const a1 = (before + frac) * 2 * Math.PI - Math.PI / 2;
    return { it, i, a0, a1, frac, color: palette[i % palette.length] };
  });
  const arc = (a0: number, a1: number, rr: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)} A ${rr} ${rr} 0 ${large} 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)}`;
  };
  const hiItem = hi != null ? segs[hi] : null;
  if (items.length === 0) {
    return <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: CH.textSubtle }}>{t("no_data", lang)}</div>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {segs.map((s) => (
            <path
              key={s.i}
              d={arc(s.a0, s.a1, (r + ir) / 2)}
              stroke={s.color}
              fill="none"
              strokeWidth={hi === s.i ? r - ir + 6 : r - ir}
              strokeLinecap="butt"
              opacity={hi == null || hi === s.i ? 1 : 0.35}
              style={{ transition: "stroke-width .15s, opacity .15s", cursor: "pointer" }}
              onMouseEnter={() => setHi(s.i)}
              onMouseLeave={() => setHi(null)}
            />
          ))}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 22, color: CH.text }}>
            {hiItem ? (hiItem.frac * 100).toFixed(0) + "%" : fmt.num(total, lang)}
          </div>
          <div style={{ fontSize: 10, color: CH.textSubtle, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
            {hiItem ? (lang === "en" ? hiItem.it.en : hiItem.it.vi) : lang === "en" ? "tickets" : "vé"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {segs.map((s) => (
          <div
            key={s.i}
            onMouseEnter={() => setHi(s.i)}
            onMouseLeave={() => setHi(null)}
            style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", opacity: hi == null || hi === s.i ? 1 : 0.5, transition: "opacity .15s" }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "0 0 auto" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: CH.text, flex: 1 }}>{lang === "en" ? s.it.en : s.it.vi}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: CH.textSubtle }}>{fmt.num(s.it.count, lang)}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: CH.text, width: 42, textAlign: "right" }}>{(s.frac * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Controls — Segmented, PeriodSelector, GranularityToggle, DeltaPill
// ============================================================
export interface SegOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "6px 11px" : "8px 14px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <div style={{ display: "inline-flex", background: "#fff", border: "1px solid var(--5s-border)", borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="mp-focusable"
            style={{
              padding: pad,
              fontSize: fs,
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              border: "none",
              cursor: "pointer",
              borderRadius: 7,
              background: on ? "var(--5s-blue)" : "transparent",
              color: on ? "#fff" : "var(--5s-text-muted)",
              transition: "background .15s, color .15s",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type PeriodValue = "7d" | "30d" | "90d";
export type GranularityValue = "daily" | "weekly" | "monthly";

export function PeriodSelector({ value, onChange, lang }: { value: PeriodValue; onChange: (v: PeriodValue) => void; lang: Lang }) {
  return (
    <Segmented<PeriodValue>
      value={value}
      onChange={onChange}
      options={[
        { value: "7d", label: t("last_7", lang) },
        { value: "30d", label: t("last_30", lang) },
        { value: "90d", label: t("last_90", lang) },
      ]}
    />
  );
}

export function GranularityToggle({ value, onChange, lang }: { value: GranularityValue; onChange: (v: GranularityValue) => void; lang: Lang }) {
  return (
    <Segmented<GranularityValue>
      size="sm"
      value={value}
      onChange={onChange}
      options={[
        { value: "daily", label: t("daily", lang) },
        { value: "weekly", label: t("weekly", lang) },
        { value: "monthly", label: t("monthly", lang) },
      ]}
    />
  );
}

export function DeltaPill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: up ? "var(--5s-success)" : "var(--5s-danger)",
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: up ? "none" : "scaleY(-1)" }}
      >
        <path d="M2 8l4-4 4 4" />
      </svg>
      {fmt.pct(value)}
    </span>
  );
}

export type { RefObject };
