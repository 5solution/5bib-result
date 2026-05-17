"use client";

/**
 * F-024 Race Picker — search race for auto-fill (US-06).
 *
 * Optional: contract may not be race-specific. Use SDK `racesControllerSearchRaces`
 * from generated SDK (this controller already exists pre-Phase 2B).
 *
 * F-024 Fix 1 (2026-05-11): support 2-tab mode toggle.
 *   - Tab "Chọn từ DB" — search race entity, populate raceId
 *   - Tab "Nhập thủ công" — admin gõ raceName/raceDate/raceLocation tự do
 *     (case: ký HĐ trước khi setup race entity, hoặc race nhiều ngày).
 *     raceDate là FREE-FORMAT STRING (Danny chốt B): "06:00 ngày 15/06/2026
 *     đến 12:00 ngày 16/06/2026" cho race nhiều ngày. KHÔNG dùng date picker.
 *   Khi manual mode: raceId KHÔNG được set → backend lưu raceId=undefined,
 *   raceName/raceDate/raceLocation snapshot vào contract.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import "@/lib/api";
import {
  racesControllerSearchRaces,
  type RacesControllerSearchRacesData,
  type RacesControllerSearchRacesResponses,
} from "@/lib/api-generated";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "./search-input";

export type RacePickerValue = {
  raceId?: string; // undefined khi manual input mode
  raceName: string;
  raceDate?: string;
  raceLocation?: string;
} | null;

type Props = {
  value: RacePickerValue;
  onChange: (v: RacePickerValue) => void;
  /** Default true. Set false để chỉ hiển thị DB picker (vd: filter screen). */
  allowManual?: boolean;
};

type RaceLite = {
  _id?: string;
  id?: string;
  // Backend Race schema field hierarchy:
  //  - `title` — primary display name on Race doc (race.schema.ts:136)
  //  - `name` — legacy alt OR may be present on some races
  //  - `raceName` — manual mode shape (contracts ContractRaceSnapshotDto)
  // Frontend fallback chain: raceName → title → name → "(không tên)"
  title?: string;
  name?: string;
  raceName?: string;
  startDate?: string;
  raceDate?: string;
  location?: string;
};

