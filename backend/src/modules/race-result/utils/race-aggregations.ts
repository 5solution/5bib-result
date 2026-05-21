/**
 * FEATURE-056 — Race aggregation pure helpers.
 *
 * Pure functions consumed by `RaceRecapService`. No DI, no I/O. Single source
 * of truth for race-level aggregations (podium / pace / AG / status / negSplit)
 * shared (Phase 1.5) with `RaceResultService.getLeaderboard()` via Manager Plan.
 *
 * DATA INTEGRITY (Danny "k nó kiện đấy" mandate):
 * - Podium MUST sort by `genderRankNumeric` ASC (vendor authoritative — RaceResult.com
 *   field already encodes podium order). Fallback chipTimeMs ASC tie-break.
 * - Chip times preserved AS-IS from vendor (no reformatting).
 * - Athlete names preserved AS-IS (no canonicalize — legal spelling).
 * - Helper outputs contain ONLY public-safe fields (no email/phone/DOB).
 *
 * BR coverage: BR-56-09/10/11/12/18 + 5 pure-function spec section 4.6 PRD.
 */
// ─── Public result shapes (consumed by service layer) ──────────────────

export interface AggregatedPodiumCell {
  name: string;
  bib: string;
  chipTime: string;
  category?: string;
  medal: 'gold' | 'silver' | 'bronze';
  avatarUrl?: string;
  /** F-056 GAP #1 — derived city (resolved later in service via city-derive helper) */
  city?: string;
}

export interface PodiumResult {
  male: AggregatedPodiumCell[];
  female: AggregatedPodiumCell[];
  /** Count finishers per gender (used for "X finisher" header counter) */
  maleFinisherCount: number;
  femaleFinisherCount: number;
}

export interface PaceStatsResult {
  medianPace: string;
  p10Pace: string;
  p90Pace: string;
  distribution: number[];
  finisherCount: number;
}

export interface AGBucketResult {
  category: string;
  finisherCount: number;
  top5: AggregatedPodiumCell[];
}

export interface StatusCountsResult {
  finishers: number;
  dnf: number;
  dns: number;
  dsq: number;
  /** Total all-status (sum) — used for "Tổng X / Y VĐV" header (BR-56-13). */
  registered: number;
}

export interface NegSplitResult {
  /** Percent 0-100 (1 decimal) — % finishers with valid negative split. */
  value: number;
  /** Hardcoded benchmark Vietnam 40 per BR-56-02. */
  benchmark: 40;
  /** F-056 NEW — Avg 1st half chipTime hh:mm:ss across analyzed finishers. */
  avgFirstHalf: string;
  /** F-056 NEW — Avg 2nd half chipTime hh:mm:ss. */
  avgSecondHalf: string;
  /** F-056 NEW — Delta seconds (avg2H - avg1H). Positive = positive split. */
  deltaSeconds: number;
  /** F-056 NEW — Count finishers with valid checkpoint data analyzed. */
  finishersAnalyzed: number;
  /** F-056 Clarification #3 — Vietnamese narrative interpretation based on percentage thresholds. */
  interpretation: string;
}

// ─── Lean input type (matches what service queries via .lean()) ────────

/**
 * Lean input type — superset matching what service queries via `.lean()`.
 * Most fields optional since vendor data is inconsistent (BR-46-26 lesson).
 */
export interface RaceResultLean {
  bib: string;
  name?: string;
  chipTime?: string;
  category?: string;
  gender?: string;
  genderRank?: string;
  genderRankNumeric?: number;
  chiptimes?: string;
  pace?: string;
  started?: number;
  club?: string;
  nationality?: string;
  avatarUrl?: string;
}

// ─── Pure time helpers ─────────────────────────────────────────────────

