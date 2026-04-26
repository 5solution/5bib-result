import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
// sharp is CJS with module.exports = fn. Without esModuleInterop our
// default-import compiles to `sharp_1.default` → undefined at runtime.
import sharp = require('sharp');
import { env } from 'src/config';
import type { PhotoType } from '../dto/upload-photo.dto';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Detect image type from magic bytes — don't trust the Content-Type header. */
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
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
    return 'image/png';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class TeamPhotoService {
  private readonly logger = new Logger(TeamPhotoService.name);
  private readonly bucket = env.teamManagement.s3Bucket;
  private readonly region = env.s3.region;

  constructor(private readonly s3: S3Client) {}

  async upload(
    file: Express.Multer.File,
    photoType: PhotoType,
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded (field name must be "file")');
    }
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException('File larger than 5MB');
    }

    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || !ACCEPTED_MIME.has(detectedMime)) {
      throw new UnsupportedMediaTypeException(
        `Only jpeg/png/webp allowed (detected: ${detectedMime ?? 'unknown'})`,
      );
    }

    const pipeline = sharp(file.buffer).rotate();
    let processed: Buffer;
    if (photoType === 'avatar') {
      processed = await pipeline
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } else if (photoType === 'benefits') {
      // Benefits banner: wide, keep detail legible (poster with pricing
      // lists, gift images, etc.). Cap longest side at 1600px.
      processed = await pipeline
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } else {
      // CCCD: keep legible quality, cap longest side at 1600px.
      processed = await pipeline
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();
    }

    // Route cccd_back to the same private prefix as cccd so the existing
    // bucket policy (Block Public Access on team-photos/cccd/*) covers both
    // — no need to add a new policy line for cccd_back.
    const prefix = photoType === 'cccd_back' ? 'cccd' : photoType;
    const key = `team-photos/${prefix}/${uuidv4()}.webp`;
    // NOTE: Do NOT set object ACL. Most S3 buckets have Block Public Access
    // enabled and will reject `public-read`. Access is controlled by bucket
    // policy configured out-of-band:
    //   - `team-photos/avatar/*`     → public GET allowed via bucket policy
    //   - `team-photos/cccd/*`       → private; served via presignCccd() only
    //                                  (covers both cccd front + cccd_back)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: 'image/webp',
      }),
    );

    const url =
      photoType === 'avatar' || photoType === 'benefits'
        ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
        : key;
    this.logger.log(`Uploaded ${photoType} photo → ${key}`);
    return { url, key };
  }

  /** Return a short-lived presigned URL for a private CCCD photo. */
  async presignCccd(keyOrUrl: string, ttlSeconds = 3600): Promise<string> {
    const key = keyOrUrl.startsWith('team-photos/')
      ? keyOrUrl
      : this.extractKeyFromUrl(keyOrUrl);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  private extractKeyFromUrl(url: string): string {
    const marker = `${this.bucket}.s3.`;
    const idx = url.indexOf(marker);
    if (idx < 0) return url;
    return url.substring(url.indexOf('/', idx + marker.length) + 1);
  }
}
