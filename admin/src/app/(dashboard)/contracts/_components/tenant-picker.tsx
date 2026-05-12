"use client";

/**
 * F-028 — MySQL Tenant Picker (search 5bib_platform_live `tenant` table).
 * Debounced search 300ms, list-based UI (no Popover dependency).
 * Pattern clone partner-picker.tsx.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchMysqlTenants,
  type TenantSearchResult,
} from "@/lib/finance-api";

type Props = {
  value: number | null | undefined;
  /** Khi đã có sẵn tenant (vd init từ contract đã link), pass label để hiển thị. */
  initialLabel?: string;
  onChange: (id: number | null, tenant?: TenantSearchResult | null) => void;
};

export function TenantPicker({ value, initialLabel, onChange }: Props) {
  const [q, setQ] = useState("");
  const [tenants, setTenants] = useState<TenantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchMysqlTenants(q.trim())
        .then((res) => {
          if (alive) setTenants(res);
        })
        .catch((err) => {
          if (alive) {
            setError((err as Error).message);
            toast.error(`Không tải được tenant: ${(err as Error).message}`);
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
  }, [q]);

  const selected = useMemo(
    () => tenants.find((t) => t.id === value),
    [tenants, value],
  );

  // Display label: prefer matched item from list; fallback initialLabel
  // (admin opened dialog với existing link nhưng list chưa load tenant đó).
  const selectedLabel = selected
    ? selected.taxId
      ? `${selected.name} — MST: ${selected.taxId}`
      : selected.name
    : value != null
      ? (initialLabel ?? `Tenant #${value}`)
      : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên tenant hoặc MST..."
          className="pl-8"
          aria-label="Tìm tenant"
        />
      </div>

      {value != null && (
        <div className="flex w-full items-start justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1 break-words">
            <span className="font-medium text-blue-900">Đã chọn:</span>{" "}
            <span className="break-words text-blue-800">{selectedLabel}</span>
            <span className="ml-2 font-mono text-xs text-blue-600">
              (id={value})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="shrink-0 text-xs text-red-600 hover:underline"
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
        ) : tenants.length === 0 ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Không có tenant nào khớp
          </div>
        ) : (
          <ul>
            {tenants.map((t) => {
              const isSelected = t.id === value;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onChange(t.id, t)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F0EB] ${
                      isSelected ? "bg-[#E6ECFF] font-semibold" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                        {t.taxId ? (
                          <>MST: {t.taxId}</>
                        ) : (
                          <span className="italic">Chưa có MST</span>
                        )}
                        <span className="mx-1">·</span>id={t.id}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-blue-700" />
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
