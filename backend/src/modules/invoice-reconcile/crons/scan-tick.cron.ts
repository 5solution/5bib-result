/**
 * F-076 BR-11 Scan tick — `@Cron('*\/5 * 8-22 * * *')` ICT
 *
 * Pattern port từ `dashboard/services/dashboard-aggregator.cron.ts`.
 *
 * Mỗi 5 phút trong giờ làm việc 08:00-22:00 ICT (180 tick/ngày):
 *  1. SETNX lock 4 phút (anti-stampede)
 *  2. Pull Layer 1 (DB) + Layer 2 (MISA)
 *  3. Classify + diff vs last snapshot
 *  4. Emit URGENT alert (Loại 2/3/4/5/6) ngay khi detect
 *  5. Cache report Redis (cho admin UI + hourly recap reuse)
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';

@Injectable()
export class InvoiceScanTickCron {
  private readonly logger = new Logger(InvoiceScanTickCron.name);

  constructor(private readonly reconcile: InvoiceReconcileService) {}

  @Cron('0 */5 8-22 * * *', {
    name: 'invoice-reconcile-scan-tick',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async run(): Promise<void> {
    const enabled = this.reconcile.getEnabledRaceIds();
    if (enabled.length === 0) {
      this.logger.debug('[scan-tick] no enabled races, skip');
      return;
    }
    const acquired = await this.reconcile.tryAcquireLock();
    if (!acquired) {
      this.logger.log('[scan-tick] lock busy, skip tick');
      return;
    }
    const date = isoDateIct(new Date());
    const start = Date.now();
    try {
      const report = await this.reconcile.scan(date, 'cron');
      const ms = Date.now() - start;
      this.logger.log(
        `[scan-tick] OK ms=${ms} date=${date} expected=${report.expectedCount} missing=${report.missingCount} maxSeverity=${report.maxSeverity}`,
      );
    } catch (e) {
      this.logger.error(
        `[scan-tick] fail date=${date}: ${(e as Error).message}`,
      );
    } finally {
      await this.reconcile.releaseLock();
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
