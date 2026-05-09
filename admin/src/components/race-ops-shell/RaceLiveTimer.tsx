"use client";

/**
 * F-007 BR-AF-07/08/09/10 — RACE LIVE timer in global shell header.
 *
 * Behavior matrix (BR-AF-07):
 *   draft     → "DRAFT" gray static badge (no tick)
 *   pre_race  → "RACE START IN T-HH:MM:SS" amber countdown 1Hz
 *   live      → "RACE LIVE · HH:MM:SS" red pulsing 1Hz
 *   ended     → "RACE ENDED · HH:MM:SS" gray static (final elapsed)
 *
 * Edge cases (BR-AF-10):
 *   - scheduledStartAt null → "TBD"
 *   - startedAt null while live → "RACE LIVE · --:--:--"
 */

import { useEffect, useState } from "react";

export type RaceTimerStatus = "draft" | "pre_race" | "live" | "ended";

export interface RaceTimerInput {
  status: RaceTimerStatus;
  startedAt?: string | null;
  scheduledStartAt?: string | null;
  endedAt?: string | null;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatHHMMSS(diffMs: number): string {
  const total = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function computeTimerDisplay(race: RaceTimerInput, nowMs: number = Date.now()): string {
  switch (race.status) {
    case "draft":
      return "DRAFT";
    case "pre_race": {
      if (!race.scheduledStartAt) return "TBD";
      const target = new Date(race.scheduledStartAt).getTime();
      if (Number.isNaN(target)) return "TBD";
      const diff = target - nowMs;
      if (diff <= 0) return "RACE LIVE · --:--:--";
      return `RACE START IN T-${formatHHMMSS(diff)}`;
    }
    case "live": {
      if (!race.startedAt) return "RACE LIVE · --:--:--";
      const start = new Date(race.startedAt).getTime();
      if (Number.isNaN(start)) return "RACE LIVE · --:--:--";
      return `RACE LIVE · ${formatHHMMSS(nowMs - start)}`;
    }
    case "ended": {
      if (!race.startedAt || !race.endedAt) return "RACE ENDED · --:--:--";
      const start = new Date(race.startedAt).getTime();
      const end = new Date(race.endedAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return "RACE ENDED · --:--:--";
      return `RACE ENDED · ${formatHHMMSS(end - start)}`;
    }
  }
}

function badgeClass(status: RaceTimerStatus): string {
  // Tailwind utility classes — kept inline (Server-Component-friendly bundling not needed; this is 'use client').
  switch (status) {
    case "draft":
      return "inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-stone-600";
    case "pre_race":
      return "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-amber-700 ring-1 ring-amber-200";
    case "live":
      return "inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide text-rose-700 ring-1 ring-rose-200";
    case "ended":
      return "inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-stone-600 ring-1 ring-stone-200";
  }
}

export function RaceLiveTimer({ race }: { race: RaceTimerInput }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    // BR-AF-09 — only tick when timer actually changes (live + pre_race)
    if (race.status !== "live" && race.status !== "pre_race") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [race.status]);

  const display = computeTimerDisplay(race, now);
  const isLive = race.status === "live";

  return (
    <span className={badgeClass(race.status)} title={display}>
      {isLive ? <span className="size-1.5 rounded-full bg-rose-600 pulse-live" aria-hidden /> : null}
      <span className="tabular-nums">{display}</span>
    </span>
  );
}
