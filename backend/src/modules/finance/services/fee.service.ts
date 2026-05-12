import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { OrderReadonly } from '../entities/order-readonly.entity';

/**
 * F-028 BR-PNL-04 + BR-PNL-22 — cross-DB MySQL platform pull cho TICKET_SALES.
 *
 * Compute "actual revenue" của 1 race-deal bằng SUM total_price của orders:
 *   - tenant_id match contract.tenantId (BIGINT từ MySQL platform)
 *   - mysql_race_id match (BIGINT)
 *   - internal_status = 'COMPLETE' (5BIB platform convention — equivalent
 *     "paid" trong PRD ban đầu — confirm qua F-016 ReconciliationQueryService
 *     line 73)
 *   - order_category ∈ FIVE_BIB_CATEGORIES (EXCLUDE 'MANUAL' — bài học
 *     F-016 BR-01)
 *   - deleted = 0
 *
 * Phase 1 scope: KHÔNG split payment_ref (Phase 2). Trả tổng GMV — coi như
 * revenue 5BIB-share đầy đủ tới khi BBNT actual về.
 *
 * Edge cases:
 *   - tenantId / mysqlRaceId null → return null (caller fallback estimatedFee)
 *   - MySQL connection down → log warn + return null (graceful degradation,
 *     UP-07 + UP-11 test case)
 *   - 0 order paid → return 0 (revenue legit 0)
 */
@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  private static readonly FIVE_BIB_CATEGORIES = [
    'ORDINARY',
    'PERSONAL_GROUP',
    'CHANGE_COURSE',
    'GROUP_BUY',
    'GROUP_BUY_FIXED',
    'CODE_TRANSFER',
  ];

  constructor(
    @Optional()
    @InjectRepository(OrderReadonly, 'platform')
    private readonly orderRepo: Repository<OrderReadonly> | null,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /**
   * Pull SUM(total_price) cho TICKET_SALES contract. Trả null nếu không pull
   * được (caller cần fallback). 5min Redis cache (BR-PNL-13).
   */
  async getActualRevenueForRace(
    tenantId: number | null | undefined,
    mysqlRaceId: number | null | undefined,
    contractId: string,
  ): Promise<{ revenue: number | null; warning?: string }> {
    if (!tenantId || !mysqlRaceId) {
      return {
        revenue: null,
        warning:
          'Hợp đồng chưa liên kết tenantId / mysqlRaceId — không pull được doanh thu thực, dùng ước tính',
      };
    }

    if (!this.orderRepo) {
      return {
        revenue: null,
        warning:
          'Platform DB chưa cấu hình (PLATFORM_DB_HOST unset) — dùng ước tính',
      };
    }

    const cacheKey = `pnl:ticket-sales-fee:${contractId}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const parsed = Number(cached);
          if (!Number.isNaN(parsed)) return { revenue: parsed };
        }
      } catch (e) {
        this.logger.warn(
          `[finance] redis get fail ${cacheKey}: ${(e as Error).message}`,
        );
      }
    }

    try {
      const row = await this.orderRepo
        .createQueryBuilder('o')
        .innerJoin(
          'order_line_item',
          'oli',
          'oli.order_id = o.id',
        )
        .innerJoin('ticket_type', 'tt', 'tt.id = oli.ticket_type_id')
        .innerJoin('race_course', 'rc', 'rc.id = tt.race_course_id')
        .select('SUM(o.total_price)', 'total')
        .where('rc.race_id = :raceId', { raceId: mysqlRaceId })
        .andWhere('o.tenant_id = :tenantId', { tenantId })
        .andWhere("o.internal_status = 'COMPLETE'")
        .andWhere('o.deleted = 0')
        .andWhere('o.order_category IN (:...cats)', {
          cats: FeeService.FIVE_BIB_CATEGORIES,
        })
        .getRawOne<{ total: string | null }>();

      // Mỗi line item lặp đơn — DISTINCT cần thiết khi 1 order có 2 LI
      // → fallback: query simpler theo order_metadata trực tiếp tránh nhân bản.
      const orderRow = await this.orderRepo
        .createQueryBuilder('o')
        .select('SUM(o.total_price)', 'total')
        .where('o.tenant_id = :tenantId', { tenantId })
        .andWhere("o.internal_status = 'COMPLETE'")
        .andWhere('o.deleted = 0')
        .andWhere('o.order_category IN (:...cats)', {
          cats: FeeService.FIVE_BIB_CATEGORIES,
        })
        .andWhere(
          `o.id IN (
            SELECT DISTINCT oli2.order_id
            FROM order_line_item oli2
            INNER JOIN ticket_type tt2 ON tt2.id = oli2.ticket_type_id
            INNER JOIN race_course rc2 ON rc2.id = tt2.race_course_id
            WHERE rc2.race_id = :raceId2
          )`,
          { raceId2: mysqlRaceId },
        )
        .getRawOne<{ total: string | null }>();

      // Prefer distinct-order based total để tránh nhân bản join (line items)
      const revenue = Number(orderRow?.total ?? row?.total ?? 0);

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, String(revenue), 'EX', 300);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set fail ${cacheKey}: ${(e as Error).message}`,
          );
        }
      }

      return { revenue };
    } catch (err) {
      this.logger.warn(
        `[finance] MySQL pull fail tenant=${tenantId} race=${mysqlRaceId}: ${
          (err as Error).message
        }`,
      );
      return {
        revenue: null,
        warning:
          'Không truy vấn được doanh thu thực từ platform DB — dùng ước tính. Liên hệ kỹ thuật nếu lặp lại.',
      };
    }
  }
}
