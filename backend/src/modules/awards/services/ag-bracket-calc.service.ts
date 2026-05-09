import { Injectable } from '@nestjs/common';
import {
  AGBracket,
  AGPreset,
  AG_PRESETS,
  GenderKey,
  defaultPresetFor,
} from '../constants/ag-presets';
import {
  CompoundingMode,
  Gender,
} from '../schemas/podium.schema';

/**
 * F-019 v2 — bracketSource tri-mode (PAUSE-RACE-V2-C LOCKED).
 *  - `'5bib'` (default): chỉ Path A (DOB master-data → ageOnRaceDay → bracket).
 *    Athlete thiếu DOB → exclude khỏi AG bucket.
 *  - `'vendor'`: chỉ Path B (vendor `Category` string parse).
 *    BTC chọn khi DOB coverage < 50%. Risk: vendor sai → 5BIB lose neutrality.
 *  - `'hybrid'`: Path A first → fallback Path B cho athletes thiếu DOB.
 */
export type BracketSource = '5bib' | 'vendor' | 'hybrid';

export interface AthleteForRanking {
  bib: string;
  name?: string;
  athleteId?: string;
  /**
   * F-019 v2 — gender accept both 'M'/'F' (already-normalized) AND raw
   * 'Male'/'Female'/'Nam'/'Nữ' strings (case-insensitive). v1 bug: chỉ chấp
   * nhận 'M'/'F' → vendor gender 'Male' bị filter ra silently → 0 podium.
   */
  gender: 'M' | 'F' | string | null;
  /** Raw DOB if exposed by upstream (Path A). DEPRECATED — use ageOnRaceDay. */
  dateOfBirth?: Date;
  /**
   * F-019 v2 — pre-computed age on race day (years). Path A primary input.
   * Set by `AgeComputerService` before calling `computeAGBuckets`.
   * KHÔNG persist DOB raw vào MongoDB (BR-03 PII strict allowlist).
   */
  ageOnRaceDay?: number | null;
  /** Vendor-supplied AG label (Path B — Phase 1 fallback). */
  vendorAgeGroup?: string;
  /** Final chip time ms for sort. */
  chipTimeMs: number | null;
  /** Gun time ms (secondary tie-breaker). */
  gunTimeMs: number | null;
  nationality?: string;
  /** Optional cached overall finish rank (after vendor sort) — for compounding mode. */
  overallRank?: number | null;
}

/**
 * F-019 v2 — robust gender normalize. Accepts:
 *   - Already-normalized: 'M', 'F'
 *   - English: 'Male', 'Female', 'male', 'female', 'm', 'f'
 *   - Vietnamese: 'Nam', 'Nữ', 'Nu', 'NAM', 'NỮ'
 * Returns 'M' | 'F' | null (cho 'Other'/'unknown').
 */
export function normalizeGenderStrict(raw: unknown): 'M' | 'F' | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const g = raw.trim().toUpperCase();
  if (!g) return null;
  if (g === 'M' || g === 'NAM' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'NỮ' || g === 'NU' || g === 'FEMALE' || g === 'W') {
    return 'F';
  }
  return null;
}

export interface RankedPodiumAthlete {
  bib: string;
  name?: string;
  athleteId?: string;
  rank: number;
  chipTimeMs?: number;
  gunTimeMs?: number;
  gender?: string;
  ageOnRaceDay?: number;
  nationality?: string;
  tied?: boolean;
}

export interface AGBucketResult {
  ageGroupKey: string; // e.g. "M_30-39"
  ageGroup: string; // e.g. "30-39"
  ageGroupLabel: string;
  gender: Gender;
  athletes: RankedPodiumAthlete[];
}

export interface CalcOptions {
  presetKey?: string;
  raceDay: Date;
  agTopN?: number;
  compoundingMode?: CompoundingMode;
  /** WA TR9 = 'upper' (đúng tuổi 30 → bracket 30-39). */
  boundaryMode?: 'upper' | 'lower';
  /** courseType for default preset selection. */
  courseType?: string;
  override?: AGPreset;
  /** Mutually exclusive scope (BR-AG-07): overall_top_3 | overall_top_5. */
  excludeOverallTopN?: number;
  /**
   * F-019 v2 — race-specific bracketSource override (PAUSE-RACE-V2-C).
   * Default `'5bib'` (Path A primary).
   */
  bracketSource?: BracketSource;
}

