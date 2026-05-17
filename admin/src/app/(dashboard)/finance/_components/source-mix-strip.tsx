"use client";

/**
 * FEATURE-040 — Source mix strip (F-028 dashboard).
 *
 * Visualizes distribution of contracts by feeSource as stacked progress bar.
 * Below KPI cards, above trend chart. Hidden if total === 0.
 *
 * Click segment → onSegmentClick(source) callback (parent navigates
 * /finance/contracts?feeSource=X).
 *
 * Tooltip pattern: title attribute (browser-native, consistent with existing
 * admin codebase that does NOT use a tooltip lib).
 */
import type { FeeSource, FeeSourceMixClient } from "@/lib/finance-api";
import { FEE_SOURCE_ICON, FEE_SOURCE_LABEL } from "./fee-source-badge";

interface Props {
  mix: FeeSourceMixClient | undefined;
  total: number;
  onSegmentClick?: (source: FeeSource) => void;
}

interface Segment {
  source: FeeSource;
  count: number;
  pct: number;
  bgClass: string;
  textClass: string;
}

const SEG_BG: Record<FeeSource, string> = {
  RECONCILIATION: "bg-green-500",
  SELF_COMPUTE: "bg-blue-500",
  MIXED: "bg-amber-500",
  ESTIMATED: "bg-stone-400",
};

const SEG_TEXT: Record<FeeSource, string> = {
  RECONCILIATION: "text-green-700",
  SELF_COMPUTE: "text-blue-700",
  MIXED: "text-amber-700",
  ESTIMATED: "text-stone-600",
};

export function SourceMixStrip({ mix, total, onSegmentClick }: Props) {
  if (!mix || total <= 0) return null;

  const segments: Segment[] = (
    [
      ["RECONCILIATION", mix.reconciliation] as const,
      ["SELF_COMPUTE", mix.selfCompute] as const,
      ["MIXED", mix.mixed] as const,
      ["ESTIMATED", mix.estimated] as const,
    ]
      .filter(([, count]) => count > 0)
      .map(([source, count]) => ({
        source,
        count,
        pct: (count / total) * 100,
        bgClass: SEG_BG[source],
        textClass: SEG_TEXT[source],
      }))
  );

  if (segments.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-stone-200 bg-white p-3"
      data-testid="source-mix-strip"
      aria-label="Phân bổ nguồn doanh thu theo hợp đồng"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-600">
          Nguồn doanh thu
        </h3>
        <span className="text-[11px] text-stone-500">
          {total} HĐ · click segment để filter
        </span>
      </div>

      {/* Stacked progress bar */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-stone-100"
        role="img"
        aria-label={segments
          .map((s) => `${Math.round(s.pct)}% ${FEE_SOURCE_LABEL[s.source]}`)
          .join(", ")}
      >
        {segments.map((s) => (
          <button
            key={s.source}
            type="button"
            onClick={() => onSegmentClick?.(s.source)}
            disabled={!onSegmentClick}
            className={`${s.bgClass} h-full transition-opacity hover:opacity-80 disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-blue-500`}
            style={{ width: `${s.pct}%` }}
            title={`${s.count} HĐ ${FEE_SOURCE_LABEL[s.source]} — click để filter`}
            aria-label={`${s.count} hợp đồng ${FEE_SOURCE_LABEL[s.source]}, ${Math.round(s.pct)}%`}
          />
        ))}
      </div>

      {/* Inline legend below bar */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {segments.map((s, idx) => (
          <span
            key={s.source}
            className={`inline-flex items-center gap-1 ${s.textClass}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-sm ${s.bgClass}`}
              aria-hidden
            />
            <span className="font-medium">
              {Math.round(s.pct)}% {FEE_SOURCE_ICON[s.source]}{" "}
              {FEE_SOURCE_LABEL[s.source]}
            </span>
            <span className="text-stone-400">({s.count})</span>
            {idx < segments.length - 1 ? (
              <span className="text-stone-300" aria-hidden>
                ·
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
