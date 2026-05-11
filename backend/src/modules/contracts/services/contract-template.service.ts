import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import {
  ContractTemplate,
  ContractTemplateDocument,
  LineItemTemplate,
} from '../schemas/contract-template.schema';
import {
  ArticleSection,
  getDefaultArticles,
} from '../constants/default-templates';
import { ContractType } from '../schemas/contract.schema';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');

/**
 * F-024 UX-39 v3 — Map contractType → DOCX template filename trong
 * `backend/assets/contract-templates/`. Defense-in-depth: chỉ accept
 * pre-defined static filename, KHÔNG nhận từ user input.
 */
const TEMPLATE_FILE_MAP: Record<ContractType, string> = {
  TIMING: 'contract-timing.docx',
  RACEKIT: 'contract-racekit.docx',
  OPERATIONS: 'contract-operations.docx',
  TICKET_SALES: 'contract-ticket-sales.docx',
};

const PREVIEW_HTML_CACHE_TTL = 60; // 60s

/**
 * F-024 UX-39 v3 — backup retention. Mỗi lần upload mới, file cũ
 * được rename `<type>-<timestamp>.docx` trong `.backup/`. Giữ vô hạn
 * — admin có thể restore version cũ.
 */
const BACKUP_DIRNAME = '.backup';

@Injectable()
export class ContractTemplateService {
  private readonly logger = new Logger(ContractTemplateService.name);
  private readonly templatesDir = path.join(
    process.cwd(),
    'assets',
    'contract-templates',
  );

  constructor(
    @InjectModel(ContractTemplate.name)
    private model: Model<ContractTemplateDocument>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /** Returns full article list, applying any DB overrides + per-contract overrides. */
  async getArticles(
    contractType: ContractType,
    perContractOverrides: Record<string, string> = {},
  ): Promise<ArticleSection[]> {
    const defaults = getDefaultArticles(contractType);
    const dbDoc = await this.model.findOne({ contractType }).lean();
    const dbOverrides: Record<string, string> = (dbDoc?.articles ?? {}) as any;

    return defaults.map((art) => ({
      ...art,
      body:
        perContractOverrides?.[art.key] ??
        dbOverrides[art.key] ??
        art.body,
    }));
  }

  async list() {
    return this.model.find().lean();
  }

  async getByType(contractType: ContractType) {
    const doc = await this.model.findOne({ contractType }).lean();
    if (!doc) {
      // Return synthetic doc from defaults
      return {
        contractType,
        articles: {},
        variables: [],
      };
    }
    return doc;
  }

  async upsert(
    contractType: ContractType,
    articles: Record<string, string>,
    lastEditedBy?: string,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { contractType },
        { $set: { articles, lastEditedBy } },
        { new: true, upsert: true },
      )
      .lean();
    if (!doc) throw new NotFoundException('Template not found');
    return doc;
  }

  async resetToDefault(contractType: ContractType) {
    await this.model.deleteOne({ contractType });
    return { success: true };
  }

