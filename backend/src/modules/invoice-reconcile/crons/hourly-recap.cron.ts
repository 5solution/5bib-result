/**
 * F-076 + F-079 BR-79-01 Heartbeat Recap — `@Cron('0 0 8,10,12,14,16,18,20,22 * * *')` ICT
 *
 * 2 tiếng/lần 08:00-22:00 ICT (8 tick/ngày). Bao gồm 22:00 sau EOD 21:00 vì
 * content khác (heartbeat = current snapshot, EOD = full-day counters).
 *
 * KHÔNG re-scan; chỉ đọc cached report + previous snapshot → compute diff
 * + resolve race titles → render Loại 1 INFO Heartbeat/Recap → send Telegram.
 *
 * F-079 BR-79-04: ALWAYS send (relax BR-25 skip-when-OK condition) — heartbeat
 * giúp Danny + Hiền visibility cron alive kể cả khi missing=0.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';

@Injectable()
export class InvoiceHourlyRecapCron {
  private readonly logger = new Logger(InvoiceHourlyRecapCron.name);

  constructor(private readonly reconcile: InvoiceReconcileService) {}

  // F-079 BR-79-01 — đổi từ '0 0 8-20 * * *' (13 tick) → 2h tick 8-22.
  // Name + TZ giữ NGUYÊN BR-79-03 — KHÔNG đổi ScheduleRegistry mapping.
  @Cron('0 0 8,10,12,14,16,18,20,22 * * *', {
    name: 'invoice-reconcile-hourly-recap',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async run(): Promise<void> {
    const enabled = this.reconcile.getEnabledRaceIds();
    if (enabled.length === 0) return;

    const date = isoDateIct(new Date());
    try {
      const { sent, report } = await this.reconcile.runHourlyRecap(date);
      if (!report) {
        this.logger.log('[hourly-recap] no cached report yet, skip');
        return;
      }
      this.logger.log(
        `[hourly-recap] sent=${sent} date=${date} expected=${report.expectedCount} missing=${report.missingCount}`,
      );
    } catch (e) {
      this.logger.error(
        `[hourly-recap] fail date=${date}: ${(e as Error).message}`,
      );
    }
  }
}

function isoDateIct(now: Date): string {
  const ict = new Date(now.getTime() + 7 * 3_600_000);
  const yyyy = ict.getUTCFullYear();
  const mm = String(ict.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ict.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
