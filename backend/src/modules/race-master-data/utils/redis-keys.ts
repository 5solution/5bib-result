/**
 * Centralized Redis key registry for race-master-data module.
 * Listed in CLAUDE.md global key registry.
 */
export const RaceMasterRedisKeys = {
  /** HSET athlete cache: HGET key bib_number → JSON public-view payload. TTL 24h. */
  athleteByBib: (raceId: number) => `master:athlete:bib:${raceId}`,

  /** HSET reverse index: athletes_id → bib_number (for invalidate on bib change). TTL 24h. */
  athleteIdToBib: (raceId: number) => `master:athlete:byid:${raceId}`,

  /** Stats cache JSON. TTL 60s — short to keep numbers fresh. */
  stats: (raceId: number) => `master:stats:${raceId}`,

  /** SETNX EX 60s — anti-stampede on FULL sync (prevent two admins clicking simultaneously). */
  syncLock: (raceId: number) => `master:sync-lock:${raceId}`,

  /** SETNX EX 50s — prevent cron tick overlap per race (cron interval 5min, but lock < interval for safety). */
  cronLock: (raceId: number) => `master:cron-lock:${raceId}`,

  /** SETNX EX 5s — anti-stampede for on-demand MySQL fallback. */
  lookupLock: (raceId: number, bibNumber: string) =>
    `master:lookup-lock:${raceId}:${bibNumber}`,
} as const;

export const RACE_MASTER_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h
export const RACE_MASTER_STATS_TTL_SECONDS = 60;
export const RACE_MASTER_SYNC_LOCK_TTL_SECONDS = 60;
export const RACE_MASTER_CRON_LOCK_TTL_SECONDS = 50;
/**
 * B-3 fix: bumped 5s → 15s. MySQL p99 cold-cache fallback có thể tới 8-10s
 * (DNS hiccup, JOIN nặng). 15s đủ cover mà không stuck queue lâu khi MySQL down.
 * Kèm Lua CAS-with-token release pattern (xem `releaseLookupLock` dùng token).
 */
export const RACE_MASTER_LOOKUP_LOCK_TTL_SECONDS = 15;

/** Default cron delta sync interval. Configurable env var nếu cần. */
export const RACE_MASTER_DELTA_OVERLAP_SECONDS = 60;

/**
 * Janitor sweep stale RUNNING sync logs. Process kill (-9) / OOM crash
 * không chạy được catch{} → log mắc kẹt status=RUNNING vĩnh viễn → poison
 * "is sync running" check ở triggerSync.
 */
export const RACE_MASTER_STALE_RUNNING_LOG_THRESHOLD_MS = 10 * 60 * 1000; // 10min
