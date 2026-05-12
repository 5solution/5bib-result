"use client";

/**
 * F-024 Financial Summary — real-time hiển thị subtotal/VAT/total/advance/remainder.
 *
 * Pure presentational. Caller chuẩn bị numbers (đã calc qua `calcTotals` hoặc
 * server response). Dùng trong wizard step 4-5 + contract detail page.
 */
import { formatVND } from "@/lib/contracts-api";

type Props = {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  advanceAmount?: number;
  remainderAmount?: number;
};

export function FinancialSummary({
  subtotal,
  vatRate,
  vatAmount,
  totalAmount,
  advanceAmount,
  remainderAmount,
}: Props) {
  return (
    <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-[#F3F0EB] p-4">
      <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
        Tổng hợp tài chính
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Cộng (chưa VAT)" value={formatVND(subtotal)} />
        <Row label={`VAT (${vatRate}%)`} value={formatVND(vatAmount)} />
        <Row
          label="TỔNG CỘNG"
          value={formatVND(totalAmount)}
          emphasis
        />
        {advanceAmount != null && (
          <Row label="Tạm ứng" value={formatVND(advanceAmount)} />
        )}
        {remainderAmount != null && (
          <Row label="Còn lại" value={formatVND(remainderAmount)} />
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt
        className={
          emphasis
            ? "text-[13px] font-bold text-[var(--text,#1C1917)]"
            : "text-[var(--text-muted,#78716C)]"
        }
      >
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "font-mono text-base font-extrabold text-[var(--text,#1C1917)]"
            : "font-mono text-[var(--text,#1C1917)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
