import { Injectable, Logger } from '@nestjs/common';

/**
 * F-019 BR-AG-39 — vendor quirks normalization layer.
 *
 * TD-F019-VENDOR Phase 1: awards-internal. Phase 2 extract sang
 * `common/services/` cho F-005/F-010 cùng dùng.
 *
 * Source: Section B advisory §4 + memory `vendor_raceresult_quirks.md`.
 *  - TimingPoint case mixed (`Finish` 5K vs `FINISH` 10/21/42K) → lowercase compare
 *  - `-1` sentinels cho OverallRank/genderRank → filter ra trước sort
 *  - Pace root sai → recompute = `finishChipTimeMs / distanceM × 1000`
 *  - `OverallRank` live tại checkpoint != final → KHÔNG dùng vendor rank cho podium calc
 *  - BIB không unique cross-race → luôn scope theo `raceId`
 */

export interface NormalizedAthlete {
  bib: string;
  name?: string;
  raceId: string;
  courseId: string;
  /** Final chip time as milliseconds. NaN when no finish read. */
  chipTimeMs: number | null;
  /** Final gun time as milliseconds. */
  gunTimeMs: number | null;
  /** Pace as sec/km recomputed from chipTime + distance — never trust vendor `pace`. */
  paceSecPerKm: number | null;
  status: 'FIN' | 'DNF' | 'DSQ' | 'CUT' | 'LIVE' | 'DNS' | 'UNKNOWN';
  gender: 'M' | 'F' | null;
  /** Vendor-supplied AG label (e.g. "Nam 30-39") — Path B fallback for AG calc. */
  vendorAgeGroup?: string;
  nationality?: string;
  hasFinishChipRead: boolean;
  /** Last split rank if available (live OverallRank pre-finish — DO NOT use for podium). */
  lastSplitRank: number | null;
  /** Last split distance (km). */
  lastSplitDistanceKm: number | null;
  /** Elapsed sec at lastSplit (for predicted rank). */
  lastSplitElapsedSec: number | null;
  /** Number of splits successfully recorded. */
  splitsCount: number;
  /** Raw vendor finish reads count (for Pattern E duplicate detection). */
  finishReadCount: number;
  /** True khi pre-existing dsqReason chứa pending/review (for Pattern C). */
  dsqReasonText?: string;
  /** Raw evidence handle (for downstream pattern explanation). */
  raw: Record<string, unknown>;
}

const TIME_REGEX_HMS = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/;
const TIME_REGEX_MS = /^(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;

function parseTimeToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '0' || trimmed === '00:00' || trimmed === '00:00:00') {
    return null;
  }
  const hms = TIME_REGEX_HMS.exec(trimmed);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    const s = parseInt(hms[3], 10);
    const frac = hms[4] ? parseInt(hms[4].padEnd(3, '0').slice(0, 3), 10) : 0;
    return h * 3_600_000 + m * 60_000 + s * 1_000 + frac;
  }
  const ms = TIME_REGEX_MS.exec(trimmed);
  if (ms) {
    const m = parseInt(ms[1], 10);
    const s = parseInt(ms[2], 10);
    const frac = ms[3] ? parseInt(ms[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    return m * 60_000 + s * 1_000 + frac;
  }
  return null;
}

function parseRank(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    if (raw <= 0 || raw >= 900_000) return null; // -1 / 999999 sentinel
    return raw;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n <= 0 || n >= 900_000) return null;
  return n;
}

function tryParseJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

@Injectable()
export class NormalizeVendorQuirksService {
  private readonly logger = new Logger(NormalizeVendorQuirksService.name);

