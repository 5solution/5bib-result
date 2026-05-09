/**
 * F-014 BR-AS-01 — Client-derive 9-status enum (Option C, Danny APPROVED).
 *
 * Backend has NO `status` field on race-result schema (Manager PAUSE #2
 * finding). F-013 derived 5 statuses (FIN/DNS/DNF/DSQ/LIVE) via
 * `deriveKioskStatus()`. We extend that to 9 statuses for the admin
 * roster view.
 *
 * Derivation order (longest-tail first to avoid mis-classification):
 *   1. DSQ — explicit `editHistory` field='status' newValue='DSQ' OR
 *      timingPoint starts with 'DSQ' OR dsqReason present
 *   2. MED — editHistory field='status' newValue='MED' (no vendor signal)
 *   3. CUT — editHistory field='status' newValue='CUT' (no vendor signal —
 *      could later be derived from finishTime > race cutoff but cutoff is
 *      not on the row, so we ONLY trust manual flag for now)
 *   4. DNF — `dnf > 0` OR timingPoint='DNF' OR editHistory field='status' newValue='DNF'
 *   5. FIN — chipTime present AND finite numeric OverallRank AND
 *      timingPoint contains 'FINISH'
 *   6. LIVE — startTime present (or any partial split detected) AND no finish
 *   7. DNS — race ended AND no startTime AND no chipTime AND
 *      (dnsChipFail=true OR timingPoint='DNS')
 *   8. PICKED — racekitReceived=true AND no startTime
 *   9. REG — fallback default
 *
 * `raceStatus` parameter narrows DNS detection: only after race ended can
 * a no-show be confidently classified as DNS (vs "race hasn't started").
 *
 * @param row Race-result row (vendor PascalCase + normalized lowercase
 *            both tolerated via field accessors).
 * @param raceStatus Optional race lifecycle hint (`'live' | 'ended' | …`).
 *                   When 'ended', missing-start → DNS; otherwise REG/PICKED.
 * @returns One of 9 AthleteStatus values. Never null — always falls back
 *          to 'REG' so the table never shows blank cells.
 */

import type { AthleteRow, AthleteEditHistoryEntry } from '../athletes.types';
import type { AthleteStatus } from '../athletes.constant';

/**
 * Inspect editHistory for the most recent `field='status'` entry.
 * Returns the status string or null if no manual override recorded.
 */
function lastStatusEdit(history: AthleteEditHistoryEntry[] | undefined): string | null {
  if (!history || history.length === 0) return null;
  // editHistory is appended chronologically — scan reverse.
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry?.field === 'status' && typeof entry.newValue === 'string') {
      return entry.newValue.trim().toUpperCase();
    }
  }
  return null;
}

/** True if string represents a meaningful chip time (not '-' / empty / 0). */
function hasMeaningfulTime(t: string): boolean {
  if (!t) return false;
  const trimmed = t.trim();
  if (!trimmed) return false;
  if (trimmed === '-' || trimmed === '0' || trimmed === '00:00:00' || trimmed === '00:00') {
    return false;
  }
  return true;
}

/** True if rank string parses to a positive finite integer. */
function hasFiniteRank(r: string | number | undefined): boolean {
  if (r === undefined || r === null || r === '') return false;
  const n = typeof r === 'number' ? r : parseInt(String(r), 10);
  return Number.isFinite(n) && n > 0;
}

export function deriveAthleteStatus(
  row: AthleteRow,
  raceStatus?: string | null,
): AthleteStatus {
  // 1. Manual override via editHistory takes precedence — admin DSQ/MED/CUT
  //    decisions are authoritative.
  const manualStatus = lastStatusEdit(row.editHistory);
  if (manualStatus === 'DSQ') return 'DSQ';
  if (manualStatus === 'MED') return 'MED';
  if (manualStatus === 'CUT') return 'CUT';
  if (manualStatus === 'DNF') return 'DNF';
  if (manualStatus === 'FIN') return 'FIN';
  if (manualStatus === 'DNS') return 'DNS';
  if (manualStatus === 'PICKED') return 'PICKED';
  if (manualStatus === 'LIVE') return 'LIVE';
  if (manualStatus === 'REG') return 'REG';

  // 2. Vendor signals — timingPoint sentinels.
  const tp = String(row.timingPoint ?? row.TimingPoint ?? '').trim().toUpperCase();
  if (tp.startsWith('DSQ') || row.dsqReason) return 'DSQ';

  // 3. DNF from explicit dnf flag or timingPoint
  const dnfFlag = row.dnf;
  const isDnf =
    dnfFlag === true ||
    (typeof dnfFlag === 'number' && dnfFlag > 0) ||
    tp === 'DNF';
  if (isDnf) return 'DNF';

  // 4. FIN — finish reached + meaningful time + valid rank
  const chipTime = String(row.chipTime ?? row.ChipTime ?? '');
  const gunTime = String(row.gunTime ?? row.GunTime ?? '');
  const overallRank = row.overallRank ?? row.OverallRank;
  const hasFinishMarker = tp.startsWith('FINISH');
  const hasTimeData = hasMeaningfulTime(chipTime) || hasMeaningfulTime(gunTime);

  if (hasFinishMarker && hasTimeData && hasFiniteRank(overallRank)) {
    return 'FIN';
  }
  // Some vendors push finish without timingPoint marker; rank+time is enough
  // when row was clearly finalized (finishTime present).
  if (
    row.finishTime &&
    hasTimeData &&
    hasFiniteRank(overallRank)
  ) {
    return 'FIN';
  }

  // 5. DNS — race ended + no signs of start/finish + chip-fail or sentinel.
  const startTime = String(row.startTime ?? '');
  const isRaceEnded = String(raceStatus ?? '').toLowerCase() === 'ended';
  if (
    tp === 'DNS' ||
    (isRaceEnded && !startTime && !hasTimeData && row.dnsChipFail)
  ) {
    return 'DNS';
  }

  // 6. LIVE — startTime present OR any non-finish timing-point split detected
  const isLive =
    !!startTime ||
    (!!tp && tp !== 'FINISH' && !tp.startsWith('FINISH') && tp !== 'DNS' && tp !== 'DNF');
  if (isLive) return 'LIVE';

  // 7. PICKED — racekit received pre-race
  const racekit =
    row.racekitReceived === true || row.racekit_received === true;
  if (racekit) return 'PICKED';

  // 8. REG — default fallback (registered but no further signal)
  return 'REG';
}
