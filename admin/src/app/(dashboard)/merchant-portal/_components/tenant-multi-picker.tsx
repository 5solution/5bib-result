"use client";

/**
 * F-069 M3 — Multi-select MySQL tenant picker (chips).
 *
 * Reuse nguồn data `searchMysqlTenants` của contracts/TenantPicker (PAUSE #2),
 * nhưng MULTI-select vì access config nhận `tenantIds: number[]` (BR-MP-33).
 * Single-select TenantPicker không dùng trực tiếp được — Manager plan đã note.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchMysqlTenants, type TenantSearchResult } from "@/lib/finance-api";

type Props = {
  /** Tenant IDs đã chọn. */
  value: number[];
  onChange: (ids: number[]) => void;
  /**
   * Khi edit config có sẵn tenantIds nhưng chưa search ra — pass names để hiển
   * thị chip đúng tên ngay (saved roundtrip, denormalized từ list API).
   */
  initialNames?: Record<number, string>;
};

export function TenantMultiPicker({ value, onChange, initialNames }: Props) {
  const [q, setQ] = useState("");
  const [tenants, setTenants] = useState<TenantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache id→name từ mọi nguồn (search results + initialNames) để render chip.
  const [nameCache, setNameCache] = useState<Record<number, string>>(
    () => ({ ...(initialNames ?? {}) }),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchMysqlTenants(q.trim())
        .then((res) => {
          if (!alive) return;
          setTenants(res);
          setNameCache((prev) => {
            const next = { ...prev };
            for (const t of res) next[t.id] = t.name;
            return next;
          });
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

  const selectedSet = useMemo(() => new Set(value), [value]);

  function toggle(id: number) {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  function remove(id: number) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="space-y-2">
      {/* Chips — tenant đã chọn */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs text-blue-800"
            >
              <span className="truncate" title={nameCache[id] ?? `Tenant #${id}`}>
                {nameCache[id] ?? `Tenant #${id}`}
              </span>
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Bỏ ${nameCache[id] ?? id}`}
                className="ml-0.5 shrink-0 rounded-full px-1 text-blue-500 hover:bg-blue-100 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm BTC theo tên hoặc MST..."
          className="pl-8"
          aria-label="Tìm tenant BTC"
        />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
        {loading ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Đang tải...
          </div>
        ) : error ? (
          <div className="p-3 text-center text-sm text-red-600">Lỗi: {error}</div>
        ) : tenants.length === 0 ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Không có BTC nào khớp
          </div>
        ) : (
          <ul>
            {tenants.map((t) => {
              const isSelected = selectedSet.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F0EB] ${
                      isSelected ? "bg-[#E6ECFF] font-semibold" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                        {t.taxId ? <>MST: {t.taxId}</> : <span className="italic">Chưa có MST</span>}
                        <span className="mx-1">·</span>id={t.id}
                      </div>
                    </div>
                    {isSelected && <Check className="size-4 text-blue-700" />}
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
