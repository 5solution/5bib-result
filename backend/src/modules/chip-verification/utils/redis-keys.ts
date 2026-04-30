/**
 * Centralized Redis key registry for chip-verification module.
 * Listed in CLAUDE.md global key registry (race day docs).
 */
export const ChipRedisKeys = {
  /** HSET athlete cache: HGET key bib_number → JSON athlete payload. TTL 24h. */
  athleteCache: (raceId: number) => `chip:athlete:${raceId}`,

  /** Sentinel: '1' if preload completed for this race. TTL 24h. */
  cacheReady: (raceId: number) => `chip:cache:ready:${raceId}`,

  /** Token → mysql_race_id reverse lookup. TTL 24h. DEL on rotate/disable. */
  tokenIndex: (token: string) => `chip:token:${token}`,

  /** Preview blob (CSV import). TTL 10m. */
  preview: (previewToken: string) => `chip:preview:${previewToken}`,

  /** SETNX EX 5s — anti-stampede for on-demand MySQL fallback. MUST-DO #3. */
  lookupLock: (raceId: number, chipId: string) =>
    `chip:lookup-lock:${raceId}:${chipId}`,

  /** SETNX EX 25s — prevent cron tick overlap per race. MUST-DO #3. */
  cronLock: (raceId: number) => `chip:cron-lock:${raceId}`,

  /** SETNX (no expire) — atomic "is_first_verify" guarantee. MUST-DO #3. */
  firstVerify: (raceId: number, athletesId: number) =>
    `chip:firstverify:${raceId}:${athletesId}`,

  /** Throttle tracker — combined token+IP key (MUST-DO #9). */
  throttleTracker: (token: string, ip: string) =>
    `chip:throttle:${token}:${ip}`,
} as const;

export const CHIP_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const CHIP_PREVIEW_TTL_SECONDS = 10 * 60;
export const CHIP_LOOKUP_LOCK_TTL_SECONDS = 5;
export const CHIP_CRON_LOCK_TTL_SECONDS = 25;
