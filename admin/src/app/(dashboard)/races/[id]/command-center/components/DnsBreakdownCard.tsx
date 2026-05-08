"use client";

/**
 * F-010 BR-FC-05/06 — DNS Breakdown Card
 *
 * Hiển thị 3-state breakdown từ `dashboardSnapshot.dnsBreakdown`:
 *   - DNS_NOT_PICKED  → gray  (chưa nhận racekit)
 *   - DNS_NO_START    → amber (đã nhận BIB nhưng không xuất phát)
 *   - DNS_CHIP_FAIL   → red   (admin flag, vendor chip fail evidence)
 *
 * Color coding theo PRD Screen 3. Display only — không trigger filter (PRD
 * defers filter wiring; for MVP show counts inline trên existing DNS card).
 */

interface DnsBreakdownData {
  total: number;
  notPicked: number;
  noStart: number;
  chipFail: number;
}

interface Props {
  breakdown: DnsBreakdownData | undefined | null;
  totalFallback: number;
}

export default function DnsBreakdownCard({
  breakdown,
  totalFallback,
}: Props) {
  const total = breakdown?.total ?? totalFallback ?? 0;
  const notPicked = breakdown?.notPicked ?? 0;
  const noStart = breakdown?.noStart ?? 0;
  const chipFail = breakdown?.chipFail ?? 0;
  const hasBreakdown = !!breakdown;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          DNS
        </span>
        <span className="text-2xl font-bold tabular-nums text-stone-900">
          {total}
        </span>
      </div>

      {hasBreakdown && total > 0 ? (
        <div className="mt-3 space-y-1.5">
          <DnsRow
            label="Chưa nhận racekit"
            count={notPicked}
            colorClass="bg-stone-200 text-stone-700"
          />
          <DnsRow
            label="Không xuất phát"
            count={noStart}
            colorClass="bg-amber-100 text-amber-800"
          />
          <DnsRow
            label="Chip fail"
            count={chipFail}
            colorClass="bg-red-100 text-red-800"
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Chưa có breakdown.
        </p>
      )}
    </div>
  );
}

function DnsRow({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`rounded px-2 py-0.5 font-mono font-medium ${colorClass}`}
      >
        {count}
      </span>
    </div>
  );
}
