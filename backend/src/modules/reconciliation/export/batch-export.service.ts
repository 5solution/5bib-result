import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from 'src/config';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../schemas/reconciliation.schema';
import { ExportJob, ExportJobDocument } from './export-job.schema';
import { TongHopService, TongHopRow } from './tong-hop.service';
import { XlsxService } from '../services/xlsx.service';
import { DocxService } from '../services/docx.service';
import { ReconciliationQueryService } from '../services/reconciliation-query.service';

const BUCKET = env.s3.bucket;
const REGION = env.s3.region;

/**
 * Convert a Vietnamese merchant name to an ASCII slug suitable for filenames/folders.
 * Rules:
 *   1. Replace đ/Đ → d/D (not handled by NFD decomposition)
 *   2. NFD-normalize → decompose accented chars (e.g. ắ → a + combining marks)
 *   3. Strip all combining diacritical marks (U+0300–U+036F)
 *   4. Keep only ASCII alphanumeric + spaces
 *   5. Trim, collapse spaces → underscore
 * Example: "Công Ty RJ CP Đường Đua Mới" → "Cong_Ty_RJ_CP_Duong_Dua_Moi"
 */
function slugify(name: string): string {
  return name
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}


@Injectable()
export class BatchExportService {
  private readonly logger = new Logger(BatchExportService.name);
  private s3: S3Client;

  constructor(
    @InjectModel(Reconciliation.name)
    private reconciliationModel: Model<ReconciliationDocument>,
    @InjectModel(ExportJob.name)
    private exportJobModel: Model<ExportJobDocument>,
    private tongHopService: TongHopService,
    private xlsxService: XlsxService,
    private docxService: DocxService,
    private queryService: ReconciliationQueryService,
  ) {
    this.s3 = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
  }

