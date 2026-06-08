"use client";

/**
 * F-069 Merchant Portal — hand-rolled SVG charts + time controls
 * (ported from mp-charts.jsx). Zero chart deps. Typed data props.
 */
import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { fmt, parseDate } from "@/lib/mp/fmt";
import { t, type Lang } from "@/lib/mp/i18n";
import type { TicketForecastDto, TicketHeatmapDto, TicketSalesSummaryDto } from "@/lib/api-generated/types.gen";

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
            {hiItem ? (lang === "en" ? hiItem.it.en : hiItem.it.vi) : t("tickets_word", lang)}
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

// ============================================================
// F-070 MKT analytics — insight footer + empty state helpers
// ============================================================
function InsightFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 9, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--5s-surface)" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: "var(--5s-magenta-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--5s-magenta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
        </svg>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--5s-text-muted)" }}>{children}</div>
    </div>
  );
}

function ChartEmpty({ msg }: { msg: string }) {
  return <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: CH.textSubtle }}>{msg}</div>;
}

// ============================================================
// PaceChart (F-070) — cumulative + projection + target line
// ============================================================
export function PaceChart({
  data,
  lang = "vi",
  target,
  width = 1080,
  height = 280,
}: {
  data: TicketForecastDto;
  lang?: Lang;
  target?: number | null;
  width?: number;
  height?: number;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  // effective target: explicit prop overrides DTO field (lets the page redraw
  // optimistically), 0 → treated as "no target" per BR-70-09.
  const rawTarget = target !== undefined ? target : data.target;
  const effTarget = rawTarget != null && rawTarget > 0 ? rawTarget : null;

  const cum = useMemo(
    () =>
      data.cumulative
        .map((p) => ({ ms: parseDate(p.date)?.getTime() ?? NaN, v: p.value, date: p.date }))
        .filter((p) => Number.isFinite(p.ms)),
    [data.cumulative],
  );

  if (cum.length < 2) {
    return <ChartEmpty msg={t("not_enough_data", lang)} />;
  }

  const raceEnded = data.raceEnded;
  const projection = !raceEnded && data.projectedValue != null && data.projectionDate != null ? data.projectedValue : null;
  const projMs = projection != null ? parseDate(data.projectionDate)?.getTime() ?? null : null;

  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const t0 = cum[0].ms;
  const lastActual = cum[cum.length - 1];
  // right edge = race day (projection) if known & after last actual, else last actual
  const t1 = projMs != null && projMs > lastActual.ms ? projMs : lastActual.ms;
  const span = Math.max(1, t1 - t0);

  const topVal = Math.max(lastActual.v, effTarget ?? 0, projection ?? 0);
  const niceMax = niceCeil(topVal * 1.05);

  const xx = (ms: number) => pad.l + ((ms - t0) / span) * iw;
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;

  const actualPts = cum.map((p) => `${xx(p.ms)},${y(p.v)}`).join(" ");
  const lastX = xx(lastActual.ms);
  const lastY = y(lastActual.v);
  const projX = projMs != null ? xx(projMs) : null;
  const projY = projection != null ? y(projection) : null;

  // month ticks across the window
  const ticks: { ms: number; label: string }[] = [];
  const d = new Date(t0);
  d.setDate(1);
  let guard = 0;
  while (d.getTime() <= t1 && guard < 60) {
    if (d.getTime() >= t0) ticks.push({ ms: d.getTime(), label: fmt.monthShort(d, lang) });
    d.setMonth(d.getMonth() + 1);
    guard++;
  }

  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (width / r.width);
    const ms = t0 + ((px - pad.l) / iw) * span;
    let best = 0;
    let bd = Infinity;
    cum.forEach((p, i) => {
      const dd = Math.abs(p.ms - ms);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setHi(best);
  };

  // ---- insight text ----
  let insight: ReactNode;
  if (raceEnded) {
    insight = (
      <>
        <strong style={{ color: "var(--5s-text)", fontWeight: 700 }}>{t("insight", lang)} · </strong>
        {t("insight_race_ended", lang).replace("{n}", fmt.num(lastActual.v, lang))}
      </>
    );
  } else if (projection != null) {
    const above = effTarget != null && projection >= effTarget;
    let body: string;
    if (effTarget != null) {
      body = t(above ? "insight_proj_above" : "insight_proj_below", lang)
        .replace("{proj}", fmt.num(projection, lang))
        .replace("{target}", fmt.num(effTarget, lang));
    } else {
      body = t("insight_proj_notarget", lang).replace("{proj}", fmt.num(projection, lang));
    }
    insight = (
      <>
        <strong style={{ color: "var(--5s-text)", fontWeight: 700 }}>{t("insight", lang)} · </strong>
        {body}
      </>
    );
  } else {
    insight = (
      <>
        <strong style={{ color: "var(--5s-text)", fontWeight: 700 }}>{t("insight", lang)} · </strong>
        {t("not_enough_data", lang)}
      </>
    );
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
          {yLines.map((v, i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke={CH.grid} strokeWidth="1" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
                {fmt.num(v, lang)}
              </text>
            </g>
          ))}

          {/* target line (purple) */}
          {effTarget != null && (
            <g>
              <line x1={pad.l} x2={pad.l + iw} y1={y(effTarget)} y2={y(effTarget)} stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="5 4" />
              <text x={pad.l + iw} y={y(effTarget) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill="#7C3AED">
                {t("target_label", lang)} {fmt.num(effTarget, lang)}
              </text>
            </g>
          )}

          {/* race-day marker */}
          {projX != null && (
            <g>
              <line x1={projX} x2={projX} y1={pad.t} y2={pad.t + ih} stroke="var(--5s-danger)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <text x={projX} y={pad.t + 9} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--5s-danger)">
                {t("race_day", lang)}
              </text>
            </g>
          )}

          {/* projection line (blue dashed) */}
          {projX != null && projY != null && (
            <g>
              <line x1={lastX} y1={lastY} x2={projX} y2={projY} stroke={CH.blue} strokeWidth="2" strokeDasharray="6 5" opacity="0.7" />
              <circle cx={projX} cy={projY} r="4.5" fill="#fff" stroke={CH.blue} strokeWidth="2" />
            </g>
          )}

          {/* actual cumulative */}
          <polyline points={actualPts} fill="none" stroke={CH.blue} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />

          {ticks.map((tk, i) => (
            <text key={i} x={xx(tk.ms)} y={height - 8} textAnchor="middle" fontSize="11" fill={CH.textSubtle} fontFamily="var(--font-mono)">
              {tk.label}
            </text>
          ))}

          {hi != null && (
            <g>
              <line x1={xx(cum[hi].ms)} x2={xx(cum[hi].ms)} y1={pad.t} y2={pad.t + ih} stroke={CH.blue} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={xx(cum[hi].ms)} cy={y(cum[hi].v)} r="5" fill="#fff" stroke={CH.blue} strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {hi != null && (
          <Tooltip width={width} cx={xx(cum[hi].ms)} cyTop={pad.t}>
            <div style={{ fontSize: 11, color: CH.textSubtle, marginBottom: 3 }}>{fmtPaceDate(cum[hi].date, lang)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, color: CH.text }}>
              {fmt.num(cum[hi].v, lang)} <span style={{ fontWeight: 500, color: CH.textSubtle, fontSize: 12 }}>{t("cumulative_tickets", lang)}</span>
            </div>
          </Tooltip>
        )}
      </div>
      <InsightFooter>{insight}</InsightFooter>
    </div>
  );
}

function fmtPaceDate(iso: string, lang: Lang): string {
  const d = parseDate(iso);
  return d ? fmt.date(d, lang) : iso;
}

// ============================================================
// Heatmap (F-070) — 7 days × 7 time buckets
// ============================================================
export function Heatmap({ data, lang = "vi", width = 1080 }: { data: TicketHeatmapDto; lang?: Lang; width?: number }) {
  const [hi, setHi] = useState<{ r: number; c: number } | null>(null);
  const max = Math.max(1, data.max);
  const totalCells = data.grid.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0);

  if (totalCells === 0) {
    return <ChartEmpty msg={t("no_reg_data", lang)} />;
  }

  const cellBg = (v: number) => `rgba(29,73,255,${0.06 + (v / max) * 0.92})`;
  const labelW = 54;
  const cw = (width - labelW) / 7;

  // insight: find peak cell
  let peak = { r: 0, c: 0, v: -1 };
  data.grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v > peak.v) peak = { r, c, v };
    }),
  );
  const peakDay = data.dayLabels[peak.r] ?? "";
  const peakBucket = data.bucketLabels[peak.c] ?? "";

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", paddingLeft: labelW }}>
          {data.bucketLabels.map((b, i) => (
            <div key={i} style={{ width: cw, textAlign: "center", fontSize: 10, color: CH.textSubtle, fontFamily: "var(--font-mono)" }}>
              {b}
            </div>
          ))}
        </div>
        {data.grid.map((row, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: labelW, fontSize: 11.5, fontWeight: 700, color: "var(--5s-text-muted)" }}>{data.dayLabels[r]}</div>
            {row.map((v, c) => {
              const on = hi?.r === r && hi?.c === c;
              return (
                <div
                  key={c}
                  onMouseEnter={() => setHi({ r, c })}
                  onMouseLeave={() => setHi(null)}
                  style={{
                    width: cw - 4,
                    height: 30,
                    margin: 2,
                    borderRadius: 6,
                    background: cellBg(v),
                    cursor: "pointer",
                    outline: on ? "2px solid var(--5s-magenta)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: v / max > 0.5 ? "#fff" : "var(--5s-text-subtle)" }}>
                    {fmt.num(v, lang)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: labelW }}>
          <span style={{ fontSize: 10.5, color: CH.textSubtle }}>{t("legend_low", lang)}</span>
          <div style={{ flex: 1, maxWidth: 160, height: 8, borderRadius: 99, background: "linear-gradient(90deg, rgba(29,73,255,0.08), rgba(29,73,255,0.98))" }} />
          <span style={{ fontSize: 10.5, color: CH.textSubtle }}>{t("legend_high", lang)}</span>
          <span style={{ fontSize: 10.5, color: CH.textSubtle, marginLeft: 6 }}>· {t("vn_hours", lang)}</span>
        </div>
      </div>
      <InsightFooter>
        <strong style={{ color: "var(--5s-text)", fontWeight: 700 }}>{t("insight", lang)} · </strong>
        {t("insight_heatmap", lang).replace("{day}", peakDay).replace("{bucket}", peakBucket)}
      </InsightFooter>
    </div>
  );
}

// ============================================================
// Funnel (F-070) — derived from ticket summary (counts only)
// ============================================================
function statusOrderCount(summary: TicketSalesSummaryDto, statuses: string[]): number {
  return summary.byStatus.filter((s) => statuses.includes(s.financialStatus)).reduce((a, s) => a + s.orderCount, 0);
}

function FunnelStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 14px", border: "1px solid var(--5s-border)", borderRadius: 11, background: "var(--5s-bg)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--5s-text-subtle)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 22, color }}>{value}</div>
    </div>
  );
}

