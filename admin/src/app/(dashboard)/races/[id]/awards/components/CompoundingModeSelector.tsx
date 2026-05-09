"use client";

/**
 * F-019 v2.1 — Compounding Mode Selector.
 *
 * UI để admin override `awardsCompoundingMode` per-race:
 *  - 'mutually_exclusive' (default VN amateur): top 3 overall EXCLUDED khỏi AG.
 *  - 'compounding' (WA TR9): top 3 overall VẪN tính trong AG (cộng dồn).
 *
 * Đa số race VN amateur dùng mutually_exclusive — 1 BIB chỉ nhận 1 giải.
 * Race quốc tế / theo chuẩn WA → opt-in compounding.
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { racesControllerUpdateRace } from "@/lib/api-generated";

export type CompoundingMode = "mutually_exclusive" | "compounding";

interface CompoundingModeSelectorProps {
  raceId: string;
  current: CompoundingMode;
  /** Notify parent khi mode update thành công (refetch race meta if needed). */
  onChanged?: (next: CompoundingMode) => void;
}

const MODE_LABELS: Record<CompoundingMode, { label: string; tooltip: string }> = {
  mutually_exclusive: {
    label:
      "Loại trừ — Top chung cuộc KHÔNG nhận giải lứa tuổi (VN amateur convention)",
    tooltip:
      "Áp dụng cho ~80% race VN amateur — 1 BIB chỉ nhận 1 giải. Athlete đã vào top 3 overall sẽ KHÔNG xuất hiện trong top AG.",
  },
  compounding: {
    label:
      "Cộng dồn — Top chung cuộc VẪN nhận giải lứa tuổi (WA TR9 standard)",
    tooltip:
      "Chuẩn World Athletics Tech Rule 9 — top overall vẫn được tính trong AG bucket. 1 athlete có thể nhận 2 giải (overall + AG).",
  },
};

export function CompoundingModeSelector({
  raceId,
  current,
  onChanged,
}: CompoundingModeSelectorProps) {
  const { token } = useAuth();
  const [value, setValue] = useState<CompoundingMode>(current);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChange = async (next: CompoundingMode) => {
    if (!token || next === value) return;
    setSaving(true);
    setErr(null);
    const previous = value;
    setValue(next);
    try {
      await racesControllerUpdateRace({
        path: { id: raceId },
        body: { awardsCompoundingMode: next },
        ...authHeaders(token),
      });
      onChanged?.(next);
    } catch (e) {
      // rollback UI state on failure
      setValue(previous);
      setErr(
        e instanceof Error
          ? e.message
          : "Không lưu được mode. Thử lại sau.",
      );
    } finally {
      setSaving(false);
    }
  };

  const detail = MODE_LABELS[value];

  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex items-center rounded bg-stone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-700 ring-1 ring-stone-200">
          F-019 v2.1
        </span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-stone-900">
            Compounding Mode (Awards calc)
          </h4>
          <p className="mt-1 text-xs text-stone-600" title={detail.tooltip}>
            {detail.tooltip}
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {(Object.keys(MODE_LABELS) as CompoundingMode[]).map((mode) => (
              <label
                key={mode}
                className="flex items-start gap-2 text-sm text-stone-800"
                title={MODE_LABELS[mode].tooltip}
              >
                <input
                  type="radio"
                  name={`compoundingMode-${raceId}`}
                  value={mode}
                  checked={value === mode}
                  disabled={saving}
                  onChange={() => handleChange(mode)}
                  className="mt-0.5"
                />
                <span>{MODE_LABELS[mode].label}</span>
              </label>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-amber-700">
            ⚠ Đổi mode → cần recompute lại podium DRAFT (chưa LOCKED). Mode mới
            chỉ áp dụng từ lần recompute kế tiếp.
          </p>

          {err && (
            <p className="mt-1 text-[11px] text-red-600">Lỗi: {err}</p>
          )}
        </div>
      </div>
    </div>
  );
}