const VENDOR_AG_REGEX = /(\d{1,2})\s*[-–]\s*(\d{1,2})|(\d{1,2})\s*\+/;

/**
 * F-019 BR-AG-01..10 — pure function AG bracket calc.
 *
 * Path A (Phase 2): athlete.dateOfBirth available → compute age WA-style.
 * Path B (Phase 1): athlete.vendorAgeGroup string (e.g. "Nam 30-39") → parse & assign.
 * Else: athlete excluded with status `AG_INELIGIBLE_NO_DOB`.
 */
@Injectable()
export class AGBracketCalcService {
  /** BR-AG-01 — WA-style age calc. CẤM `Math.floor(diff/365.25)`. */
  computeAge(dob: Date, raceDay: Date): number {
    let age = raceDay.getUTCFullYear() - dob.getUTCFullYear();
    const dobMonth = dob.getUTCMonth();
    const dobDay = dob.getUTCDate();
    const raceMonth = raceDay.getUTCMonth();
    const raceDay_ = raceDay.getUTCDate();
    if (raceMonth < dobMonth || (raceMonth === dobMonth && raceDay_ < dobDay)) {
      age -= 1;
    }
    return age;
  }

  /**
   * BR-AG-03 — boundary inclusive WA TR9: đúng tuổi 30 → bracket 30-39 (TRÊN).
   * BR-AG-04 — athletes < min bracket → null (excluded). > max → bracket cao nhất.
   */
  assignBracket(
    age: number,
    gender: 'M' | 'F',
    preset: AGPreset,
    boundaryMode?: 'upper' | 'lower',
  ): AGBracket | null {
    const mode = boundaryMode ?? preset.boundaryMode;
    const brackets = preset.brackets[gender];
    for (const b of brackets) {
      const inLower = age >= b.min;
      const inUpper = b.max === -1 || age <= b.max;
      if (inLower && inUpper) {
        return b;
      }
    }
    // Above all caps → assign last bracket (e.g. 60+).
    const last = brackets[brackets.length - 1];
    if (last && last.max === -1 && age >= last.min) return last;
    return null;
  }

  /** BR-AG-39 fallback Path B: parse vendor "Nam 30-39" → bracket. */
  parseVendorAgeGroup(
    vendor: string,
    gender: 'M' | 'F',
    preset: AGPreset,
  ): AGBracket | null {
    if (!vendor) return null;
    const v = vendor.trim();
    const m = VENDOR_AG_REGEX.exec(v);
    if (!m) return null;
    const minRaw = m[1] ?? m[3];
    const maxRaw = m[2];
    if (!minRaw) return null;
    const min = parseInt(minRaw, 10);
    // m[3] truthy means we matched the "60+" branch (no upper).
    const isOpenEnded = !!m[3];
    const max = isOpenEnded ? -1 : (maxRaw ? parseInt(maxRaw, 10) : -1);
    const brackets = preset.brackets[gender];
    // Pass 1 — exact range match (preferred).
    for (const b of brackets) {
      if (b.min === min && b.max === max) return b;
    }
    // Pass 2 — open-ended "60+" matches bracket with same min and max=-1 (already covered above).
    // Pass 3 — loose match: vendor range fits inside bracket only when neither side is open-ended at preset level.
    for (const b of brackets) {
      if (b.max === -1 && max === -1 && b.min <= min) return b;
      if (b.max !== -1 && max !== -1 && b.min <= min && b.max >= max) return b;
    }
    return null;
  }

  /** Resolve preset by key + courseType + override. */
  resolvePreset(
    presetKey?: string,
    courseType?: string,
    override?: AGPreset,
  ): AGPreset {
    if (override) return override;
    if (presetKey && AG_PRESETS[presetKey]) return AG_PRESETS[presetKey];
    return defaultPresetFor(courseType);
  }

