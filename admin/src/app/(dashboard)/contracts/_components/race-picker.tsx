"use client";

/**
 * F-024 Race Picker — search race for auto-fill (US-06).
 *
 * Optional: contract may not be race-specific. Use SDK `racesControllerSearchRaces`
 * from generated SDK (this controller already exists pre-Phase 2B).
 */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import "@/lib/api";
import { racesControllerSearchRaces } from "@/lib/api-generated";

export type RacePickerValue = {
  raceId: string;
  raceName: string;
  raceDate?: string;
  raceLocation?: string;
} | null;

type Props = {
  value: RacePickerValue;
  onChange: (v: RacePickerValue) => void;
};

type RaceLite = {
  _id?: string;
  id?: string;
  name?: string;
  raceName?: string;
  startDate?: string;
  raceDate?: string;
  location?: string;
};

export function RacePicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<RaceLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setList([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      racesControllerSearchRaces({ query: { q, limit: 10 } as any })
        .then((res: any) => {
          if (!alive) return;
          const items: RaceLite[] = Array.isArray(res?.data)
            ? res.data
            : res?.data?.items ?? [];
          setList(items);
        })
        .catch((err) => {
          if (alive) toast.error(`Không tìm được race: ${err.message}`);
        })
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--border,#E7E2D9)] bg-[#E6ECFF] p-3">
        <div>
          <div className="text-sm font-semibold">{value.raceName}</div>
          {value.raceDate && (
            <div className="text-xs text-[var(--text-muted,#78716C)]">
              {value.raceDate?.slice(0, 10)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Xoá race đã chọn"
          className="rounded p-1 hover:bg-white"
        >
          <X className="size-4" />
        </button>
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
          placeholder="Tìm giải đấu (optional)"
          className="pl-8"
        />
      </div>
      {q && (
        <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
          {loading && (
            <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
              Đang tìm...
            </div>
          )}
          {!loading && list.length === 0 && (
            <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
              Không có kết quả
            </div>
          )}
          {!loading &&
            list.map((r) => {
              const id = r._id || r.id || "";
              const name = r.raceName || r.name || "(không tên)";
              const date = r.raceDate || r.startDate;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    onChange({
                      raceId: id,
                      raceName: name,
                      raceDate: date,
                      raceLocation: r.location,
                    })
                  }
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F3F0EB]"
                >
                  <div className="font-medium">{name}</div>
                  {date && (
                    <div className="text-xs text-[var(--text-muted,#78716C)]">
                      {date.slice(0, 10)} {r.location ? `· ${r.location}` : ""}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
