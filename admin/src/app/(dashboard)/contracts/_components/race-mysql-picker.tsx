"use client";

/**
 * F-028 — MySQL Race Picker per tenant.
 *
 * Auto-reload khi tenantId thay đổi. Debounced 300ms title filter.
 * Empty state: "Chọn tenant trước" khi tenantId null.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchMysqlRaces,
  type RaceSearchResult,
} from "@/lib/finance-api";

type Props = {
  tenantId: number | null | undefined;
  value: number | null | undefined;
  initialLabel?: string;
  onChange: (id: number | null, race?: RaceSearchResult | null) => void;
  disabled?: boolean;
};

export function RaceMysqlPicker({
  tenantId,
  value,
  initialLabel,
  onChange,
  disabled,
}: Props) {
  const [q, setQ] = useState("");
  const [races, setRaces] = useState<RaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setRaces([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchMysqlRaces(tenantId, q.trim() || undefined)
        .then((res) => {
          if (alive) setRaces(res);
        })
        .catch((err) => {
          if (alive) {
            setError((err as Error).message);
            toast.error(`Không tải được race: ${(err as Error).message}`);
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [tenantId, q]);

  const selected = useMemo(
    () => races.find((r) => r.raceId === value),
    [races, value],
  );

  const selectedLabel = selected
    ? selected.title
    : value != null
      ? (initialLabel ?? `Race #${value}`)
      : null;

  if (!tenantId) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border,#E7E2D9)] bg-[#FAF8F5] p-4 text-center text-sm text-[var(--text-muted,#78716C)]">
        Chọn tenant trước để xem danh sách race
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên giải..."
          className="pl-8"
          disabled={disabled}
          aria-label="Tìm race"
        />
      </div>

      {value != null && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <div>
            <span className="font-medium text-emerald-900">Đã chọn:</span>{" "}
            <span className="text-emerald-800">{selectedLabel}</span>
            <span className="ml-2 font-mono text-xs text-emerald-600">
              (raceId={value})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            disabled={disabled}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
        {loading ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Đang tải...
          </div>
        ) : error ? (
          <div className="p-3 text-center text-sm text-red-600">
            Lỗi: {error}
          </div>
        ) : races.length === 0 ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Tenant này chưa có race nào (hoặc không khớp filter)
          </div>
        ) : (
          <ul>
            {races.map((r) => {
              const isSelected = r.raceId === value;
              const dateStr = r.createdOn
                ? new Date(r.createdOn).toLocaleDateString("vi-VN")
                : "—";
              return (
                <li key={r.raceId}>
                  <button
                    type="button"
                    onClick={() => onChange(r.raceId, r)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F0EB] disabled:opacity-50 ${
                      isSelected ? "bg-[#DCFCE7] font-semibold" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                        raceId={r.raceId} · tạo {dateStr}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-emerald-700" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