  normalizeAthlete(input: {
    raceId: string;
    courseId: string;
    bib: string;
    name?: string;
    gender?: string;
    chipTime?: string;
    gunTime?: string;
    chiptimes?: string;
    guntimes?: string;
    paces?: string;
    overallRanks?: string;
    overallRank?: string | number;
    overallRankNumeric?: number;
    timingPoint?: string;
    distance?: string;
    courseDistanceKm?: number;
    category?: string;
    nationality?: string;
    splits?: Array<{ name?: string; time?: string; rank?: number }>;
    rawData?: Record<string, unknown> | null;
    dsqReason?: string;
    dsqReasonInternal?: string;
  }): NormalizedAthlete {
    const chiptimesObj = tryParseJson(input.chiptimes);
    const overallRanksObj = tryParseJson(input.overallRanks);
    const pacesObj = tryParseJson(input.paces);

    // Locate finish chip read across case-mixed keys (Finish vs FINISH).
    let finishKey: string | null = null;
    let finishReadCount = 0;
    if (chiptimesObj) {
      for (const k of Object.keys(chiptimesObj)) {
        if (k.toLowerCase() === 'finish') {
          const v = chiptimesObj[k];
          if (v != null && v !== '') {
            finishReadCount++;
            finishKey = k;
          }
        }
      }
    }

    // Prefer column-level finish; fallback to chiptimes JSON.
    const chipTimeMs =
      parseTimeToMs(input.chipTime) ??
      (finishKey ? parseTimeToMs(chiptimesObj![finishKey]) : null);
    const gunTimeMs = parseTimeToMs(input.gunTime);

    // Pace recompute (BR-AG-39 — vendor `pace` root sai cho finishers).
    let paceSecPerKm: number | null = null;
    if (chipTimeMs != null && input.courseDistanceKm && input.courseDistanceKm > 0) {
      paceSecPerKm = chipTimeMs / 1000 / input.courseDistanceKm;
    }

    // Last split rank from overallRanks JSON (excl. Finish — vendor live rank).
    let lastSplitRank: number | null = null;
    let lastSplitName: string | null = null;
    if (overallRanksObj) {
      for (const k of Object.keys(overallRanksObj)) {
        if (k.toLowerCase() === 'finish' || k.toLowerCase() === 'start') {
          continue;
        }
        const r = parseRank(overallRanksObj[k]);
        if (r != null) {
          lastSplitRank = r;
          lastSplitName = k;
        }
      }
    }

    // Splits count — non-empty entries excluding Start/Finish.
    let splitsCount = 0;
    if (chiptimesObj) {
      for (const k of Object.keys(chiptimesObj)) {
        const lk = k.toLowerCase();
        if (lk === 'start') continue;
        if (lk === 'finish') continue;
        const v = chiptimesObj[k];
        if (v != null && v !== '') splitsCount++;
      }
    }
    if (splitsCount === 0 && input.splits?.length) {
      splitsCount = input.splits.filter(
        (s) => s.time && s.time.length > 0 && parseTimeToMs(s.time) != null,
      ).length;
    }

    // lastSplit distance — heuristic from splits array (per-name lookup).
    let lastSplitDistanceKm: number | null = null;
    let lastSplitElapsedSec: number | null = null;
    if (input.splits?.length) {
      for (const s of input.splits) {
        const t = parseTimeToMs(s.time);
        if (t != null) {
          lastSplitElapsedSec = t / 1000;
          if (s.name && /^\d+(?:\.\d+)?\s*(?:k|km)?$/i.test(s.name.trim())) {
            const km = parseFloat(s.name);
            if (!Number.isNaN(km)) lastSplitDistanceKm = km;
          }
        }
      }
    }

    const status = deriveStatus(input.timingPoint, chipTimeMs, input.dsqReason);
    const dsqReasonText =
      input.dsqReason ?? input.dsqReasonInternal ?? undefined;

    const gender = normalizeGender(input.gender);

    return {
      bib: String(input.bib),
      name: input.name,
      raceId: input.raceId,
      courseId: input.courseId,
      chipTimeMs,
      gunTimeMs,
      paceSecPerKm,
      status,
      gender,
      vendorAgeGroup: input.category,
      nationality: input.nationality,
      hasFinishChipRead: chipTimeMs != null,
      lastSplitRank,
      lastSplitDistanceKm,
      lastSplitElapsedSec,
      splitsCount,
      finishReadCount,
      dsqReasonText,
      raw: {
        chiptimesObj,
        overallRanksObj,
        pacesObj,
        timingPoint: input.timingPoint,
        lastSplitName,
      },
    };
  }
}

function normalizeGender(raw?: string): 'M' | 'F' | null {
  if (!raw) return null;
  const g = raw.trim().toUpperCase();
  if (g === 'M' || g === 'NAM' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'NỮ' || g === 'NU' || g === 'FEMALE' || g === 'W') {
    return 'F';
  }
  return null;
}

function deriveStatus(
  timingPoint: string | undefined,
  chipTimeMs: number | null,
  dsqReason?: string,
): NormalizedAthlete['status'] {
  if (dsqReason && dsqReason.trim().length > 0) {
    if (/cut.*off|cutoff|cut/i.test(dsqReason)) return 'CUT';
    if (/dnf/i.test(dsqReason)) return 'DNF';
    if (/dsq|disqual/i.test(dsqReason)) return 'DSQ';
    if (/dns|did.not.start/i.test(dsqReason)) return 'DNS';
  }
  const tp = (timingPoint ?? '').toLowerCase();
  if (tp === 'finish' || tp === 'fin') return chipTimeMs != null ? 'FIN' : 'DNF';
  if (chipTimeMs != null) return 'FIN';
  return 'LIVE';
}
