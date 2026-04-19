// Interim typed fetch wrapper for certificates endpoints.
// TODO: once backend boots on this worktree, run `pnpm run generate:api`
// and replace these calls with generated SDK functions.

export type TemplateType = "certificate" | "share_card";
export type LayerType = "text" | "image" | "shape" | "photo";
export type ShapeType = "rect" | "rounded_rect" | "circle" | "line";
export type TextAlign = "left" | "center" | "right";

export interface TemplateCanvas {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
}

export interface TemplateLayer {
  type: LayerType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  // text
  variable?: string;
  text?: string;
  font?: string;
  size?: number;
  color?: string;
  fontWeight?: string;
  textAlign?: TextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  // image
  imageUrl?: string;
  // shape
  shape?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface PhotoArea {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface CertificateTemplate {
  _id: string;
  name: string;
  race_id: string;
  course_id?: string | null;
  type: TemplateType;
  canvas: TemplateCanvas;
  layers: TemplateLayer[];
  photo_area?: PhotoArea | null;
  placeholder_photo_url?: string | null;
  is_archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateListResponse {
  data: CertificateTemplate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateTemplateInput {
  name: string;
  race_id: string;
  course_id?: string | null;
  type: TemplateType;
  canvas: TemplateCanvas;
  layers: TemplateLayer[];
  photo_area?: PhotoArea | null;
  placeholder_photo_url?: string | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & {
  is_archived?: boolean;
};

export interface ListTemplatesQuery {
  raceId?: string;
  courseId?: string;
  type?: TemplateType;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CourseTemplateOverride {
  course_id: string;
  template_certificate?: string | null;
  template_share_card?: string | null;
}

export interface RaceCertificateConfig {
  _id?: string;
  race_id: string;
  default_template_certificate?: string | null;
  default_template_share_card?: string | null;
  course_overrides?: CourseTemplateOverride[];
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertRaceConfigInput {
  default_template_certificate?: string | null;
  default_template_share_card?: string | null;
  course_overrides?: CourseTemplateOverride[];
  enabled?: boolean;
}

function authed(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message)
        ? body.message.join("; ")
        : body.message;
  } catch {
    // ignore
  }
  throw new Error(message);
}

// ─── Templates ────────────────────────────────────────────────

export async function listCertificateTemplates(
  token: string,
  query: ListTemplatesQuery = {},
): Promise<TemplateListResponse> {
  const qs = new URLSearchParams();
  if (query.raceId) qs.set("raceId", query.raceId);
  if (query.courseId) qs.set("courseId", query.courseId);
  if (query.type) qs.set("type", query.type);
  if (query.includeArchived !== undefined)
    qs.set("includeArchived", String(query.includeArchived));
  if (query.page) qs.set("page", String(query.page));
  if (query.pageSize) qs.set("pageSize", String(query.pageSize));
  const res = await fetch(`/api/certificate-templates?${qs.toString()}`, {
    headers: authed(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function getCertificateTemplate(
  token: string,
  id: string,
): Promise<CertificateTemplate> {
  const res = await fetch(`/api/certificate-templates/${id}`, {
    headers: authed(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function createCertificateTemplate(
  token: string,
  input: CreateTemplateInput,
): Promise<CertificateTemplate> {
  const res = await fetch("/api/certificate-templates", {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function updateCertificateTemplate(
  token: string,
  id: string,
  input: UpdateTemplateInput,
): Promise<CertificateTemplate> {
  const res = await fetch(`/api/certificate-templates/${id}`, {
    method: "PATCH",
    headers: authed(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteCertificateTemplate(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`/api/certificate-templates/${id}`, {
    method: "DELETE",
    headers: authed(token),
  });
  await assertOk(res);
}

// ─── Race Config ──────────────────────────────────────────────

export async function getRaceCertificateConfig(
  token: string,
  raceId: string,
): Promise<RaceCertificateConfig | null> {
  const res = await fetch(`/api/race-certificate-configs/${raceId}`, {
    headers: authed(token),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  await assertOk(res);
  return res.json();
}

export async function upsertRaceCertificateConfig(
  token: string,
  raceId: string,
  input: UpsertRaceConfigInput,
): Promise<RaceCertificateConfig> {
  const res = await fetch(`/api/race-certificate-configs/${raceId}`, {
    method: "PUT",
    headers: authed(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

// ─── Render (public, no auth) ─────────────────────────────────

export function certificateRenderUrl(
  raceId: string,
  bib: string,
  type: TemplateType,
  courseId?: string,
): string {
  const qs = new URLSearchParams({ type });
  if (courseId) qs.set("courseId", courseId);
  return `/api/certificates/render/${raceId}/${bib}?${qs.toString()}`;
}

// ─── Constants ────────────────────────────────────────────────

export const TEMPLATE_VARIABLES = [
  { key: "runner_name", label: "Tên VĐV" },
  { key: "bib", label: "BIB" },
  { key: "finish_time", label: "Thời gian" },
  { key: "pace", label: "Pace" },
  { key: "distance", label: "Cự ly" },
  { key: "event_name", label: "Tên giải" },
  { key: "event_date", label: "Ngày giải" },
] as const;

export const CANVAS_PRESETS = [
  { label: "Certificate (1080×1350)", width: 1080, height: 1350 },
  { label: "Share Square (1200×1200)", width: 1200, height: 1200 },
  { label: "Share Landscape (1200×630)", width: 1200, height: 630 },
  { label: "A4 Portrait (2480×3508)", width: 2480, height: 3508 },
] as const;

export const FONT_FAMILIES = [
  "Inter",
  "Be Vietnam Pro",
  "Roboto",
  "Playfair Display",
  "Montserrat",
] as const;
