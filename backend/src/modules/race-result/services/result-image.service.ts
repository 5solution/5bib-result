import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type Image,
} from '@napi-rs/canvas';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as QRCode from 'qrcode';
import { env } from 'src/config';
import {
  NormalizedImageConfig,
  ResultImageQueryDto,
  normalizeImageConfig,
} from '../dto/result-image-query.dto';
import { resolveTemplateResult } from '../templates';
import type {
  RenderData,
  Badge,
  SplitData,
} from '../templates/types';
import { SIZE_DIMENSIONS, PREVIEW_DIMENSIONS } from '../templates/types';
import { BadgeService } from './badge.service';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Manual magic-byte sniff for JPG/PNG/WebP.
 * Avoids pulling the ESM-only `file-type` package into our CJS build.
 */
function isAllowedImageMagicBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true;
  }
  return false;
}

const S3_CACHE_PREFIX = 'result-images';
const BG_UPLOADS_PREFIX = 'result-images/bg-uploads';
const RENDER_LOCK_TTL_SECONDS = 30;
const S3_PRESIGN_EXPIRES_SECONDS = 3600;
// TTL matches S3 lifecycle (24h). Flag presence ⇒ S3 has the object; absence ⇒
// either never rendered or expired. False positives (flag without S3) are handled
// gracefully — tryFetchFromS3 returns null and we re-render.
const S3_INDEX_TTL_SECONDS = 86400;
// Background photo uploaded via /upload-bg lives in S3 for 24h. Frontend uses
// the returned photoId for subsequent template/gradient changes instead of
// re-uploading the buffer each time.
const BG_UPLOAD_TTL_SECONDS = 86400;
// Cache the downloaded photo buffer in Redis so rapid template switching
// (user trying classic → celebration → endurance...) doesn't pay an S3 GET each time.
const BG_BUFFER_CACHE_TTL_SECONDS = 600;

/**
 * Minimal input shape from `RaceResultService.getAthleteDetail()`.
 * Matches the PascalCase transform the service returns.
 */
export interface AthleteInput {
  Name: string;
  Bib: string;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap?: string;
  Gender: string;
  Category: string;
  OverallRank: string;
  GenderRank: string;
  CatRank?: string;
  distance: string;
  /** Split times (parsed from Chiptimes JSON) */
  splits?: SplitData[];
  /**
   * Result-doc version tag. When admin edits the result via
   * `RaceResultService.editResult`, `updated_at` bumps → cache key changes →
   * cache invalidates automatically without needing a purge hook.
   */
  updatedAt?: string | Date | null;
}

export interface GenerateImageInput {
  raceId: string;
  bib: string;
  athlete: AthleteInput;
  raceName: string;
  raceSlug: string;
  totalFinishers?: number;
  courseName?: string;
  config: NormalizedImageConfig;
  customPhotoBuffer?: Buffer;
  /**
   * Pre-fetched badges promise. Caller can kick off `BadgeService.detectBadges`
   * in parallel with their own DB loads (athlete, race meta) so by the time
   * `renderImage` needs badges they're already computed. Saves ~300ms on
   * cold render path. If undefined, service falls back to fetching itself.
   */
  prefetchedBadges?: Promise<Badge[]>;
  /**
   * Reference to a previously-uploaded background photo via uploadBackgroundPhoto().
   * Mutually exclusive with customPhotoBuffer — if both set, photoId wins
   * (service fetches buffer from S3 instead of using the inline buffer).
   * Designed to avoid re-uploading 5–10MB photos on every template switch.
   */
  photoId?: string;
}

export interface UploadBackgroundResult {
  /** Opaque ID — pass back as `photoId` on subsequent /result-image calls. */
  photoId: string;
  /** ISO timestamp when the photo will be auto-deleted by S3 lifecycle. */
  expiresAt: string;
}

