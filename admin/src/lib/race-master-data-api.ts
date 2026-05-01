/**
 * TEMPORARY hand-typed wrapper for race-master-data API.
 *
 * After BE deploys to staging, run `pnpm generate:api` and replace these
 * with generated SDK functions. Schema names + paths must stay in sync —
 * see `backend/src/modules/race-master-data/controllers/race-master-data-admin.controller.ts`.
 */
import { client } from './api-generated/client.gen';

// ─────────── DTOs ───────────

export interface RaceAthleteAdminDto {
  mysql_race_id: number;
  athletes_id: number;
  bib_number: string | null;
  display_name: string | null;
  bib_name: string | null;
  full_name: string | null;
  gender: string | null;
  course_id: number | null;
  course_name: string | null;
  course_distance: string | null;
  club: string | null;
  last_status: string | null;
  racekit_received: boolean;
  racekit_received_at: string | null;
  email: string | null;
  contact_phone: string | null;
  id_number: string | null;
  source: string;
  legacy_modified_on: string | null;
  synced_at: string;
  sync_version: number;
}

export interface ListAthletesResponseDto {
  items: RaceAthleteAdminDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RaceAthleteStatsDto {
  total: number;
  withBib: number;
  byCourse: Record<string, number>;
  byStatus: Record<string, number>;
  lastSyncedAt: string | null;
}

export interface SyncLogDto {
  id: string;
  mysql_race_id: number;
  sync_type: 'ATHLETE_FULL' | 'ATHLETE_DELTA' | 'MANUAL';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  started_at: string;
  completed_at: string | null;
  rows_fetched: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  duration_ms: number;
  error_message: string | null;
  triggered_by: string;
}

export interface SyncLogListDto {
  items: SyncLogDto[];
  total: number;
}

export interface TriggerSyncResponseDto {
  log: SyncLogDto;
}

export type ListAthletesQuery = {
  search?: string;
  course_id?: number;
  gender?: string;
  last_status?: string;
  page?: number;
  pageSize?: number;
};

// ─────────── Endpoints ───────────

const base = (mysqlRaceId: number) =>
  `/api/admin/races/${mysqlRaceId}/master-data`;

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(
    path,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '' || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + url.search;
}

export async function getMasterDataStats(
  mysqlRaceId: number,
): Promise<RaceAthleteStatsDto> {
  const res = await client.get<RaceAthleteStatsDto>({
    url: `${base(mysqlRaceId)}/stats`,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function listMasterDataAthletes(
  mysqlRaceId: number,
  query: ListAthletesQuery,
): Promise<ListAthletesResponseDto> {
  const res = await client.get<ListAthletesResponseDto>({
    url: buildUrl(`${base(mysqlRaceId)}/athletes`, query),
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function getMasterDataAthlete(
  mysqlRaceId: number,
  bibNumber: string,
): Promise<RaceAthleteAdminDto> {
  const res = await client.get<RaceAthleteAdminDto>({
    url: `${base(mysqlRaceId)}/athletes/${encodeURIComponent(bibNumber)}`,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function triggerMasterDataSync(
  mysqlRaceId: number,
  syncType: 'ATHLETE_FULL' | 'ATHLETE_DELTA',
): Promise<TriggerSyncResponseDto> {
  const res = await client.post<TriggerSyncResponseDto>({
    url: `${base(mysqlRaceId)}/sync`,
    body: { syncType },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function listMasterDataSyncLogs(
  mysqlRaceId: number,
  limit = 50,
): Promise<SyncLogListDto> {
  const res = await client.get<SyncLogListDto>({
    url: buildUrl(`${base(mysqlRaceId)}/sync-logs`, { limit }),
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

function extractError(err: unknown, status?: number): string {
  if (status === 409) {
    return 'Sync đang chạy cho race này. Đợi hoàn tất rồi thử lại.';
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join('; ');
  }
  return status ? `HTTP ${status}` : 'Request failed';
}
