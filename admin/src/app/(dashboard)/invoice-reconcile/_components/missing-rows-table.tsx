"use client";

/**
 * F-076 — Missing rows table với filter pills + sort + click-to-copy.
 *
 * Display Convention CLAUDE.md: render BUCKET_LABEL[bucket] (VN), NOT raw
 * enum. Order code is `orderCode` (= `order_metadata.name`) per BR-05b.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BUCKET_LABEL,
  BUCKET_REASON,
} from "@/lib/invoice-reconcile-labels";
import {
  formatRelativeVi,
  formatVnd,
  type MissingInvoiceRow,
  type ReconcileBucket,
} from "@/lib/invoice-reconcile-api";

const ALL_BUCKETS: ReconcileBucket[] = ["SYNC_LAG", "UNISSUED", "DUPLICATE"];

interface Props {
  rows: MissingInvoiceRow[];
  /** F-088 — đánh dấu / bỏ đánh dấu đơn đã xử lý. */
  onResolve?: (orderId: number, resolved: boolean) => void;
  hideResolved?: boolean;
  onToggleHideResolved?: () => void;
}

export function MissingRowsTable({
  rows,
  onResolve,
  hideResolved = false,
  onToggleHideResolved,
}: Props) {
  const [filter, setFilter] = useState<Set<ReconcileBucket>>(
    () => new Set(ALL_BUCKETS),
  );
  const [raceFilter, setRaceFilter] = useState<"all" | number>("all");

  const races = useMemo(() => {
    const s = new Set<number>();
    for (const r of rows) s.add(r.raceId);
    return Array.from(s).sort((a, b) => a - b);
  }, [rows]);

  const resolvedCount = useMemo(
    () => rows.filter((r) => r.resolved).length,
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!filter.has(r.bucket as ReconcileBucket)) return false;
      if (raceFilter !== "all" && r.raceId !== raceFilter) return false;
      if (hideResolved && r.resolved) return false;
      return true;
    });
  }, [rows, filter, raceFilter, hideResolved]);

  const toggleBucket = (b: ReconcileBucket) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  const copyOrderCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Đã copy ${code}`);
    } catch {
      toast.error("Không copy được");
    }
  };

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="mt-2 text-lg font-semibold text-emerald-700">
          Tất cả hóa đơn đã xuất
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Hôm nay không có đơn nào cần xử lý.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <span className="text-xs font-semibold text-stone-600">Lọc:</span>
        {ALL_BUCKETS.map((b) => {
          const active = filter.has(b);
          return (
            <button
              key={b}
              onClick={() => toggleBucket(b)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-stone-300 bg-white text-stone-500 line-through"
              }`}
            >
              {BUCKET_LABEL[b]}
            </button>
          );
        })}

        <span className="ml-4 text-xs font-semibold text-stone-600">
          Race:
        </span>
        <select
          value={raceFilter === "all" ? "all" : String(raceFilter)}
          onChange={(e) =>
            setRaceFilter(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">Tất cả</option>
          {races.map((r) => (
            <option key={r} value={r}>
              Race {r}
            </option>
          ))}
        </select>

        {resolvedCount > 0 && onToggleHideResolved && (
          <button
            onClick={onToggleHideResolved}
            className={`ml-4 rounded-full border px-3 py-1 text-xs font-medium transition ${
              hideResolved
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-stone-300 bg-white text-stone-500"
            }`}
          >
            {hideResolved ? "Đang ẩn" : "Ẩn"} đã xử lý ({resolvedCount})
          </button>
        )}

        <span className="ml-auto text-xs text-stone-500">
          {filtered.length}/{rows.length} đơn
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-left">Race</th>
              <th className="px-3 py-2 text-left">Mã đơn</th>
              <th className="px-3 py-2 text-left">Người mua</th>
              <th className="px-3 py-2 text-right">Tổng tiền</th>
              <th className="px-3 py-2 text-left">Paid</th>
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2 text-left">Lý do</th>
              {onResolve && <th className="px-3 py-2 text-right">Xử lý</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={onResolve ? 9 : 8}
                  className="px-3 py-8 text-center text-stone-500"
                >
                  Không có đơn nào khớp filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={`${row.orderId}-${row.bucket}`}
                  className={`border-t border-stone-200 hover:bg-stone-50 ${
                    row.resolved ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <SeverityBadge bucket={row.bucket} />
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    Race {row.raceId}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => copyOrderCode(row.orderCode)}
                      className="font-mono text-blue-600 hover:underline"
                      title="Click để copy"
                    >
                      {row.orderCode}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {row.buyerName ?? row.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatVnd(row.totalPrice)}
                  </td>
                  <td className="px-3 py-2 text-stone-600">
                    {formatRelativeVi(row.paymentOn)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      row.ageHours > 20
                        ? "text-red-600 font-bold"
                        : "text-stone-700"
                    }`}
                  >
                    {row.ageHours}h{row.breached ? " 🔥" : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {BUCKET_REASON[row.bucket as ReconcileBucket]}
                    {row.bucket === "SYNC_LAG" && row.misaInvNo && (
                      <span className="ml-1 font-mono text-stone-500">
                        (MISA: {row.misaInvNo})
                      </span>
                    )}
                    {row.bucket === "DUPLICATE" && row.duplicateCount && (
                      <span className="ml-1 font-mono text-red-600">
                        ({row.duplicateCount} hóa đơn)
                      </span>
                    )}
                  </td>
                  {onResolve && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => onResolve(row.orderId, !row.resolved)}
                        className={`rounded border px-2 py-1 text-xs font-medium transition ${
                          row.resolved
                            ? "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
                            : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {row.resolved ? "↩ Bỏ đánh dấu" : "✓ Đã xử lý"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SeverityBadge({ bucket }: { bucket: ReconcileBucket }) {
  const tone = {
    SYNC_LAG: "bg-amber-100 text-amber-800 border-amber-300",
    UNISSUED: "bg-red-100 text-red-800 border-red-300",
    DUPLICATE: "bg-rose-100 text-rose-800 border-rose-300",
    OK: "bg-emerald-100 text-emerald-800 border-emerald-300",
  }[bucket];
  return (
    <Badge variant="outline" className={tone}>
      {BUCKET_LABEL[bucket]}
    </Badge>
  );
}
