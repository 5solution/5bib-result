"use client";

/**
 * F-069 — Multi-select race picker (chips) cho chế độ "Chọn giải cụ thể".
 *
 * Data source: `merchantPortalAdminControllerSearchRaces` — list giải cross-tenant.
 * Selected raceIds → access config `raceOverrides.include` (BR-MP-05 Option C).
 * Mirror API của TenantMultiPicker (value/onChange/initialTitles + id→title cache).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { authHeaders } from "@/lib/api";
import { merchantPortalAdminControllerSearchRaces } from "@/lib/api-generated/sdk.gen";
import { formatRaceStatus } from "@/lib/merchant-portal-labels";

type RaceOption = {
  raceId: number;
  title: string;
  status: string;
  tenantId: number;
  tenantName: string | null;
};

type Props = {
  /** Race IDs đã chọn. */
  value: number[];
  onChange: (ids: number[]) => void;
  /**
   * Khi edit có sẵn raceIds nhưng chưa search ra — pass titles để hiển thị chip
   * đúng tên ngay (saved roundtrip).
   */
  initialTitles?: Record<number, string>;
};

function extractMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Không tải được danh sách giải";
}

export function RacePicker({ value, onChange, initialTitles }: Props) {
  const [q, setQ] = useState("");
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache id→title từ mọi nguồn (search results + initialTitles) để render chip.
  const [titleCache, setTitleCache] = useState<Record<number, string>>(
    () => ({ ...(initialTitles ?? {}) }),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      const term = q.trim();
      merchantPortalAdminControllerSearchRaces({
        query: { q: term || undefined },
        ...authHeaders(null),
      })
        .then(({ data, error: apiError }) => {
          if (!alive) return;
          if (apiError) throw apiError;
          const items = data?.items ?? [];
          setRaces(items);
          setTitleCache((prev) => {
            const next = { ...prev };
            for (const r of items) next[r.raceId] = r.title;
            return next;
          });
        })
        .catch((err) => {
          if (alive) {
            const msg = extractMsg(err);
            setError(msg);
            toast.error(`Không tải được giải: ${msg}`);
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
      {/* Chips — giải đã chọn */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs text-blue-800"
            >
              <span className="truncate" title={titleCache[id] ?? `Giải #${id}`}>
                {titleCache[id] ?? `Giải #${id}`}
              </span>
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Bỏ ${titleCache[id] ?? id}`}
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
          placeholder="Tìm giải theo tên hoặc mã…"
          className="pl-8"
          aria-label="Tìm giải"
        />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
        {loading ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Đang tải...
          </div>
        ) : error ? (
          <div className="p-3 text-center text-sm text-red-600">Lỗi: {error}</div>
        ) : races.length === 0 ? (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Không có giải nào khớp
          </div>
        ) : (
          <ul>
            {races.map((r) => {
              const isSelected = selectedSet.has(r.raceId);
              return (
                <li key={r.raceId}>
                  <button
                    type="button"
                    onClick={() => toggle(r.raceId)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F0EB] ${
                      isSelected ? "bg-[#E6ECFF] font-semibold" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="text-xs text-[var(--text-muted,#78716C)]">
                        BTC: {r.tenantName ?? "—"}
                        <span className="mx-1">·</span>
                        <span className="font-mono">id={r.raceId}</span>
                        <span className="mx-1">·</span>
                        {formatRaceStatus(r.status)}
                      </div>
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-blue-700" />}
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
