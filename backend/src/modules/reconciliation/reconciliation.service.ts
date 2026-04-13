import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from 'src/config';
import {
  Reconciliation,
  ReconciliationDocument,
} from './schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../merchant/schemas/merchant-config.schema';
import {
  ReconciliationCronLog,
  ReconciliationCronLogDocument,
} from './schemas/reconciliation-cron-log.schema';
import { Tenant } from '../merchant/entities/tenant.entity';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationCalcService } from './services/reconciliation-calc.service';
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { PreviewReconciliationDto } from './dto/preview-reconciliation.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { UpdateReconciliationStatusDto } from './dto/update-reconciliation-status.dto';
import { BatchCreateReconciliationDto } from './dto/batch-create-reconciliation.dto';

const BUCKET_NAME = env.s3.bucket;
const REGION = env.s3.region;

@Injectable()
export class ReconciliationService {
  private s3Client: S3Client;

  constructor(
    private queryService: ReconciliationQueryService,
    private calcService: ReconciliationCalcService,
    private preflightService: ReconciliationPreflightService,
    private xlsxService: XlsxService,
    private docxService: DocxService,
    @InjectModel(Reconciliation.name)
    private reconciliationModel: Model<ReconciliationDocument>,
    @InjectModel(MerchantConfig.name)
    private configModel: Model<MerchantConfigDocument>,
    @InjectModel(ReconciliationCronLog.name)
    private cronLogModel: Model<ReconciliationCronLogDocument>,
    @InjectRepository(Tenant, 'platform')
    private tenantRepo: Repository<Tenant>,
  ) {
    this.s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
  }

  async preview(dto: PreviewReconciliationDto) {
    const tenant = await this.queryService.getTenant(dto.tenant_id);
    const config = await this.configModel.findOne({ tenantId: dto.tenant_id });

    // DTO values take priority; fall back to merchant config
    const feeRate = dto.fee_rate_applied ?? config?.service_fee_rate ?? null;
    const manualFeePerTicket = dto.manual_fee_per_ticket ?? config?.manual_fee_per_ticket ?? 5000;
    const feeVatRate = dto.fee_vat_rate ?? config?.fee_vat_rate ?? 0;

    const { fiveBibOrders, manualOrders, missingPaymentRef } =
      await this.queryService.queryOrders(
        dto.mysql_race_id,
        dto.period_start,
        dto.period_end,
      );

    const summary = this.calcService.calculateSummary(
      fiveBibOrders,
      manualOrders,
      feeRate,
      manualFeePerTicket,
      feeVatRate,
      0,
    );

    const lineItems = this.calcService.buildLineItems(fiveBibOrders);
    const manualOrderRows = this.calcService.buildManualOrders(manualOrders);

    return {
      tenant_name: tenant?.name ?? '',
      tenant_metadata: tenant?.metadata ?? {},
      fee_rate_applied: feeRate,
      manual_fee_per_ticket: manualFeePerTicket,
      fee_vat_rate: feeVatRate,
      ...summary,
      line_items: lineItems,
      manual_orders: manualOrderRows,
      missing_payment_ref_count: missingPaymentRef.length,
      raw_5bib_order_count: fiveBibOrders.length,
      raw_manual_order_count: manualOrders.length,
    };
  }

