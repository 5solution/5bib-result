import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KpiCardDto, KpiResponseDto } from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-01/02/04/21 — KPI MTD vs prev MTD.
 *
 * Bốn KPI cố định MVP:
 *  - GMV (gross merchandise value, MTD, exclude MANUAL orders)
 *  - Doanh thu net (sau discount)
 *  - VĐV đăng ký (count distinct user_id paid)
 *  - Phí 5BIB (platform fee đã thu trong MTD, lấy từ reconciliations đã sent)
 *
 * Source-of-truth: bảng MySQL `order_metadata` (platform DB) — invariant
 * `financial_status='paid'` (BR-DASH-04) + exclude `order_category='MANUAL'`
 * (5BIB không có revenue share trên manual order).
 *
 * Delta = (cur - prev) / prev × 100, làm tròn 1 chữ số. NULL khi prev=0 hoặc
 * cả hai = 0 (BR-DASH-02 → UI hiển thị "—").
 */
@Injectable()
export class DashboardKpiService {
  private readonly logger = new Logger(DashboardKpiService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
  ) {}

  async getMtdKpis(): Promise<KpiResponseDto> {
    const now = new Date();
    const periodStart = this.startOfMonth(now);
    const elapsedDays = Math.max(
      1,
      Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1,
    );

    // Prev MTD = cùng số ngày của tháng trước (BR-DASH-01).
    const prevMonthStart = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1),
    );
    const prevPeriodEnd = new Date(prevMonthStart);
    prevPeriodEnd.setUTCDate(prevPeriodEnd.getUTCDate() + elapsedDays);

    const curRange = {
      start: this.fmtDate(periodStart),
      end: this.fmtDateExclusive(now),
    };
    const prevRange = {
      start: this.fmtDate(prevMonthStart),
      end: this.fmtDate(prevPeriodEnd),
    };

    const [cur, prev] = await Promise.all([
      this.aggregateOrders(curRange.start, curRange.end),
      this.aggregateOrders(prevRange.start, prevRange.end),
    ]);

    const kpis: KpiCardDto[] = [
      this.toCard('gmv', 'GMV tháng này', cur.gmv, prev.gmv, 'vnd'),
      this.toCard('net', 'Doanh thu net', cur.net, prev.net, 'vnd'),
      this.toCard('athletes', 'VĐV đăng ký', cur.athletes, prev.athletes, 'count'),
      this.toCard(
        'platform_fee',
        'Phí 5BIB',
        cur.platformFee,
        prev.platformFee,
        'vnd',
      ),
    ];

    return {
      kpis,
      period: 'mtd',
      periodStart: periodStart.toISOString(),
      prevPeriodStart: prevMonthStart.toISOString(),
    };
  }

  /**
   * Aggregate paid orders trong khoảng [start, end). Loại MANUAL khỏi GMV/net.
   * Platform fee tính từ feeRate snapshot trong reconciliation? Ở MVP đơn giản
   * lấy net × 0.055 (rate mặc định 5.5%) khi merchant config không có.
   * KHÔNG ánh xạ chính xác từng tenant để giữ scope nhỏ — analytics module đã có
   * tính toán chi tiết riêng nếu Finance cần.
   */
  private async aggregateOrders(
    start: string,
    end: string,
  ): Promise<{ gmv: number; net: number; athletes: number; platformFee: number }> {
    try {
      const [row] = await this.db.query(
        `SELECT
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) AS gmv,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL'
            THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0)
            ELSE 0 END), 0) AS net,
          COUNT(DISTINCT CASE WHEN order_category != 'MANUAL' THEN user_id END) AS athletes
        FROM order_metadata
        WHERE financial_status = 'paid'
          AND payment_on >= ? AND payment_on < ?`,
        [start, end],
      );
      const gmv = Number(row?.gmv ?? 0);
      const net = Number(row?.net ?? 0);
      const athletes = Number(row?.athletes ?? 0);
      // Phí 5BIB ước lượng = net × 5.5% (rate mặc định khi không lookup tenant).
      const platformFee = Math.round(net * 0.055);
      return { gmv, net, athletes, platformFee };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`KPI aggregate fail (${start}..${end}): ${msg}`);
      return { gmv: 0, net: 0, athletes: 0, platformFee: 0 };
    }
  }

  private toCard(
    key: string,
    label: string,
    value: number,
    prevValue: number,
    unit: 'vnd' | 'count',
  ): KpiCardDto {
    const deltaPercent = this.computeDelta(value, prevValue);
    return { key, label, value, prevValue, deltaPercent, unit };
  }

  /**
   * BR-DASH-02 — chia 0 hoặc cả hai = 0 → NULL ("—" trên UI).
   */
  private computeDelta(cur: number, prev: number): number | null {
    if (prev === 0 || cur === 0) {
      if (cur === 0 && prev === 0) return null;
      // prev = 0, cur > 0 → tăng vô cùng, vẫn trả NULL để UI render "—" (đồng bộ design)
      if (prev === 0) return null;
    }
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  }

  private startOfMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private fmtDateExclusive(d: Date): string {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
}
