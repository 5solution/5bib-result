import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';

/**
 * Pre-warm analytics cache so DB is never hit directly during user requests.
 *
 * Strategy:
 *  - Every 15 min: warm current month (overview, daily revenue, top-races,
 *    category, merchants, funnel).
 *  - Daily at 02:00: warm the previous 12 months (overview + merchants only;
 *    historical data rarely changes so 24h TTL is sufficient).
 */
@Injectable()
export class AnalyticsCron {
  private readonly logger = new Logger(AnalyticsCron.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private monthStr(offset = 0): string {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthRange(month: string): { from: string; to: string } {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(days).padStart(2, '0')}`,
    };
  }

  private async warmMonth(month: string): Promise<void> {
    const { from, to } = this.monthRange(month);
    const q = (extra: object = {}) => ({ month, from, to, ...extra } as any);

    await Promise.allSettled([
      this.analyticsService.getOverview(q()),
      this.analyticsService.getDailyRevenue(q()),
      this.analyticsService.getTopRaces(q({ limit: 5 })),
      this.analyticsService.getRevenueByCategory(q()),
      this.analyticsService.getMerchantComparison(q()),
      this.analyticsService.getFunnel(q()),
    ]);
  }

  private async warmOverviewOnly(month: string): Promise<void> {
    const { from, to } = this.monthRange(month);
    const q = { month, from, to } as any;

    await Promise.allSettled([
      this.analyticsService.getOverview(q),
      this.analyticsService.getMerchantComparison(q),
    ]);
  }

  // ─── Jobs ──────────────────────────────────────────────────────────────────

  /** Every 15 min — keep current month cache fresh */
  @Cron('*/15 * * * *')
  async warmCurrentMonth(): Promise<void> {
    const month = this.monthStr(0);
    this.logger.log(`[cache warm] current month ${month}`);
    try {
      await this.warmMonth(month);
      this.logger.log(`[cache warm] current month ${month} done`);
    } catch (e) {
      this.logger.error(`[cache warm] current month failed: ${e}`);
    }
  }

  /** Daily at 02:00 — refresh historical months (24h TTL, low priority) */
  @Cron('0 2 * * *')
  async warmHistoricalMonths(): Promise<void> {
    this.logger.log('[cache warm] historical months start');
    for (let i = 1; i <= 12; i++) {
      const month = this.monthStr(-i);
      try {
        await this.warmOverviewOnly(month);
      } catch (e) {
        this.logger.warn(`[cache warm] month ${month} failed: ${e}`);
      }
    }
    this.logger.log('[cache warm] historical months done');
  }
}