  async create(dto: CreateReconciliationDto): Promise<ReconciliationDocument> {
    const tenant = await this.queryService.getTenant(dto.tenant_id);

    const feeRate = dto.fee_rate_applied ?? null;
    const manualFeePerTicket = dto.manual_fee_per_ticket ?? 5000;
    const feeVatRate = dto.fee_vat_rate ?? 0;
    const manualAdjustment = dto.manual_adjustment ?? 0;

    const { fiveBibOrders, manualOrders } =
      await this.queryService.queryOrders(
        dto.mysql_race_id,
        dto.period_start,
        dto.period_end,
      );

    const summary = this.calcService.calculateSummary(
      fiveBibOrders,
      manualOrders,
      feeRate,
      manualFeePerTicket,
      feeVatRate,
      manualAdjustment,
    );

    const lineItems = this.calcService.buildLineItems(fiveBibOrders);
    const manualOrderRows = this.calcService.buildManualOrders(manualOrders);

    // Run pre-flight to determine flags and status
    const period = dto.period_start.slice(0, 7); // YYYY-MM
    const preflight = await this.preflightService.run(
      dto.tenant_id,
      period,
      dto.mysql_race_id,
    );
    const flags = this.preflightService.extractFlags(preflight);
    const status = this.preflightService.determineStatus(flags);

    const doc = await this.reconciliationModel.create({
      tenant_id: dto.tenant_id,
      mysql_race_id: dto.mysql_race_id,
      race_title: dto.race_title,
      tenant_name: tenant?.name ?? '',
      period_start: dto.period_start,
      period_end: dto.period_end,
      fee_rate_applied: feeRate,
      manual_fee_per_ticket: manualFeePerTicket,
      fee_vat_rate: feeVatRate,
      ...summary,
      manual_adjustment: manualAdjustment,
      adjustment_note: dto.adjustment_note ?? null,
      status,
      flags,
      created_source: (dto as any).created_source ?? 'manual',
      xlsx_url: null,
      docx_url: null,
      created_by: dto.created_by ?? null,
      reviewed_by: null,
      reviewed_at: null,
      approved_by: null,
      approved_at: null,
      signed_at: null,
      signed_date_str: dto.signed_date_str ?? null,
      line_items: lineItems,
      manual_orders: manualOrderRows,
      raw_5bib_orders: fiveBibOrders,
      raw_manual_orders: manualOrders,
    });

    // Attach tenant metadata for DOCX generation
    (doc as any).tenant_metadata = tenant?.metadata ?? {};

    const generateXlsx = dto.generate_xlsx !== false;
    const generateDocx = dto.generate_docx !== false;

    if (generateXlsx) {
      try {
        const buf = await this.xlsxService.generate(doc);
        const url = await this.uploadBuffer(
          buf,
          `reconciliations/${doc._id}/reconciliation.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        if (url) doc.xlsx_url = url;
      } catch (err) {
        console.error('XLSX generation error:', err);
      }
    }

    if (generateDocx) {
      try {
        const buf = await this.docxService.generate(doc);
        const url = await this.uploadBuffer(
          buf,
          `reconciliations/${doc._id}/reconciliation.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        if (url) doc.docx_url = url;
      } catch (err) {
        console.error('DOCX generation error:', err);
      }
    }

    await doc.save();
    return doc;
  }

  async getAllMerchantIds(): Promise<number[]> {
    const configs = await this.configModel.find({}, { tenantId: 1 }).lean();
    return configs.map((c) => c.tenantId);
  }

  async findAll(filters: {
    tenant_id?: number;
    mysql_race_id?: number;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.tenant_id) query.tenant_id = filters.tenant_id;
    if (filters.mysql_race_id) query.mysql_race_id = filters.mysql_race_id;
    if (filters.status) query.status = filters.status;

    const [data, total] = await Promise.all([
      this.reconciliationModel
        .find(query, {
          raw_5bib_orders: 0,
          raw_manual_orders: 0,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reconciliationModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<ReconciliationDocument> {
    const doc = await this.reconciliationModel.findById(id);
    if (!doc) throw new NotFoundException(`Reconciliation ${id} not found`);
    return doc;
  }

  async updateStatus(
    id: string,
    dto: UpdateReconciliationStatusDto,
  ): Promise<ReconciliationDocument> {
    const doc = await this.findOne(id);

    doc.status = dto.status;

    if (dto.status === 'reviewed') {
      doc.reviewed_at = new Date();
      if (dto.reviewed_by) doc.reviewed_by = dto.reviewed_by;
    }

    if (dto.status === 'approved') {
      doc.approved_at = new Date();
      if (dto.approved_by) doc.approved_by = dto.approved_by;
    }

    if (dto.status === 'signed') {
      doc.signed_at = dto.signed_at ? new Date(dto.signed_at) : new Date();
    }

    await doc.save();
    return doc;
  }

  async regenerate(
    id: string,
    type: 'xlsx' | 'docx' | 'both',
  ): Promise<ReconciliationDocument> {
    const doc = await this.findOne(id);
    const tenant = await this.queryService.getTenant(doc.tenant_id);
    (doc as any).tenant_metadata = tenant?.metadata ?? {};

    if (type === 'xlsx' || type === 'both') {
      const buf = await this.xlsxService.generate(doc);
      const url = await this.uploadBuffer(
        buf,
        `reconciliations/${doc._id}/reconciliation.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      if (url) doc.xlsx_url = url;
    }

    if (type === 'docx' || type === 'both') {
      const buf = await this.docxService.generate(doc);
      const url = await this.uploadBuffer(
        buf,
        `reconciliations/${doc._id}/reconciliation.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      if (url) doc.docx_url = url;
    }

    await doc.save();
    return doc;
  }

  async batchCreate(dto: BatchCreateReconciliationDto): Promise<{
    created: number;
    skipped: number;
    failed: number;
    results: Array<{
      merchant_id: number;
      merchant_name: string;
      race_id: number;
      race_title: string;
      status: 'created' | 'skipped' | 'failed';
      reason?: string;
      reconciliation_id?: string;
    }>;
  }> {
    let merchantIds: number[];
    if (dto.merchant_ids === 'all') {
      merchantIds = await this.getAllMerchantIds();
    } else {
      merchantIds = dto.merchant_ids;
    }

    const { period_start, period_end } = this.parsePeriod(dto.period);

    const results: Array<{
      merchant_id: number;
      merchant_name: string;
      race_id: number;
      race_title: string;
      status: 'created' | 'skipped' | 'failed';
      reason?: string;
      reconciliation_id?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const merchantId of merchantIds) {
      let merchantName = `Merchant #${merchantId}`;
      try {
        const preflight = await this.preflightService.run(merchantId, dto.period);
        merchantName = preflight.merchant_name;

        const config = await this.configModel.findOne({ tenantId: merchantId }).lean();

        if (dto.skip_errors) {
          const hasErrors = preflight.warnings.some((w) => w.severity === 'ERROR');
          if (hasErrors) {
            for (const race of preflight.races_with_orders) {
              results.push({
                merchant_id: merchantId,
                merchant_name: merchantName,
                race_id: race.race_id,
                race_title: race.race_name,
                status: 'skipped',
                reason: 'Skipped due to ERROR-severity preflight flags',
              });
              skipped++;
            }
            continue;
          }
        }

        for (const race of preflight.races_with_orders) {
          try {
            const existing = await this.reconciliationModel.findOne({
              tenant_id: merchantId,
              mysql_race_id: race.race_id,
              period_start,
              period_end,
            });

            if (existing) {
              results.push({
                merchant_id: merchantId,
                merchant_name: merchantName,
                race_id: race.race_id,
                race_title: race.race_name,
                status: 'skipped',
                reason: 'Reconciliation already exists for this period',
                reconciliation_id: String(existing._id),
              });
              skipped++;
              continue;
            }

            const doc = await this.create({
              tenant_id: merchantId,
              mysql_race_id: race.race_id,
              race_title: race.race_name,
              period_start,
              period_end,
              fee_rate_applied: config?.service_fee_rate ?? 5.5,
              manual_fee_per_ticket: config?.manual_fee_per_ticket ?? 5000,
              fee_vat_rate: config?.fee_vat_rate ?? 0,
              manual_adjustment: 0,
              adjustment_note: null,
              signed_date_str: null,
              generate_xlsx: true,
              generate_docx: true,
              created_by: null,
              created_source: 'batch',
            } as any);

            results.push({
              merchant_id: merchantId,
              merchant_name: merchantName,
              race_id: race.race_id,
              race_title: race.race_name,
              status: 'created',
              reconciliation_id: String(doc._id),
            });
            created++;
          } catch (err) {
            results.push({
              merchant_id: merchantId,
              merchant_name: merchantName,
              race_id: race.race_id,
              race_title: race.race_name,
              status: 'failed',
              reason: err.message,
            });
            failed++;
          }
        }
      } catch (err) {
        results.push({
          merchant_id: merchantId,
          merchant_name: merchantName,
          race_id: 0,
          race_title: '—',
          status: 'failed',
          reason: err.message,
        });
        failed++;
      }
    }

    return { created, skipped, failed, results };
  }

  async delete(id: string): Promise<void> {
    const result = await this.reconciliationModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) throw new NotFoundException(`Reconciliation ${id} not found`);
  }

  async getCronLogs(limit = 12) {
    return this.cronLogModel.find({}).sort({ ran_at: -1 }).limit(limit).lean();
  }

  private parsePeriod(period: string): { period_start: string; period_end: string } {
    const [year, month] = period.split('-').map(Number);
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      period_start: `${year}-${mm}-01`,
      period_end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      await this.s3Client.send(command);
      return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
    } catch (err) {
      console.error('S3 upload error:', err);
      return null;
    }
  }
}