  /**
   * BR-AG-10 — Tie-breaker WA TR25:
   *  1. chipTimeMs ASC
   *  2. gunTimeMs ASC
   *  3. bibNumber ASC (numeric if possible)
   *
   * Ex-aequo: athletes with full 3-level match share rank, next rank skips.
   */
  rankAthletes(
    athletes: AthleteForRanking[],
    topN = 3,
  ): RankedPodiumAthlete[] {
    const eligible = athletes.filter((a) => a.chipTimeMs != null && a.chipTimeMs > 0);
    eligible.sort((a, b) => {
      const ct = (a.chipTimeMs ?? Infinity) - (b.chipTimeMs ?? Infinity);
      if (ct !== 0) return ct;
      const gt = (a.gunTimeMs ?? Infinity) - (b.gunTimeMs ?? Infinity);
      if (gt !== 0) return gt;
      const bibA = parseInt(a.bib, 10);
      const bibB = parseInt(b.bib, 10);
      if (!Number.isNaN(bibA) && !Number.isNaN(bibB)) return bibA - bibB;
      return a.bib.localeCompare(b.bib);
    });

    const ranked: RankedPodiumAthlete[] = [];
    let currentRank = 0;
    let lastKey: string | null = null;
    let achieved = 0; // number of distinct rank groups emitted
    for (let i = 0; i < eligible.length; i++) {
      const a = eligible[i];
      const key = `${a.chipTimeMs}-${a.gunTimeMs ?? ''}-${a.bib}`;
      // Tie key — only group when chip+gun match (bib makes it distinct again).
      const tieKey = `${a.chipTimeMs}-${a.gunTimeMs ?? ''}`;
      if (tieKey !== lastKey) {
        currentRank = i + 1;
        achieved += 1;
        lastKey = tieKey;
      }
      const tied =
        i > 0 && lastKey === `${eligible[i - 1].chipTimeMs}-${eligible[i - 1].gunTimeMs ?? ''}` &&
        eligible[i - 1].chipTimeMs === a.chipTimeMs &&
        eligible[i - 1].gunTimeMs === a.gunTimeMs;
      ranked.push({
        bib: a.bib,
        name: a.name,
        athleteId: a.athleteId,
        rank: currentRank,
        chipTimeMs: a.chipTimeMs ?? undefined,
        gunTimeMs: a.gunTimeMs ?? undefined,
        gender: a.gender ?? undefined,
        nationality: a.nationality,
        tied,
      });
      if (achieved > topN) break; // include current tied group then stop
    }
    // Mark tied athletes (back-fill).
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i].rank === ranked[i - 1].rank) {
        ranked[i].tied = true;
        ranked[i - 1].tied = true;
      }
    }
    // Trim to topN+ tied tail.
    while (ranked.length > 0 && ranked[ranked.length - 1].rank > topN) {
      ranked.pop();
    }
    return ranked;
  }

  /**
   * Group athletes into AG buckets + rank top N per bucket.
   *
   * Compounding (default WA-style): top overall vẫn eligible AG.
   * Mutually exclusive: overall top N excluded khỏi AG bucket.
   */
  computeAGBuckets(
    athletes: AthleteForRanking[],
    options: CalcOptions,
  ): AGBucketResult[] {
    const preset = this.resolvePreset(
      options.presetKey,
      options.courseType,
      options.override,
    );
    const topN = options.agTopN ?? 3;
    const compounding = options.compoundingMode ?? 'compounding';
    const excludeIds = new Set<string>();
    if (compounding === 'mutually_exclusive') {
      const cutoff = options.excludeOverallTopN ?? 3;
      // Sort overall first; mark top cutoff bibs as excluded.
      const sorted = [...athletes]
        .filter((a) => a.chipTimeMs != null && a.chipTimeMs > 0)
        .sort((a, b) => (a.chipTimeMs ?? Infinity) - (b.chipTimeMs ?? Infinity));
      for (let i = 0; i < Math.min(cutoff, sorted.length); i++) {
        excludeIds.add(sorted[i].bib);
      }
    }

    const buckets = new Map<string, AthleteForRanking[]>();
    const bucketMeta = new Map<
      string,
      { ageGroupKey: string; ageGroup: string; ageGroupLabel: string; gender: Gender }
    >();

    const bracketSource: BracketSource = options.bracketSource ?? '5bib';

    for (const a of athletes) {
      // F-019 v2 fix: normalize gender robust (was strict 'M'/'F' filter only,
      // dropped vendor 'Male'/'Female'/'Nam' silently → 0 podium bug).
      const g = normalizeGenderStrict(a.gender);
      if (g !== 'M' && g !== 'F') continue;
      if (excludeIds.has(a.bib)) continue;
      const gKey = g as GenderKey;
      let bracket: AGBracket | null = null;
      let ageOnRaceDay: number | undefined;

      // F-019 v2: Path A priority order based on bracketSource.
      const hasAge = a.ageOnRaceDay != null && a.ageOnRaceDay >= 0;
      const hasDob = !!a.dateOfBirth;
      // F-019 v2 fix: trim whitespace BEFORE truthy check (v1 bug — vendor
      // pushed " " whitespace category, was coerced truthy → parser fail).
      const vendorAg = (a.vendorAgeGroup ?? '').trim();
      const hasVendorAg = vendorAg.length > 0;

      const tryPathA = (): AGBracket | null => {
        if (hasAge) {
          ageOnRaceDay = a.ageOnRaceDay!;
          return this.assignBracket(ageOnRaceDay, gKey, preset, options.boundaryMode);
        }
        if (hasDob) {
          const age = this.computeAge(a.dateOfBirth!, options.raceDay);
          ageOnRaceDay = age;
          return this.assignBracket(age, gKey, preset, options.boundaryMode);
        }
        return null;
      };
      const tryPathB = (): AGBracket | null => {
        if (!hasVendorAg) return null;
        return this.parseVendorAgeGroup(vendorAg, gKey, preset);
      };

      if (bracketSource === '5bib') {
        bracket = tryPathA();
      } else if (bracketSource === 'vendor') {
        bracket = tryPathB();
      } else {
        // hybrid: A first, fallback B.
        bracket = tryPathA() ?? tryPathB();
      }

      if (!bracket) continue; // AG_INELIGIBLE_NO_DOB
      const bucketKey = `${g}__${bracket.key}`;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
        bucketMeta.set(bucketKey, {
          ageGroupKey: bracket.key,
          ageGroup: bracket.max === -1 ? `${bracket.min}+` : `${bracket.min}-${bracket.max}`,
          ageGroupLabel: bracket.label,
          gender: g,
        });
      }
      // F-019 v2: push athlete with NORMALIZED gender + ageOnRaceDay carried
      // forward (Path A computed). v1 bug: spread happened BEFORE mutation, so
      // _ageOnRaceDay was lost in downstream ranking output.
      buckets.get(bucketKey)!.push({
        ...a,
        gender: gKey,
        ageOnRaceDay: ageOnRaceDay ?? a.ageOnRaceDay ?? null,
      });
    }

    const results: AGBucketResult[] = [];
    for (const [key, list] of buckets.entries()) {
      const meta = bucketMeta.get(key)!;
      const ranked = this.rankAthletes(list, topN);
      // F-019 v2 — inject ageOnRaceDay from list (already populated qua Path A
      // tryPathA closure → bucket push with ageOnRaceDay field).
      for (const r of ranked) {
        const src = list.find((a) => a.bib === r.bib);
        if (src?.ageOnRaceDay != null) r.ageOnRaceDay = src.ageOnRaceDay;
      }
      results.push({
        ageGroupKey: meta.ageGroupKey,
        ageGroup: meta.ageGroup,
        ageGroupLabel: meta.ageGroupLabel,
        gender: meta.gender,
        athletes: ranked,
      });
    }
    return results;
  }
}
