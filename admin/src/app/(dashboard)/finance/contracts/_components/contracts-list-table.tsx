"use client";

/**
 * FEATURE-038 — Contracts list table với P&L per row + sortable column
 * headers. 9 cột STT/Số HĐ/Đối tác/Giải/Loại/DT/CP/Lãi-Lỗ + Margin badge/
 * Status.
 *
 * Row click → navigate `/finance/contracts/{id}` (F-028 Phase 1 detail page).
 * Sortable headers: Số HĐ, Doanh thu, Chi phí, Lãi/Lỗ, Margin. Click toggles
 * sortDir; switching column resets to DESC.
 */
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  formatVnd,
  formatMargin,
  type DashboardContractItem,
  type ContractsListSortBy,
  type SortDir,
  type MarginTier,
} from "@/lib/finance-api";
import {
  formatContractStatus,
  formatContractType,
} from "@/lib/finance-labels";
import {
  FeeSourceBadge,
  FEE_SOURCE_TOOLTIP,
  FEE_SOURCE_ICON,
} from "../../_components/fee-source-badge";

const MARGIN_TIER_ICON: Record<MarginTier, string> = {
  loss: "🔴",
  thin: "🟡",
  healthy: "🟢",
  neutral: "⚪",
};

const MARGIN_TIER_CLASSES: Record<MarginTier, string> = {
  loss: "text-red-700",
  thin: "text-amber-700",
  healthy: "text-emerald-700",
  neutral: "text-stone-500",
};

/**
 * FEATURE-040 — Doanh thu cell with feeSource badge + hover tooltip group.
 *
 * Tooltip uses CSS-only `group-hover` pattern (no external lib). Renders:
 *   - source-specific tooltip text (BR-40-09)
 *   - grossGMV reference line if present
 */
function RevenueCell({ item }: { item: DashboardContractItem }) {
  const source = item.feeSource;
  const tooltipText = source ? FEE_SOURCE_TOOLTIP[source] : null;
  const icon = source ? FEE_SOURCE_ICON[source] : null;

  return (
    <div className="group relative inline-flex flex-col items-end">
      <div className="flex items-center justify-end gap-1.5">
        <span className="tabular-nums">{formatVnd(item.revenue)}</span>
        <FeeSourceBadge source={source} hideEstimated size="sm" />
      </div>
      {tooltipText ? (
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-[280px] rounded-md border border-stone-200 bg-white p-2 text-left text-[11px] font-normal leading-snug text-stone-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <span className="block">
            {icon ? <span aria-hidden>{icon} </span> : null}
            {tooltipText}
          </span>
          {item.grossGMV !== undefined && item.grossGMV > 0 ? (
            <span className="mt-1 block text-stone-500">
              GMV tham khảo:{" "}
              <span className="font-mono">{formatVnd(item.grossGMV)}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function SortableHeader({
  column,
  label,
  currentSort,
  currentDir,
  align = "left",
  onSort,
}: {
  column: ContractsListSortBy;
  label: string;
  currentSort: ContractsListSortBy;
  currentDir: SortDir;
  align?: "left" | "right";
  onSort: (col: ContractsListSortBy) => void;
}) {
  const isActive = currentSort === column;
  const Icon = !isActive
    ? ArrowUpDown
    : currentDir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 ${
        align === "right" ? "flex-row-reverse" : ""
      } ${isActive ? "text-stone-900" : ""}`}
      aria-label={`Sắp xếp theo ${label}`}
    >
      <span>{label}</span>
      <Icon
        className={`size-3.5 ${isActive ? "" : "text-stone-400"}`}
        aria-hidden
      />
    </button>
  );
}

export function ContractsListTable({
  items,
  page,
  limit,
  sortBy,
  sortDir,
  onSort,
}: {
  items: DashboardContractItem[];
  page: number;
  limit: number;
  sortBy: ContractsListSortBy;
  sortDir: SortDir;
  onSort: (col: ContractsListSortBy) => void;
}) {
  const baseIdx = (page - 1) * limit;
  return (
    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-600">
          <tr>
            <th className="px-3 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">
              <SortableHeader
                column="contractNumber"
                label="Số HĐ"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={onSort}
              />
            </th>
            <th className="px-3 py-2.5 font-medium">Đối tác</th>
            <th className="px-3 py-2.5 font-medium">Giải đấu</th>
            <th className="px-3 py-2.5 font-medium">Loại</th>
            <th className="px-3 py-2.5 text-right font-medium">
              <SortableHeader
                column="revenue"
                label="Doanh thu"
                currentSort={sortBy}
                currentDir={sortDir}
                align="right"
                onSort={onSort}
              />
            </th>
            <th className="px-3 py-2.5 text-right font-medium">Chi phí</th>
            <th className="px-3 py-2.5 text-right font-medium">
              <SortableHeader
                column="profit"
                label="Lãi/Lỗ"
                currentSort={sortBy}
                currentDir={sortDir}
                align="right"
                onSort={onSort}
              />
            </th>
            <th className="px-3 py-2.5 text-right font-medium">
              <SortableHeader
                column="margin"
                label="Margin"
                currentSort={sortBy}
                currentDir={sortDir}
                align="right"
                onSort={onSort}
              />
            </th>
            <th className="px-3 py-2.5 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const tier = it.marginTier;
            const profitTone =
              it.profit > 0
                ? "text-emerald-700"
                : it.profit < 0
                  ? "text-red-700"
                  : "text-stone-700";
            return (
              <tr
                key={it.contractId}
                className="border-b border-stone-100 last:border-b-0 hover:bg-blue-50/40"
              >
                <td className="px-3 py-2.5 tabular-nums text-stone-500">
                  {baseIdx + idx + 1}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/finance/contracts/${it.contractId}`}
                    className="font-mono text-xs font-medium text-blue-700 hover:underline"
                  >
                    {it.contractNumber ?? "(Nháp)"}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/finance/contracts/${it.contractId}`}
                    className="block max-w-[200px] truncate text-stone-800 hover:underline"
                    title={it.partnerName ?? undefined}
                  >
                    {it.partnerName ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/finance/contracts/${it.contractId}`}
                    className="block max-w-[180px] truncate text-stone-700 hover:underline"
                    title={it.raceName ?? undefined}
                  >
                    {it.raceName ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-stone-600">
                  {formatContractType(it.contractType)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <RevenueCell item={it} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatVnd(it.totalCost)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums font-semibold ${profitTone}`}
                >
                  {formatVnd(it.profit)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums font-medium ${MARGIN_TIER_CLASSES[tier]}`}
                >
                  <span aria-hidden className="mr-1">
                    {MARGIN_TIER_ICON[tier]}
                  </span>
                  {formatMargin(it.margin)}
                </td>
                <td className="px-3 py-2.5 text-stone-600">
                  {formatContractStatus(it.status)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
