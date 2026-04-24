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
  HeadObjectCommand,
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
import { resolveTemplate } from '../templates';
import type {
  RenderData,
  Badge,
  SplitData,
} from '../templates/types';
import { SIZE_DIMENSIONS, PREVIEW_DIMENSIONS } from '../templates/types';
import { BadgeService } from './badge.service';
import { RenderSemaphore } from './render-semaphore';

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
const RENDER_LOCK_TTL_SECONDS = 30;
const S3_PRESIGN_EXPIRES_SECONDS = 3600;

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
    private readonly semaphore: RenderSemaphore,
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

    // Validate custom photo if provided
    if (input.customPhotoBuffer) {
      await this.validatePhotoBuffer(input.customPhotoBuffer);
    }

    const cacheKey = await this.computeCacheKey(input);

    // Preview mode: skip S3 cache (cheap, low-res, short-lived)
    if (!config.preview) {
      const cached = await this.tryFetchFromS3(cacheKey);
      if (cached) {
        return { buffer: cached.buffer, fromCache: true, cacheKey, s3Url: cached.url };
      }
    }

    // Stampede protection — check if another worker is rendering the same config
    const lockKey = `render-lock:${cacheKey}`;
    let haveLock = false;
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
        // Redis down — proceed anyway
      }

      if (!haveLock) {
        // Another worker rendering — poll S3 for up to 10s
        for (let i = 0; i < 10; i++) {
          await sleep(1000);
          const cached = await this.tryFetchFromS3(cacheKey);
          if (cached) {
            return {
              buffer: cached.buffer,
              fromCache: true,
              cacheKey,
              s3Url: cached.url,
            };
          }
        }
        // Give up — fall through and render ourselves
      }
    }

    try {
      // Run render under semaphore (caps concurrent canvas renders)
      const buffer = await this.semaphore.run(() => this.renderImage(input));

      // Upload to S3 (unless preview)
      let s3Url: string | undefined;
      if (!config.preview) {
        s3Url = await this.uploadToS3(cacheKey, buffer).catch((err) => {
          this.logger.warn(`S3 upload failed for ${cacheKey}: ${err.message}`);
          return undefined;
        });
      }

      return { buffer, fromCache: false, cacheKey, s3Url };
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
    const photoHash = input.customPhotoBuffer
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
  private async renderImage(input: GenerateImageInput): Promise<Buffer> {
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

    // Load assets in parallel
    const [badges, customPhoto, qrImage] = await Promise.all([
      config.showBadges
        ? this.badgeService.detectBadges(input.raceId, input.bib)
        : Promise.resolve([] as Badge[]),
      input.customPhotoBuffer
        ? loadImage(input.customPhotoBuffer).catch(() => null)
        : Promise.resolve(null),
      canRenderQr
        ? this.generateQrImage(
            `${this.resultBaseUrl}/races/${input.raceSlug}/${input.bib}`,
          )
        : Promise.resolve(null),
    ]);

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

    const template = resolveTemplate(config.template, renderData);
    await template.render(ctx, renderData);

    return Buffer.from(canvas.toBuffer('image/png'));
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
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // 404 is expected for cache miss — don't log
      const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (code !== 404 && code !== 403) {
        this.logger.warn(
          `S3 HEAD unexpected error for ${key}: ${(err as Error).message}`,
        );
      }
      return null;
    }
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
      this.logger.warn(`S3 GET failed for ${key}: ${(err as Error).message}`);
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
