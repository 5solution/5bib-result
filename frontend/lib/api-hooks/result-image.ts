/**
 * Result Image creator hooks.
 *
 * Intentionally uses raw fetch (not the generated SDK) because:
 *  - The generated @hey-api/openapi-ts SDK only typed `bg`/`customBg` from the
 *    legacy DTO shape. Phase 2 added `template`, `size`, `showBadges`, etc.
 *  - The endpoint returns a binary PNG; multipart → blob is ergonomic with
 *    FormData + fetch, not the SDK JSON client.
 *  - Preview URLs are used directly as `<img src>` so no fetch wrapper needed.
 *
 * Rerun `pnpm run generate:api` periodically; when the SDK catches up,
 * this file can migrate to the typed caller.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const TEMPLATE_KEYS = [
  'classic',
  'celebration',
  'endurance',
  'story',
  'sticker',
  'podium',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const SIZE_KEYS = ['4:5', '1:1', '9:16'] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

export const GRADIENT_KEYS = [
  'blue',
  'dark',
  'sunset',
  'forest',
  'purple',
] as const;
export type GradientKey = (typeof GRADIENT_KEYS)[number];

export interface ResultImageRequestBody {
  template?: TemplateKey;
  size?: SizeKey;
  gradient?: GradientKey;
  showSplits?: boolean;
  showQrCode?: boolean;
  showBadges?: boolean;
  customMessage?: string;
  /**
   * Reference to a previously-uploaded background photo (via /upload-bg).
   * Strongly preferred over `customPhoto` — avoids re-uploading 5–10MB on every
   * template switch. If both are set, photoId wins on the server.
   */
  photoId?: string;
  /** Custom photo/background. Must pass magic-byte validation on the server. */
  customPhoto?: File | Blob | null; // File = raw upload, Blob = after client-side crop
  /** Deprecated alias — keep for back-compat with old callers. */
  customBg?: File | null;
}

export interface UploadBackgroundResponse {
  photoId: string;
  expiresAt: string; // ISO timestamp
}

/**
 * Upload a custom background photo ONCE, get back a photoId for reuse across
 * subsequent template/gradient changes. The photo lives in S3 for 24h and is
 * cached in Redis for 10 min for fast template switching.
 *
 * Designed to replace inline `customPhoto` upload on every template change —
 * cuts modal interaction bandwidth from N×5MB to 1×5MB + N×tiny GETs.
 */
export function useUploadBackgroundPhoto() {
  return useMutation({
    mutationFn: async (file: File | Blob): Promise<UploadBackgroundResponse> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/race-results/result-image/upload-bg', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await safeJson(res);
        throw new ResultImageError(
          payload?.message ?? `Lỗi tải ảnh nền (${res.status})`,
          res.status,
        );
      }
      return (await res.json()) as UploadBackgroundResponse;
    },
  });
}

/**
 * Build URL for the GET preview endpoint. Use directly as `<img src>`.
 * `preview=1` tells backend to render at half-res (~480px wide) for speed.
 */
export function buildPreviewUrl(
  raceId: string,
  bib: string,
  opts: {
    template?: TemplateKey;
    size?: SizeKey;
    gradient?: GradientKey;
    showBadges?: boolean;
    showQrCode?: boolean;
    showSplits?: boolean;
    customMessage?: string;
    /**
     * Reference to a previously-uploaded background photo. When set, the
     * preview renders with that photo as background — same as a POST with
     * customPhoto file but with no upload cost. Get from useUploadBackgroundPhoto.
     */
    photoId?: string;
    /** Cache-bust token — bump to force a re-render. */
    token?: string | number;
  } = {},
): string {
  const params = new URLSearchParams();
  params.set('preview', '1');
  if (opts.template) params.set('template', opts.template);
  if (opts.size) params.set('size', opts.size);
  if (opts.gradient) params.set('gradient', opts.gradient);
  if (opts.showBadges !== undefined) params.set('showBadges', String(opts.showBadges));
  if (opts.showQrCode !== undefined) params.set('showQrCode', String(opts.showQrCode));
  if (opts.showSplits !== undefined) params.set('showSplits', String(opts.showSplits));
  if (opts.customMessage) params.set('customMessage', opts.customMessage);
  if (opts.photoId) params.set('photoId', opts.photoId);
  if (opts.token !== undefined) params.set('t', String(opts.token));
  return `/api/race-results/result-image/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}?${params.toString()}`;
}

export interface GenerateResultImageResult {
  blob: Blob;
  objectUrl: string;
  templateFallback: boolean;
  fallbackReason: string | null;
}

/**
 * POST full-res result image. Returns Blob + object URL for download/share.
 *
 * The URL returned has a lifetime of "until component unmount" — callers should
 * `URL.revokeObjectURL(url)` when done (we do it in the modal cleanup).
 */
