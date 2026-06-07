/**
 * TEMPORARY hand-typed wrapper for chip-verification API.
 *
 * After BE deploys to staging, run `pnpm generate:api` and replace these
 * with `chipVerificationControllerXxx` / `chipVerificationPublicControllerXxx`
 * from `@/lib/api-generated`. Schema names + paths must stay in sync — see
 * `backend/src/modules/chip-verification/{chip-verification.controller.ts,
 * chip-verification-public.controller.ts}`.
 */
import { client } from './api-generated/client.gen';

export interface ChipMappingItemDto {
  id: string;
  mysql_race_id: number;
  chip_id: string;
  bib_number: string;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
  updated_at: string;
}

export interface ListChipMappingsResponseDto {
  items: ChipMappingItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportPreviewRowErrorDto {
  row: number;
  reason: string;
}

export interface ImportPreviewResponseDto {
  totalRows: number;
  valid: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  swapDeletes: number;
  errors: ImportPreviewRowErrorDto[];
  warnings: ImportPreviewRowErrorDto[];
  previewToken: string;
}

export interface ConfirmImportResponseDto {
  imported: number;
}

export interface TokenActionResponseDto {
  token: string | null;
  chip_verify_enabled: boolean;
  total_chip_mappings: number;
  preload_completed_at: string | null;
}

export interface ChipStatsResponseDto {
  total_mappings: number;
  total_verified: number;
  total_attempts: number;
  recent_5m: number;
}

export interface CacheActionResponseDto {
  success: boolean;
  cached_count: number;
  preload_completed_at: string | null;
}

type TokenAction = 'GENERATE' | 'ROTATE' | 'DISABLE';

export async function importChipMappingsPreview(
  raceId: number,
  file: File,
): Promise<ImportPreviewResponseDto> {
  // hey-api `client.post({ body: fd })` JSON-stringify FormData → backend
  // gets `{}` instead of multipart. Existing admin pattern (team-api.ts) uses
  // native `fetch` cho file upload — proxy server-side vẫn inject Bearer auth.
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/admin/races/${raceId}/chip-mappings/import`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const errBody = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(extractError(errBody, res.status));
  }
  return (await res.json()) as ImportPreviewResponseDto;
}

export async function confirmChipImport(
  raceId: number,
  previewToken: string,
): Promise<ConfirmImportResponseDto> {
  const res = await client.post<ConfirmImportResponseDto>({
    url: `/api/admin/races/${raceId}/chip-mappings/import/confirm`,
    body: { previewToken },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function listChipMappings(
  raceId: number,
  page: number,
  pageSize: number,
  search?: string,
): Promise<ListChipMappingsResponseDto> {
  const url = new URL(
    `/api/admin/races/${raceId}/chip-mappings`,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  );
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  if (search) url.searchParams.set('search', search);
  const res = await client.get<ListChipMappingsResponseDto>({
    url: url.pathname + url.search,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function updateChipMapping(
  raceId: number,
  mappingId: string,
  body: { chip_id?: string; bib_number?: string; status?: 'ACTIVE' | 'DISABLED' },
): Promise<ChipMappingItemDto> {
  const res = await client.put<ChipMappingItemDto>({
    url: `/api/admin/races/${raceId}/chip-mappings/${mappingId}`,
    body,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function deleteChipMapping(
  raceId: number,
  mappingId: string,
): Promise<void> {
  const res = await client.delete<void>({
    url: `/api/admin/races/${raceId}/chip-mappings/${mappingId}`,
  });
  if (res.error) throw new Error(extractError(res.error));
}

export async function chipTokenAction(
  raceId: number,
  action: TokenAction,
): Promise<TokenActionResponseDto> {
  const res = await client.post<TokenActionResponseDto>({
    url: `/api/admin/races/${raceId}/chip-verify/token`,
    body: { action },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function getChipStats(
  raceId: number,
): Promise<ChipStatsResponseDto> {
  const res = await client.get<ChipStatsResponseDto>({
    url: `/api/admin/races/${raceId}/chip-verify/stats`,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function chipCacheAction(
  raceId: number,
  action: 'REFRESH' | 'CLEAR',
): Promise<CacheActionResponseDto> {
  const res = await client.post<CacheActionResponseDto>({
    url: `/api/admin/races/${raceId}/chip-verify/cache`,
    body: { action },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export interface ChipConfigResponseDto {
  chip_verify_enabled: boolean;
  chip_verify_token: string | null;
  total_chip_mappings: number;
  preload_completed_at: string | null;
  cache_ready: boolean;
  delta_sync_enabled: boolean;
}

export async function setDeltaSyncEnabled(
  raceId: number,
  enabled: boolean,
): Promise<ChipConfigResponseDto> {
  const res = await client.post<ChipConfigResponseDto>({
    url: `/api/admin/races/${raceId}/chip-verify/delta-sync`,
    body: { enabled },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

export async function getChipConfig(
  raceId: number,
): Promise<ChipConfigResponseDto> {
  const res = await client.get<ChipConfigResponseDto>({
    url: `/api/admin/races/${raceId}/chip-verify/config`,
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

// ─────────── Mongo ↔ MySQL link ───────────

export interface ChipConfigLinkResponseDto {
  mongo_race_id: string;
  mysql_race_id: number;
  chip_verify_enabled: boolean;
  total_chip_mappings: number;
}

export async function getChipConfigByMongoId(
  mongoRaceId: string,
): Promise<ChipConfigLinkResponseDto | null> {
  const res = await client.get<ChipConfigLinkResponseDto>({
    url: `/api/admin/races/by-mongo/${mongoRaceId}/chip-verify/config`,
  });
  if (res.response?.status === 404) return null;
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) return null;
  return res.data;
}

export async function linkMongoToMysql(
  mongoRaceId: string,
  mysqlRaceId: number,
): Promise<ChipConfigLinkResponseDto> {
  const res = await client.post<ChipConfigLinkResponseDto>({
    url: `/api/admin/races/by-mongo/${mongoRaceId}/chip-verify/link`,
    body: { mysql_race_id: mysqlRaceId },
  });
  if (res.error) throw new Error(extractError(res.error));
  if (!res.data) throw new Error('Empty response');
  return res.data;
}

function extractError(err: unknown, status?: number): string {
  if (status === 413) {
    return 'File CSV vượt quá giới hạn 5MB. Chia file hoặc liên hệ admin.';
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join('; ');
  }
  return status ? `HTTP ${status}` : 'Request failed';
}
