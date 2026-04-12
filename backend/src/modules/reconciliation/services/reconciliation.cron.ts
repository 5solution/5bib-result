import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReconciliationService } from '../reconciliation.service';
import { ReconciliationQueryService } from './reconciliation-query.service';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import {
  ReconciliationCronLog,
  ReconciliationCronLogDocument,
} from '../schemas/reconciliation-cron-log.schema';

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8546716617:AAFrsKbAckmM0TXMHB0WGKEWj46LyQyVR90';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1230174187';
const ADMIN_URL = 'https://result-admin-dev.5bib.com/reconciliations';

interface CronResult {
  merchant: string;
  race: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}

@Injectable()
export class ReconciliationCron {
  private readonly logger = new Logger(ReconciliationCron.name);
  private isRunning = false;

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly queryService: ReconciliationQueryService,
    @InjectModel(Reconciliation.name)
    private readonly reconciliationModel: Model<ReconciliationDocument>,
    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,
    @InjectModel(ReconciliationCronLog.name)
    private readonly cronLogModel: Model<ReconciliationCronLogDocument>,
  ) {}

  // Chạy lúc 08:00 ngày 1 hàng tháng
  @Cron('0 8 1 * *')
  async handleMonthlyReconciliation() {
    if (this.isRunning) {
      this.logger.warn('Previous reconciliation cron still running, skipping.');
      return;
    }
    this.isRunning = true;

    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const period_start = this.fmtDate(prevMonthStart);
    const period_end = this.fmtDate(prevMonthEnd);
    const period = period_start.slice(0, 7); // YYYY-MM

    this.logger.log(`Monthly reconciliation cron started — ${period_start} → ${period_end}`);

    const results: CronResult[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const errorMerchants: string[] = [];

    try {
      // Chỉ lấy merchant đủ điều kiện:
      // contract_status = 'active' + service_fee_rate NOT NULL + approved_at NOT NULL
      const configs = await this.configModel
        .find({
          contract_status: 'active',
          service_fee_rate: { $ne: null },
          approved_at: { $ne: null },
        })
        .lean();

      this.logger.log(`Found ${configs.length} eligible merchants`);

      for (const config of configs) {
        let merchantName = `Merchant #${config.tenantId}`;
        try {
          const tenant = await this.queryService.getTenant(config.tenantId);
          if (tenant) merchantName = tenant.name;

          const races = await this.queryService.getRacesByTenant(config.tenantId);

          for (const race of races) {
            const mysql_race_id = Number(race.race_id);
            const race_title: string = race.title;

            // Skip nếu đã có đối soát cho kỳ này
            const existing = await this.reconciliationModel.findOne({
              tenant_id: config.tenantId,
              mysql_race_id,
              period_start,
              period_end,
            });
            if (existing) {
              results.push({ merchant: merchantName, race: race_title, status: 'skipped', reason: 'Đã có đối soát' });
              skipped++;
              continue;
            }

            // Pre-check: có orders trong kỳ không?
            const { fiveBibOrders, manualOrders } =
              await this.queryService.queryOrders(mysql_race_id, period_start, period_end);
            if (fiveBibOrders.length === 0 && manualOrders.length === 0) {
              results.push({ merchant: merchantName, race: race_title, status: 'skipped', reason: '0 đơn trong kỳ' });
              skipped++;
              continue;
            }

            // ERROR không block — thử tạo, ghi lỗi và tiếp tục
            try {
              await this.reconciliationService.create({
                tenant_id: config.tenantId,
                mysql_race_id,
                race_title,
                period_start,
                period_end,
                fee_rate_applied: config.service_fee_rate ?? null,
                manual_fee_per_ticket: config.manual_fee_per_ticket ?? 5000,
                fee_vat_rate: config.fee_vat_rate ?? 0,
                manual_adjustment: 0,
                adjustment_note: null,
                signed_date_str: null,
                generate_xlsx: true,
                generate_docx: true,
                created_by: null,
                created_source: 'cron',
              } as any);
              results.push({ merchant: merchantName, race: race_title, status: 'created' });
              created++;
            } catch (err) {
              this.logger.error(`Failed "${race_title}" (tenant ${config.tenantId}): ${err.message}`);
              results.push({ merchant: merchantName, race: race_title, status: 'error', reason: err.message });
              errors++;
              if (!errorMerchants.includes(merchantName)) errorMerchants.push(merchantName);
            }
          }
        } catch (err) {
          this.logger.error(`Failed to process merchant ${merchantName}: ${err.message}`);
          results.push({ merchant: merchantName, race: '—', status: 'error', reason: err.message });
          errors++;
          if (!errorMerchants.includes(merchantName)) errorMerchants.push(merchantName);
        }
      }
    } catch (err) {
      this.logger.error(`Cron fatal error: ${err.message}`, err.stack);
      await this.sendTelegram(
        `❌ Cron đối soát tự động gặp lỗi nghiêm trọng\nKỳ: ${period_start} → ${period_end}\n${err.message}`,
      );
      this.isRunning = false;
      return;
    }

    this.isRunning = false;
    this.logger.log(`Cron done — created=${created}, skipped=${skipped}, errors=${errors}`);

    // Save cron log entry
    const errorDetails = results
      .filter((r) => r.status === 'error')
      .map((r) => ({
        tenant_id: 0,
        merchant_name: r.merchant,
        race_title: r.race,
        reason: r.reason ?? '',
      }));
    try {
      await this.cronLogModel.create({
        period,
        ran_at: new Date(),
        created_count: created,
        skipped_count: skipped,
        error_count: errors,
        error_details: errorDetails,
        triggered_by: 'cron',
      });
    } catch (logErr) {
      this.logger.error(`Failed to save cron log: ${logErr.message}`);
    }

    const month = `T${String(prevMonthStart.getMonth() + 1).padStart(2, '0')}/${prevMonthStart.getFullYear()}`;
    let msg = `🤖 Auto đối soát ${month} hoàn thành\n`;
    msg += `✅ Đã tạo: ${created} bản\n`;
    msg += `⏭ Bỏ qua: ${skipped} (0 đơn hoặc đã có)\n`;
    if (errors > 0) {
      msg += `🔴 Cần xử lý: ${errors} lỗi (${errorMerchants.slice(0, 3).join(', ')}${errorMerchants.length > 3 ? '...' : ''})\n`;
    }
    msg += `\n→ Xem tại: ${ADMIN_URL}`;

    await this.sendTelegram(msg);
  }

  private async sendTelegram(text: string) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
        },
      );
      if (!res.ok) {
        this.logger.error(`Telegram failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      this.logger.error(`Telegram send error: ${err.message}`);
    }
  }

  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