export function useGenerateResultImage(raceId: string, bib: string) {
  return useMutation({
    mutationFn: async (
      body: ResultImageRequestBody,
    ): Promise<GenerateResultImageResult> => {
      const form = new FormData();
      if (body.template) form.append('template', body.template);
      if (body.size) form.append('size', body.size);
      if (body.gradient) form.append('gradient', body.gradient);
      if (body.showSplits !== undefined) form.append('showSplits', String(body.showSplits));
      if (body.showQrCode !== undefined) form.append('showQrCode', String(body.showQrCode));
      if (body.showBadges !== undefined) form.append('showBadges', String(body.showBadges));
      if (body.customMessage) form.append('customMessage', body.customMessage);
      // photoId is preferred — server uses it directly without parsing buffer.
      // If it's set, we skip sending the file blob entirely (saves bandwidth).
      if (body.photoId) {
        form.append('photoId', body.photoId);
      } else if (body.customPhoto) {
        form.append('customPhoto', body.customPhoto);
      } else if (body.customBg) {
        form.append('customBg', body.customBg);
      }

      const res = await fetch(
        `/api/race-results/result-image/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}`,
        {
          method: 'POST',
          body: form,
          credentials: 'include',
        },
      );

      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          const payload = await safeJson(res);
          const retry = typeof payload?.retryAfterSeconds === 'number'
            ? payload.retryAfterSeconds
            : 10;
          throw new ResultImageError(
            payload?.message ?? 'Hệ thống đang tải cao, vui lòng thử lại',
            res.status,
            retry,
          );
        }
        const payload = await safeJson(res);
        throw new ResultImageError(
          payload?.message ?? `Lỗi tạo ảnh (${res.status})`,
          res.status,
        );
      }

      const templateFallback = res.headers.get('X-Template-Fallback') === '1';
      const fallbackReason = res.headers.get('X-Template-Fallback-Reason');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return { blob, objectUrl, templateFallback, fallbackReason };
    },
  });
}

/** GET the live share counter for a race. Cheap — hits a Redis INCR counter. */
export function useRaceShareCount(raceId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['share-count', raceId],
    queryFn: async () => {
      if (!raceId) return 0;
      const res = await fetch(`/api/race-results/share-count/${encodeURIComponent(raceId)}`, {
        credentials: 'include',
      });
      if (!res.ok) return 0;
      const data = (await res.json()) as { count?: number };
      return typeof data.count === 'number' ? data.count : 0;
    },
    enabled: options?.enabled !== false && !!raceId,
    staleTime: 30 * 1000, // 30s
    refetchInterval: 60 * 1000, // auto-refresh every minute while modal open
  });
}

/**
 * Ping the share counter after a successful share. Non-blocking, fire-and-forget.
 * Backend dedupes by bib within the same minute so double-clicks don't inflate.
 */
export function useIncrementShareCount(raceId: string, bib: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channel?: string) => {
      const res = await fetch(
        `/api/race-results/share-count/${encodeURIComponent(raceId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bib, channel: channel ?? 'unknown' }),
          credentials: 'include',
        },
      );
      if (!res.ok) return { count: 0 };
      return (await res.json()) as { count: number };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['share-count', raceId] });
    },
  });
}

// ─── Badges (for AchievementBanner + CelebrationOverlay) ────────

export interface AthleteBadge {
  type: string;
  label: string;
  shortLabel?: string;
  color?: string;
}

/**
 * Fetch the badges detected by BadgeService for a single athlete.
 * Cached 5 min — badges only change when race results update.
 */
export function useAthleteBadges(
  raceId: string,
  bib: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['athlete-badges', raceId, bib],
    queryFn: async (): Promise<AthleteBadge[]> => {
      if (!raceId || !bib) return [];
      const res = await fetch(
        `/api/race-results/badges/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}`,
        { credentials: 'include' },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: AthleteBadge[] };
      return Array.isArray(data.data) ? data.data : [];
    },
    enabled: options?.enabled !== false && !!raceId && !!bib,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Analytics share log (D-1) ──────────────────────────────────

export interface ShareEventInput {
  raceId: string;
  bib: string;
  template: TemplateKey;
  channel: 'download' | 'web-share' | 'copy-link' | 'unknown';
  gradient?: GradientKey;
  size?: SizeKey;
  templateFallback?: boolean;
}

/**
 * Fire-and-forget log of a share action. Backend persists to `shareevents`
 * collection for admin analytics. Never blocks the UX — errors swallowed.
 */
export function useLogShareEvent() {
  return useMutation({
    mutationFn: async (input: ShareEventInput) => {
      try {
        await fetch('/api/race-results/result-image-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          credentials: 'include',
          keepalive: true, // survive page navigation
        });
      } catch {
        // analytics failure is non-fatal
      }
      return { ok: true };
    },
  });
}

// ─── Error class ────────────────────────────────────────────────

export class ResultImageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ResultImageError';
  }
}

async function safeJson(
  res: Response,
): Promise<{ message?: string; retryAfterSeconds?: number } | null> {
  try {
    return (await res.json()) as { message?: string; retryAfterSeconds?: number };
  } catch {
    return null;
  }
}
