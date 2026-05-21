/**
 * FEATURE-047 Phase 1B — Athlete Photo upload + EXIF strip + S3 + moderation.
 *
 * BR-47-11..18 implementation.
 *
 * **Sharp EXIF strip pattern** (reused from team-photo.service.ts:78):
 *   `sharp(buffer).rotate()` — auto-rotate by EXIF then DROP all metadata.
 *
 * **Magic bytes validation** — defense beyond Content-Type header trust.
 *
 * **Manager Adjustment #11 — Signed URL 24h TTL** (supersedes BR-47-15 direct
 * public). Prevents bulk-scrape via slug enumeration. NO public bucket policy
 * for `athlete-photos/` prefix.
 *
 * Anti-spam: 10 pending per athleteSlug (BR-47-14).
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp = require('sharp');

import {
  AthletePhoto,
  AthletePhotoDocument,
  AthletePhotoType,
} from '../schemas/athlete-photo.schema';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PENDING_PER_SLUG = 10;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SIGNED_URL_TTL_SEC = 86400; // 24h Adjustment #11
const S3_PREFIX = 'athlete-photos';

/** Detect mime from magic bytes (don't trust client Content-Type). */
function detectImageMime(
  buf: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
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
    return 'image/png';
  }
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class AthletePhotoService {
  private readonly logger = new Logger(AthletePhotoService.name);
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    @InjectModel(AthletePhoto.name)
    private readonly photoModel: Model<AthletePhotoDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly s3: S3Client,
  ) {
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.region = process.env.AWS_REGION ?? 'ap-southeast-1';
  }

  /**
   * BR-47-11..14: upload + EXIF strip + S3 store + pending status.
   * Caller MUST verify user is authenticated (LogtoAuthGuard at controller).
   */
  async uploadPhoto(
    athleteSlug: string,
    file: Express.Multer.File,
    type: AthletePhotoType,
    uploadedByUserId: string,
    raceId?: string,
    bib?: string,
  ): Promise<{ id: string; status: 'pending' }> {
    if (!file?.buffer) {
      throw new BadRequestException('Không có file (field "file" bắt buộc)');
    }
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException('File vượt quá 5MB');
    }

    // Magic bytes validation (defense beyond header)
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || !ACCEPTED_MIME.has(detectedMime)) {
      throw new UnsupportedMediaTypeException(
        `Chỉ chấp nhận JPEG/PNG/WebP (detected: ${detectedMime ?? 'unknown'})`,
      );
    }

    // Anti-spam: max 10 pending per slug
    const pendingCount = await this.photoModel.countDocuments({
      athleteSlug,
      status: 'pending',
    });
    if (pendingCount >= MAX_PENDING_PER_SLUG) {
      throw new ConflictException(
        `Bạn đã có ${MAX_PENDING_PER_SLUG} ảnh đang chờ duyệt — vui lòng chờ admin duyệt trước khi upload thêm`,
      );
    }

    // EXIF strip via sharp().rotate() → output webp normalized
    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .rotate() // auto-rotate by EXIF then drop all metadata
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      this.logger.warn(
        `[uploadPhoto] sharp processing failed: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'Không xử lý được ảnh — file có thể bị hỏng',
      );
    }

    // S3 upload — NO public ACL (Adjustment #11 signed URL only)
    const photoId = uuidv4();
    const s3Key = `${S3_PREFIX}/${athleteSlug}/${photoId}.webp`;
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: processed,
          ContentType: 'image/webp',
          // NO ACL — bucket policy must NOT make this prefix public
        }),
      );
    } catch (err) {
      this.logger.error(
        `[uploadPhoto] S3 PUT failed: ${(err as Error).message}`,
      );
      throw new BadRequestException('Tải ảnh lên S3 thất bại — thử lại sau');
    }

    // MongoDB insert (status=pending)
    const created = await this.photoModel.create({
      athleteSlug,
      type,
      s3Key,
      mime: 'image/webp', // normalized via sharp output
      sizeBytes: processed.length,
      status: 'pending',
      uploadedByUserId,
      raceId,
      bib,
      exifStripped: true,
    });

    // Increment admin badge counter
    await this.safeRedisIncr('athlete:photo:pending-count');

    return { id: String(created._id), status: 'pending' };
  }

  /**
   * BR-47-16: public read returns ONLY approved photos. Adjustment #11 signed URL.
   */
  async getApprovedPhotos(athleteSlug: string): Promise<
    Array<{
      id: string;
      type: AthletePhotoType;
      s3Url: string;
      raceId?: string;
      bib?: string;
      uploadedAt: string;
    }>
  > {
    const photos = await this.photoModel
      .find({ athleteSlug, status: 'approved' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const result = await Promise.all(
      photos.map(async (p) => ({
        id: String(p._id),
        type: p.type,
        s3Url: await this.getSignedUrlForKey(p.s3Key),
        raceId: p.raceId,
        bib: p.bib,
        uploadedAt: (p.createdAt ?? new Date()).toISOString(),
      })),
    );
    return result;
  }

  /** Admin moderation queue (paginated). LogtoAdminGuard at controller. */
  async getPendingQueue(
    page = 1,
    limit = 20,
  ): Promise<{
    items: Array<{
      id: string;
      athleteSlug: string;
      type: AthletePhotoType;
      signedUrl: string;
      mime: string;
      sizeBytes: number;
      uploadedAt: string;
      raceId?: string;
      bib?: string;
    }>;
    total: number;
  }> {
    const skip = Math.max(0, (page - 1) * limit);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const [photos, total] = await Promise.all([
      this.photoModel
        .find({ status: 'pending' })
        .sort({ createdAt: 1 }) // FIFO oldest first
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.photoModel.countDocuments({ status: 'pending' }),
    ]);

    const items = await Promise.all(
      photos.map(async (p) => ({
        id: String(p._id),
        athleteSlug: p.athleteSlug,
        type: p.type,
        signedUrl: await this.getSignedUrlForKey(p.s3Key),
        mime: p.mime,
        sizeBytes: p.sizeBytes,
        uploadedAt: (p.createdAt ?? new Date()).toISOString(),
        raceId: p.raceId,
        bib: p.bib,
      })),
    );

    return { items, total };
  }

  /** Approve photo — atomic state transition. */
  async approve(
    photoId: string,
    adminUserId: string,
  ): Promise<{ id: string; status: 'approved'; athleteSlug: string }> {
    const updated = await this.photoModel.findOneAndUpdate(
      { _id: photoId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          moderatedBy: adminUserId,
          moderatedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!updated) {
      throw new ConflictException(
        'Ảnh không tồn tại hoặc đã được duyệt/từ chối bởi admin khác',
      );
    }

    // Decrement pending counter
    await this.safeRedisDecr('athlete:photo:pending-count');
    // Invalidate athlete profile cache (force photos refresh on next read)
    await this.safeRedisDel(`athlete:profile:${updated.athleteSlug}`);

    this.logger.log(
      `[approve] photoId=${photoId} slug=${updated.athleteSlug} admin=${adminUserId}`,
    );
    return {
      id: String(updated._id),
      status: 'approved',
      athleteSlug: updated.athleteSlug,
    };
  }

  /** Reject photo — atomic with reason. */
  async reject(
    photoId: string,
    adminUserId: string,
    reason?: string,
  ): Promise<{ id: string; status: 'rejected'; athleteSlug: string }> {
    const updated = await this.photoModel.findOneAndUpdate(
      { _id: photoId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          moderatedBy: adminUserId,
          moderatedAt: new Date(),
          rejectionReason: reason,
        },
      },
      { new: true },
    );
    if (!updated) {
      throw new ConflictException(
        'Ảnh không tồn tại hoặc đã được duyệt/từ chối bởi admin khác',
      );
    }

    await this.safeRedisDecr('athlete:photo:pending-count');
    await this.safeRedisDel(`athlete:profile:${updated.athleteSlug}`);

    this.logger.log(
      `[reject] photoId=${photoId} slug=${updated.athleteSlug} admin=${adminUserId} reason=${reason ?? '<none>'}`,
    );
    return {
      id: String(updated._id),
      status: 'rejected',
      athleteSlug: updated.athleteSlug,
    };
  }

  /** Admin badge: count pending across all slugs. */
  async getPendingCount(): Promise<number> {
    try {
      const cached = await this.redis.get('athlete:photo:pending-count');
      if (cached !== null) return parseInt(cached, 10) || 0;
    } catch {
      /* fall through */
    }
    const count = await this.photoModel.countDocuments({ status: 'pending' });
    await this.safeRedisSet('athlete:photo:pending-count', String(count), 60);
    return count;
  }

  /**
   * Adjustment #11 — Signed URL 24h TTL. Caller must ensure photo is approved.
   */
  async getSignedUrlForKey(s3Key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
        { expiresIn: SIGNED_URL_TTL_SEC },
      );
    } catch (err) {
      this.logger.warn(
        `[getSignedUrlForKey] failed key=${s3Key}: ${(err as Error).message}`,
      );
      return '';
    }
  }

  // ─── Redis safe wrappers ───────────────────────────────────────────────

  private async safeRedisIncr(key: string): Promise<void> {
    try {
      await this.redis.incr(key);
    } catch (err) {
      this.logger.warn(`[redis.incr] failed: ${(err as Error).message}`);
    }
  }

  private async safeRedisDecr(key: string): Promise<void> {
    try {
      const v = await this.redis.decr(key);
      if (v < 0) await this.redis.set(key, '0');
    } catch (err) {
      this.logger.warn(`[redis.decr] failed: ${(err as Error).message}`);
    }
  }

  private async safeRedisSet(
    key: string,
    value: string,
    ttl?: number,
  ): Promise<void> {
    try {
      if (ttl) await this.redis.setex(key, ttl, value);
      else await this.redis.set(key, value);
    } catch (err) {
      this.logger.warn(`[redis.set] failed: ${(err as Error).message}`);
    }
  }

  private async safeRedisDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`[redis.del] failed: ${(err as Error).message}`);
    }
  }
}

// Re-export magic-bytes detector for unit tests
export { detectImageMime };
