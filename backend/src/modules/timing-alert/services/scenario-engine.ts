import { createHash } from 'crypto';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';
import {
  SimulationScenario,
  ScenarioType,
} from '../schemas/timing-alert-simulation.schema';
import { parseTimeToSeconds, secondsToHms } from '../utils/parsed-athlete';

/**
 * Phase 2 — Scenario injection engine.
 *
 * Apply scenarios on TOP of time-filtered athletes. Deterministic chọn
 * athletes qua hash(simCourseId + bib) → same input always picks same
 * athletes. BTC reset + replay → scenarios consistent.
 *
 * **Apply order:**
 * 1. TOP_N_MISS_FINISH (specific selection theo rank)
 * 2. MAT_FAILURE (consecutive at one CP)
 * 3. MISS_FINISH / MISS_MIDDLE_CP / MISS_START (random N)
 * 4. LATE_FINISHER (shift time, KHÔNG drop)
 * 5. PHANTOM_RUNNER (drop Start)
 *
 * Mỗi athlete có thể bị nhiều scenarios apply (cộng dồn) — VD top 1 vừa
 * MISS_FINISH vừa LATE_FINISHER thì kết quả là drop Finish (logic short-
 * circuit nếu key đã drop).
 *
 * **Performance:** O(N_athletes × N_scenarios). Với 5000 athletes × 5
 * scenarios = 25K iterations per serve, in-memory, dưới 50ms.
 */
export interface ScenarioApplyResult {
  items: RaceResultApiItem[];
  /** Số athletes thật sự bị tác động (debug stat). */
  affectedCount: Record<string, number>;
}

export function applyScenarios(
  items: RaceResultApiItem[],
  scenarios: SimulationScenario[],
  simCourseId: string,
): ScenarioApplyResult {
  const enabled = scenarios.filter(
    (s) =>
      s.enabled &&
      (!s.scopeSimCourseId || s.scopeSimCourseId === simCourseId),
  );
  const affectedCount: Record<string, number> = {};

  if (enabled.length === 0) {
    return { items, affectedCount };
  }

  // Working copy — KHÔNG mutate input
  let working: RaceResultApiItem[] = items.map((it) => ({ ...it }));

  // Sort scenarios theo apply order
  const orderRank: Record<ScenarioType, number> = {
    TOP_N_MISS_FINISH: 1,
    MAT_FAILURE: 2,
    MISS_FINISH: 3,
    MISS_MIDDLE_CP: 4,
    MISS_START: 5,
    PHANTOM_RUNNER: 6,
    LATE_FINISHER: 7,
  };
  const ordered = [...enabled].sort(
    (a, b) => (orderRank[a.type] ?? 99) - (orderRank[b.type] ?? 99),
  );

  for (const scenario of ordered) {
    const { newWorking, affected } = applyOne(working, scenario, simCourseId);
    working = newWorking;
    affectedCount[scenario.id] = affected;
  }

  return { items: working, affectedCount };
}

// ─────────── Per-scenario logic ───────────

function applyOne(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
): { newWorking: RaceResultApiItem[]; affected: number } {
  switch (scenario.type) {
    case 'TOP_N_MISS_FINISH':
      return applyTopNMissFinish(items, scenario);
    case 'MAT_FAILURE':
      return applyMatFailure(items, scenario, simCourseId);
    case 'MISS_FINISH':
      return applyDropKey(items, scenario, simCourseId, 'finish');
    case 'MISS_MIDDLE_CP':
      return applyMissMiddleCp(items, scenario, simCourseId);
    case 'MISS_START':
      return applyDropKey(items, scenario, simCourseId, 'start');
    case 'PHANTOM_RUNNER':
      return applyPhantomRunner(items, scenario, simCourseId);
    case 'LATE_FINISHER':
      return applyLateFinisher(items, scenario, simCourseId);
    default:
      return { newWorking: items, affected: 0 };
  }
}

/**
 * TOP_N_MISS_FINISH — pick athletes có Finish time tốt nhất (smallest
 * seconds), drop Finish key. Force CRITICAL alerts (TopN projection).
 */
function applyTopNMissFinish(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
): { newWorking: RaceResultApiItem[]; affected: number } {
  const topN = scenario.topN ?? 10;
  // Compute seconds cho mỗi athlete có Finish, sort ASC, lấy topN BIBs
  const withFinish: Array<{ idx: number; bib: string; finishSec: number }> = [];
  items.forEach((it, idx) => {
    const map = parseChiptimes(it.Chiptimes);
    const finishKey = findKeyCi(map, 'finish');
    if (!finishKey) return;
    const seconds = parseTimeToSeconds(map[finishKey]);
    if (seconds === null || seconds <= 0) return;
    withFinish.push({ idx, bib: String(it.Bib ?? ''), finishSec: seconds });
  });
  withFinish.sort((a, b) => a.finishSec - b.finishSec);

  const targets = new Set(withFinish.slice(0, topN).map((t) => t.idx));
  if (targets.size === 0) return { newWorking: items, affected: 0 };

  const newWorking = items.map((it, idx) => {
    if (!targets.has(idx)) return it;
    return dropKeyFromItem(it, 'finish');
  });
  return { newWorking, affected: targets.size };
}

