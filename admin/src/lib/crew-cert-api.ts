/**
 * FEATURE-090 — Crew Certificate (GCN) admin API wrapper.
 * Hand-typed thin wrappers over `/api/*` proxy (pattern landing/short-links).
 */

export interface CrewTemplateLayer {
  type: 'text' | 'image' | 'shape' | 'photo';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  imageUrl?: string;
  photoBorderRadius?: number;
  photoBorderColor?: string;
  photoBorderWidth?: number;
}

export interface CrewTemplateCanvas {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
}

export interface CrewTemplate {
  canvas: CrewTemplateCanvas;
  layers: CrewTemplateLayer[];
  photoArea?: { x: number; y: number; width: number; height: number; borderRadius?: number } | null;
  placeholderPhotoUrl?: string | null;
  photoBehindBackground?: boolean;
}

export interface CrewBatch {
  id: string;
  slug: string;
  eventName: string;
  active: boolean;
  extraFields: string[];
  recipientCount: number;
  template?: CrewTemplate | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrewBatchListItem {
  id: string;
  slug: string;
  eventName: string;
  active: boolean;
  recipientCount: number;
  updatedAt: string;
}

export interface CrewRecipientRow {
  fullName: string;
  position: string;
  photoUrl?: string;
  extraFields?: Record<string, string>;
}

export interface RosterPreview {
  total: number;
  valid: CrewRecipientRow[];
  invalid: { rowNumber: number; reason: string }[];
  extraFields: string[];
}

export interface CrewSearchResult {
  id: string;
  fullName: string;
  position: string;
}

export class CrewCertApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'CrewCertApiError';
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
      /* non-JSON */
    }
    throw new CrewCertApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listBatches(): Promise<{ items: CrewBatchListItem[]; total: number }> {
  return request('/crew-certificates');
}
export function createBatch(body: { eventName: string; slug: string }): Promise<CrewBatch> {
  return request('/crew-certificates', { method: 'POST', body: JSON.stringify(body) });
}
export function getBatch(id: string): Promise<CrewBatch> {
  return request(`/crew-certificates/${id}`);
}
export function updateBatch(
  id: string,
  body: Partial<{ eventName: string; slug: string; active: boolean; extraFields: string[]; template: CrewTemplate }>,
): Promise<CrewBatch> {
  return request(`/crew-certificates/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteBatch(id: string): Promise<void> {
  return request(`/crew-certificates/${id}`, { method: 'DELETE' });
}
export function listRecipients(id: string): Promise<CrewSearchResult[]> {
  return request(`/crew-certificates/${id}/recipients`);
}
export function rosterConfirm(id: string, rows: CrewRecipientRow[]): Promise<{ inserted: number }> {
  return request(`/crew-certificates/${id}/roster/confirm`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

/** multipart — KHÔNG set json Content-Type. */
export async function rosterPreview(id: string, file: File): Promise<RosterPreview> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/crew-certificates/${id}/roster/preview`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new CrewCertApiError(res.status, `Lỗi đọc file (${res.status})`);
  return (await res.json()) as RosterPreview;
}

/** Preview render URL của phôi ĐÃ LƯU (cache-bust qua ts). */
export function previewUrl(id: string, ts: number): string {
  return `/api/crew-certificates/${id}/preview?ts=${ts}`;
}

/** LIVE preview: render phôi CHƯA lưu (draft) → blob object URL. */
export async function previewDraft(id: string, template: CrewTemplate): Promise<string> {
  const res = await fetch(`/api/crew-certificates/${id}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new CrewCertApiError(res.status, `Render preview lỗi (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

/** Upload phôi nền → S3 folder crew-certificates (token injected by proxy). */
export async function uploadCrewImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'crew-certificates');
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new CrewCertApiError(res.status, 'Upload ảnh thất bại');
  const body = (await res.json()) as { url: string };
  if (!body?.url) throw new CrewCertApiError(500, 'Thiếu URL ảnh');
  return body.url;
}
