"use client";

/**
 * F-028 — PnL Summary Card.
 *
 * Variants:
 *   - default: full card với 4 metric chính + badge revenue source
 *   - compact: 4 cell inline cho contract detail integration (Screen 7)
 *
 * Auto-fetch P&L summary qua TanStack Query nếu `summary` không pass vào.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import {
  formatMargin,
  formatVnd,
  getPnLSummary,
  type MarginTier,
  type PnLSummary,
  type RevenueSource,
} from "@/lib/finance-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Hourglass,
} from "lucide-react";

interface Props {
  contractId: string;
  compact?: boolean;
  /** Optional preloaded summary — bypass auto-fetch */
  summary?: PnLSummary | null;
}

function RevenueBadge({ source }: { source: RevenueSource }) {
  if (source === "ACTUAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        <CheckCircle2 className="size-3" aria-hidden /> Actual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
      <Hourglass className="size-3" aria-hidden /> Estimated
    </span>
  );
}

function MarginBadge({
  tier,
  margin,
}: {
  tier: MarginTier;
  margin: number | null;
}) {
  const map: Record<MarginTier, { label: string; cls: string }> = {
    loss: { label: "Lỗ", cls: "bg-rose-100 text-rose-800" },
    thin: { label: "Mỏng", cls: "bg-amber-100 text-amber-800" },
    healthy: { label: "Healthy", cls: "bg-green-100 text-green-800" },
    neutral: { label: "—", cls: "bg-stone-100 text-stone-700" },
  };
  const { label, cls } = map[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label} · {formatMargin(margin)}
    </span>
  );
}

export function PnLSummaryCard({ contractId, compact, summary }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["finance", "pnl", contractId],
    queryFn: () => getPnLSummary(contractId),
    enabled: !summary,
    staleTime: 30_000,
  });

  const pnl = summary ?? data;

  const profitIcon = useMemo(() => {
    if (!pnl) return null;
    if (pnl.profit > 0) {
      return <ArrowUpRight className="size-4 text-green-600" aria-hidden />;
    }
    if (pnl.profit < 0) {
      return <ArrowDownRight className="size-4 text-rose-600" aria-hidden />;
    }
    return null;
  }, [pnl]);

  if (isLoading && !summary) {
    return compact ? (
      <Skeleton className="h-20 w-full" />
    ) : (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !pnl) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        <AlertTriangle className="mr-1 inline size-4" aria-hidden />
        Không tải được P&amp;L. {(error as Error | undefined)?.message ?? ""}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">P&amp;L Deal</h3>
          <RevenueBadge source={pnl.revenueSource} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-stone-500">Doanh thu</div>
            <div className="font-mono text-sm font-semibold">
              {formatVnd(pnl.revenue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-stone-500">Chi phí</div>
            <div className="font-mono text-sm font-semibold">
              {formatVnd(pnl.totalCost)}
            </div>
            <div className="text-[10px] text-stone-400">
              {pnl.costItemCount} mục
            </div>
          </div>
          <div>
            <div className="text-xs text-stone-500">Lãi/Lỗ</div>
            <div
              className={`flex items-center gap-1 font-mono text-sm font-semibold ${
                pnl.profit > 0
                  ? "text-green-700"
                  : pnl.profit < 0
                    ? "text-rose-700"
                    : "text-stone-700"
              }`}
            >
              {profitIcon}
              {formatVnd(pnl.profit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-stone-500">Margin</div>
            <MarginBadge tier={pnl.marginTier} margin={pnl.margin} />
          </div>
        </div>
        {pnl.warning && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>{pnl.warning}</span>
          </div>
        )}
        <div className="mt-3 text-right">
          <Link
            href={`/finance/contracts/${contractId}`}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Xem chi tiết P&amp;L →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Tổng quan Lãi/Lỗ</span>
          <RevenueBadge source={pnl.revenueSource} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Doanh thu
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-stone-900">
              {formatVnd(pnl.revenue)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Tổng chi phí
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-stone-900">
              {formatVnd(pnl.totalCost)}
            </div>
            <div className="text-xs text-stone-400">{pnl.costItemCount} mục</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Lãi/Lỗ
            </div>
            <div
              className={`mt-1 flex items-center gap-1 font-mono text-lg font-bold ${
                pnl.profit > 0
                  ? "text-green-700"
                  : pnl.profit < 0
                    ? "text-rose-700"
                    : "text-stone-700"
              }`}
            >
              {profitIcon}
              {formatVnd(pnl.profit)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Margin
            </div>
            <div className="mt-1">
              <MarginBadge tier={pnl.marginTier} margin={pnl.margin} />
            </div>
          </div>
        </div>
        {pnl.warning && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{pnl.warning}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
