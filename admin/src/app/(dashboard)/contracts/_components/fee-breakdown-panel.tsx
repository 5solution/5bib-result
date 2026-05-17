"use client";

/**
 * FEATURE-040 — Fee breakdown drill-down panel.
 *
 * Mount in contract detail Lãi/Lỗ section. Collapsed by default; expand on
 * click → TanStack Query fetch /api/finance/contracts/:id/fee-breakdown.
 *
 * UI States:
 *   - Loading: skeleton 4 rows inside panel
 *   - Error: "Lỗi tải breakdown" + retry
 *   - Data: source badge + recon contributions + self-compute slice + total +
 *     grossGMV reference + warnings
 *
 * BR-40-12 pre-F016 legacy banner per recon slice if `legacyWarning` present.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatVnd,
  getFeeBreakdown,
  type FeeBreakdownResponse,
} from "@/lib/finance-api";
import {
  FeeSourceBadge,
  FEE_SOURCE_TOOLTIP,
} from "../../finance/_components/fee-source-badge";

interface Props {
  contractId: string;
}

export function FeeBreakdownPanel({ contractId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<
    FeeBreakdownResponse
  >({
    queryKey: ["finance", "fee-breakdown", contractId],
    queryFn: () => getFeeBreakdown(contractId),
    enabled: expanded,
    staleTime: 60_000,
  });

  if (!expanded) {
    return (
      <div className="flex">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className="text-xs text-stone-600 hover:text-stone-900"
          aria-label="Mở chi tiết breakdown phí"
          data-testid="btn-expand-fee-breakdown"
        >
          <ChevronDown className="size-3.5" aria-hidden />
          chi tiết breakdown
        </Button>
      </div>
    );
  }

  return (
    <Card data-testid="fee-breakdown-panel" className="border-blue-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span>Fee Breakdown</span>
            {data ? (
              <FeeSourceBadge source={data.feeSource} size="md" />
            ) : null}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            aria-label="Đóng chi tiết breakdown phí"
          >
            <ChevronUp className="size-3.5" aria-hidden />
            <span className="text-xs">Thu gọn</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || isFetching ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden />
              Lỗi tải breakdown.{" "}
              {(error as Error | undefined)?.message ?? ""}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              aria-label="Thử lại tải breakdown"
            >
              Thử lại
            </Button>
          </div>
        ) : data ? (
          <BreakdownBody data={data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function BreakdownBody({ data }: { data: FeeBreakdownResponse }) {
  const tooltipText = FEE_SOURCE_TOOLTIP[data.feeSource];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs italic text-stone-500" aria-live="polite">
        {tooltipText}
      </p>

      {/* Recon contributions */}
      {data.reconciliations.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-700">
            BBNT đã ký áp dụng ({data.reconciliations.length})
          </h4>
          <ul className="space-y-2">
            {data.reconciliations.map((r) => (
              <li
                key={r.reconciliationId}
                className="rounded-md border border-stone-200 bg-stone-50 p-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-800">
                    {r.periodStart} → {r.periodEnd}
                  </span>
                  <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-700">
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-stone-700">
                  <span>
                    Phí 5BIB:{" "}
                    <span className="font-mono font-semibold">
                      {formatVnd(r.feeAmount)}
                    </span>
                  </span>
                  <span>
                    Phí MANUAL:{" "}
                    <span className="font-mono font-semibold">
                      {formatVnd(r.manualFeeAmount)}
                    </span>
                  </span>
                </div>
                {r.legacyWarning ? (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-800">
                    <Info
                      className="mt-0.5 size-3 shrink-0"
                      aria-hidden
                    />
                    <span>
                      ℹ️ BBNT này từ trước 08/05/2026 — có thể thiếu
                      GROUP_BUY/CODE_TRANSFER orders (xem TD-F016)
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Self-compute slice */}
      {data.selfCompute ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-700">
            Self-compute{" "}
            {data.selfCompute.periodGapStart && data.selfCompute.periodGapEnd
              ? `(gap ${data.selfCompute.periodGapStart} → ${data.selfCompute.periodGapEnd})`
              : ""}
          </h4>
          <div className="rounded-md border border-blue-100 bg-blue-50/40 p-2 text-xs space-y-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-stone-700">
              <span>
                5BIB orders: <span className="font-mono">{data.selfCompute.count5BIB}</span>
              </span>
              <span>
                Gross 5BIB:{" "}
                <span className="font-mono">{formatVnd(data.selfCompute.gross5BIB)}</span>
              </span>
              <span>
                Rate: <span className="font-mono">{data.selfCompute.feeRatePercent}%</span>
              </span>
              <span>
                Phí 5BIB:{" "}
                <span className="font-mono font-semibold">
                  {formatVnd(data.selfCompute.fee5BIB)}
                </span>
              </span>
              <span>
                MANUAL orders: <span className="font-mono">{data.selfCompute.countManual}</span>
              </span>
              <span>
                Vé MANUAL: <span className="font-mono">{data.selfCompute.manualTicketCount}</span>
              </span>
              <span>
                VNĐ/vé:{" "}
                <span className="font-mono">
                  {formatVnd(data.selfCompute.manualFeePerTicket)}
                </span>
              </span>
              <span>
                Phí MANUAL:{" "}
                <span className="font-mono font-semibold">
                  {formatVnd(data.selfCompute.feeManual)}
                </span>
              </span>
            </div>
            {data.selfCompute.rateFallbackWarning ? (
              <div className="mt-1.5 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                <span>{data.selfCompute.rateFallbackWarning}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Total */}
      <div className="flex items-center justify-between border-t border-stone-200 pt-2">
        <span className="text-sm font-semibold text-stone-900">
          Total Doanh thu (fee 5BIB):
        </span>
        <span className="font-mono text-base font-bold text-stone-900">
          {formatVnd(data.totalFee)}
        </span>
      </div>

      {/* GMV reference */}
      {data.grossGMV !== undefined ? (
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>GMV (tham khảo, KHÔNG dùng cho P&amp;L):</span>
          <span className="font-mono">{formatVnd(data.grossGMV)}</span>
        </div>
      ) : null}

      {/* Generic warnings */}
      {data.warnings && data.warnings.length > 0 ? (
        <ul className="space-y-1">
          {data.warnings.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-800"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