export interface GenerateImageResult {
  /** PNG bytes */
  buffer: Buffer;
  /** Whether the result came from S3 cache */
  fromCache: boolean;
  /** Cache key used (for debugging) */
  cacheKey: string;
  /** Optional presigned S3 URL (if caller prefers redirect) */
  s3Url?: string;
  /** Template actually rendered (may differ from requested if gated/unknown) */
  templateActual: string;
  /** Template that was requested by caller */
  templateRequested: string;
  /** True when service fell back to classic due to gating / unknown key */
  fallback: boolean;
  /** Reason code when fallback=true (e.g. "ineligible:podium") */
  fallbackReason?: string;
}

@Injectable()
export class ResultImageService implements OnModuleInit {
  private readonly logger = new Logger(ResultImageService.name);
  private logoBuffer: Buffer | null = null;
  private logoImage: Image | null = null;
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly resultBaseUrl: string;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly badgeService: BadgeService,
  ) {
    this.bucket = env.s3.bucket;
    this.region = env.s3.region;
    this.s3Client = new S3Client({ region: this.region });
    // Public frontend base URL for QR codes. Fallback to prod domain.
    this.resultBaseUrl =
      process.env.RESULT_PUBLIC_URL ?? 'https://result.5bib.com';
  }

  async onModuleInit(): Promise<void> {
    await this.registerFonts();
    await this.preloadLogo();
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Generate (or fetch from cache) a result image.
   *
   * Flow:
   *   1. Compute cacheKey from config + athlete snapshot
   *   2. Check S3 cache (unless preview mode)
   *   3. Redis render-lock to prevent stampede
   *   4. Semaphore.run() → actual canvas render
   *   5. Upload to S3 (unless preview) + return buffer
   */
  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const { config } = input;
    const tGen = Date.now();
    const mark: Record<string, number> = {};

    // Resolve photoId → buffer (cached in Redis 10min, S3 fallback). Letting the
    // caller pass a photoId instead of a 5–10MB buffer on every template change
    // saves significant upload bandwidth on the wire.
    // photoId wins over customPhotoBuffer if both are set.
    if (input.photoId) {
      const loaded = await this.loadBackgroundPhoto(input.photoId);
      if (loaded) {
        // Build a NEW input object so we don't mutate the caller's object and
        // so downstream renderImage/computeCacheKey see the resolved buffer.
        input = { ...input, customPhotoBuffer: loaded };
      } else {
        // photoId expired or unknown — log and fall through (will render with
        // gradient instead of failing the whole request).
        this.logger.warn(
          `photoId ${input.photoId} not found in S3/Redis — falling back to no-photo render`,
        );
      }
    }

    // Validate custom photo if provided (after photoId resolution)
    if (input.customPhotoBuffer) {
      await this.validatePhotoBuffer(input.customPhotoBuffer);
    }
    mark.validate = Date.now() - tGen;

    const cacheKey = await this.computeCacheKey(input);
    mark.cacheKey = Date.now() - tGen;

    // ── Preview fast path: Redis cache (TTL 3 min) ──────────────────────────
    // Preview renders are cheap/low-res and only live in the modal — no need
    // for S3.  A Redis hit returns in ~2ms vs 200-500ms for a full canvas render.
    // Key is prefixed so it never collides with render-lock keys.
    if (config.preview) {
      try {
        const cached = await this.redis.getBuffer(`preview-img:${cacheKey}`);
        if (cached) {
          return {
            buffer: cached,
            fromCache: true,
            cacheKey,
            templateRequested: config.template,
            templateActual: config.template,
            fallback: false,
          };
        }
      } catch {
        // Redis unavailable — fall through to render
      }
    }

    // Full-res: S3 cache lookup gated by a Redis index flag.
    //
    // Why: S3 GET on cache miss costs ~600ms (full round-trip to AWS) and
    // returns 404 — pure waste. We set a Redis flag `s3idx:<key>=1` after
    // successful upload, so we can know in ~5ms whether S3 has the object
    // before paying for the GET. Cold renders skip the S3 GET entirely.
    if (!config.preview) {
      let s3HasIt = false;
      try {
        s3HasIt = (await this.redis.get(`s3idx:${cacheKey}`)) === '1';
      } catch {
        // Redis down — fall back to S3 GET (slow but correct)
        s3HasIt = true;
      }
      const cached = s3HasIt ? await this.tryFetchFromS3(cacheKey) : null;
      mark.s3Check = Date.now() - tGen;
      if (cached) {
        this.logger.log(
          `[generate] cache=hit validate=${mark.validate}ms key=${mark.cacheKey - mark.validate}ms s3Check=${mark.s3Check - mark.cacheKey}ms total=${Date.now() - tGen}ms`,
        );
        return {
          buffer: cached.buffer,
          fromCache: true,
          cacheKey,
          s3Url: cached.url,
          templateRequested: config.template,
          templateActual: config.template,
          fallback: false,
        };
      }
    }

    // Stampede protection — full-res only. Preview path skips the lock because:
    //   - Each render is fast (~300-500ms with cache)
    //   - Redis SETNX adds 50-150ms overhead per request — too much for the
    //     interactive template-switching UX
    //   - At our traffic level, occasional duplicate render is cheaper than
    //     the lock overhead on every request
    let haveLock = false;
    const lockKey = `render-lock:${cacheKey}`;
    if (!config.preview) {
      try {
        const acquired = await this.redis.set(
          lockKey,
          '1',
          'EX',
          RENDER_LOCK_TTL_SECONDS,
          'NX',
        );
        haveLock = acquired === 'OK';
      } catch {
        // Redis down — proceed anyway (no stampede protection, but still correct)
      }

      if (!haveLock) {
        // Another worker rendering the full-res — poll S3 for up to 10s
        for (let i = 0; i < 10; i++) {
          await sleep(1000);
          const cached = await this.tryFetchFromS3(cacheKey);
          if (cached) {
            return {
              buffer: cached.buffer,
              fromCache: true,
              cacheKey,
              s3Url: cached.url,
              templateRequested: config.template,
              templateActual: config.template,
              fallback: false,
            };
          }
        }
        // Give up — fall through and render ourselves
      }
    }

    try {
      mark.lock = Date.now() - tGen;
      // Render directly — no semaphore cap. Traffic volume is low and the
      // queueing overhead added latency without protecting against real OOM.
      const rendered = await this.renderImage(input);
      mark.render = Date.now() - tGen;

      // Upload to S3 (unless preview); cache preview in Redis.
      // S3 upload is fire-and-forget — the response already contains the buffer,
      // so blocking on upload only delays the user. By the time a second identical
      // request arrives, the upload should have completed and the cache hit path
      // works. If upload fails, next request just re-renders (still correct).
      // Lock release is also moved into the upload chain so it stays held until
      // the file is actually in S3 (otherwise stampede protection breaks).
      if (!config.preview) {
        const lockKeyOuter = lockKey;
        const haveLockOuter = haveLock;
        haveLock = false; // prevent finally{} from releasing prematurely
        this.uploadToS3(cacheKey, rendered.buffer)
          .then(() =>
            // Mark S3 as having this object so future requests skip the cache-miss
            // S3 GET round-trip. TTL matches S3 lifecycle (24h).
            this.redis
              .set(`s3idx:${cacheKey}`, '1', 'EX', S3_INDEX_TTL_SECONDS)
              .catch(() => {/* ignore — flag is best-effort */}),
          )
          .catch((err) => {
            this.logger.warn(`S3 upload failed for ${cacheKey}: ${err.message}`);
          })
          .finally(() => {
            if (haveLockOuter) {
              this.redis.del(lockKeyOuter).catch(() => {/* ignore */});
            }
          });
      } else {
        // Store preview in Redis (TTL 3 min, fire-and-forget)
        this.redis
          .set(`preview-img:${cacheKey}`, rendered.buffer, 'EX', 180)
          .catch(() => {/* Redis down — ignore */});
      }
      mark.upload = Date.now() - tGen;

      this.logger.log(
        `[generate] cache=miss validate=${mark.validate}ms key=${mark.cacheKey - mark.validate}ms ` +
          `s3Check=${(mark.s3Check ?? mark.cacheKey) - mark.cacheKey}ms lock=${mark.lock - (mark.s3Check ?? mark.cacheKey)}ms ` +
          `render=${mark.render - mark.lock}ms uploadKickoff=${mark.upload - mark.render}ms total=${Date.now() - tGen}ms ` +
          `bufKB=${Math.round(rendered.buffer.length / 1024)}`,
      );

      return {
        buffer: rendered.buffer,
        fromCache: false,
        cacheKey,
        // s3Url omitted — upload happens in background; first response returns buffer only
        templateRequested: config.template,
        templateActual: rendered.templateActual,
        fallback: rendered.fallback,
        fallbackReason: rendered.fallbackReason,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(
        `Render failed for ${input.raceId}/${input.bib}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    } finally {
      if (haveLock) {
        try {
          await this.redis.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    }
  }

  /**
   * Share counter. Returns current count.
   */
  async getShareCount(raceId: string): Promise<number> {
    try {
      const v = await this.redis.get(`share-count:${raceId}`);
      return v ? parseInt(v, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async incrementShareCount(raceId: string): Promise<number> {
    try {
      return await this.redis.incr(`share-count:${raceId}`);
    } catch (err) {
      this.logger.warn(`Share count incr failed: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Upload a background photo to S3, return a photoId the caller can reuse
   * across subsequent /result-image calls. Avoids re-uploading the same buffer
   * on every template/gradient/setting change.
   *
   * S3 lifecycle rule on `result-images/bg-uploads/` deletes after 24h.
   */
  async uploadBackgroundPhoto(buffer: Buffer): Promise<UploadBackgroundResult> {
    await this.validatePhotoBuffer(buffer);
    const photoId = crypto.randomUUID();
    const key = `${BG_UPLOADS_PREFIX}/${photoId}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        // Sniffed content type isn't critical here — we treat the bytes as opaque
        // image data and re-decode via @napi-rs/canvas, which auto-detects format.
        ContentType: 'application/octet-stream',
      }),
    );
    // Pre-warm Redis cache so the very first render with this photoId skips the
    // S3 round-trip — user almost always calls /result-image right after upload.
    this.redis
      .set(`bg-buf:${photoId}`, buffer, 'EX', BG_BUFFER_CACHE_TTL_SECONDS)
      .catch(() => {/* ignore */});

    const expiresAt = new Date(
      Date.now() + BG_UPLOAD_TTL_SECONDS * 1000,
    ).toISOString();
    return { photoId, expiresAt };
  }

  /**
   * Load a previously-uploaded background photo by photoId. Checks Redis cache
   * first (10min TTL), falls back to S3 GET. Returns null if photo expired or
   * never existed — caller should treat as "no custom photo".
   */
  private async loadBackgroundPhoto(photoId: string): Promise<Buffer | null> {
    if (!photoId || !/^[A-Za-z0-9-]{1,64}$/.test(photoId)) return null;

    try {
      const cached = await this.redis.getBuffer(`bg-buf:${photoId}`);
      if (cached) return cached;
    } catch {
      // Redis down — fall through to S3
    }

    try {
      const obj = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: `${BG_UPLOADS_PREFIX}/${photoId}`,
        }),
      );
      const body = obj.Body as NodeJS.ReadableStream | undefined;
      if (!body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      this.redis
        .set(`bg-buf:${photoId}`, buffer, 'EX', BG_BUFFER_CACHE_TTL_SECONDS)
        .catch(() => {/* ignore */});

      return buffer;
    } catch (err) {
      const code = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (code !== 404 && code !== 403) {
        this.logger.warn(
          `S3 GET bg-uploads/${photoId} failed: ${(err as Error).message}`,
        );
      }
      return null;
    }
  }

  // ─── Internals ──────────────────────────────────────────────

  private async registerFonts(): Promise<void> {
    try {
      const fontsDir = path.resolve(__dirname, '../../../../assets/fonts');
      const register = (file: string, family: string) => {
        const full = path.join(fontsDir, file);
        GlobalFonts.registerFromPath(full, family);
      };
      register('Inter-Regular.ttf', 'Inter');
      register('Inter-Bold.ttf', 'Inter');
      register('Inter-Black.ttf', 'Inter');
      register('BeVietnamPro-Regular.ttf', 'Be Vietnam Pro');
      register('BeVietnamPro-SemiBold.ttf', 'Be Vietnam Pro');
      register('BeVietnamPro-Bold.ttf', 'Be Vietnam Pro');
      register('BeVietnamPro-Black.ttf', 'Be Vietnam Pro');
      this.logger.log('Fonts registered: Inter + Be Vietnam Pro');
    } catch (err) {
      this.logger.error(
        `Font registration failed — renders will fall back to system fonts: ${(err as Error).message}`,
      );
    }
  }

  private async preloadLogo(): Promise<void> {
    try {
      const logoPath = path.resolve(
        __dirname,
        '../../../../assets/logo_5BIB_white.png',
      );
      this.logoBuffer = await fs.readFile(logoPath);
      this.logoImage = await loadImage(this.logoBuffer);
      this.logger.log('5BIB logo preloaded');
    } catch (err) {
      this.logger.warn(`Logo preload failed: ${(err as Error).message}`);
    }
  }

  /**
   * Compute a stable hash across all user-facing config + athlete result snapshot.
   * Used as S3 cache key.
   */
  private async computeCacheKey(input: GenerateImageInput): Promise<string> {
    const { config } = input;
    // Prefer photoId over hashing the buffer — photoId is already a unique ID
    // and avoids ~5–10ms md5 cost on every cacheKey computation.
    const photoHash = input.photoId
      ? input.photoId.slice(0, 16)
      : input.customPhotoBuffer
        ? crypto
            .createHash('md5')
            .update(input.customPhotoBuffer)
            .digest('hex')
            .slice(0, 12)
        : 'none';

    // Include ALL athlete fields the image depends on so cache invalidates
    // automatically when admin edits the result. `updatedAt` is the canonical
    // version tag — any edit bumps it. Other fields are defense-in-depth in
    // case updatedAt isn't propagated for some reason.
    const athleteSnapshot = {
      chip: input.athlete.ChipTime,
      gun: input.athlete.GunTime,
      overall: input.athlete.OverallRank,
      gender: input.athlete.GenderRank,
      cat: input.athlete.CatRank ?? '',
      pace: input.athlete.Pace,
      gap: input.athlete.Gap ?? '',
      name: input.athlete.Name,
      category: input.athlete.Category,
      dist: input.athlete.distance,
      v: input.athlete.updatedAt
        ? new Date(input.athlete.updatedAt).getTime()
        : 0,
    };

    const configHash = crypto
      .createHash('md5')
      .update(
        JSON.stringify({
          t: config.template,
          s: config.size,
          g: config.gradient,
          sp: config.showSplits,
          qr: config.showQrCode,
          bg: config.showBadges,
          m: config.customMessage ?? '',
          tc: config.textColor,
          ph: photoHash,
          as: athleteSnapshot,
        }),
      )
      .digest('hex')
      .slice(0, 16);

    return `${S3_CACHE_PREFIX}/${input.raceId}/${input.bib}/${config.template}-${config.size.replace(':', 'x')}-${configHash}.png`;
  }

  /**
   * Core render function — runs under semaphore.
   */
  private async renderImage(
    input: GenerateImageInput,
  ): Promise<{ buffer: Buffer; templateActual: string; fallback: boolean; fallbackReason?: string }> {
    const { config } = input;
    const dims = config.preview
      ? PREVIEW_DIMENSIONS[config.size]
      : SIZE_DIMENSIONS[config.size];

    const canvas = createCanvas(dims.width, dims.height);
    const ctx = canvas.getContext('2d');

    // QR needs a race slug — skip silently if empty (prevents generating a
    // broken URL like https://result.5bib.com/races//{bib} when the race
    // doc has no slug or races service lookup failed).
    const canRenderQr = config.showQrCode && !!input.raceSlug;
    if (config.showQrCode && !input.raceSlug) {
      this.logger.warn(
        `QR skipped for race=${input.raceId} bib=${input.bib}: empty raceSlug`,
      );
    }

    // Profiling: time each asset load individually (still parallel) + render + encode.
    // Logs printed at end of renderImage so each request shows where time went.
    const tStart = Date.now();
    const timings: { badges?: number; photo?: number; qr?: number } = {};

    // Use prefetched badges promise if caller kicked it off earlier (controller-side
     // parallelization). Falls back to a fresh detect call otherwise.
    const badgesP = config.showBadges
      ? (input.prefetchedBadges ??
          this.badgeService.detectBadges(input.raceId, input.bib)
        ).then((r) => {
          timings.badges = Date.now() - tStart;
          return r;
        })
      : Promise.resolve([] as Badge[]);

    const photoP = input.customPhotoBuffer
      ? loadImage(input.customPhotoBuffer)
          .then((r) => {
            timings.photo = Date.now() - tStart;
            return r;
          })
          .catch(() => {
            timings.photo = Date.now() - tStart;
            return null;
          })
      : Promise.resolve(null);

    const qrP = canRenderQr
      ? this.generateQrImage(
          `${this.resultBaseUrl}/races/${input.raceSlug}/${input.bib}`,
        ).then((r) => {
          timings.qr = Date.now() - tStart;
          return r;
        })
      : Promise.resolve(null);

    const [badges, customPhoto, qrImage] = await Promise.all([
      badgesP,
      photoP,
      qrP,
    ]);
    const tAssets = Date.now();

    const renderData: RenderData = {
      athleteName: input.athlete.Name,
      bib: input.athlete.Bib,
      chipTime: input.athlete.ChipTime,
      gunTime: input.athlete.GunTime,
      pace: input.athlete.Pace,
      overallRank: input.athlete.OverallRank,
      totalFinishers: input.totalFinishers ?? 0,
      genderRank: input.athlete.GenderRank,
      categoryRank: input.athlete.CatRank ?? '',
      category: input.athlete.Category,
      gender: input.athlete.Gender,
      gap: input.athlete.Gap ?? '',
      distance: input.athlete.distance,

      raceName: input.raceName,
      raceSlug: input.raceSlug,
      courseName: input.courseName,

      splits: input.athlete.splits,
      badges,
      customMessage: config.customMessage,

      resultUrl: input.raceSlug
        ? `${this.resultBaseUrl}/races/${input.raceSlug}/${input.bib}`
        : `${this.resultBaseUrl}/races/${input.raceId}/${input.bib}`,
      textColorScheme: config.textColor === 'light' ? 'light' : 'dark',

      template: config.template,
      size: config.size,
      canvasWidth: dims.width,
      canvasHeight: dims.height,
      preview: config.preview,

      gradientPreset: config.gradient,
      customPhoto: customPhoto ?? undefined,
      qrImage: qrImage ?? undefined,

      assets: {
        logo5BIB: this.logoImage,
        fontFamily: 'Be Vietnam Pro',
        monoFontFamily: 'Inter',
      },

      showSplits: config.showSplits,
      showQrCode: canRenderQr && !!qrImage,
      showBadges: config.showBadges,
      textColorMode: config.textColor,
    };

    const resolved = resolveTemplateResult(config.template, renderData);
    await resolved.template.render(ctx, renderData);
    const tRender = Date.now();

    // Preview → JPEG quality 85 (encodes 3-5× faster than PNG, ~50% smaller).
    // Full-res → PNG (preserves crispness for download/share).
    // Quality 85 is visually indistinguishable from PNG for screen previews
    // and the smaller payload also speeds up wire transfer.
    const buffer = config.preview
      ? Buffer.from(canvas.toBuffer('image/jpeg', 85))
      : Buffer.from(canvas.toBuffer('image/png'));
    const tEncode = Date.now();

    const photoKB = input.customPhotoBuffer
      ? Math.round(input.customPhotoBuffer.length / 1024)
      : 0;
    this.logger.log(
      `[render] badges=${timings.badges ?? 0}ms photo=${timings.photo ?? 0}ms qr=${timings.qr ?? 0}ms ` +
        `assets=${tAssets - tStart}ms render=${tRender - tAssets}ms encode=${tEncode - tRender}ms ` +
        `total=${tEncode - tStart}ms tpl=${resolved.template.name} dims=${dims.width}x${dims.height} ` +
        `format=${config.preview ? 'jpeg' : 'png'} bufKB=${Math.round(buffer.length / 1024)} ` +
        `photoKB=${photoKB} bib=${input.bib}`,
    );

    return {
      buffer,
      templateActual: resolved.template.name,
      fallback: resolved.fallback,
      fallbackReason: resolved.reason,
    };
  }

  private async generateQrImage(url: string): Promise<Image | null> {
    try {
      const buffer = await QRCode.toBuffer(url, {
        width: 240,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      return await loadImage(buffer);
    } catch (err) {
      this.logger.warn(`QR generation failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async validatePhotoBuffer(buffer: Buffer): Promise<void> {
    if (buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Ảnh vượt quá 10MB');
    }
    if (!isAllowedImageMagicBytes(buffer)) {
      throw new BadRequestException('Chỉ chấp nhận JPG, PNG, WEBP');
    }
  }

  // ─── S3 layer ───────────────────────────────────────────────

  private async tryFetchFromS3(
    key: string,
  ): Promise<{ buffer: Buffer; url: string } | null> {
    // Single GET request — avoids the HEAD+GET double round-trip (2× S3 API
    // calls per cache miss under load). 404/403 = cache miss, anything else logs.
    try {
      const obj = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = obj.Body as NodeJS.ReadableStream | undefined;
      if (!body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      const url = await this.getPresignedUrl(key);
      return { buffer, url };
    } catch (err) {
      const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (code !== 404 && code !== 403) {
        // Unexpected error (network, permissions, etc.) — log for visibility
        this.logger.warn(`S3 GET failed for ${key}: ${(err as Error).message}`);
      }
      return null;
    }
  }

  private async uploadToS3(key: string, buffer: Buffer): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=86400', // 24h
      }),
    );
    return this.getPresignedUrl(key);
  }

  private getPresignedUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: S3_PRESIGN_EXPIRES_SECONDS },
    );
  }

  // ─── Backward-compat legacy entrypoint ───────────────────────

  /**
   * DEPRECATED — kept so the old controller signature still compiles until frontend
   * migrates to the new flow. Routes to `generate()` with a minimal DTO translation.
   */
  async generateImage(
    athlete: {
      Name: string;
      Bib: string;
      ChipTime: string;
      GunTime: string;
      Pace: string;
      Gap: string;
      Gender: string;
      Category: string;
      OverallRank: string;
      GenderRank: string;
      CatRank: string;
      distance: string;
      race_name: string;
    },
    bgKey: string,
    customBgBuffer?: Buffer,
    ratio: '4:5' | '1:1' | '9:16' = '4:5',
    raceId = 'legacy',
    raceSlug = 'legacy',
  ): Promise<Buffer> {
    const dto: ResultImageQueryDto = {
      template: 'classic',
      size: ratio,
      gradient: ['blue', 'dark', 'sunset', 'forest', 'purple'].includes(bgKey)
        ? (bgKey as 'blue' | 'dark' | 'sunset' | 'forest' | 'purple')
        : 'blue',
      showBadges: false,
      showSplits: false,
      showQrCode: false,
      textColor: 'auto',
      preview: false,
    };
    const config = normalizeImageConfig(dto);
    const result = await this.generate({
      raceId,
      bib: athlete.Bib,
      athlete: {
        Name: athlete.Name,
        Bib: athlete.Bib,
        ChipTime: athlete.ChipTime,
        GunTime: athlete.GunTime,
        Pace: athlete.Pace,
        Gap: athlete.Gap,
        Gender: athlete.Gender,
        Category: athlete.Category,
        OverallRank: athlete.OverallRank,
        GenderRank: athlete.GenderRank,
        CatRank: athlete.CatRank,
        distance: athlete.distance,
      },
      raceName: athlete.race_name,
      raceSlug,
      config,
      customPhotoBuffer: customBgBuffer,
    });
    return result.buffer;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
