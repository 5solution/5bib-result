import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';

/**
 * Internal checkpoint type cho miss detection logic.
 *
 * Race-domain config sống ở `race.courses[].checkpoints[]` Mongo schema
 * (`{key, name, distanceKm}`). Poll service load Race document → map sang
 * shape này trước khi pass vào MissDetector.
 */
export interface CourseCheckpoint {
  key: string;
  distance_km: number;
}

/**
 * Internal shape sau khi parse RR API response. Tách logic parse
 * `Chiptimes` JSON ra khỏi miss-detector + projected-rank để dễ test +
 * reuse.
 *
 * Vendor quirks đã handle (xem `vendor_raceresult_quirks.md` memory):
 * - Bib=0 → fallback parse certificate URL hoặc index
 * - TimingPoint case mixed → normalize lowercase comparison khi match Finish
 * - Chiptimes có thể là `{}` empty hoặc string JSON
 * - Time string formats: "HH:MM:SS" hoặc "MM:SS" hoặc "" (chưa qua point)
 * - Negative sentinels "-1" ở rank fields (không quan tâm cho miss detection)
 */
export interface ParsedAthlete {
  /** Resolved BIB string (KHÔNG = "0" sentinel) */
  bib: string;
  /** Display name = `Firstname + Lastname` || `Name` field || null */
  fullName: string | null;
  contest: string | null;
  /** Age group từ RR `Category` field (đã RR pre-categorize). */
  ageGroup: string | null;
  gender: string | null;
  /** Map checkpoint key → time string (VD `{ Start: "06:00", TM2: "07:32:11" }`). */
  checkpointTimes: Record<string, string>;
  /** Last seen point KEY (theo course order) — null nếu chưa qua điểm nào. */
  lastSeenPoint: string | null;
  /** Last seen time string (= checkpointTimes[lastSeenPoint]). */
  lastSeenTime: string | null;
  /** Original RR API item (debug snapshot). */
  raw: RaceResultApiItem;
}

/**
 * Parse RaceResult Simple API item → internal shape.
 *
 * @param item RR API response item
 * @param courseCheckpoints config checkpoints cho course này (ordered)
 *        — dùng để xác định lastSeenPoint THEO course order, KHÔNG theo
 *        order key trong Chiptimes JSON (vendor có thể pushes inconsistent).
 */
export function parseRaceResultAthlete(
  item: RaceResultApiItem,
  courseCheckpoints: CourseCheckpoint[],
): ParsedAthlete {
  // BIB resolution — same logic as RaceResultService.syncRaceResult
  let bib: string;
  if (item.Bib !== 0 && item.Bib != null) {
    bib = String(item.Bib);
  } else {
    const certUrl = item.Certificate || item.Certi || '';
    const match = certUrl.match(/\/certificates\/(\d+)\//);
    bib = match ? match[1] : '';
  }

  // Name resolution — RR Simple API trả 1 trong 3 dạng tùy event config
  let fullName: string | null = null;
  if (item.Firstname || item.Lastname) {
    fullName = `${item.Firstname ?? ''} ${item.Lastname ?? ''}`.trim() || null;
  } else if (item.Name) {
    fullName = item.Name.trim() || null;
  }

  // Parse Chiptimes JSON — vendor returns string, có thể empty hoặc malformed
  const checkpointTimes = parseChiptimesJson(item.Chiptimes);

  // Determine last seen point THEO course order (not JSON key order).
  // VD course = [Start, TM1, TM2, TM3, Finish]. Athlete có Chiptimes
  // {Start: "06:00", TM2: "07:32"} (vendor sometimes skip empty).
  // Last seen = TM2 (max index có time non-empty).
  let lastSeenPoint: string | null = null;
  let lastSeenTime: string | null = null;
  for (let i = courseCheckpoints.length - 1; i >= 0; i--) {
    const cp = courseCheckpoints[i];
    const time = checkpointTimes[cp.key];
    if (time && time.trim().length > 0) {
      lastSeenPoint = cp.key;
      lastSeenTime = time.trim();
      break;
    }
  }

  return {
    bib,
    fullName,
    contest: item.Contest?.trim() || null,
    ageGroup: item.Category?.trim() || null,
    gender: item.Gender?.trim() || null,
    checkpointTimes,
    lastSeenPoint,
    lastSeenTime,
    raw: item,
  };
}

/**
 * Vendor pushes `Chiptimes` as string-encoded JSON. Handle:
 * - Empty string / null → {}
 * - Malformed JSON → log + return {}
 * - Already parsed object (some events) → pass through
 */
function parseChiptimesJson(raw: string | undefined | null): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Find the next checkpoint AFTER `currentKey` theo course order.
 * Returns null nếu currentKey là điểm cuối (Finish).
 */
export function nextCheckpointInOrder(
  currentKey: string,
  courseCheckpoints: CourseCheckpoint[],
): CourseCheckpoint | null {
  const idx = courseCheckpoints.findIndex((cp) => cp.key === currentKey);
  if (idx === -1 || idx === courseCheckpoints.length - 1) return null;
  return courseCheckpoints[idx + 1];
}

/**
 * Parse time string "HH:MM:SS" hoặc "MM:SS" → seconds total. Returns null
 * nếu format invalid. KHÔNG hỗ trợ ms.
 */
export function parseTimeToSeconds(
  time: string | undefined | null,
): number | null {
  if (!time || typeof time !== 'string') return null;
  const parts = time.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function secondsToHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
