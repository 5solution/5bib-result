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
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { env } from 'src/config';

// docxtemplater + pizzip — DOCX generation
// libreoffice-convert — DOCX → PDF (needs LibreOffice in Docker container)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docxtemplater = require('docxtemplater');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const libre = require('libreoffice-convert');

const libreConvertAsync = promisify<Buffer, string, undefined, Buffer>(
  libre.convert,
);

/**
 * PAUSE-CODE-PHASE2-B confirmation: PDF convert timeout 30s.
 * Rationale: contract racekit lớn (30+ line items) render khoảng 4-8s trên máy
 * dev. 30s là biên an toàn cho production (libreoffice cold-start) + tránh
 * client hang. Khi timeout → fallback DOCX-only (PDF undefined trong response).
 */
const PDF_CONVERT_TIMEOUT_MS = 30_000;
const SIGNED_URL_TTL = 15 * 60; // 15min read

export type GeneratedDocType =
  | 'QUOTATION'
  | 'CONTRACT'
  | 'ACCEPTANCE_REPORT'
  | 'PAYMENT_REQUEST';

export interface RenderContext {
  [key: string]: any;
}

export interface RenderResult {
  docx: Buffer;
  pdf?: Buffer;
}

export interface UploadResult {
  docxKey: string;
  docxUrl: string;
  pdfKey?: string;
  pdfUrl?: string;
}

/**
 * F-024 BR-CM-12: Document generator.
 *
 * Approach:
 *   1. Load DOCX template from `backend/assets/contract-templates/<name>.docx`
 *   2. Replace placeholders {varName} via docxtemplater (delimiter `{` / `}`)
 *   3. Optionally convert DOCX → PDF via libreoffice-convert (requires
 *      LibreOffice installed in container — see Dockerfile).
 *   4. Upload both to S3 under `contracts/{contractId}/{docType}_{ts}.{ext}`
 *      (PAUSE-CODE-PHASE2-A: lifecycle 7y per legal retention — pattern
 *      `awards-pdf/` + `medical-reports/` distinct from `result-images/` 24h TTL).
 *   5. Return signed URLs (15min TTL) for read access.
 *
 * Templates EXTRACTED + SANITIZED from `templates-input/` files. See
 * `docs/F-024-placeholder-spec.md` for full placeholder list.
 *
 * Convention: placeholder format `{varName}` (NOT `{{varName}}`) for compatibility
 * with sanitized templates. Missing data → empty string (no crash).
 */
@Injectable()
export class DocumentGeneratorService {
  private readonly logger = new Logger(DocumentGeneratorService.name);
  private readonly templatesDir = path.join(
    process.cwd(),
    'assets',
    'contract-templates',
  );
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

  /** Render DOCX from template with context. */
  async renderDocx(
    templateName: string,
    context: RenderContext,
  ): Promise<Buffer> {
    // L-03 QC fix: defense-in-depth filename whitelist. Caller chỉ pass
    // server-side static TEMPLATE_FILE_MAP value; assert format tránh
    // path traversal ngay cả khi caller bug đẩy user input vào đây.
    if (!/^[\w-]+\.docx$/.test(templateName)) {
      throw new BadRequestException(
        `Invalid template name: ${templateName}`,
      );
    }
    const templatePath = path.join(this.templatesDir, templateName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath);
    const zip = new PizZip(content);

    // Custom parser to support nested access: {client.entityName}
    const parser = (tag: string) => ({
      get(scope: any) {
        if (tag === '.') return scope;
        return tag
          .split('.')
          .reduce((obj: any, key: string) => (obj == null ? '' : obj[key]), scope);
      },
    });

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
      parser,
      nullGetter: () => '', // missing data → empty string (no crash)
    });

    doc.render(this.sanitizeContext(context));

    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /** Render DOCX + convert to PDF via LibreOffice (with 30s timeout fallback). */
  async renderBoth(
    templateName: string,
    context: RenderContext,
  ): Promise<RenderResult> {
    const docx = await this.renderDocx(templateName, context);
    let pdf: Buffer | undefined;
    try {
      pdf = await Promise.race([
        libreConvertAsync(docx, '.pdf', undefined),
        new Promise<Buffer>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new ServiceUnavailableException(
                  `PDF convert timeout >${PDF_CONVERT_TIMEOUT_MS / 1000}s`,
                ),
              ),
            PDF_CONVERT_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      this.logger.warn(
        `LibreOffice PDF convert failed: ${(err as Error).message}. ` +
          `Returning DOCX only. (Check libreoffice install in container)`,
      );
    }
    return { docx, pdf };
  }

  /** Convert ONLY (no template render — for ad-hoc DOCX→PDF). */
  async convertDocxToPdf(docx: Buffer): Promise<Buffer> {
    return libreConvertAsync(docx, '.pdf', undefined);
  }

  /**
   * Render + upload to S3. Returns S3 keys + signed read URLs.
   * Path convention: `contracts/{contractId}/{docType}_{ts}.{docx|pdf}`
   */
  async renderAndUpload(
    templateName: string,
    context: RenderContext,
    contractId: string,
    docType: GeneratedDocType,
  ): Promise<UploadResult> {
    const { docx, pdf } = await this.renderBoth(templateName, context);
    const ts = Date.now();
    const baseKey = `contracts/${contractId}/${docType}_${ts}`;
    const docxKey = `${baseKey}.docx`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: docxKey,
        Body: docx,
        ContentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );
    const docxUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: docxKey }),
      { expiresIn: SIGNED_URL_TTL },
    );

    let pdfKey: string | undefined;
    let pdfUrl: string | undefined;
    if (pdf) {
      pdfKey = `${baseKey}.pdf`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: pdfKey,
          Body: pdf,
          ContentType: 'application/pdf',
        }),
      );
      pdfUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: pdfKey }),
        { expiresIn: SIGNED_URL_TTL },
      );
    }

    this.logger.log(
      `[doc-gen] uploaded contractId=${contractId} docType=${docType} ` +
        `docxBytes=${docx.length} pdfBytes=${pdf?.length ?? 0}`,
    );

    return { docxKey, docxUrl, pdfKey, pdfUrl };
  }

  /** Get signed URL for an existing S3 key (download endpoint). */
  async getSignedDownloadUrl(s3Key: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: SIGNED_URL_TTL },
    );
  }

  /** Stream file body from S3 (for direct backend proxy download). */
  async getFileBody(s3Key: string): Promise<{
    body: Buffer;
    contentType: string;
  }> {
    const resp = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
    );
    const body = await this.streamToBuffer(resp.Body as NodeJS.ReadableStream);
    return {
      body,
      contentType: resp.ContentType ?? 'application/octet-stream',
    };
  }

  private async streamToBuffer(
    stream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Convert any non-string value to string for safe rendering.
   * docxtemplater throws on objects unless they're loops. Numbers/dates → string.
   */
  private sanitizeContext(ctx: RenderContext): RenderContext {
    const out: RenderContext = {};
    for (const [k, v] of Object.entries(ctx)) {
      if (v === null || v === undefined) {
        out[k] = '';
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) =>
          typeof item === 'object' && item !== null
            ? this.sanitizeContext(item as RenderContext)
            : item,
        );
      } else if (v instanceof Date) {
        out[k] = this.formatDate(v);
      } else if (typeof v === 'number') {
        out[k] = this.formatNumber(v);
      } else if (typeof v === 'object') {
        out[k] = this.sanitizeContext(v as RenderContext);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private formatDate(d: Date): string {
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatNumber(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('vi-VN').format(n);
  }
}