/**
 * MAT_FAILURE — drop time tại checkpointKey cho N athletes liên tiếp
 * theo time order (athletes vừa qua mat fail). Force anomaly detection.
 */
function applyMatFailure(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
): { newWorking: RaceResultApiItem[]; affected: number } {
  const cp = scenario.checkpointKey?.trim();
  if (!cp) return { newWorking: items, affected: 0 };

  // Sort athletes có time tại cp theo time ASC, lấy first N
  const withCp: Array<{ idx: number; cpSec: number }> = [];
  items.forEach((it, idx) => {
    const map = parseChiptimes(it.Chiptimes);
    const cpKey = findKeyCi(map, cp);
    if (!cpKey) return;
    const seconds = parseTimeToSeconds(map[cpKey]);
    if (seconds === null || seconds <= 0) return;
    withCp.push({ idx, cpSec: seconds });
  });
  withCp.sort((a, b) => a.cpSec - b.cpSec);

  // Skip first few (athletes đầu qua trước fail), lấy slice giữa N
  // Simpler: pick consecutive starting from offset hash-deterministic
  const seed = hashSeed(simCourseId + 'mat' + cp);
  const offset = withCp.length > scenario.count
    ? Math.floor((seed % 1000) * (withCp.length - scenario.count) / 1000)
    : 0;
  const targets = new Set(
    withCp.slice(offset, offset + scenario.count).map((t) => t.idx),
  );

  const newWorking = items.map((it, idx) => {
    if (!targets.has(idx)) return it;
    return dropKeyFromItem(it, cp);
  });
  return { newWorking, affected: targets.size };
}

/**
 * MISS_MIDDLE_CP — random N athletes, drop 1 random middle checkpoint
 * (không Start, không Finish).
 */
function applyMissMiddleCp(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
): { newWorking: RaceResultApiItem[]; affected: number } {
  const eligible = items
    .map((it, idx) => {
      const map = parseChiptimes(it.Chiptimes);
      const middle = Object.keys(map).filter(
        (k) => !isMatchCi(k, 'start') && !isMatchCi(k, 'finish'),
      );
      return middle.length > 0 ? { idx, middle } : null;
    })
    .filter((e): e is { idx: number; middle: string[] } => e !== null);

  const targets = pickDeterministic(
    eligible.map((e) => e.idx),
    scenario.count,
    simCourseId + 'middle',
    items,
  );
  const targetSet = new Set(targets);

  const newWorking = items.map((it, idx) => {
    if (!targetSet.has(idx)) return it;
    const eligible = parseChiptimes(it.Chiptimes);
    const middle = Object.keys(eligible).filter(
      (k) => !isMatchCi(k, 'start') && !isMatchCi(k, 'finish'),
    );
    if (middle.length === 0) return it;
    // Pick which middle key to drop deterministically
    const seed = hashSeed(simCourseId + String(it.Bib ?? '') + 'middle');
    const dropKey = middle[seed % middle.length];
    return dropKeyFromItem(it, dropKey);
  });
  return { newWorking, affected: targetSet.size };
}

function applyDropKey(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
  matchKey: string, // 'finish' | 'start' (case-insensitive)
): { newWorking: RaceResultApiItem[]; affected: number } {
  const eligible = items
    .map((it, idx) => {
      const map = parseChiptimes(it.Chiptimes);
      return findKeyCi(map, matchKey) ? idx : null;
    })
    .filter((idx): idx is number => idx !== null);

  const targets = pickDeterministic(
    eligible,
    scenario.count,
    simCourseId + matchKey,
    items,
  );
  const targetSet = new Set(targets);
  const newWorking = items.map((it, idx) =>
    targetSet.has(idx) ? dropKeyFromItem(it, matchKey) : it,
  );
  return { newWorking, affected: targetSet.size };
}

/**
 * PHANTOM_RUNNER — drop Start nhưng giữ TM1+. Sequence broken — useful
 * test phantom detection (athlete xuất hiện không có baseline time).
 */
function applyPhantomRunner(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
): { newWorking: RaceResultApiItem[]; affected: number } {
  // Eligible = athletes có cả Start + ≥1 middle/finish
  const eligible = items
    .map((it, idx) => {
      const map = parseChiptimes(it.Chiptimes);
      const hasStart = !!findKeyCi(map, 'start');
      const hasOther = Object.keys(map).some((k) => !isMatchCi(k, 'start'));
      return hasStart && hasOther ? idx : null;
    })
    .filter((idx): idx is number => idx !== null);

  const targets = pickDeterministic(
    eligible,
    scenario.count,
    simCourseId + 'phantom',
    items,
  );
  const targetSet = new Set(targets);
  const newWorking = items.map((it, idx) =>
    targetSet.has(idx) ? dropKeyFromItem(it, 'start') : it,
  );
  return { newWorking, affected: targetSet.size };
}

