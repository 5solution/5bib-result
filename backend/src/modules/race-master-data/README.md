# Race Master Data Module — Boundary Contract

> **Spec:** `5BIB_Spec_RaceMasterDataSync_v1.0.md` (29/04/2026)
> **Phase:** 0 (Foundation) — phải build TRƯỚC chip-verification v1.3, checkpoint-capture, future modules

## Responsibility

Single source of truth cho athlete pre-race data. Sync MySQL `'platform'` legacy → cache MongoDB → cache Redis → expose `RaceAthleteLookupService` (DI).

## Boundary

### CHỊU TRÁCH NHIỆM

- ✅ Tất cả `SELECT` từ MySQL `'platform'` (athletes/subinfo/order_line_item/ticket_type/race_course/code) — **chỉ** module này được query.
- ✅ Cache MongoDB collection `race_athletes` (compound unique `mysql_race_id+athletes_id`).
- ✅ Cache Redis tier 1 (HSET `master:athlete:bib:{raceId}`).
- ✅ Sync orchestration: full / delta / on-demand.
- ✅ Audit log immutable (`race_master_sync_logs`).
- ✅ Admin REST endpoint `/api/admin/races/:raceId/master-data/*`.

### KHÔNG làm

- ❌ Sync race results (chip_time, splits) — đã có `RaceResultService`/`RaceSyncCron`.
- ❌ Sync race metadata — đã có `RacesService` pull từ `api.5bib.com/pub/race`.
- ❌ Write vào MySQL legacy.
- ❌ Bất kỳ business logic của consumer (verification log, OCR, leaderboard).
- ❌ Push DNF/DQ approved về RaceResult — Phase 3 separate spec.

## Public API (DI)

```typescript
@Injectable()
export class RaceAthleteLookupService {
  // Public view (no PII) — for chip-verify, checkpoint, leaderboard.
  lookupByBib(raceId: number, bib: string): Promise<RaceAthletePublicDto | null>;
  lookupBibs(raceId: number, bibs: string[]): Promise<Map<string, RaceAthletePublicDto>>;

  // Admin view (with PII email/phone/cccd).
  lookupByBibAdmin(raceId: number, bib: string): Promise<RaceAthleteAdminDto | null>;

  // Pagination + filter for admin UI.
  list(raceId: number, q: ListAthletesQueryDto): Promise<ListAthletesResponseDto>;

  // Stats (cached 60s).
  getStats(raceId: number): Promise<RaceAthleteStatsDto>;

  // Trigger sync (idempotent, anti-stampede via Redis SETNX lock).
  triggerSync(raceId: number, opts: { syncType: 'ATHLETE_FULL' | 'ATHLETE_DELTA'; triggeredBy: string }): Promise<RaceMasterSyncLogDocument>;

  // Audit log.
  listSyncLogs(raceId: number, limit?: number): Promise<RaceMasterSyncLogDocument[]>;
}
```

Consumer modules **chỉ import `RaceMasterDataModule`** + inject `RaceAthleteLookupService`. KHÔNG import entity, KHÔNG import schema, KHÔNG có TypeORM connection riêng.

## 3-Tier Cache

```
1. Redis HGET  master:athlete:bib:{raceId}    < 5ms      ←─ Hot path
                ↓ miss
2. MongoDB     race_athletes.findOne()         < 30ms    ←─ write-through to Redis
                ↓ miss
3. MySQL       SELECT JOIN athletes (1 row)    < 80ms    ←─ write-through to BOTH Redis + Mongo
```

Anti-stampede: SETNX `master:lookup-lock:{raceId}:{bib}` (TTL 5s) protects fallback path.

## Sync Strategy

### Full sync (admin trigger / consumer enable)

- Bulk SELECT JOIN MySQL → bulkWrite upsert Mongo → bulk warmup Redis HSET.
- Idempotent (upsert by `mysql_race_id+athletes_id`).
- SETNX lock `master:sync-lock:{raceId}` TTL 60s prevents concurrent FULL.

### Delta sync (cron `*/5 * * * *`)

- Active races = those with data + `legacy_modified_on` trong 30 ngày gần nhất.
- Per-race cron lock SETNX `master:cron-lock:{raceId}` TTL 50s.
- Filter `modified_on > checkpoint - 60s overlap` (clock skew tolerance).

### On-demand fallback (consumer lookupByBib miss)

- Single row by `(race_id, bib_number)` → write-through Mongo + Redis.
- Lookup-lock anti-stampede.

## PII Boundary

- Schema `RaceAthlete`: `email`, `contact_phone`, `id_number` marked `select: false`.
- `lookupByBib` (public DI): KHÔNG có PII.
- `lookupByBibAdmin` (admin DI): explicit `select('+email +contact_phone +id_number')`.
- Type system enforce qua 2 DTO khác nhau: `RaceAthletePublicDto` vs `RaceAthleteAdminDto`.

## Verification Plan (MD-1..MD-17)

| # | Test | Method | Expected |
|---|------|--------|---------|
| MD-1 | Module conditional load | Set/unset `PLATFORM_DB_HOST` | Skip giống Reconciliation |
| MD-2 | Full sync race 100 athletes | POST `/admin/.../sync` mode=FULL | < 1s, all rows in Mongo, sync_log SUCCESS |
| MD-3 | Full sync race 7K athletes | POST sync mode=FULL race=124 | < 8s, sync_log SUCCESS |
| MD-4 | Delta sync chỉ row mới | UPDATE 1 athlete legacy → cron tick → check Mongo | row updated, count=1 in log |
| MD-5 | Delta sync overlap window | UPDATE row 30s before cron run | Vẫn được catch (overlap 60s) |
| MD-6 | `lookupByBib` Redis hit | Call 2 lần cùng bib | 2nd call < 5ms, MySQL không bị query |
| MD-7 | `lookupByBib` Mongo hit | Clear Redis → call | < 30ms, Redis cập nhật write-through |
| MD-8 | `lookupByBib` MySQL fallback | Clear Redis + Mongo cho 1 athlete → call | Trả đúng data, cập nhật cả 2 cache |
| MD-9 | PII allowlist `lookupByBib` (public) | Inspect response | KHÔNG có email/phone/cccd |
| MD-10 | `lookupByBibAdmin` có PII | Inspect response | CÓ email/phone/cccd |
| MD-11 | Idempotent bulkWrite | Run full sync 2 lần liên tiếp | Không duplicate, modifiedCount=0 ở lần 2 |
| MD-12 | Active races filter | Race chưa có data → cron skip | Sync log không có entry cho race này |
| MD-13 | Sync log audit | Trigger 5 syncs different types | Log đủ 5 entry với triggered_by chính xác |
| MD-14 | List paginated | List race 7K với pageSize=50 | Trả 50 rows, total=7191, < 100ms |
| MD-15 | Stats endpoint | GET stats race 192 | Đúng total + by_course + by_status |
| MD-16 | Concurrent lookup | 100 concurrent `lookupByBib` cùng race | Không deadlock, all < 50ms (Redis hit) |
| MD-17 | KHÔNG INSERT/UPDATE MySQL | Toàn bộ test → grep query log | Chỉ SELECT, KHÔNG có ghi |
| MD-18 | Concurrent triggerSync FULL | 2 admin click cùng lúc | 1 chạy thật, 1 trả log entry holder (sync-lock) |
| MD-19 | bib_number null partial index | 100 athletes chưa có bib | Tất cả insert thành công, không violate unique |
| MD-20 | Bib reassignment cache invalidation | Athlete đổi bib từ 100→200 | Cache key 100 bị DEL, key 200 set mới |