export function RacePicker({ value, onChange, allowManual = true }: Props) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<RaceLite[]>([]);
  const [loading, setLoading] = useState(false);
  // Mode: 'db' = pick từ database, 'manual' = nhập tự do.
  // Khi value đã có raceId → infer 'db'. Khi value có raceName nhưng không raceId → 'manual'.
  const [mode, setMode] = useState<"db" | "manual">(
    value && !value.raceId && value.raceName ? "manual" : "db",
  );
  // Local state cho manual form (không sync lên parent ngay từng keystroke
  // để tránh re-render wizard; commit on blur).
  const [manualForm, setManualForm] = useState({
    raceName: value && !value.raceId ? value.raceName : "",
    raceDate: value && !value.raceId ? value.raceDate ?? "" : "",
    raceLocation: value && !value.raceId ? value.raceLocation ?? "" : "",
  });

  // UX-23: nếu q rỗng → load 10 race gần đây nhất để user pick mà không cần gõ.
  // SDK schema: `title` cho search keyword, `pageSize` cho limit (không có `q` / `limit`).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      const query: NonNullable<RacesControllerSearchRacesData["query"]> = {
        title: q.trim() || undefined,
        pageSize: 10,
      };
      racesControllerSearchRaces({ query })
        .then((res) => {
          if (!alive) return;
          // SDK trả về `{ data: { data: { list: [...] } } }`.
          // `list` items là `Record<string, unknown>` (vendor race shape không
          // được codegen vào schema chi tiết) — narrow xuống RaceLite tại đây.
          const payload = res.data as
            | RacesControllerSearchRacesResponses[200]
            | undefined;
          const rawList = payload?.data?.list ?? [];
          const items: RaceLite[] = rawList.map((r) => r as RaceLite);
          setList(items);
        })
        .catch((err: Error) => {
          if (alive) toast.error(`Không tìm được race: ${err.message}`);
        })
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  // Hiển thị "đã chọn" CHỈ khi mode === 'db' và có raceId (pick từ DB).
  // Manual mode dùng form luôn open (admin có thể edit tự do).
  if (value && value.raceId && mode === "db") {
    return (
      <div className="space-y-2">
        {allowManual && (
          <ModeTabs
            mode={mode}
            onChange={(m) => {
              if (m === "manual") {
                // Switch sang manual: giữ data race đã pick làm seed cho form.
                setManualForm({
                  raceName: value.raceName ?? "",
                  raceDate: value.raceDate ?? "",
                  raceLocation: value.raceLocation ?? "",
                });
                onChange({
                  raceName: value.raceName ?? "",
                  raceDate: value.raceDate,
                  raceLocation: value.raceLocation,
                });
              }
              setMode(m);
            }}
          />
        )}
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
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="space-y-3">
        {allowManual && (
          <ModeTabs mode={mode} onChange={(m) => setMode(m)} />
        )}
        <div className="rounded-md border border-[var(--border,#E7E2D9)] bg-white p-4 space-y-3">
          <div>
            <Label htmlFor="manual-race-name">Tên giải *</Label>
            <Input
              id="manual-race-name"
              value={manualForm.raceName}
              onChange={(e) => {
                const v = e.target.value;
                setManualForm((f) => ({ ...f, raceName: v }));
                onChange(
                  v.trim().length === 0
                    ? null
                    : {
                        raceId: undefined,
                        raceName: v,
                        raceDate: manualForm.raceDate || undefined,
                        raceLocation: manualForm.raceLocation || undefined,
                      },
                );
              }}
              placeholder='vd: "Giải chạy ABC 2026"'
            />
          </div>
          <div>
            <Label htmlFor="manual-race-date">
              Ngày diễn ra (free-format)
            </Label>
            <Input
              id="manual-race-date"
              value={manualForm.raceDate}
              onChange={(e) => {
                const v = e.target.value;
                setManualForm((f) => ({ ...f, raceDate: v }));
                if (manualForm.raceName.trim()) {
                  onChange({
                    raceId: undefined,
                    raceName: manualForm.raceName,
                    raceDate: v || undefined,
                    raceLocation: manualForm.raceLocation || undefined,
                  });
                }
              }}
              placeholder='vd: "06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026"'
            />
            <p className="mt-1 text-xs text-[var(--text-muted,#78716C)]">
              Nhập tự do — chấp nhận race nhiều ngày, giờ giấc chi tiết. Hệ
              thống sẽ substitue nguyên văn vào template DOCX.
            </p>
          </div>
          <div>
            <Label htmlFor="manual-race-location">Địa điểm</Label>
            <Input
              id="manual-race-location"
              value={manualForm.raceLocation}
              onChange={(e) => {
                const v = e.target.value;
                setManualForm((f) => ({ ...f, raceLocation: v }));
                if (manualForm.raceName.trim()) {
                  onChange({
                    raceId: undefined,
                    raceName: manualForm.raceName,
                    raceDate: manualForm.raceDate || undefined,
                    raceLocation: v || undefined,
                  });
                }
              }}
              placeholder='vd: "Hồ Tuyền Lâm, Đà Lạt"'
            />
          </div>
          {manualForm.raceName.trim().length > 0 &&
            manualForm.raceName.trim().length < 3 && (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Tên giải nên có tối thiểu 3 ký tự.
              </p>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allowManual && (
        <ModeTabs mode={mode} onChange={(m) => setMode(m)} />
      )}
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Tìm giải đấu (optional)"
        ariaLabel="Tìm giải đấu"
      />
      <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
        {!q && !loading && list.length > 0 && (
          <div className="border-b border-[var(--border,#E7E2D9)] bg-[#FAF8F5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted,#78716C)]">
            Race gần đây
          </div>
        )}
        {loading && (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            Đang tìm...
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="p-3 text-center text-sm text-[var(--text-muted,#78716C)]">
            {q ? "Không có kết quả" : "Chưa có race nào"}
          </div>
        )}
          {!loading &&
            list.map((r) => {
              const id = r._id || r.id || "";
              // F-040 fix — Backend Race schema dùng field `title` (race.schema.ts:136),
              // KHÔNG phải `name`. Trước fix: race-picker chỉ check raceName||name → fallback
              // "(không tên)" cho mọi race vì Race objects không có 2 field này.
              const name = r.raceName || r.title || r.name || "(không tên)";
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
    </div>
  );
}

/**
 * F-024 Fix 1 — segmented control 2 tab cho DB vs Manual race input.
 * Pattern khớp với shadcn tabs nhưng inline để không thêm dependency.
 */
function ModeTabs({
  mode,
  onChange,
}: {
  mode: "db" | "manual";
  onChange: (m: "db" | "manual") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Cách chọn giải đấu"
      className="inline-flex rounded-md border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] p-0.5 text-xs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "db"}
        onClick={() => onChange("db")}
        className={
          "rounded px-3 py-1 transition-colors " +
          (mode === "db"
            ? "bg-white font-semibold text-[var(--text,#1C1917)] shadow-sm"
            : "text-[var(--text-muted,#78716C)] hover:text-[var(--text,#1C1917)]")
        }
      >
        Chọn từ danh sách
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "manual"}
        onClick={() => onChange("manual")}
        className={
          "rounded px-3 py-1 transition-colors " +
          (mode === "manual"
            ? "bg-white font-semibold text-[var(--text,#1C1917)] shadow-sm"
            : "text-[var(--text-muted,#78716C)] hover:text-[var(--text,#1C1917)]")
        }
      >
        Nhập thủ công
      </button>
    </div>
  );
}
