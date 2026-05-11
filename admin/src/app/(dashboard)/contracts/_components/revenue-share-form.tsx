"use client";

/**
 * F-024 Revenue-share form — TICKET_SALES pricing (BR-CM-03 + BR-CM-15).
 *
 * Inputs: feePercentage (%), feePerAthlete (VND), estimatedAthletes (count).
 * Display estimated fee (computed) — BR-CM-15:
 *   estimatedFee = estimatedAthletes × feePerAthlete + estimatedAthletes × avgTicketPrice × feePercentage / 100
 * NOTE: avgTicketPrice không thu từ admin UI ở wizard — estimate chỉ tính phần
 * feePerAthlete cố định. Frontend cảnh báo "Phí % tính từ doanh thu thực sau race".
 */
import { useMemo } from "react";
import type { RevenueShare } from "@/lib/contracts-api";
import { formatVND } from "@/lib/contracts-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: RevenueShare;
  onChange: (next: RevenueShare) => void;
  disabled?: boolean;
};

export function RevenueShareForm({ value, onChange, disabled }: Props) {
  const estimatedFixed = useMemo(
    () =>
      (value.estimatedAthletes || 0) * (value.feePerAthlete || 0),
    [value.estimatedAthletes, value.feePerAthlete],
  );

  function set<K extends keyof RevenueShare>(key: K, v: RevenueShare[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="fee-pct">% Phí bán vé</Label>
          <Input
            id="fee-pct"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={value.feePercentage}
            onChange={(e) =>
              set("feePercentage", Number(e.target.value) || 0)
            }
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="fee-per-athlete">Phí cố định / VĐV (VND)</Label>
          <Input
            id="fee-per-athlete"
            type="number"
            min={0}
            step={1000}
            value={value.feePerAthlete}
            onChange={(e) =>
              set("feePerAthlete", Number(e.target.value) || 0)
            }
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="est-athletes">Số VĐV ước tính</Label>
          <Input
            id="est-athletes"
            type="number"
            min={0}
            value={value.estimatedAthletes}
            onChange={(e) =>
              set("estimatedAthletes", Number(e.target.value) || 0)
            }
            disabled={disabled}
          />
        </div>
      </div>
      <div className="mt-4 rounded-md bg-[#F3F0EB] p-3 text-sm">
        <span className="text-[var(--text-muted,#78716C)]">
          Ước tính phí cố định (VĐV × phí/VĐV):
        </span>
        <span className="ml-2 font-mono font-semibold">
          {formatVND(estimatedFixed)}
        </span>
        <p className="mt-1 text-xs text-[var(--text-muted,#78716C)]">
          Phí phần trăm tính từ doanh thu vé thực tế sau race — chốt trong biên
          bản nghiệm thu.
        </p>
      </div>
    </div>
  );
}
