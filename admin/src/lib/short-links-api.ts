/**
 * FEATURE-089 — Short link admin API wrapper.
 *
 * Hand-typed thin wrappers over the runtime `/api/*` proxy + named
 * `ShortLinkApiError` (mirrors F-083 `landing-api.ts` pattern).
 */

export interface ShortLink {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  title?: string;
  clickCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShortLinkListResponse {
  items: ShortLink[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateShortLinkBody {
  targetUrl: string;
  title?: string;
  customAlias?: string;
}

export interface UpdateShortLinkBody {
  targetUrl?: string;
  title?: string;
  active?: boolean;
}

export class ShortLinkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ShortLinkApiError';
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
    throw new ShortLinkApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listShortLinks(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ShortLinkListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<ShortLinkListResponse>(`/short-links${suffix}`);
}

export function createShortLink(body: CreateShortLinkBody): Promise<ShortLink> {
  return request<ShortLink>('/short-links', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateShortLink(
  id: string,
  body: UpdateShortLinkBody,
): Promise<ShortLink> {
  return request<ShortLink>(`/short-links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteShortLink(id: string): Promise<void> {
  return request<void>(`/short-links/${id}`, { method: 'DELETE' });
}

/** QR PNG URL (qua proxy). `<img src>` trực tiếp được. */
export function shortLinkQrUrl(id: string): string {
  return `/api/short-links/${id}/qr.png`;
}
