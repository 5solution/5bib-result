/**
 * FEATURE-091 — Border Pass email admin API wrapper.
 * Hand-typed thin wrappers over `/api/*` proxy (pattern crew-cert / short-links).
 */

export interface BibPassLayer {
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
  letterSpacing?: number;
  fill?: string;
  shape?: 'rect' | 'rounded_rect' | 'circle' | 'line';
  borderRadius?: number;
  imageUrl?: string;
}

export interface BibPassCanvas {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
}

export interface BibPassTemplate {
  canvas: BibPassCanvas;
  layers: BibPassLayer[];
  photoArea?: { x: number; y: number; width: number; height: number; borderRadius?: number } | null;
  placeholderPhotoUrl?: string | null;
  photoBehindBackground?: boolean;
}

export interface BibPassStaticFields {
  location: string;
  raceDay: string;
  distance: string;
  passportPrefix: string;
}

export interface BibPassEmail {
  subject: string;
  bodyHtml: string;
  fromName: string;
}

export interface BibPassConfig {
  id: string;
  raceId: number;
  raceName: string;
  enabled: boolean;
  template: BibPassTemplate | null;
  staticFields: BibPassStaticFields;
  email: BibPassEmail;
  attachmentFilename: string;
  createdAt: string;
  updatedAt: string;
}

export interface BibPassConfigListItem {
  raceId: number;
  raceName: string;
  enabled: boolean;
  hasTemplate: boolean;
  sentCount: number;
  updatedAt: string;
}

export interface BibPassRaceOption {
  raceId: number;
  title: string | null;
  confirmedCount: number;
  configured: boolean;
}

export interface ConfirmedAthleteRow {
  athletesId: number;
  name: string | null;
  bib: string | null;
  emailMasked: string | null;
  hasEmail: boolean;
  sendStatus: 'sent' | 'failed' | 'skipped' | 'pending';
}

export interface BibPassStats {
  confirmed: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface SendBatchResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  hasMore: boolean;
}

export interface FontOption {
  family: string;
  label: string;
  category: string;
}

export interface UpsertBibPassConfig {
  raceName?: string;
  enabled?: boolean;
  template?: BibPassTemplate;
  staticFields?: Partial<BibPassStaticFields>;
  email?: Partial<BibPassEmail>;
  attachmentFilename?: string;
}

export class BibPassApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'BibPassApiError';
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
    throw new BibPassApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listFonts(): Promise<FontOption[]> {
  return request('/bib-pass/fonts');
}
export function listRaceOptions(): Promise<{ items: BibPassRaceOption[] }> {
  return request('/bib-pass/races');
}
export function listConfigs(): Promise<{ items: BibPassConfigListItem[]; total: number }> {
  return request('/bib-pass/configs');
}
export function getConfig(raceId: number): Promise<BibPassConfig> {
  return request(`/bib-pass/configs/${raceId}`);
}
export function upsertConfig(raceId: number, body: UpsertBibPassConfig): Promise<BibPassConfig> {
  return request(`/bib-pass/configs/${raceId}`, { method: 'PUT', body: JSON.stringify(body) });
}
export function deleteConfig(raceId: number): Promise<void> {
  return request(`/bib-pass/configs/${raceId}`, { method: 'DELETE' });
}
export function getStats(raceId: number): Promise<BibPassStats> {
  return request(`/bib-pass/configs/${raceId}/stats`);
}
export function listConfirmed(
  raceId: number,
  opts: { q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: ConfirmedAthleteRow[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams();
  if (opts.q) qs.set('q', opts.q);
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.pageSize) qs.set('pageSize', String(opts.pageSize));
  const suffix = qs.toString() ? `?${qs}` : '';
  return request(`/bib-pass/configs/${raceId}/confirmed${suffix}`);
}
export function testSend(
  raceId: number,
  body: { toEmail: string; athletesId?: number },
): Promise<{ ok: boolean; message: string }> {
  return request(`/bib-pass/configs/${raceId}/test-send`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export function sendBatch(raceId: number): Promise<SendBatchResult> {
  return request(`/bib-pass/configs/${raceId}/send-batch`, { method: 'POST' });
}

/**
 * LIVE preview: render phôi CHƯA lưu (draft) → blob object URL. Gửi kèm
 * raceName + staticFields để preview phản ánh giá trị chưa lưu (KHÔNG cần
 * config đã tồn tại — giải mới cấu hình lần đầu vẫn preview được).
 */
export async function previewDraft(
  raceId: number,
  draft: { template: BibPassTemplate; raceName?: string; staticFields?: Partial<BibPassStaticFields> },
): Promise<string> {
  const res = await fetch(`/api/bib-pass/configs/${raceId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new BibPassApiError(res.status, `Render preview lỗi (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

/** Upload phôi nền → S3 folder crew-certificates (dùng chung lifecycle persist). */
export async function uploadBibPassImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'crew-certificates');
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new BibPassApiError(res.status, 'Upload ảnh thất bại');
  const body = (await res.json()) as { url: string };
  if (!body?.url) throw new BibPassApiError(500, 'Thiếu URL ảnh');
  return body.url;
}
