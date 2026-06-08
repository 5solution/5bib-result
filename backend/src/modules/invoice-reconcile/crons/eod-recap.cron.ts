/**
 * F-076 BR-11 + BR-31 EOD recap — `@Cron('0 0 21 * * *')` ICT
 *
 * 21:00 ICT hằng ngày. Replace tiếng tròn 21:00 (Hourly recap skip).
 *
 * Đọc cached report + daily counters → render Loại 7 EOD Daily Recap → send.
 * Luôn gửi (KHÔNG skip kể cả 0 đơn pending — kế toán cần biết).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';

@Injectable()
export class InvoiceEodRecapCron {
  private readonly logger = new Logger(InvoiceEodRecapCron.name);

  constructor(private readonly reconcile: InvoiceReconcileService) {}

  @Cron('0 0 21 * * *', {
    name: 'invoice-reconcile-eod-recap',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async run(): Promise<void> {
    const enabled = this.reconcile.getEnabledRaceIds();
    if (enabled.length === 0) {
      this.logger.debug('[eod-recap] no enabled races, skip');
      return;
    }
    const date = isoDateIct(new Date());
    try {
      const { sent } = await this.reconcile.runEodRecap(date);
      this.logger.log(`[eod-recap] sent=${sent} date=${date}`);
    } catch (e) {
      this.logger.error(`[eod-recap] fail date=${date}: ${(e as Error).message}`);
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