/**
 * LATE_FINISHER — random N có Finish, shift Finish time +shiftMinutes.
 * KHÔNG drop, chỉ delay → test overdue threshold.
 */
function applyLateFinisher(
  items: RaceResultApiItem[],
  scenario: SimulationScenario,
  simCourseId: string,
): { newWorking: RaceResultApiItem[]; affected: number } {
  const shiftSec = (scenario.shiftMinutes ?? 30) * 60;
  // Eligible nếu CHIP hoặc GUN có Finish (post-merge sẽ thấy)
  const eligible = items
    .map((it, idx) => {
      const chip = parseChiptimes(it.Chiptimes);
      const gun = parseChiptimes(it.Guntimes);
      return findKeyCi(chip, 'finish') || findKeyCi(gun, 'finish') ? idx : null;
    })
    .filter((idx): idx is number => idx !== null);

  const targets = pickDeterministic(
    eligible,
    scenario.count,
    simCourseId + 'late',
    items,
  );
  const targetSet = new Set(targets);
  const newWorking = items.map((it, idx) => {
    if (!targetSet.has(idx)) return it;
    // Shift Finish trong CẢ Chiptimes + Guntimes (parser merge cả 2 →
    // nếu chỉ shift 1, parser sẽ priority Chiptimes, có thể skip Guntimes shift)
    const chip = parseChiptimes(it.Chiptimes);
    const gun = parseChiptimes(it.Guntimes);
    const chipKey = findKeyCi(chip, 'finish');
    const gunKey = findKeyCi(gun, 'finish');

    if (chipKey) {
      const sec = parseTimeToSeconds(chip[chipKey]);
      if (sec !== null) chip[chipKey] = secondsToHms(sec + shiftSec);
    }
    if (gunKey) {
      const sec = parseTimeToSeconds(gun[gunKey]);
      if (sec !== null) gun[gunKey] = secondsToHms(sec + shiftSec);
    }

    return {
      ...it,
      Chiptimes: JSON.stringify(chip),
      Guntimes: JSON.stringify(gun),
    };
  });
  return { newWorking, affected: targetSet.size };
}

// ─────────── Helpers ───────────

function pickDeterministic(
  eligibleIndices: number[],
  count: number,
  scenarioSeed: string,
  items: RaceResultApiItem[],
): number[] {
  if (count <= 0 || eligibleIndices.length === 0) return [];
  const n = Math.min(count, eligibleIndices.length);
  // Sort eligible by hash(seed + bib) ASC, take first n
  const scored = eligibleIndices.map((idx) => ({
    idx,
    score: hashSeed(scenarioSeed + String(items[idx]?.Bib ?? idx)),
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map((s) => s.idx);
}

function hashSeed(input: string): number {
  const h = createHash('sha256').update(input).digest();
  // Take first 4 bytes → uint32
  return h.readUInt32BE(0);
}

function parseChiptimes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const p = JSON.parse(trimmed) as Record<string, string>;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function findKeyCi(map: Record<string, string>, target: string): string | null {
  const lower = target.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

function isMatchCi(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Drop key khỏi CẢ Chiptimes + Guntimes — symmetric strip.
 *
 * **Why both:** scenarios test miss-detection cho timing-alert poll.
 * `parseRaceResultAthlete` (utils/parsed-athlete.ts) merge Chiptimes +
 * Guntimes (Chiptimes priority, Guntimes fallback) → nếu chỉ drop
 * Chiptimes, Guntimes "rescue" key → poll service vẫn thấy time → scenario
 * NO-OP.
 *
 * Drop both → merged result thực sự thiếu key → scenario có effect đúng.
 */
function dropKeyFromItem(
  item: RaceResultApiItem,
  matchKey: string,
): RaceResultApiItem {
  const chip = parseChiptimes(item.Chiptimes);
  const gun = parseChiptimes(item.Guntimes);

  const chipKey = findKeyCi(chip, matchKey);
  if (chipKey) delete chip[chipKey];
  const gunKey = findKeyCi(gun, matchKey);
  if (gunKey) delete gun[gunKey];

  if (!chipKey && !gunKey) return item; // key not present in either

  // Recompute TimingPoint = key cuối còn lại theo time desc, từ merged map
  const merged: Record<string, string> = { ...gun, ...chip }; // chip priority
  const remaining = Object.entries(merged)
    .map(([k, v]) => ({ k, sec: parseTimeToSeconds(v) ?? -1 }))
    .filter((e) => e.sec > 0);
  remaining.sort((a, b) => b.sec - a.sec);
  const newTimingPoint = remaining[0]?.k ?? '';

  return {
    ...item,
    Chiptimes: JSON.stringify(chip),
    Guntimes: JSON.stringify(gun),
    TimingPoint: newTimingPoint,
  };
}
