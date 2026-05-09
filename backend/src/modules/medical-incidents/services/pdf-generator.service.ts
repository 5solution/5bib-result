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
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { env } from 'src/config';
import { MedicalIncidentDocument } from '../schemas/medical-incident.schema';
import { PdfExportResponseDto } from '../dto/incident-response.dto';
import { PdfExportOptionsDto } from '../dto/pdf-export-options.dto';

/**
 * F-018 BR-MI-29..30 — PDF generator (Phase 1 simple readable, advisory MI-11).
 *
 * Reuses `@napi-rs/canvas` pattern from `result-image.service.ts`. Output is
 * a 2480×3508 (A4 @ 300dpi) PNG buffer — Phase 1 we ship PNG-as-PDF placeholder
 * (frontend converts to PDF on print). Phase 2 will swap in pdf-lib for true
 * multi-page A4 PDF; pattern shape unchanged.
 *
 * F-018 A5 — synchronous Phase 1 with 30s timeout + UX warning for >50 batch.
 *
 * Security:
 *  - HTML-escape all user content before fillText (XSS via PDF reader)
 *  - canvas.fillText only — no PDF metadata interpolation (CVE class)
 */
const PAGE_WIDTH = 2480; // A4 portrait @ 300dpi
const PAGE_HEIGHT = 3508;
const MARGIN = 160;
const BATCH_WARN_THRESHOLD = 50;
const BATCH_HARD_TIMEOUT_MS = 30_000;
const SIGNED_URL_TTL = 15 * 60; // 15min read

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Nhe (1) - So cuu tai cho',
  2: 'Trung binh (2) - Can y ta',
  3: 'Nghiem trong (3) - Leu y te',
  4: 'Nang (4) - Chuyen vien',
  5: 'Nguy kich (5) - Hoi suc cap cuu',
};

const STATE_LABELS: Record<string, string> = {
  REPORTED: 'Da ghi nhan',
  MEDIC_DISPATCHED: 'Da dieu y te',
  MEDIC_ON_SITE: 'Y te da den',
  AMB_REQUESTED: 'Da goi cap cuu',
  HOSPITAL_TRANSFER: 'Da chuyen vien',
  RESOLVED_ONSITE: 'Da xu ly tai cho',
  RESOLVED_DNF: 'Da xu ly - DNF',
  CLOSED: 'Da dong',
};

