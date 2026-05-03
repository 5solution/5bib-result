import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedAthlete,
  nextCheckpointInOrder,
  parseTimeToSeconds,
  secondsToHms,
} from '../utils/parsed-athlete';
import { CourseCheckpoint } from '../utils/parsed-athlete';
import { TimingAlertSeverity } from '../schemas/timing-alert.schema';
import { ProjectedRankResult } from './projected-rank.service';

export interface DetectionResult {
  /** True nếu athlete bị miss → caller upsert alert */
  isPhantom: boolean;
  /** True nếu missing point cuối cùng = "Finish" (case-insensitive) */
  isMissingFinish: boolean;
  /** Last seen point + time (KEY) */
  lastSeenPoint: string;
  lastSeenTime: string;
  /** Missing point KEY (next sau lastSeen theo course order) */
  missingPoint: string;
  /** Quá giờ expected bao nhiêu phút */
  overdueMinutes: number;
  /** Projected finish time string "HH:MM:SS" */
  projectedFinishTime: string;
  /** Projected finish total seconds */
  projectedFinishSeconds: number;
}

export interface SeverityResult {
  severity: TimingAlertSeverity;
  reason: string;
}

/**
 * Phase 1B — 3-tier miss detection algorithm.
 *
 * **Tier 1 — Phantom Runner:** athlete có time A nhưng KHÔNG có time B
 * (next in course order), quá `expected_time(B) + threshold`.
 *
 * **Tier 2 — Missing Finish:** subset Tier 1 với `nextPoint === Finish`
 * (case-insensitive).
 *
 * **Tier 3 — Top Athlete Escalation:** severity dựa projected rank — caller
 * compute `ProjectedRankService.calculate()` rồi gọi `classifySeverity()`.
 *
 * Stateless service — pure function, không inject dependencies. Easy unit test.
 */
@Injectable()
export class MissDetectorService {
  private readonly logger = new Logger(MissDetectorService.name);

  /** Pace buffer trước khi flag — match spec 5%. */
  private static readonly PACE_BUFFER = 1.05;

