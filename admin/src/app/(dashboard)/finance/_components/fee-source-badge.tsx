/**
 * FEATURE-040 — Fee source pill badge (BR-40-09).
 *
 * 4 variants:
 *   - RECONCILIATION: green ✅ "BBNT đã ký"
 *   - SELF_COMPUTE:   blue 🧮 "Tự tính"
 *   - MIXED:          amber 🔀 "Kết hợp"
 *   - ESTIMATED:      grey 📊 "Ước tính" (hide on F-038 list per BR-40-09 default)
 *
 * Tooltip handled by parent — badge itself is presentation only.
 */
import type { FeeSource } from "@/lib/finance-api";

interface Props {
  source: FeeSource | undefined;
  hideEstimated?: boolean;
  size?: "sm" | "md";
}

const META: Record<
  FeeSource,
  { label: string; icon: string; cls: string; ariaLabel: string }
> = {
  RECONCILIATION: {
    label: "BBNT đã ký",
    icon: "✅",
    cls: "bg-green-50 text-green-800 border-green-200",
    ariaLabel: "Nguồn: Biên bản nghiệm thu đã ký",
  },
  SELF_COMPUTE: {
    label: "Tự tính",
    icon: "🧮",
    cls: "bg-blue-50 text-blue-800 border-blue-200",
    ariaLabel: "Nguồn: Tự tính từ tỉ lệ phí merchant",
  },
  MIXED: {
    label: "Kết hợp",
    icon: "🔀",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    ariaLabel: "Nguồn: Kết hợp BBNT + tự tính",
  },
  ESTIMATED: {
    label: "Ước tính",
    icon: "📊",
    cls: "bg-stone-50 text-stone-700 border-stone-200",
    ariaLabel: "Nguồn: Ước tính theo totalAmount",
  },
};

export function FeeSourceBadge({
  source,
  hideEstimated,
  size = "sm",
}: Props) {
  if (!source) return null;
  if (source === "ESTIMATED" && hideEstimated) return null;

  const meta = META[source];
  const sizing =
    size === "md"
      ? "px-2 py-0.5 text-xs"
      : "px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold rounded-full border ${sizing} ${meta.cls}`}
      aria-label={meta.ariaLabel}
    >
      <span aria-hidden>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

/** Tooltip dictionary per BR-40-09 — re-exported for parents to render. */
export const FEE_SOURCE_TOOLTIP: Record<FeeSource, string> = {
  RECONCILIATION:
    "Doanh thu lấy từ biên bản nghiệm thu đã ký với merchant",
  SELF_COMPUTE:
    "Tự tính từ tỉ lệ phí merchant — chưa có BBNT",
  MIXED:
    "Một phần lấy từ BBNT, phần còn lại tự tính",
  ESTIMATED:
    "Số ước tính theo contract.totalAmount BTC nhập — chưa link platform",
};

export const FEE_SOURCE_ICON: Record<FeeSource, string> = {
  RECONCILIATION: "✅",
  SELF_COMPUTE: "🧮",
  MIXED: "🔀",
  ESTIMATED: "📊",
};

export const FEE_SOURCE_LABEL: Record<FeeSource, string> = {
  RECONCILIATION: "BBNT đã ký",
  SELF_COMPUTE: "Tự tính",
  MIXED: "Kết hợp",
  ESTIMATED: "Ước tính",
};