  /**
   * F-024 UX-39 — Expose default article boilerplate cho admin editor.
   *
   * Trả về RAW defaults (KHÔNG apply DB override) — admin UI cần biết text
   * mặc định để populate textarea defaultValue + diff vs override hiện tại.
   * Pure read từ constants/default-templates.ts, không DB query.
   */
  getDefaultsForType(contractType: ContractType): ArticleSection[] {
    return getDefaultArticles(contractType);
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 1 — Preview HTML (audit viewer)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Convert template DOCX → HTML qua mammoth. Cache Redis 60s.
   * READ-ONLY — viewer purely audit. KHÔNG roundtrip => fidelity 100%.
   */
  async getPreviewHtml(contractType: ContractType): Promise<{
    html: string;
    cached: boolean;
    templateFile: string;
  }> {
    const templateFile = TEMPLATE_FILE_MAP[contractType];
    if (!templateFile) {
      throw new BadRequestException(`Unsupported contract type: ${contractType}`);
    }

    const cacheKey = `contract-templates:preview-html:${contractType}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return { html: cached, cached: true, templateFile };
        }
      } catch (err) {
        this.logger.warn(
          `[preview-html] Redis GET failed: ${(err as Error).message}`,
        );
      }
    }

    const templatePath = path.join(this.templatesDir, templateFile);
    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        `Template file not found: ${templateFile}`,
      );
    }

    // Convert DOCX → HTML qua mammoth. styleMap giúp giữ heading + bold +
    // table-of-articles. Nếu mammoth fail (corrupt docx) sẽ throw, controller
    // bắt và trả 500 với log.
    const result = await mammoth.convertToHtml(
      { path: templatePath },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1.contract-h1",
          "p[style-name='Heading 2'] => h2.contract-h2",
          "p[style-name='Title'] => h1.contract-title",
          "p[style-name='Subtitle'] => h2.contract-subtitle",
          "b => strong",
          "i => em",
        ],
      },
    );

    if (result.messages && result.messages.length > 0) {
      this.logger.debug(
        `[preview-html] mammoth messages (${contractType}): ${result.messages.length}`,
      );
    }

    const html = result.value as string;

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, html, 'EX', PREVIEW_HTML_CACHE_TTL);
      } catch (err) {
        this.logger.warn(
          `[preview-html] Redis SET failed: ${(err as Error).message}`,
        );
      }
    }

    return { html, cached: false, templateFile };
  }

  /** Invalidate preview HTML cache (called after upload). */
  async invalidatePreviewCache(contractType: ContractType): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`contract-templates:preview-html:${contractType}`);
    } catch (err) {
      this.logger.warn(
        `[preview-html] Cache invalidate failed: ${(err as Error).message}`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 2 — Upload DOCX template + backup history
  // ────────────────────────────────────────────────────────────────────────

  /** Resolve absolute path cho a template type. Defense-in-depth. */
  private getTemplatePath(contractType: ContractType): string {
    const templateFile = TEMPLATE_FILE_MAP[contractType];
    if (!templateFile) {
      throw new BadRequestException(`Unsupported contract type: ${contractType}`);
    }
    return path.join(this.templatesDir, templateFile);
  }

  private getBackupDir(): string {
    const dir = path.join(this.templatesDir, BACKUP_DIRNAME);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Validate uploaded DOCX bằng dry-run docxtemplater render với sample data.
   * Nếu render fail → reject (corrupted/invalid placeholder).
   */
  private async validateDocxBuffer(buffer: Buffer): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Docxtemplater = require('docxtemplater');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PizZip = require('pizzip');

    let zip: any;
    try {
      zip = new PizZip(buffer);
    } catch (err) {
      throw new BadRequestException(
        `File DOCX không hợp lệ (zip parse fail): ${(err as Error).message}`,
      );
    }

    let doc: any;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{', end: '}' },
        nullGetter: () => '',
      });
    } catch (err) {
      throw new BadRequestException(
        `Template DOCX có lỗi cú pháp placeholder: ${(err as Error).message}`,
      );
    }

    // Dry-run render với sample data. Nếu template có placeholder lạ
    // (e.g. {invalidTag}), docxtemplater sẽ throw — admin biết để fix.
    try {
      doc.render({
        contractNumber: 'SAMPLE-001',
        signDate: '01/01/2026',
        raceName: 'Sample Race',
        client: { entityName: 'Sample Client' },
        provider: { entityName: '5BIB' },
        lineItems: [],
        subtotal: 0,
        vatAmount: 0,
        totalAmount: 0,
      });
    } catch (err) {
      throw new BadRequestException(
        `DOCX render test thất bại: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Upload new DOCX template:
   *   1. Validate MIME + size (controller layer cũng đã check, defense in depth)
   *   2. Validate via docxtemplater dry-run render
   *   3. Backup old template → `.backup/<type>-<ts>.docx`
   *   4. Write new template
   *   5. Invalidate Redis cache
   */
  async uploadTemplate(
    contractType: ContractType,
    buffer: Buffer,
    originalFilename: string,
  ): Promise<{
    success: true;
    backup?: { filename: string; size: number };
    newFilename: string;
    newSize: number;
  }> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('File rỗng');
    }
    // Defense-in-depth (controller cũng check 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File quá lớn (>10MB)');
    }

    await this.validateDocxBuffer(buffer);

    const currentPath = this.getTemplatePath(contractType);
    const templateFile = path.basename(currentPath);

    let backup: { filename: string; size: number } | undefined;
    if (fs.existsSync(currentPath)) {
      const ts = Date.now();
      const backupName = `${path.basename(
        templateFile,
        '.docx',
      )}-${ts}.docx`;
      const backupPath = path.join(this.getBackupDir(), backupName);
      const oldStat = fs.statSync(currentPath);
      fs.copyFileSync(currentPath, backupPath);
      backup = { filename: backupName, size: oldStat.size };
      this.logger.log(
        `[upload-template] Backup created: ${backupName} (${oldStat.size}B)`,
      );
    }

