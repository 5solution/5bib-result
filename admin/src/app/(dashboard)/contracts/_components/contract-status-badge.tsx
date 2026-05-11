/**
 * F-024 Contract Status Badge — Server Component OK (no event handlers).
 *
 * Maps backend BR-CM-07 enum → F-022 status pill tones from design-tokens.ts.
 */
import type { ContractStatus } from "@/lib/contracts-api";
import { STATUS_PILL_TONES, type StatusPillTone } from "@/lib/design-tokens";

type Props = { status: ContractStatus | string };

const STATUS_CONFIG: Record<string, { label: string; tone: StatusPillTone }> = {
  DRAFT: { label: "Nháp", tone: "gray" },
  SENT: { label: "Đã gửi", tone: "blue" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "green" },
  REJECTED: { label: "Từ chối", tone: "red" },
  CONVERTED_TO_CONTRACT: { label: "Đã chuyển HĐ", tone: "violet" },
  ACTIVE: { label: "Đang hiệu lực", tone: "blue" },
  COMPLETED: { label: "Hoàn thành", tone: "green" },
  CANCELLED: { label: "Huỷ", tone: "red" },
};

export function ContractStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, tone: "gray" as const };
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
