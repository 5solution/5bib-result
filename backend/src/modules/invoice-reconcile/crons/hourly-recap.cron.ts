/**
 * F-076 BR-11 + BR-25 Hourly recap — `@Cron('0 0 8-20 * * *')` ICT
 *
 * Đúng tiếng tròn 08:00-20:00 ICT (13 tick/ngày — skip 21:00 vì EOD thay).
 *
 * KHÔNG re-scan; chỉ đọc cached report + previous snapshot → compute diff
 * → render Loại 1 INFO Hourly Recap → send Telegram.
 *
 * Skip condition (BR-25): no missing AND no diff → bỏ qua tick để tránh
 * noise (xem alert.service.sendHourlyRecap).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';

@Injectable()
export class InvoiceHourlyRecapCron {
  private readonly logger = new Logger(InvoiceHourlyRecapCron.name);

  constructor(private readonly reconcile: InvoiceReconcileService) {}

  @Cron('0 0 8-20 * * *', {
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