function escapeText(s: string | undefined): string {
  if (!s) return '';
  // Strip control chars + cap length so a single rogue field can't blow up canvas.
  return s.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, 500);
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
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
   * Generate PDF from list of incidents. Returns S3 key + signed URL.
   *
   * F-018 A5 — sync Phase 1; surfaces `warning` field when >50 incidents.
   * Caller wraps in race timeout (controller).
   */
  async generatePdf(
    raceId: string,
    incidents: MedicalIncidentDocument[],
    options: PdfExportOptionsDto = {},
  ): Promise<PdfExportResponseDto> {
    if (incidents.length === 0) {
      throw new BadRequestException('Khong co su co nao de xuat bao cao');
    }

    const start = Date.now();
    const warning =
      incidents.length > BATCH_WARN_THRESHOLD
        ? `Bao cao ${incidents.length} su co - co the mat den 30s`
        : undefined;

    // Race promise vs hard timeout.
    const buf = await Promise.race([
      this.renderCanvas(raceId, incidents, options),
      new Promise<Buffer>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ServiceUnavailableException(
                'PDF generation timed out (>30s) - thu lai voi batch nho hon',
              ),
            ),
          BATCH_HARD_TIMEOUT_MS,
        ),
      ),
    ]);

    const ts = Date.now();
    const s3Key = `medical-reports/${raceId}/${ts}.png`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buf,
        ContentType: 'image/png',
        // Default access — bucket policy decides. Signed URLs only.
      }),
    );

    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: SIGNED_URL_TTL },
    );

    this.logger.log(
      `[pdf] race=${raceId} count=${incidents.length} bytes=${buf.length} ms=${
        Date.now() - start
      }`,
    );

    return {
      s3Key,
      signedUrl,
      expiresAtIso: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
      incidentCount: incidents.length,
      warning,
    };
  }

  private async renderCanvas(
    raceId: string,
    incidents: MedicalIncidentDocument[],
    options: PdfExportOptionsDto,
  ): Promise<Buffer> {
    const canvas = createCanvas(PAGE_WIDTH, PAGE_HEIGHT);
    const ctx = canvas.getContext('2d');

    // White background.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Header.
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('BAO CAO Y TE CUOC DUA', MARGIN, MARGIN + 80);

    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#57534e';
    ctx.fillText(`Race: ${escapeText(raceId)}`, MARGIN, MARGIN + 140);
    ctx.fillText(
      `Tao luc: ${new Date().toISOString().slice(0, 19)} UTC`,
      MARGIN,
      MARGIN + 190,
    );
    ctx.fillText(`Tong so su co: ${incidents.length}`, MARGIN, MARGIN + 240);

    // Severity breakdown.
    const breakdown = [1, 2, 3, 4, 5].map((sev) => ({
      sev,
      count: incidents.filter((i) => i.severity === sev).length,
    }));
    let y = MARGIN + 320;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#1c1917';
    ctx.fillText('Phan bo theo muc do:', MARGIN, y);
    y += 50;
    ctx.font = '30px sans-serif';
    for (const b of breakdown) {
      ctx.fillText(
        `  Sev ${b.sev} (${SEVERITY_LABELS[b.sev]}): ${b.count}`,
        MARGIN,
        y,
      );
      y += 44;
    }

    // Incident list (top 12 — Phase 1; Phase 2 multi-page).
    y += 40;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Danh sach (12 dau tien):', MARGIN, y);
    y += 50;
    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#44403c';

    for (const inc of incidents.slice(0, 12)) {
      const reportedAt =
        inc.reportedAt instanceof Date
          ? inc.reportedAt.toISOString()
          : new Date(inc.reportedAt).toISOString();
      const line = `[${inc.severity}] ${escapeText(inc.category)}${
        inc.bib ? ` BIB ${escapeText(inc.bib)}` : ' (no BIB)'
      } - ${STATE_LABELS[inc.state] ?? inc.state} - ${reportedAt.slice(0, 16)}`;
      ctx.fillText(line, MARGIN, y);
      y += 38;
      if (y > PAGE_HEIGHT - MARGIN - 200) break;
    }

    // Signature block.
    if (options.includeSignature !== false) {
      const sigY = PAGE_HEIGHT - MARGIN - 160;
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#1c1917';
      ctx.fillText('Race Medical Director:', MARGIN, sigY);
      ctx.font = '26px sans-serif';
      ctx.fillStyle = '#57534e';
      // Pull signature from first signed incident as canonical signer (Phase 1).
      const signed = incidents.find((i) => i.medicalDirectorSignature);
      if (signed?.medicalDirectorSignature) {
        ctx.fillText(
          `${escapeText(signed.medicalDirectorSignature.name)} - ${
            signed.medicalDirectorSignature.signedAt instanceof Date
              ? signed.medicalDirectorSignature.signedAt.toISOString().slice(0, 19)
              : new Date(signed.medicalDirectorSignature.signedAt).toISOString().slice(0, 19)
          }`,
          MARGIN,
          sigY + 40,
        );
      } else {
        ctx.fillText('(Chua co chu ky - Phase 1 typed name)', MARGIN, sigY + 40);
      }
    }

    // Footer.
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#a8a29e';
    ctx.fillText(
      'F-018 Medical Incident Tracker - Phase 1 - 5BIB',
      MARGIN,
      PAGE_HEIGHT - MARGIN + 20,
    );

    return canvas.toBuffer('image/png');
  }
}
