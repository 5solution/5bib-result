import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

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

export interface RenderContext {
  [key: string]: any;
}

export interface RenderResult {
  docx: Buffer;
  pdf?: Buffer;
}

/**
 * F-024 BR-CM-12: Document generator.
 *
 * Approach:
 *   1. Load DOCX template from `backend/assets/contract-templates/<name>.docx`
 *   2. Replace placeholders {varName} via docxtemplater (delimiter `{` / `}`)
 *   3. Optionally convert DOCX → PDF via libreoffice-convert (requires
 *      LibreOffice installed in container — see Dockerfile).
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

  /** Render DOCX from template with context. */
  async renderDocx(
    templateName: string,
    context: RenderContext,
  ): Promise<Buffer> {
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
        return tag.split('.').reduce(
          (obj: any, key: string) => (obj == null ? '' : obj[key]),
          scope,
        );
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

  /** Render DOCX + convert to PDF via LibreOffice. */
  async renderBoth(
    templateName: string,
    context: RenderContext,
  ): Promise<RenderResult> {
    const docx = await this.renderDocx(templateName, context);
    let pdf: Buffer | undefined;
    try {
      pdf = await libreConvertAsync(docx, '.pdf', undefined);
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