export function Funnel({ summary, lang = "vi" }: { summary: TicketSalesSummaryDto; lang?: Lang }) {
  const total = summary.totalOrders;

  if (total === 0) {
    return <ChartEmpty msg={t("no_reg_data", lang)} />;
  }

  const confirmed = statusOrderCount(summary, ["paid", "completed"]);
  const pending = statusOrderCount(summary, ["pending"]);
  const dropped = statusOrderCount(summary, ["voided", "cancelled", "refunded"]);

  const conv = (confirmed / total) * 100;
  const pendRate = (pending / total) * 100;
  const cancelRate = (dropped / total) * 100;

  const stages = [
    { label: t("orders_created", lang), v: total, color: "var(--5s-blue-300)" },
    { label: t("paid_confirmed", lang), v: confirmed, color: "var(--5s-blue)" },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stages.map((st, i) => {
          const w = (st.v / total) * 100;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--5s-text)" }}>{st.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--5s-text)" }}>
                  {fmt.num(st.v, lang)} <span style={{ color: CH.textSubtle }}>· {w.toFixed(1)}%</span>
                </span>
              </div>
              <div style={{ height: 34, background: "var(--5s-surface)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ width: w + "%", height: "100%", background: st.color, borderRadius: 8, transition: "width .5s var(--ease-out-expo)" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <FunnelStat label={t("conversion", lang)} value={conv.toFixed(1) + "%"} color="var(--5s-success)" />
        <FunnelStat label={t("pending_rate", lang)} value={pendRate.toFixed(1) + "%"} color="var(--5s-warning)" />
        <FunnelStat label={t("cancel_rate", lang)} value={cancelRate.toFixed(1) + "%"} color="var(--5s-danger)" />
      </div>
      <InsightFooter>
        <strong style={{ color: "var(--5s-text)", fontWeight: 700 }}>{t("insight", lang)} · </strong>
        {t("insight_funnel", lang)
          .replace("{conv}", conv.toFixed(0))
          .replace("{pend}", pendRate.toFixed(0))
          .replace("{cancel}", cancelRate.toFixed(0))}
      </InsightFooter>
    </div>
  );
}

export type { RefObject };