/** Pure — chip time "hh:mm:ss" → seconds. Returns 0 if invalid/empty. */
export function chipTimeToSeconds(time: string | undefined): number {
  if (!time) return 0;
  const t = time.trim();
  if (!t || t === '0:00:00' || t === '00:00:00') return 0;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Pure — seconds → "hh:mm:ss" (2-digit minute/second, zero-padded hour if 1+ hour). */
export function secondsToChipTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

/** Pure — pace "mm:ss" or "mm:ss/km" → seconds per km. */
export function paceToSeconds(pace: string | undefined): number {
  if (!pace) return 0;
  const cleaned = pace.replace(/\/km$/i, '').trim();
  if (!cleaned) return 0;
  const parts = cleaned.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Pure — seconds → "m:ss/km" pace label. */
export function secondsToPace(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

/** Pure — normalize gender token to internal 'male'|'female'|null. */
export function normalizeGenderToken(
  gender: string | undefined,
): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'm' || g === 'male' || g === 'nam') return 'male';
  if (g === 'f' || g === 'female' || g === 'nu' || g === 'nữ') return 'female';
  return null;
}

/** Pure — true if chipTime string represents a finisher (non-empty, non-zero). */
export function isFinisherChipTime(chipTime: string | undefined): boolean {
  if (!chipTime) return false;
  const trimmed = chipTime.trim();
  return Boolean(trimmed) && trimmed !== '0:00:00' && trimmed !== '00:00:00';
}

// ─── Pure aggregation functions ────────────────────────────────────────

/**
 * Compute Top-3 podium per gender.
 *
 * DATA INTEGRITY: sort key = `genderRankNumeric` ASC (vendor RaceResult.com
 * authoritative ranking), fallback `chipTimeMs` ASC for tie-break when vendor
 * rank missing/duplicate.
 */
export function computePodium(rows: RaceResultLean[]): PodiumResult {
  const finishers = rows.filter((r) => isFinisherChipTime(r.chipTime));
  const males = finishers.filter((r) => normalizeGenderToken(r.gender) === 'male');
  const females = finishers.filter(
    (r) => normalizeGenderToken(r.gender) === 'female',
  );

  const sortByRank = (a: RaceResultLean, b: RaceResultLean): number => {
    // Primary: genderRankNumeric ASC. Treat missing as Infinity (push to end).
    const ra =
      typeof a.genderRankNumeric === 'number' && a.genderRankNumeric > 0
        ? a.genderRankNumeric
        : Number.POSITIVE_INFINITY;
    const rb =
      typeof b.genderRankNumeric === 'number' && b.genderRankNumeric > 0
        ? b.genderRankNumeric
        : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    // Tie-break: chipTime ASC (vendor secondary authority).
    return chipTimeToSeconds(a.chipTime) - chipTimeToSeconds(b.chipTime);
  };

  const sortedM = [...males].sort(sortByRank);
  const sortedF = [...females].sort(sortByRank);

  return {
    male: sortedM.slice(0, 3).map((r, i) => toCell(r, i)),
    female: sortedF.slice(0, 3).map((r, i) => toCell(r, i)),
    maleFinisherCount: males.length,
    femaleFinisherCount: females.length,
  };
}

/**
 * Compute pace distribution + p10/median/p90.
 * BR-56-11: sort finishers by pace ASC, percentile by index.
 */
export function computePaceStats(rows: RaceResultLean[]): PaceStatsResult {
  const finishers = rows.filter((r) => isFinisherChipTime(r.chipTime));
  const paceSecondsRaw = finishers
    .map((r) => paceToSeconds(r.pace))
    .filter((s) => s > 0);

  if (paceSecondsRaw.length === 0) {
    return {
      medianPace: '—',
      p10Pace: '—',
      p90Pace: '—',
      distribution: new Array(10).fill(0),
      finisherCount: 0,
    };
  }

  const sorted = [...paceSecondsRaw].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bucketWidth = (max - min) / 10 || 1;
  const distribution = new Array(10).fill(0);
  for (const s of sorted) {
    const idx = Math.min(9, Math.floor((s - min) / bucketWidth));
    distribution[idx]++;
  }

  return {
    medianPace: secondsToPace(median),
    p10Pace: secondsToPace(p10),
    p90Pace: secondsToPace(p90),
    distribution,
    finisherCount: paceSecondsRaw.length,
  };
}

/**
 * Compute AG breakdown — group by raw `category`, Top 5 per bracket.
 * BR-56-12: min 1 finisher to render bracket; sort by genderRankNumeric ASC.
 */
export function computeAGBreakdown(rows: RaceResultLean[]): AGBucketResult[] {
  const finishers = rows.filter((r) => isFinisherChipTime(r.chipTime));
  const groups = new Map<string, RaceResultLean[]>();
  for (const r of finishers) {
    const ag = (r.category ?? '').trim();
    if (!ag) continue;
    if (!groups.has(ag)) groups.set(ag, []);
    groups.get(ag)!.push(r);
  }

  const out: AGBucketResult[] = [];
  const sortedAGs = Array.from(groups.keys()).sort();
  for (const ag of sortedAGs) {
    const bucket = groups.get(ag)!;
    const sorted = [...bucket].sort((a, b) => {
      const ra =
        typeof a.genderRankNumeric === 'number' && a.genderRankNumeric > 0
          ? a.genderRankNumeric
          : Number.POSITIVE_INFINITY;
      const rb =
        typeof b.genderRankNumeric === 'number' && b.genderRankNumeric > 0
          ? b.genderRankNumeric
          : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return chipTimeToSeconds(a.chipTime) - chipTimeToSeconds(b.chipTime);
    });
    out.push({
      category: ag,
      finisherCount: bucket.length,
      top5: sorted.slice(0, 5).map((r, i) => toCell(r, i)),
    });
  }
  return out;
}

/**
 * Count status buckets per BR-56-15 hero stats.
 * Status derivation:
 *  - finisher: isFinisherChipTime(chipTime) && parsed > 0
 *  - dnf: not finished, but `started > 0`
 *  - dns: otherwise
 *  - dsq: NOT derived here (vendor doesn't expose DSQ separately in baseline). Returned as 0.
 */
export function computeStatusCounts(rows: RaceResultLean[]): StatusCountsResult {
  let finishers = 0;
  let dnf = 0;
  let dns = 0;
  const dsq = 0;
  for (const r of rows) {
    if (isFinisherChipTime(r.chipTime) && chipTimeToSeconds(r.chipTime) > 0) {
      finishers++;
    } else if (typeof r.started === 'number' && r.started > 0) {
      dnf++;
    } else {
      dns++;
    }
  }
  return { finishers, dnf, dns, dsq, registered: rows.length };
}

/**
 * Compute negative-split aggregate.
 *
 * BR-56-09: For each finisher with valid `chiptimes` JSON containing midpoint
 * checkpoint, compute 1st-half and 2nd-half splits. Count finishers with
 * `pace_2ndHalf < pace_1stHalf` (negative split). Return percent + averages.
 *
 * DATA INTEGRITY: malformed JSON / missing midpoint → skip (do not count as
 * positive or negative — `finishersAnalyzed` decreases).
 *
 * F-056 Clarification #3: `interpretation` is COMPUTED here (Vietnamese narrative
 * based on percentage thresholds).
 */
export function computeNegSplit(rows: RaceResultLean[]): NegSplitResult {
  const finishers = rows.filter((r) => isFinisherChipTime(r.chipTime));

  let negCount = 0;
  let firstHalfSum = 0;
  let secondHalfSum = 0;
  let analyzed = 0;

  for (const r of finishers) {
    const split = parseSplit(r);
    if (!split) continue;
    analyzed++;
    firstHalfSum += split.firstHalfSeconds;
    secondHalfSum += split.secondHalfSeconds;
    if (split.secondHalfSeconds < split.firstHalfSeconds) negCount++;
  }

  const percent =
    analyzed > 0 ? Math.round((negCount / analyzed) * 1000) / 10 : 0;
  const avg1HSeconds = analyzed > 0 ? Math.round(firstHalfSum / analyzed) : 0;
  const avg2HSeconds = analyzed > 0 ? Math.round(secondHalfSum / analyzed) : 0;
  const deltaSeconds = avg2HSeconds - avg1HSeconds;

  return {
    value: percent,
    benchmark: 40,
    avgFirstHalf: secondsToChipTime(avg1HSeconds),
    avgSecondHalf: secondsToChipTime(avg2HSeconds),
    deltaSeconds,
    finishersAnalyzed: analyzed,
    interpretation: buildNegSplitInterpretation(percent, analyzed),
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────

function toCell(r: RaceResultLean, index: number): AggregatedPodiumCell {
  return {
    name: r.name ?? '',
    bib: r.bib,
    chipTime: r.chipTime ?? '',
    category: r.category,
    medal: index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze',
    avatarUrl: r.avatarUrl,
  };
}

interface SplitOutput {
  firstHalfSeconds: number;
  secondHalfSeconds: number;
}

/**
 * Parse `chiptimes` JSON → find checkpoint closest to 50% of finish time →
 * return (1st half, 2nd half) seconds. Null if data insufficient.
 *
 * DATA INTEGRITY: try/catch malformed JSON, skip row.
 */
function parseSplit(r: RaceResultLean): SplitOutput | null {
  if (!r.chiptimes) return null;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(r.chiptimes) as Record<string, string>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const checkpoints = Object.entries(parsed)
    .filter(([k]) => k !== 'Start')
    .map(([k, v]) => ({ name: k, seconds: chipTimeToSeconds(v) }))
    .filter((c) => c.seconds > 0);
  if (checkpoints.length < 2) return null;

  const finishSeconds = chipTimeToSeconds(r.chipTime);
  if (finishSeconds <= 0) return null;

  // Exclude any explicit Finish/FINISH from midpoint candidates — we want a
  // legitimate intermediate checkpoint, not the finish itself.
  const midpointCandidates = checkpoints.filter(
    (c) => c.name.toLowerCase() !== 'finish',
  );
  if (midpointCandidates.length === 0) return null;

  const halfTime = finishSeconds / 2;
  let best = midpointCandidates[0];
  let bestDiff = Math.abs(best.seconds - halfTime);
  for (const c of midpointCandidates) {
    const diff = Math.abs(c.seconds - halfTime);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  const firstHalf = best.seconds;
  const secondHalf = finishSeconds - best.seconds;
  if (firstHalf <= 0 || secondHalf <= 0) return null;
  return { firstHalfSeconds: firstHalf, secondHalfSeconds: secondHalf };
}

/**
 * F-056 Clarification #3 — Vietnamese narrative interpretation based on
 * negative-split percentage thresholds. Hardcoded thresholds per Manager Plan.
 */
function buildNegSplitInterpretation(
  percent: number,
  analyzed: number,
): string {
  if (analyzed === 0) {
    return 'Không đủ dữ liệu split để tính.';
  }
  if (percent < 20) {
    return `Chỉ ${percent}% VĐV chạy nửa sau nhanh hơn nửa đầu — race kỹ thuật cao, phần lớn không pacing được đoạn cuối.`;
  }
  if (percent <= 40) {
    return `${percent}% VĐV negative split — race phù hợp đa số trình độ, pacing strategy đa dạng.`;
  }
  return `${percent}% VĐV negative split — race dễ pacing với đường nhẹ và nhiều finisher kinh nghiệm.`;
}
