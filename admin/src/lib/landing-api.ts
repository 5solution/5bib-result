/**
 * FEATURE-083 — Race Landing admin API wrapper.
 *
 * Mirrors the F-068 `course-data-ops-api.ts` pattern: hand-typed thin wrappers
 * over the runtime `/api/*` proxy + a named `LandingApiError`. SDK regen
 * (`pnpm --filter admin generate:api`) to be run in the QC phase against the
 * backend on :8081; until then these typed wrappers are the contract.
 */

export interface LandingSectionAdmin {
  id: string;
  type: string;
  variant: string;
  enabled: boolean;
  order: number;
  anchor?: string;
  data: Record<string, unknown>;
}

export interface LandingThemeAdmin {
  preset?: string;
  main: string;
  sec: string;
  fontHeading: string;
  fontBody: string;
  heroOverlay: number;
}

export interface LandingMetaAdmin {
  title?: string;
  description?: string;
  lang: string;
  ogImage?: string;
  favicon?: string;
  robots: string;
  analytics: Record<string, unknown>;
}

export interface LandingDomainAdmin {
  subdomain?: string;
  domainStatus: string;
  sslStatus: string;
}

export interface LandingPublishAdmin {
  hasUnpublishedChanges: boolean;
  version: number;
  publishedAt?: string | null;
}

export interface LandingAdmin {
  id: string;
  raceRef: { raceId: string; mysqlRaceId?: number | null; slug?: string };
  internalName?: string;
  status: string;
  meta: LandingMetaAdmin;
  theme: LandingThemeAdmin;
  domain: LandingDomainAdmin;
  sections: LandingSectionAdmin[];
  publish: LandingPublishAdmin;
  createdAt: string;
  updatedAt: string;
}

export interface LandingListItem {
  id: string;
  raceTitle?: string;
  subdomain?: string;
  status: string;
  enabledSectionCount: number;
  updatedAt: string;
}

export interface LandingListResponse {
  data: LandingListItem[];
  total: number;
  pageNo: number;
  pageSize: number;
}

export interface UpdateLandingBody {
  internalName?: string;
  meta?: Partial<LandingMetaAdmin>;
  theme?: Partial<LandingThemeAdmin>;
  domain?: { subdomain?: string };
}

export interface SectionInput {
  id?: string;
  type: string;
  variant: string;
  enabled: boolean;
  order: number;
  anchor?: string;
  data: Record<string, unknown>;
}

export class LandingApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'LandingApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Lỗi ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[]; code?: string };
      code = body.code;
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      /* non-JSON error body */
    }
    throw new LandingApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listLandings(params: {
  status?: string;
  pageNo?: number;
  pageSize?: number;
  q?: string;
}): Promise<LandingListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.pageNo) qs.set('pageNo', String(params.pageNo));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<LandingListResponse>(`/landings${suffix}`);
}

export function createLanding(raceId: string): Promise<LandingAdmin> {
  return request<LandingAdmin>('/landings', {
    method: 'POST',
    body: JSON.stringify({ raceId }),
  });
}

export function getLanding(id: string): Promise<LandingAdmin> {
  return request<LandingAdmin>(`/landings/${id}`);
}

export function updateLanding(
  id: string,
  body: UpdateLandingBody,
): Promise<LandingAdmin> {
  return request<LandingAdmin>(`/landings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function reorderSections(
  id: string,
  sections: SectionInput[],
): Promise<LandingAdmin> {
  return request<LandingAdmin>(`/landings/${id}/sections`, {
    method: 'PATCH',
    body: JSON.stringify({ sections }),
  });
}

export function publishLanding(id: string): Promise<LandingAdmin> {
  return request<LandingAdmin>(`/landings/${id}/publish`, { method: 'POST' });
}

export function unpublishLanding(id: string): Promise<LandingAdmin> {
  return request<LandingAdmin>(`/landings/${id}/unpublish`, { method: 'POST' });
}

export function deleteLanding(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/landings/${id}`, { method: 'DELETE' });
}
