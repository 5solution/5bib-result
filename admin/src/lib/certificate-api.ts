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
  id: string;
  name: string;
  race_id: string;
  course_id?: string | null;
  type: TemplateType;
  canvas: TemplateCanvas;
  layers: TemplateLayer[];
  photo_area?: PhotoArea | null;
  placeholder_photo_url?: string | null;
  /**
   * When true, photo_area + "photo" layers render BELOW
   * canvas.backgroundImageUrl. Use when the bg image is a transparent PNG
   * frame with a cut-out window for the athlete photo.
   */
  photo_behind_background?: boolean;
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
  photo_behind_background?: boolean;
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
  id?: string;
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

// ─── Admin ↔ Backend shape transformers ───────────────────────
//
// Admin editor keeps convenient field names (`font`, `size`, `fillColor`,
// `strokeColor`, `variable`). Backend DTO whitelists different names
// (`fontFamily`, `fontSize`, `fill`, `stroke`, `text` with `{variable}`
// tokens). These helpers translate at the wire boundary so the editor
// doesn't need to change everywhere.
//
// Rules:
// - layer.font        ↔ layer.fontFamily
// - layer.size        ↔ layer.fontSize
// - layer.fillColor   ↔ layer.fill
// - layer.strokeColor ↔ layer.stroke
// - layer.variable    →  layer.text = "{variable}"
//   layer.text = "{word}" ←  layer.variable = "word" (inverse on load)
// - layer.zIndex      →  dropped (not in backend DTO)

type AdminLayer = TemplateLayer;
type BackendLayer = Record<string, unknown>;

function layerToBackend(l: AdminLayer): BackendLayer {
  const out: BackendLayer = {};
  const copyKeys: Array<keyof AdminLayer> = [
    "type",
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "opacity",
    "color",
    "fontWeight",
    "textAlign",
    "lineHeight",
    "letterSpacing",
    "imageUrl",
    "shape",
    "strokeWidth",
    "borderRadius",
  ];
  for (const k of copyKeys) {
    const v = l[k];
    if (v !== undefined) out[k] = v;
  }
  if (l.font !== undefined) out.fontFamily = l.font;
  if (l.size !== undefined) out.fontSize = l.size;
  if (l.fillColor !== undefined) out.fill = l.fillColor;
  if (l.strokeColor !== undefined) out.stroke = l.strokeColor;
  if (l.variable) {
    out.text = `{${l.variable}}`;
  } else if (l.text !== undefined) {
    out.text = l.text;
  }
  return out;
}

function layerFromBackend(raw: BackendLayer): AdminLayer {
  const r = raw as Record<string, unknown>;
  const out: AdminLayer = {
    type: r.type as LayerType,
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
  };
  if (r.width !== undefined) out.width = Number(r.width);
  if (r.height !== undefined) out.height = Number(r.height);
  if (r.rotation !== undefined) out.rotation = Number(r.rotation);
  if (r.opacity !== undefined) out.opacity = Number(r.opacity);
  if (typeof r.color === "string") out.color = r.color;
  if (typeof r.fontWeight === "string") out.fontWeight = r.fontWeight;
  if (typeof r.textAlign === "string")
    out.textAlign = r.textAlign as TextAlign;
  if (r.lineHeight !== undefined) out.lineHeight = Number(r.lineHeight);
  if (r.letterSpacing !== undefined)
    out.letterSpacing = Number(r.letterSpacing);
  if (typeof r.imageUrl === "string") out.imageUrl = r.imageUrl;
  if (typeof r.shape === "string") out.shape = r.shape as ShapeType;
  if (r.strokeWidth !== undefined) out.strokeWidth = Number(r.strokeWidth);
  if (r.borderRadius !== undefined) out.borderRadius = Number(r.borderRadius);
  if (typeof r.fontFamily === "string") out.font = r.fontFamily;
  if (r.fontSize !== undefined) out.size = Number(r.fontSize);
  if (typeof r.fill === "string") out.fillColor = r.fill;
  if (typeof r.stroke === "string") out.strokeColor = r.stroke;
  if (typeof r.text === "string") {
    const m = /^\{(\w+)\}$/.exec(r.text);
    if (m) out.variable = m[1];
    else out.text = r.text;
  }
  return out;
}

function templateToBackend(
  t: Partial<CreateTemplateInput> & { layers?: AdminLayer[] },
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...t };
  if (t.layers) payload.layers = t.layers.map(layerToBackend);
  return payload;
}

function templateFromBackend(raw: unknown): CertificateTemplate {
  const r = raw as Record<string, unknown>;
  const layers = Array.isArray(r.layers)
    ? (r.layers as BackendLayer[]).map(layerFromBackend)
    : [];
  return { ...(r as object), layers } as CertificateTemplate;
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
  const body = (await res.json()) as TemplateListResponse;
  return {
    ...body,
    data: (body.data ?? []).map(templateFromBackend),
  };
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
  return templateFromBackend(await res.json());
}

export async function createCertificateTemplate(
  token: string,
  input: CreateTemplateInput,
): Promise<CertificateTemplate> {
  const res = await fetch("/api/certificate-templates", {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify(templateToBackend(input)),
  });
  await assertOk(res);
  return templateFromBackend(await res.json());
}

export async function updateCertificateTemplate(
  token: string,
  id: string,
  input: UpdateTemplateInput,
): Promise<CertificateTemplate> {
  const res = await fetch(`/api/certificate-templates/${id}`, {
    method: "PATCH",
    headers: authed(token),
    body: JSON.stringify(templateToBackend(input)),
  });
  await assertOk(res);
  return templateFromBackend(await res.json());
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

// ─── Upload (image → S3) ──────────────────────────────────────

export async function uploadImage(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  await assertOk(res);
  const body = (await res.json()) as { url: string };
  if (!body?.url) throw new Error("Upload response missing url");
  return body.url;
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
  { key: "chip_time", label: "Chip Time" },
  { key: "gun_time", label: "Gun Time" },
  { key: "finish_time", label: "Thời gian (chip)" },
  { key: "pace", label: "Pace" },
  { key: "distance", label: "Cự ly" },
  { key: "nation", label: "Quốc gia" },
  { key: "gender_rank", label: "Hạng giới tính" },
  { key: "ag_rank", label: "Hạng AG (theo độ tuổi)" },
  { key: "overall_rank", label: "Hạng chung" },
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