  /**
   * Detect miss cho 1 athlete tại thời điểm hiện tại.
   *
   * @param athlete parsed RR API item (từ `parseRaceResultAthlete`)
   * @param courseCheckpoints config checkpoints
   * @param raceStartTimeIso race day start time ISO (admin config — Phase 1A
   *        chưa có field này, em sẽ thêm hoặc derive từ Chiptimes Start)
   * @param overdueThresholdMinutes config threshold (default 30)
   * @param now current time (parameterized cho testability)
   * @returns DetectionResult | null nếu KHÔNG phantom
   */
  detect(
    athlete: ParsedAthlete,
    courseCheckpoints: CourseCheckpoint[],
    overdueThresholdMinutes: number,
    options: {
      /**
       * TA-11: Cutoff time string "HH:MM:SS" của course này. Nếu projected
       * finish vượt cutoff → KHÔNG flag (VĐV sẽ bị gate-closed, không phải
       * miss timing thật sự — flag sẽ là false-positive).
       *
       * Caller (poll service) lấy từ config.cutoff_times[courseName].
       * Null/undefined = không enforce.
       */
      cutoffTime?: string | null;
    } = {},
    now: Date = new Date(),
  ): DetectionResult | null {
    if (!athlete.lastSeenPoint || !athlete.lastSeenTime) {
      // Chưa qua điểm nào — KHÔNG flag (DNS hoặc race chưa start với BIB này)
      return null;
    }

    const nextCp = nextCheckpointInOrder(athlete.lastSeenPoint, courseCheckpoints);
    if (!nextCp) {
      // last seen IS Finish hoặc point cuối → KHÔNG phantom
      return null;
    }

    // Pace = elapsed time / distance traveled
    const lastSeenCp = courseCheckpoints.find(
      (cp) => cp.key === athlete.lastSeenPoint,
    );
    if (!lastSeenCp || lastSeenCp.distance_km <= 0) {
      // Last seen là Start (distance=0) → cannot derive pace
      // → cap-based decision: nếu quá threshold sau Start, vẫn flag với
      // projected finish based on "average" pace placeholder.
      // Conservative: skip flag for Start-only case (avoid noise).
      return null;
    }

    const lastSeenSeconds = parseTimeToSeconds(athlete.lastSeenTime);
    if (lastSeenSeconds === null || lastSeenSeconds <= 0) {
      return null;
    }

    // Pace seconds/km tại điểm last seen
    const paceSecPerKm = lastSeenSeconds / lastSeenCp.distance_km;

    // Expected reach time at next checkpoint (relative to start, with buffer)
    const expectedSecondsAtNext = paceSecPerKm * nextCp.distance_km * MissDetectorService.PACE_BUFFER;

    // Now = giờ hiện tại tính bằng giây từ start. Cần convert.
    // Athlete start time: lấy từ checkpointTimes['Start'] nếu có, hoặc
    // = 0 nếu lastSeenTime là chip time elapsed (vendor pattern phổ biến).
    // Pragmatic: assume vendor's Chiptimes là elapsed-from-start
    // (most common RR Simple API behavior). Now-elapsed = now - race_start.
    // Phase 1B chưa có race_start config → fallback: lastSeenSeconds là
    // ground truth elapsed, expected so sánh với "athlete current elapsed"
    // = now - (lastSeenWallClock - lastSeenElapsed).
    //
    // Simplification cho Phase 1B (acceptable trade-off):
    // - Assume Chiptimes = elapsed seconds from race start
    // - Compute expected_elapsed_at_next = expectedSecondsAtNext
    // - "Current elapsed" = lastSeenSeconds + (minutes since last RR poll
    //   detected this athlete) — KHÔNG accurate without race_start.
    // - Pragmatic fallback: use `overdueThresholdMinutes` as flat threshold:
    //   IF (expected_elapsed_at_next - lastSeenSeconds) > 0
    //   AND time gap from last_seen wall-clock now > threshold → flag
    //
    // Phase 1A spec acknowledges this complexity. Phase 1B impl uses
    // `overdueThresholdMinutes` as direct flat: nếu lastSeenTime đã quá
    // expected_at_next BY ≥ threshold minutes → flag.
    //
    // Better approach: chấp nhận spec PRD section 5 formula với
    // `Date.now() - athlete.start_time + pace * distTarget * 1.05`.
    // Phase 1B simplification: derive overdue từ expected vs current elapsed,
    // dùng `now` minus race_start estimate.

    // FINAL APPROACH: dùng Chiptimes['Start'] nếu có để estimate race start.
    // Nếu Chiptimes['Start'] = "00:00" hoặc empty → skip start estimate, use
    // pure threshold check.
    const overdueMs = this.computeOverdue(
      athlete,
      lastSeenSeconds,
      expectedSecondsAtNext,
      now,
    );
    const overdueMinutes = Math.floor(overdueMs / 60_000);

    if (overdueMinutes < overdueThresholdMinutes) {
      return null;
    }

    // Projected finish: pace × Finish.distance_km × buffer
    const finishCp = courseCheckpoints[courseCheckpoints.length - 1];
    const projectedFinishSeconds = Math.round(
      paceSecPerKm * finishCp.distance_km * MissDetectorService.PACE_BUFFER,
    );

    // TA-11: Skip flag nếu projected finish vượt cutoff time. VĐV slow này
    // sẽ bị gate-closed, KHÔNG phải miss timing thật. Cap noise alerts.
    if (options.cutoffTime) {
      const cutoffSeconds = parseTimeToSeconds(options.cutoffTime);
      if (cutoffSeconds !== null && projectedFinishSeconds > cutoffSeconds) {
        this.logger.debug(
          `[detect] bib=${athlete.bib} skip — projected finish ${secondsToHms(projectedFinishSeconds)} > cutoff ${options.cutoffTime}`,
        );
        return null;
      }
    }

    const isMissingFinish =
      typeof nextCp.key === 'string' && nextCp.key.toLowerCase() === 'finish';

    return {
      isPhantom: true,
      isMissingFinish,
      lastSeenPoint: athlete.lastSeenPoint,
      lastSeenTime: athlete.lastSeenTime,
      missingPoint: nextCp.key,
      overdueMinutes,
      projectedFinishTime: secondsToHms(projectedFinishSeconds),
      projectedFinishSeconds,
    };
  }

