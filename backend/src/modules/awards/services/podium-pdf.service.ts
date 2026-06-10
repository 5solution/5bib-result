import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createCanvas } from '@napi-rs/canvas';
import { env } from 'src/config';
import {
  PDF_HARD_TIMEOUT_MS,
  PDF_BATCH_WARNING_THRESHOLD,
} from '../constants/awards-thresholds';
import { PodiumDocument } from '../schemas/podium.schema';
import { PdfExportOptionsDto, PodiumPdfResponseDto } from '../dto/pdf-export-options.dto';
import { nowIctDateString } from '../../../common/utils/ict-date.util';

const PAGE_WIDTH = 2480;
const PAGE_HEIGHT = 3508;
const MARGIN = 160;
const SIGNED_URL_TTL = 15 * 60;
const UPLOAD_URL_TTL = 5 * 60;

function escapeText(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, 500);
}

/**
 * F-019 BR-AG-33 + BR-AG-35 — Phase 1 sync PDF generation.
 *
 * Pattern verbatim port từ F-018 PdfGeneratorService:
 *  - @napi-rs/canvas A4 portrait 2480×3508
 *  - Promise.race 30s timeout (BR-AG-33)
 *  - S3 PUT prefix `awards-pdf/` (Lifecycle Rule 5 — KHÔNG mix với result-images/)
 *  - getSignedUrl 15min READ TTL
 *  - HTML-escape user content
 *  - Phase 1 PNG-as-PDF placeholder; Phase 2 swap pdf-lib (shape unchanged)
 */
@Injectable()
export class PodiumPdfService {
  private readonly logger = new Logger(PodiumPdfService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.s3 = new S3Client({
      region: env.s3.region,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
    this.bucket = env.s3.bucket;
  }

  /**
   * Generate PDF for ONE podium document. BR-AG-34 cardinality warning surfaced
   * when caller signals batch > 50 by passing `batchSize`.
   */
  async generatePdf(
    podium: PodiumDocument,
    options: PdfExportOptionsDto = {},
    batchSize = 1,
  ): Promise<PodiumPdfResponseDto> {
    if (!podium) throw new BadRequestException('Podium document required');
    const start = Date.now();
    const warning =
      batchSize > PDF_BATCH_WARNING_THRESHOLD
        ? `Batch lớn (${batchSize} files) — Phase 1 generate on-demand only, không auto-batch. Recommend export per-cự-ly.`
        : undefined;

    const buf = await Promise.race([
      this.renderCanvas(podium, options),
      new Promise<Buffer>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ServiceUnavailableException(
                'Tạo PDF timeout (>30s) — thử lại với batch nhỏ hơn',
              ),
            ),
          PDF_HARD_TIMEOUT_MS,
        ),
      ),
    ]);

    const ts = Date.now();
    const s3Key = `awards-pdf/${podium.raceId}/${podium.courseId}/${ts}-podium.pdf`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buf,
        ContentType: 'application/pdf',
        Metadata: {
          podiumId: String((podium as unknown as { _id: { toString(): string } })._id ?? ''),
          ageGroupKey: podium.ageGroupKey,
          gender: podium.gender,
        },
      }),
    );

    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: SIGNED_URL_TTL },
    );

    this.logger.log(
      `[awards-pdf] race=${podium.raceId} course=${podium.courseId} ag=${podium.ageGroupKey} bytes=${buf.length} ms=${Date.now() - start}`,
    );

    return {
      s3Key,
      signedUrl,
      expiresAtIso: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
      bytes: buf.length,
      generatedAt: new Date(ts).toISOString(),
      warning,
    };
  }

  private async renderCanvas(
    podium: PodiumDocument,
    options: PdfExportOptionsDto,
  ): Promise<Buffer> {
    const canvas = createCanvas(PAGE_WIDTH, PAGE_HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('LỄ TRAO GIẢI THEO NHÓM TUỔI', MARGIN, MARGIN + 80);

    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#57534e';
    ctx.fillText(
      `Race: ${escapeText(podium.raceId)}`,
      MARGIN,
      MARGIN + 140,
    );
    ctx.fillText(
      `Cự ly: ${escapeText(podium.courseName)}${
        podium.courseDistanceKm ? ` (${podium.courseDistanceKm}km)` : ''
      }`,
      MARGIN,
      MARGIN + 190,
    );
    ctx.fillText(
      `Nhóm tuổi: ${escapeText(podium.ageGroupLabel)}`,
      MARGIN,
      MARGIN + 240,
    );
    ctx.fillText(
      `Tạo lúc: ${new Date().toISOString().slice(0, 19)} UTC`,
      MARGIN,
      MARGIN + 290,
    );
    ctx.fillText(
      `Trạng thái: ${podium.state}`,
      MARGIN,
      MARGIN + 340,
    );

    // Top N athletes.
    let y = MARGIN + 440;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#1c1917';
    ctx.fillText('Top vận động viên:', MARGIN, y);
    y += 60;

    ctx.font = '32px sans-serif';
    if (!podium.athletes.length) {
      ctx.fillStyle = '#a8a29e';
      ctx.fillText('(Chưa có athlete nào trong AG này)', MARGIN, y);
    } else {
      for (const a of podium.athletes) {
        ctx.fillStyle = a.rank <= 3 ? '#1c1917' : '#57534e';
        ctx.font = a.rank <= 3 ? 'bold 36px sans-serif' : '32px sans-serif';
        const medal =
          a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : `#${a.rank}`;
        const tieBadge = a.tied ? ' (ex-aequo)' : '';
        const line = `${medal} ${escapeText(a.name)} — BIB ${escapeText(a.bib)} — ${escapeText(a.chipTime ?? '')}${tieBadge}`;
        ctx.fillText(line, MARGIN, y);
        y += 50;
        if (y > PAGE_HEIGHT - MARGIN - 320) break;
      }
    }

    // Signature block (BR-AG-35 — Phase 1 typed name).
    if (options.includeSignatureLine !== false) {
      const sigY = PAGE_HEIGHT - MARGIN - 240;
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#1c1917';
      ctx.fillText('Trưởng ban giám sát (Chief Referee):', MARGIN, sigY);
      ctx.font = '26px sans-serif';
      ctx.fillStyle = '#a8a29e';
      ctx.fillText('______________________________', MARGIN, sigY + 60);
      ctx.fillText(
        `Ký tên & ghi rõ họ tên — ${nowIctDateString()}`,
        MARGIN,
        sigY + 110,
      );
    }

    if (options.includeWatermark !== false) {
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#a8a29e';
      ctx.fillText(
        'F-019 Awards Age Group Podium — 5BIB',
        MARGIN,
        PAGE_HEIGHT - MARGIN + 20,
      );
    }

    return canvas.toBuffer('image/png');
  }

  /** Issue signed PUT URL for client-side direct upload (Phase 2 evidence). */
  async signUploadUrl(
    raceId: string,
    courseId: string,
    mime: string,
  ): Promise<{ signedUrl: string; s3Key: string; expiresAtIso: string }> {
    const ts = Date.now();
    const ext = mime === 'application/pdf' ? 'pdf' : 'png';
    const s3Key = `awards-pdf/${raceId}/${courseId}/${ts}-podium-evidence.${ext}`;
    const signedUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: mime,
      }),
      { expiresIn: UPLOAD_URL_TTL },
    );
    return {
      signedUrl,
      s3Key,
      expiresAtIso: new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString(),
    };
  }
}