  /** Trigger export by explicit reconciliation IDs */
  async triggerByIds(ids: string[], label?: string): Promise<{ jobId: string; total: number }> {
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      throw new BadRequestException('No valid reconciliation IDs provided');
    }
    const docs = await this.reconciliationModel
      .find({ _id: { $in: validIds } })
      .lean()
      .exec();
    return this.createJob(docs as any[], label);
  }

  /** Trigger export by date period */
  async triggerByPeriod(
    periodStart: string,
    periodEnd: string,
    label?: string,
  ): Promise<{ jobId: string; total: number }> {
    const docs = await this.reconciliationModel
      .find({
        period_start: { $gte: periodStart },
        period_end: { $lte: periodEnd },
      })
      .lean()
      .exec();
    return this.createJob(docs as any[], label ?? `${periodStart} đến ${periodEnd}`);
  }

  private async createJob(
    docs: any[],
    label?: string,
  ): Promise<{ jobId: string; total: number }> {
    const jobId = `exp_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.exportJobModel.create({
      jobId,
      status: 'processing',
      label: label ?? '',
      totalItems: docs.length,
      doneItems: 0,
      expiresAt,
    });

    // Run async — don't await
    this.runExport(jobId, docs).catch((err) => {
      this.logger.error(`Export job ${jobId} failed: ${err.message}`, err.stack);
      this.exportJobModel
        .updateOne({ jobId }, { status: 'failed', errorMessage: String(err.message) })
        .exec();
    });

    return { jobId, total: docs.length };
  }

  private async runExport(jobId: string, docs: any[]): Promise<void> {
    // Set up ZIP stream BEFORE appending anything so we never miss 'end'
    const pass = new PassThrough();
    const zipBufferPromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pass.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
    });

    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', (err) => pass.destroy(err));
    zip.pipe(pass);

    const tongHopRows: TongHopRow[] = [];
    let done = 0;

    for (const doc of docs) {
      try {
        // folder = ASCII slug of tenant name, e.g. "Cong_Ty_ABC"
        const folder = slugify(doc.tenant_name || String(doc.tenant_id));
        // period = YYYY_MM from period_start, e.g. "2026-04-01" → "2026_04"
        const periodStr = doc.period_start
          ? doc.period_start.slice(0, 7).replace('-', '_')
          : 'unknown';
        // raceId disambiguates multiple races per merchant in same period
        const raceId = doc.mysql_race_id ?? doc._id;

        // XLSX: download from S3 if pre-generated, otherwise generate on the fly
        let xlsxBuf: Buffer | null = null;
        if (doc.xlsx_url) {
          xlsxBuf = await this.downloadFromS3(doc.xlsx_url);
        } else {
          try {
            xlsxBuf = await this.xlsxService.generate(doc as ReconciliationDocument);
          } catch (genErr) {
            this.logger.warn(`Failed to generate XLSX for doc ${doc._id}: ${genErr.message}`);
          }
        }
        if (xlsxBuf) {
          zip.append(xlsxBuf, { name: `${folder}/doi_soat_${periodStr}_${folder}_${raceId}.xlsx` });
        }

        // DOCX: download from S3 if pre-generated, otherwise generate on the fly
        let docxBuf: Buffer | null = null;
        if (doc.docx_url) {
          docxBuf = await this.downloadFromS3(doc.docx_url);
        } else {
          try {
            const tenant = await this.queryService.getTenant(doc.tenant_id);
            (doc as any).tenant_metadata = tenant?.metadata ?? {};
            docxBuf = await this.docxService.generate(doc as ReconciliationDocument);
          } catch (genErr) {
            this.logger.warn(`Failed to generate DOCX for doc ${doc._id}: ${genErr.message}`);
          }
        }
        if (docxBuf) {
          zip.append(docxBuf, { name: `${folder}/bien_ban_doi_soat_${periodStr}_${folder}_${raceId}.docx` });
        }

        tongHopRows.push({
          tenant_name: doc.tenant_name ?? String(doc.tenant_id),
          race_count: 1,
          paid_orders: doc.raw_5bib_orders?.length ?? 0,
          gross_revenue: doc.gross_revenue ?? 0,
          fee_amount: doc.fee_amount ?? 0,
          fee_rate: doc.fee_rate_applied ?? null,
          period: `${doc.period_start} → ${doc.period_end}`,
        });
      } catch (err) {
        this.logger.warn(`Failed to add doc ${doc._id} to ZIP: ${err.message}`);
      }

      done++;
      await this.exportJobModel.updateOne({ jobId }, { doneItems: done }).exec();
    }

    // Merge rows by tenant
    const mergedMap = new Map<string, TongHopRow>();
    for (const row of tongHopRows) {
      const existing = mergedMap.get(row.tenant_name);
      if (existing) {
        existing.race_count += 1;
        existing.paid_orders += row.paid_orders;
        existing.gross_revenue += row.gross_revenue;
        existing.fee_amount += row.fee_amount;
      } else {
        mergedMap.set(row.tenant_name, { ...row });
      }
    }

    // Generate _tong_hop summary
    const jobDoc = await this.exportJobModel.findOne({ jobId }).lean().exec();
    const summaryBuf = await this.tongHopService.generate(
      Array.from(mergedMap.values()),
      jobDoc?.label ?? '',
    );
    zip.append(summaryBuf, { name: `_tong_hop/tong_hop_batch.xlsx` });

    await zip.finalize();
    const zipBuffer = await zipBufferPromise;
    const zipKey = `exports/${jobId}/batch_doi_soat.zip`;

    let zipUrl: string;

    const hasS3Creds = !!(env.s3.accessKeyId && env.s3.secretAccessKey);

    if (hasS3Creds) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: zipKey,
          Body: zipBuffer,
          ContentType: 'application/zip',
        }),
      );
      zipUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${zipKey}`;
    } else {
      // No S3 creds (local dev) — save to /tmp and serve via local endpoint
      const tmpPath = path.join(os.tmpdir(), `${jobId}.zip`);
      fs.writeFileSync(tmpPath, zipBuffer);
      zipUrl = `__local__:${tmpPath}`;
      this.logger.warn(`No S3 credentials — ZIP saved locally at ${tmpPath}`);
    }

    await this.exportJobModel.updateOne(
      { jobId },
      { status: 'done', zipUrl, zipKey, doneItems: docs.length },
    ).exec();

    this.logger.log(`Export job ${jobId} done — ${docs.length} docs, ${zipBuffer.length} bytes`);
  }

  private async downloadFromS3(url: string): Promise<Buffer> {
    // Files are publicly accessible — download via plain HTTPS (no credentials needed)
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async getJobStatus(jobId: string) {
    const job = await this.exportJobModel.findOne({ jobId }).lean().exec();
    if (!job) return null;
    return {
      jobId: job.jobId,
      status: job.status,
      label: job.label,
      progress: { total: job.totalItems, done: job.doneItems },
      zipUrl: job.zipUrl,
      isLocal: job.zipUrl?.startsWith('__local__:') ?? false,
      errorMessage: job.errorMessage,
    };
  }

  async getLocalZipBuffer(jobId: string): Promise<Buffer | null> {
    const job = await this.exportJobModel.findOne({ jobId }).lean().exec();
    if (!job?.zipUrl?.startsWith('__local__:')) return null;
    const filePath = job.zipUrl.replace('__local__:', '');
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }
}