    fs.writeFileSync(currentPath, buffer);
    this.logger.log(
      `[upload-template] Replaced ${templateFile} (${buffer.length}B, original=${originalFilename})`,
    );

    await this.invalidatePreviewCache(contractType);

    return {
      success: true,
      backup,
      newFilename: templateFile,
      newSize: buffer.length,
    };
  }

  /** List backup versions cho a contract type. Sorted by timestamp DESC. */
  async listBackups(
    contractType: ContractType,
  ): Promise<
    Array<{ filename: string; size: number; createdAt: Date }>
  > {
    const templateFile = TEMPLATE_FILE_MAP[contractType];
    if (!templateFile) {
      throw new BadRequestException(`Unsupported contract type: ${contractType}`);
    }
    const backupDir = this.getBackupDir();
    const prefix = path.basename(templateFile, '.docx') + '-';

    let entries: string[];
    try {
      entries = fs.readdirSync(backupDir);
    } catch {
      return [];
    }

    const items = entries
      .filter((f) => f.startsWith(prefix) && f.endsWith('.docx'))
      .map((f) => {
        const full = path.join(backupDir, f);
        const stat = fs.statSync(full);
        return { filename: f, size: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }

  /** Restore a backup → swap current template with backup, backup current first. */
  async restoreBackup(
    contractType: ContractType,
    backupFilename: string,
  ): Promise<{ success: true; restoredFrom: string }> {
    // Defense in depth — filename whitelist
    if (!/^[\w.\-]+\.docx$/.test(backupFilename)) {
      throw new BadRequestException(
        `Invalid backup filename: ${backupFilename}`,
      );
    }
    const templateFile = TEMPLATE_FILE_MAP[contractType];
    if (!templateFile) {
      throw new BadRequestException(`Unsupported contract type: ${contractType}`);
    }
    const prefix = path.basename(templateFile, '.docx') + '-';
    if (!backupFilename.startsWith(prefix)) {
      throw new BadRequestException(
        `Backup file does not belong to type ${contractType}`,
      );
    }

    const backupPath = path.join(this.getBackupDir(), backupFilename);
    if (!fs.existsSync(backupPath)) {
      throw new NotFoundException(`Backup not found: ${backupFilename}`);
    }

    const buffer = fs.readFileSync(backupPath);
    // Re-run validation — paranoid (file có thể đã bị tamper trên disk).
    await this.validateDocxBuffer(buffer);

    // Backup current trước khi restore
    const currentPath = this.getTemplatePath(contractType);
    if (fs.existsSync(currentPath)) {
      const ts = Date.now();
      const newBackup = `${path.basename(
        templateFile,
        '.docx',
      )}-${ts}.docx`;
      fs.copyFileSync(currentPath, path.join(this.getBackupDir(), newBackup));
    }

    fs.writeFileSync(currentPath, buffer);
    await this.invalidatePreviewCache(contractType);
    this.logger.log(
      `[restore-backup] Restored ${templateFile} from ${backupFilename}`,
    );
    return { success: true, restoredFrom: backupFilename };
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-024 UX-39 v3 Task 3 — Default line items (Phụ lục editor)
  // ────────────────────────────────────────────────────────────────────────

  async getLineItems(
    contractType: ContractType,
  ): Promise<LineItemTemplate[]> {
    const doc = await this.model.findOne({ contractType }).lean();
    return ((doc?.defaultLineItems ?? []) as LineItemTemplate[]) ?? [];
  }

  async updateLineItems(
    contractType: ContractType,
    items: LineItemTemplate[],
    lastEditedBy?: string,
  ): Promise<{ contractType: string; defaultLineItems: LineItemTemplate[] }> {
    // Sanitize — strip extra keys, coerce types, prevent NaN.
    const clean: LineItemTemplate[] = (items || []).map((it) => ({
      description: String(it.description ?? '').trim(),
      unit: String(it.unit ?? '').trim(),
      quantity: Math.max(0, Number(it.quantity) || 0),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      discount: Math.min(100, Math.max(0, Number(it.discount) || 0)),
      note: String(it.note ?? '').trim(),
    }));

    const doc = await this.model
      .findOneAndUpdate(
        { contractType },
        { $set: { defaultLineItems: clean, lastEditedBy } },
        { new: true, upsert: true },
      )
      .lean();
    if (!doc) throw new NotFoundException('Template not found');
    return {
      contractType: doc.contractType,
      defaultLineItems: (doc.defaultLineItems ?? []) as LineItemTemplate[],
    };
  }
}