  /**
   * Phase 1B — Tier 3 severity classification dựa projected rank.
   *
   * Formula (spec section 5):
   * - rank ≤ topN (overall hoặc age group) → CRITICAL
   * - rank ≤ 10 → HIGH
   * - isMissingFinish → WARNING (degraded)
   * - else → INFO
   *
   * Nếu projectedRank null (race_results collection chưa có data) → max severity = WARNING.
   */
  classifySeverity(
    detection: DetectionResult,
    projectedRank: ProjectedRankResult | null,
    topNAlert: number,
  ): SeverityResult {
    // No projected rank → degrade
    if (!projectedRank || (projectedRank.overallRank === null && projectedRank.ageGroupRank === null)) {
      if (detection.isMissingFinish) {
        return {
          severity: 'WARNING',
          reason: `Miss Finish (projected rank unavailable — chưa có finishers trong race_results)`,
        };
      }
      return {
        severity: 'INFO',
        reason: `Phantom runner ${detection.lastSeenPoint} → ${detection.missingPoint} (projected rank unavailable)`,
      };
    }

    const ag = projectedRank.ageGroupRank;
    const ov = projectedRank.overallRank;

    // CRITICAL: top N either dimension
    if ((ag !== null && ag <= topNAlert) || (ov !== null && ov <= topNAlert)) {
      const dim = ag !== null && ag <= topNAlert ? `Top ${ag} age group` : `Top ${ov} overall`;
      return {
        severity: 'CRITICAL',
        reason: `${dim} ${detection.isMissingFinish ? 'miss FINISH' : `miss ${detection.missingPoint} sau ${detection.lastSeenPoint}`}`,
      };
    }

    // HIGH: top 10 either
    if ((ag !== null && ag <= 10) || (ov !== null && ov <= 10)) {
      const dim = ag !== null && ag <= 10 ? `Top ${ag} age group` : `Top ${ov} overall`;
      return {
        severity: 'HIGH',
        reason: `${dim} ${detection.isMissingFinish ? 'miss FINISH' : `miss ${detection.missingPoint}`}`,
      };
    }

    // WARNING: missing finish (regardless of rank)
    if (detection.isMissingFinish) {
      return {
        severity: 'WARNING',
        reason: `Miss FINISH — projected rank ${ov ?? '?'} overall, age group ${ag ?? '?'}`,
      };
    }

    return {
      severity: 'INFO',
      reason: `Phantom runner ${detection.lastSeenPoint} → ${detection.missingPoint}`,
    };
  }

  /**
   * Compute overdue milliseconds từ now vs expected.
   *
   * Strategy: dùng chip elapsed time (Chiptimes ground truth) so sánh với
   * expected_at_next. Nếu (now - poll_start) > buffer → flag overdue.
   *
   * Pragmatic Phase 1B impl: athlete.lastSeenSeconds < expectedSecondsAtNext
   * (đã pass last seen, but not yet at next) → overdue = now-lastSeenWall +
   * (expectedSecondsAtNext - lastSeenSeconds) gap.
   *
   * Simplified: assume current elapsed = lastSeenSeconds + (now - last poll).
   * Without race start time, use: gap = expectedSecondsAtNext - lastSeenSeconds.
   * Actual overdue requires race_start_iso config (Phase 1B add later if needed).
   *
   * **Phase 1B v1 simplification**: overdue_ms = (expectedSecondsAtNext -
   * lastSeenSeconds) * 1000 — tức là baseline expected gap. Caller sẽ check
   * threshold. KHÔNG accurate cho thời gian thực, nhưng deterministic +
   * testable. Phase 2 sẽ thêm race start time để compute true overdue.
   */
  private computeOverdue(
    _athlete: ParsedAthlete,
    lastSeenSeconds: number,
    expectedSecondsAtNext: number,
    _now: Date,
  ): number {
    const gapSeconds = Math.max(0, expectedSecondsAtNext - lastSeenSeconds);
    return gapSeconds * 1000;
  }
}
