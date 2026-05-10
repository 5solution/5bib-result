"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface RaceOption {
  raceId: string;
  raceName: string;
}

interface Props {
  races: RaceOption[];
  selectedRaceId: string | null;
  onChange: (raceId: string | null) => void;
}

export function RaceDrillDownFilter({ races, selectedRaceId, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedRaceId ?? "__all__"}
        onValueChange={(v) => onChange(v === "__all__" ? null : v)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Chọn giải để xem riêng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Toàn platform</SelectItem>
          {races.map((r) => (
            <SelectItem key={r.raceId} value={r.raceId}>
              {r.raceName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedRaceId && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Bỏ chọn"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
