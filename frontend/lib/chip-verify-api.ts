/**
 * TEMPORARY hand-typed wrapper for public chip-verify API.
 * Replace with `chipVerificationPublicControllerXxx` after `pnpm generate:api`.
 *
 * Public endpoints (no auth, token in URL path):
 *   GET /api/chip-verify/:token/lookup?chip_id=X&device=Y
 *   GET /api/chip-verify/:token/recent?limit=20
 *   GET /api/chip-verify/:token/stats
 *
 * BR-03 strict allowlist — server NEVER returns email/phone/cccd/dob.
 */
import { client } from './api-generated/client.gen';

export type ChipResult =
  | 'FOUND'
  | 'CHIP_NOT_FOUND'
  | 'BIB_UNASSIGNED'
  | 'DISABLED'
  | 'ALREADY_PICKED_UP';

export interface ChipLookupResponse {
  result: ChipResult;
  bib_number: string | null;
  name: string | null;
  course_name: string | null;
  team: string | null;
  last_status: string | null;
  racekit_received: boolean;
  is_first_verify: boolean;
  verified_at: string;
}

export interface ChipRecentItem {
  bib_number: string | null;
  name: string | null;
  course_name: string | null;
  result: ChipResult;
  verified_at: string;
  device_label: string | null;
  is_first_verify: boolean;
}

export interface ChipStats {
  total_mappings: number;
  total_verified: number;
  total_attempts: number;
  recent_5m: number;
}

/**
 * Generic GET wrapper around hey-api client. The auto-gen client's response
 * `data` type is keyed by status code in the Responses map, which is awkward
 * to satisfy from a simple wrapper. We cast through `unknown` here once and
 * keep the rest of the codebase type-safe at the call sites.
 */
async function clientGet<T>(url: string): Promise<T> {
  const res = await client.get({ url });
  if (res.error) {
    throw new Error(extractError(res.error, res.response?.status));
  }
  if (res.data === null || res.data === undefined) {
    throw new Error('Empty response');
  }
  return res.data as T;
}

export async function lookupChip(
  token: string,
  chipId: string,
  device?: string,
): Promise<ChipLookupResponse> {
  const params = new URLSearchParams({ chip_id: chipId });
  if (device) params.set('device', device);
  return clientGet<ChipLookupResponse>(
    `/api/chip-verify/${token}/lookup?${params}`,
  );
}

export async function getRecentVerifications(
  token: string,
  limit = 20,
): Promise<{ items: ChipRecentItem[] }> {
  try {
    return await clientGet<{ items: ChipRecentItem[] }>(
      `/api/chip-verify/${token}/recent?limit=${limit}`,
    );
  } catch (err) {
    // Recent endpoint returning nothing → treat as empty list (kiosk just shows
    // the empty state rather than crashing the whole page).
    if ((err as Error).message === 'Empty response') return { items: [] };
    throw err;
  }
}

export async function getKioskStats(token: string): Promise<ChipStats> {
  return clientGet<ChipStats>(`/api/chip-verify/${token}/stats`);
}

function extractError(err: unknown, status?: number): string {
  if (status === 401) return 'Token không hợp lệ hoặc đã bị thu hồi';
  if (status === 429) return 'Quá nhiều yêu cầu, chờ 1 phút';
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Lỗi hệ thống';
}
