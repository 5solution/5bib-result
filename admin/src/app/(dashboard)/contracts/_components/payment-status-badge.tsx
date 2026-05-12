/**
 * F-024 UX-15 — Payment Request status badge.
 *
 * Mirror ContractStatusBadge pattern. Maps backend BR-CM-08 payment status
 * enum → F-022 status pill tones.
 */
import { STATUS_PILL_TONES, type StatusPillTone } from "@/lib/design-tokens";

type Props = { status?: string | null };

const STATUS_CONFIG: Record<string, { label: string; tone: StatusPillTone }> = {
  DRAFT: { label: "Nháp", tone: "gray" },
  SENT: { label: "Đã gửi", tone: "blue" },
  PENDING: { label: "Chờ thanh toán", tone: "amber" },
  PAID: { label: "Đã thanh toán", tone: "green" },
};

export function PaymentStatusBadge({ status }: Props) {
  const key = status || "DRAFT";
  const cfg = STATUS_CONFIG[key] ?? { label: key, tone: "gray" as const };
  const tone = STATUS_PILL_TONES[cfg.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}
    >
      {cfg.label}
    </span>
  );
}
