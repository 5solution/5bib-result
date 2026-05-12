import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { OrderReadonly } from '../entities/order-readonly.entity';
import { Tenant } from '../../merchant/entities/tenant.entity';
import {
  RaceSearchResultDto,
  TenantSearchResultDto,
} from '../dto/mysql-lookup.dto';

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
    @Optional()
    @InjectRepository(Tenant, 'platform')
    private readonly tenantRepo?: Repository<Tenant> | null,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // F-028 — MySQL Tenant + Race picker (admin UI link TICKET_SALES → MySQL)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Search MySQL `tenant` table by name or tax_id (col `vat`). Max 20 rows.
   * Empty query → 20 most-recent tenants (UX: show defaults instead of empty).
   * Redis cache 60s (`mysql-lookup:tenant:<q>`).
   */
  async searchTenants(q: string | undefined): Promise<TenantSearchResultDto[]> {
    if (!this.tenantRepo) return [];
    const query = (q ?? '').trim();
    const cacheKey = `mysql-lookup:tenant:${query.toLowerCase()}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as TenantSearchResultDto[];
      } catch (e) {
        this.logger.warn(
          `[finance] redis get ${cacheKey} fail: ${(e as Error).message}`,
        );
      }
    }

    try {
      const qb = this.tenantRepo
        .createQueryBuilder('t')
        .select(['t.id AS id', 't.name AS name', 't.vat AS vat'])
        .where('t.deleted = 0 OR t.deleted IS NULL');
      if (query.length > 0) {
        const like = `%${query}%`;
        qb.andWhere('(t.name LIKE :like OR t.vat LIKE :like)', { like });
      }
      qb.orderBy('t.name', 'ASC').limit(20);

      const rows: Array<{ id: number; name: string; vat: string | null }> =
        await qb.getRawMany();
      const result: TenantSearchResultDto[] = rows.map((r) => ({
        id: Number(r.id),
        name: r.name ?? '',
        taxId: r.vat ?? null,
      }));

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set ${cacheKey} fail: ${(e as Error).message}`,
          );
        }
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `[finance] searchTenants fail q="${query}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Search MySQL `races` table cho 1 tenant. Optional substring filter trên
   * title. Max 30 rows ORDER BY created_on DESC (most-recent first).
   * Redis cache 60s (`mysql-lookup:races:<tenantId>:<q>`).
   *
   * @throws BadRequestException khi tenantId invalid (<= 0)
   */
  async searchRaces(
    tenantId: number,
    q?: string,
  ): Promise<RaceSearchResultDto[]> {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('tenantId không hợp lệ');
    }
    if (!this.tenantRepo) return [];
    const query = (q ?? '').trim();
    const cacheKey = `mysql-lookup:races:${tenantId}:${query.toLowerCase()}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as RaceSearchResultDto[];
      } catch (e) {
        this.logger.warn(
          `[finance] redis get ${cacheKey} fail: ${(e as Error).message}`,
        );
      }
    }

    try {
      // Raw SQL — `races` table không có TypeORM entity mapped (pattern
      // F-016 ReconciliationQueryService line 174-180).
      let sql = `
        SELECT r.race_id AS raceId, r.title AS title, r.created_on AS createdOn
        FROM races r
        WHERE r.tenant_id = ?
      `;
      const params: any[] = [tenantId];
      if (query.length > 0) {
        sql += ' AND r.title LIKE ?';
        params.push(`%${query}%`);
      }
      sql += ' ORDER BY r.created_on DESC LIMIT 30';

      const rows: Array<{
        raceId: number;
        title: string;
        createdOn: Date | null;
      }> = await this.tenantRepo.manager.query(sql, params);

      const result: RaceSearchResultDto[] = rows.map((r) => ({
        raceId: Number(r.raceId),
        title: r.title ?? '',
        createdOn:
          r.createdOn instanceof Date
            ? r.createdOn.toISOString()
            : r.createdOn ?? null,
      }));

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set ${cacheKey} fail: ${(e as Error).message}`,
          );
        }
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `[finance] searchRaces tenant=${tenantId} q="${query}" fail: ${
          (err as Error).message
        }`,
      );
      return [];
    }
  }

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
      // F-028 HIGH-02 QC carryover — chỉ 1 query DISTINCT subquery.
      //
      // Previously: 2 queries sequential await (~400ms waste). Query 1 inner
      // join order_line_item → nhân bản total khi 1 order có ≥2 line items.
      // Query 2 dùng `o.id IN (SELECT DISTINCT ...)` subquery → 1 order chỉ
      // sum 1 lần dù có nhiều LI. Query 2 = source-of-truth, query 1 chưa
      // bao giờ được dùng (logic `orderRow ?? row` luôn ưu tiên orderRow).
      // → Bỏ query 1.
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

      const revenue = Number(orderRow?.total ?? 0);

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
