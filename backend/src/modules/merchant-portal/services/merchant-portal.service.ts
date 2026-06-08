import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import * as ExcelJS from 'exceljs';
import type Redis from 'ioredis';
import { Model } from 'mongoose';
import { DataSource } from 'typeorm';

import {
  dateToMonthKey,
  dateToWeekKey,
  labelForMonthKey,
  labelForWeekKey,
  mysqlYearweekToWeekKey,
  normalizePaymentOn,
  ymdUtc,
} from '../../analytics/services/bucket-helpers';
import { pullOrdersForFeeAggregate } from '../../analytics/services/fee-aggregate.helpers';
import {
  type PeriodKind,
  resolvePeriod,
} from '../../analytics/services/period-resolver';
import { FeeService } from '../../finance/services/fee.service';
import type { LogtoUser } from '../../logto-auth/types';
import {
  AdminRaceSearchItemDto,
  AdminRaceSearchResponseDto,
  AdminTenantSearchItemDto,
  AdminTenantSearchResponseDto,
} from '../dto/admin-search.dto';
import { MerchantMeResponseDto } from '../dto/merchant-me.dto';
import { ParticipantInsightsDto } from '../dto/participant-insights.dto';
import { RaceCapacityDto } from '../dto/capacity.dto';
import {
  aggregateCapacity,
  type RawCapacityRow,
} from '../utils/capacity.util';
import {
  YoyComparableDto,
  YoyCurveDto,
  YoySeriesDto,
} from '../dto/yoy.dto';
import { daysBefore, cumulativeCurve } from '../utils/yoy.util';
import {
  aggregateParticipants,
  type RawParticipantRow,
} from '../utils/participant-insights.util';
import {
  RevenueAggregateDto,
  RevenueByCategoryDto,
  RevenueCategoryGroupDto,
  RevenueTenantRowDto,
} from '../dto/revenue-breakdown.dto';
import { RevenueSummaryDto } from '../dto/revenue-summary.dto';
import {
  RevenueTrendDto,
  RevenueTrendPointDto,
} from '../dto/revenue-trend.dto';
import {
  MerchantRaceItemDto,
  MerchantRaceListResponseDto,
} from '../dto/race-list.dto';
import {
  StackedCourseDto,
  StackedSeriesPointDto,
  TicketForecastDto,
  TicketForecastPointDto,
  TicketHeatmapDto,
  TicketOrderListDto,
  TicketOrderRowDto,
  TicketStackedDto,
  TicketTargetDto,
  TicketTrendDto,
  TicketTrendPointDto,
} from '../dto/ticket-charts.dto';
import {
  type TicketChartGranularity,
  TicketBreakdownItemDto,
  TicketSalesBreakdownDto,
  TicketSalesSummaryDto,
  TicketStatusCountDto,
} from '../dto/ticket-sales.dto';
import {
  MerchantPortalAccess,
  MerchantPortalAccessDocument,
  type MerchantPortalPermission,
} from '../schemas/merchant-portal-access.schema';
import {
  MerchantRaceTarget,
  MerchantRaceTargetDocument,
} from '../schemas/merchant-race-target.schema';

/**
 * F-069 M2b-1 — MerchantPortalService (merchant-facing core).
 *
 * Owns access resolution + race list cho merchant users. Ticket-sales (M2b-2)
 * + revenue (M2b-3) endpoints sẽ depend on `resolveAccessibleRaces` ở đây.
 *
 * SCHEMA SOURCE OF TRUTH = `01-ba-prd-revision-r3.md` canonical SQL templates
 * (verified column-by-column vs DB thật 2026-06-05). KEY FACTS:
 *   - order_metadata KHÔNG có tenant_id → scope qua JOIN races r WHERE r.tenant_id
 *   - races.status UPPERCASE {COMPLETE/GENERATED_CODE/DRAFT/CANCEL/ONGOING}, filter `!= 'DRAFT'`
 *   - races PK = race_id (bigint), event_start_date (no `date`), is_delete (bit raw `= 0`)
 *   - order_metadata.deleted (bit raw `= 0`), financial_status = 'paid'
 *
 * Cache (BR-MP-13):
 *   - `merchant-portal:access:<userId>` access config — TTL 300s
 *   - `merchant-portal:races:<userId>` resolved race ID set — TTL 300s
 * Invalidated by admin config mutation (MerchantPortalAccessService.invalidateUserCache).
 */

const ACCESS_CACHE_TTL_SECONDS = 300;
const RACES_CACHE_TTL_SECONDS = 300;
const TICKET_SALES_CACHE_TTL_SECONDS = 60;

/**
 * Canonical financial_status values (R3 FINAL BR-MP-08, verified live DB 2026-06-05:
 * paid 35,618 / voided 9,405 / pending 1). Summary KPI ALWAYS renders these 3
 * (0 if absent in scope) so frontend KPI cards are stable.
 */
const CANONICAL_FINANCIAL_STATUSES = ['paid', 'voided', 'pending'] as const;

/** F-IMPORT — bucket label for import vé that have no demographic row (reconciles charts to total). */
const NO_DATA_LABEL = 'Chưa có dữ liệu';

/**
 * BR-MP-12 (Danny chốt Option A 2026-06-05): only `MANUAL` order_category uses
 * fixed fee (VNĐ/vé). EVERYTHING else — incl null/unknown — is %-based.
 * Keep `categoryGroup` null-safe so a future category auto-falls into fee_percent.
 */
function categoryGroup(orderCategory: string | null): 'fee_fixed' | 'fee_percent' {
  return orderCategory === 'MANUAL' ? 'fee_fixed' : 'fee_percent';
}

/** Internal access config shape cached + returned by getAccessConfig. */
export interface ResolvedAccessConfig {
  userId: string;
  userName: string;
  email: string;
  tenantIds: number[];
  include: number[];
  exclude: number[];
  permissions: MerchantPortalPermission[];
  isActive: boolean;
}

@Injectable()
export class MerchantPortalService {
  private readonly logger = new Logger(MerchantPortalService.name);

  constructor(
    @InjectModel(MerchantPortalAccess.name)
    private readonly accessModel: Model<MerchantPortalAccessDocument>,
    @InjectModel(MerchantRaceTarget.name)
    private readonly raceTargetModel: Model<MerchantRaceTargetDocument>,
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly feeService: FeeService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Access config (BR-MP-04/05) — cached read by userId
  // ────────────────────────────────────────────────────────────────

  /**
   * Load merchant access config by Logto userId. Cache 300s.
   * Throws:
   *   - 404 `404_NO_CONFIG` nếu user chưa được admin gán giải nào (BR-MP-18 step 5)
   *   - 403 `403_INACTIVE` nếu config.isActive=false (BR-MP-34 SEC-08)
   */
  async getAccessConfig(userId: string): Promise<ResolvedAccessConfig> {
    const cacheKey = `merchant-portal:access:${userId}`;

    let cachedCfg: ResolvedAccessConfig | null = null;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) cachedCfg = JSON.parse(cached) as ResolvedAccessConfig;
    } catch (err) {
      this.logger.warn(
        `Redis read ${cacheKey} failed: ${(err as Error).message}`,
      );
    }
    if (cachedCfg) {
      this.assertActive(cachedCfg); // outside try — 403 must propagate
      return cachedCfg;
    }

    const doc = await this.accessModel.findOne({ userId }).lean().exec();
    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        errorCode: '404_NO_CONFIG',
        message: {
          vi: 'Tài khoản của bạn chưa được gán giải nào. Vui lòng liên hệ admin 5BIB.',
          en: 'Your account has no race assignments. Please contact 5BIB admin.',
        },
      });
    }

    const cfg: ResolvedAccessConfig = {
      userId: doc.userId,
      userName: doc.userName,
      email: doc.email,
      tenantIds: doc.tenantIds ?? [],
      include: doc.raceOverrides?.include ?? [],
      exclude: doc.raceOverrides?.exclude ?? [],
      permissions: doc.permissions,
      isActive: doc.isActive,
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(cfg),
        'EX',
        ACCESS_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis write ${cacheKey} failed: ${(err as Error).message}`,
      );
    }

    this.assertActive(cfg);
    return cfg;
  }

  private assertActive(cfg: ResolvedAccessConfig): void {
    if (!cfg.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_INACTIVE',
        message: {
          vi: 'Tài khoản đã bị vô hiệu hóa',
          en: 'Account has been deactivated',
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Admin search — "Gán quyền BTC" dialog (tenant picker + per-race picker)
  // ────────────────────────────────────────────────────────────────

  /**
   * Search BTC (tenant) ĐANG tổ chức giải (≥1 race chưa xóa). Phục vụ admin
   * dialog gán quyền — chỉ list tenant có giải để admin không gán nhầm tenant
   * trống. Tax/MST = cột `tenant.vat` (tên cột vat nhưng lưu mã số thuế).
   *
   * q optional: khớp name LIKE %q% OR vat LIKE %q% OR id (CAST exact). Bỏ trống
   * → 50 tenant đầu theo name ASC. Parameterized (KHÔNG string-interpolate).
   */
  async searchTenants(q?: string): Promise<AdminTenantSearchResponseDto> {
    const term = q?.trim();
    let sql =
      `SELECT DISTINCT t.id AS id, t.name AS name, t.vat AS vat
       FROM tenant t
       JOIN races r ON r.tenant_id = t.id
       WHERE r.is_delete = 0`;
    const params: Array<string | number> = [];
    if (term) {
      const like = `%${term}%`;
      sql += ' AND (t.name LIKE ? OR t.vat LIKE ? OR CAST(t.id AS CHAR) = ?)';
      params.push(like, like, term);
    }
    sql += ' ORDER BY t.name ASC LIMIT 50';

    const rows: Array<{
      id: number | string;
      name: string | null;
      vat: string | null;
    }> = await this.db.query(sql, params);

    const items: AdminTenantSearchItemDto[] = rows.map((row) => ({
      id: Number(row.id),
      name: row.name ?? '',
      taxCode: row.vat ?? null,
    }));
    return { items };
  }

  /**
   * Search giải (non-draft, chưa xóa) cho per-race access grant picker. Kèm tên
   * BTC làm context (LEFT JOIN tenant — giữ giải dù tenant đã xóa).
   *
   * q optional: khớp title LIKE %q% OR race_id (CAST exact). Bỏ trống → 50 giải
   * mới nhất theo event_start_date DESC. Parameterized.
   */
  async searchRaces(q?: string): Promise<AdminRaceSearchResponseDto> {
    const term = q?.trim();
    let sql =
      `SELECT r.race_id AS race_id, r.title AS title, r.status AS status,
              r.tenant_id AS tenant_id, t.name AS tenant_name
       FROM races r
       LEFT JOIN tenant t ON t.id = r.tenant_id
       WHERE r.is_delete = 0 AND r.status != 'DRAFT'`;
    const params: Array<string | number> = [];
    if (term) {
      const like = `%${term}%`;
      sql += ' AND (r.title LIKE ? OR CAST(r.race_id AS CHAR) = ?)';
      params.push(like, term);
    }
    sql += ' ORDER BY r.event_start_date DESC LIMIT 50';

    const rows: Array<{
      race_id: number | string;
      title: string | null;
      status: string | null;
      tenant_id: number | string | null;
      tenant_name: string | null;
    }> = await this.db.query(sql, params);

    const items: AdminRaceSearchItemDto[] = rows.map((row) => ({
      raceId: Number(row.race_id),
      title: row.title ?? '',
      status: row.status ?? '',
      tenantId: Number(row.tenant_id ?? 0),
      tenantName: row.tenant_name ?? null,
    }));
    return { items };
  }

  // ────────────────────────────────────────────────────────────────
  // resolveAccessibleRaces (BR-MP-05/06) — Set<raceId> for scoping
  // ────────────────────────────────────────────────────────────────

  /**
   * BR-MP-05 — Resolve set of MySQL race_id user được phép xem:
   *   (tenant races status != 'DRAFT') ∪ raceOverrides.include (non-draft) − exclude
   *
   * Draft races NEVER shown (BR-MP-05 strict) — filter applies to BOTH tenant
   * races và include overrides. Returns `Set<number>` cached 300s.
   *
   * Mọi ticket-sales / revenue endpoint (M2b-2/3) PHẢI gọi method này TRƯỚC mọi
   * query để có scope, rồi validate `raceId ∈ Set` (IDOR prevention BR-MP-06).
   */
  async resolveAccessibleRaces(userId: string): Promise<Set<number>> {
    const cacheKey = `merchant-portal:races:${userId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return new Set(JSON.parse(cached) as number[]);
      }
    } catch (err) {
      this.logger.warn(
        `Redis read ${cacheKey} failed: ${(err as Error).message}`,
      );
    }

    const cfg = await this.getAccessConfig(userId); // 404/403 checks
    const accessible = new Set<number>();

    // 1. Tenant-scoped races (non-draft, not deleted)
    if (cfg.tenantIds.length > 0) {
      const tenantPlaceholders = cfg.tenantIds.map(() => '?').join(',');
      const tenantRaces: Array<{ race_id: number | string }> =
        await this.db.query(
          `SELECT r.race_id
           FROM races r
           WHERE r.tenant_id IN (${tenantPlaceholders})
             AND r.status != 'DRAFT' AND r.is_delete = 0`,
          cfg.tenantIds,
        );
      for (const row of tenantRaces) accessible.add(Number(row.race_id));
    }

    // 2. Per-race include overrides (validate non-draft, exists)
    if (cfg.include.length > 0) {
      const incPlaceholders = cfg.include.map(() => '?').join(',');
      const includeRaces: Array<{ race_id: number | string }> =
        await this.db.query(
          `SELECT r.race_id
           FROM races r
           WHERE r.race_id IN (${incPlaceholders})
             AND r.status != 'DRAFT' AND r.is_delete = 0`,
          cfg.include,
        );
      for (const row of includeRaces) accessible.add(Number(row.race_id));
    }

    // 3. Exclude overrides
    for (const excludeId of cfg.exclude) accessible.delete(excludeId);

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify([...accessible]),
        'EX',
        RACES_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis write ${cacheKey} failed: ${(err as Error).message}`,
      );
    }

    return accessible;
  }

  /**
   * BR-MP-06 — Guard helper: throw 403 nếu raceId KHÔNG thuộc accessible set.
   * Enumeration-safe (BR-MP-34 SEC-14): same response cho "race không tồn tại"
   * và "race tồn tại nhưng không quyền".
   */
  assertRaceAccessible(accessible: Set<number>, raceId: number): void {
    if (!accessible.has(raceId)) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_RACE',
        message: {
          vi: 'Bạn không có quyền xem giải này',
          en: "You don't have access to this race",
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // GET /me (BR-MP-26)
  // ────────────────────────────────────────────────────────────────

  async getMe(user: LogtoUser): Promise<MerchantMeResponseDto> {
    const cfg = await this.getAccessConfig(user.userId);
    const accessible = await this.resolveAccessibleRaces(user.userId);
    return {
      userId: cfg.userId,
      userName: cfg.userName,
      email: cfg.email,
      tenantIds: cfg.tenantIds,
      permissions: cfg.permissions,
      assignedRaceCount: accessible.size,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // GET /races (BR-MP-26) — assigned races enriched
  // ────────────────────────────────────────────────────────────────

  /**
   * List giải user được assign với metadata (title/status/date) + tổng vé bán
   * (paid). Optional `tenantId` filter (agency multi-tenant — BR-MP-21).
   */
  async getRaces(
    userId: string,
    tenantId?: number,
  ): Promise<MerchantRaceListResponseDto> {
    const cfg = await this.getAccessConfig(userId);

    // Cross-tenant guard (BR-MP-22): tenantId filter phải thuộc user scope
    if (tenantId !== undefined && !cfg.tenantIds.includes(tenantId)) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_TENANT',
        message: {
          vi: 'Bạn không có quyền xem BTC này',
          en: "You don't have access to this merchant",
        },
      });
    }

    const accessible = await this.resolveAccessibleRaces(userId);
    if (accessible.size === 0) {
      return { races: [], total: 0 };
    }

    const raceIds = [...accessible];
    const placeholders = raceIds.map(() => '?').join(',');

    // Race metadata (R3 verified columns)
    const tenantClause =
      tenantId !== undefined ? 'AND r.tenant_id = ?' : '';
    const metaParams =
      tenantId !== undefined ? [...raceIds, tenantId] : raceIds;
    const metaRows: Array<{
      race_id: number | string;
      title: string | null;
      status: string | null;
      event_start_date: Date | null;
      tenant_id: number | string;
      images: string | null;
    }> = await this.db.query(
      `SELECT r.race_id, r.title, r.status, r.event_start_date, r.tenant_id, r.images
       FROM races r
       WHERE r.race_id IN (${placeholders}) AND r.is_delete = 0 ${tenantClause}
       ORDER BY r.event_start_date DESC`,
      metaParams,
    );

    // Ticket count per race (paid) — R3 ticket aggregate
    const ticketRows: Array<{
      race_id: number | string;
      ticket_count: number | string;
    }> = await this.db.query(
      `SELECT om.race_id, COALESCE(SUM(oli.quantity),0) AS ticket_count
       FROM order_metadata om
       LEFT JOIN order_line_item oli ON oli.order_id = om.id
       WHERE om.race_id IN (${placeholders})
         AND om.deleted = 0 AND om.financial_status = 'paid'
       GROUP BY om.race_id`,
      raceIds,
    );
    const ticketByRace = new Map<number, number>();
    for (const row of ticketRows) {
      ticketByRace.set(Number(row.race_id), Number(row.ticket_count ?? 0));
    }

    const races: MerchantRaceItemDto[] = metaRows.map((row) => {
      const raceId = Number(row.race_id);
      return {
        raceId,
        title: row.title ?? '',
        status: row.status ?? '',
        eventStartDate: row.event_start_date,
        tenantId: Number(row.tenant_id),
        ticketsSold: ticketByRace.get(raceId) ?? 0,
        coverUrl:
          typeof row.images === 'string' && row.images.trim()
            ? row.images.trim()
            : null,
      };
    });

    return { races, total: races.length };
  }

  // ────────────────────────────────────────────────────────────────
  // M2b-2 — Ticket Sales report (BR-MP-07/08/09) — NO financial data
  // ────────────────────────────────────────────────────────────────

  /**
   * Shared scope guard for every ticket-sales endpoint: resolve accessible races
   * then assert the requested raceId is in scope (IDOR — BR-MP-06). Throws 403
   * `403_NO_RACE` enumeration-safe if not accessible.
   */
  private async assertRaceForUser(
    userId: string,
    raceId: number,
  ): Promise<void> {
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);
  }

  /**
   * Fee-banner fix (2026-06-08): FeeService warnings leak internal tenantId +
   * platform fee tiers (vd "MerchantConfig không tồn tại cho tenantId=14 — fallback
   * Tier 3 platform default 5.5%..."). NEVER expose to merchant — log server-side only.
   */
  private logFeeWarningsInternal(warnings?: string[]): void {
    if (warnings?.length) {
      this.logger.warn(
        `[merchant-portal] fee fallback (hidden from merchant): ${warnings.join(' | ')}`,
      );
    }
  }

  /** Best-effort cached read helper for ticket-sales aggregates (60s TTL). */
  private async cachedTicketRead<T>(
    cacheKey: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    } catch (err) {
      this.logger.warn(
        `Redis read ${cacheKey} failed: ${(err as Error).message}`,
      );
    }
    const result = await compute();
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        TICKET_SALES_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis write ${cacheKey} failed: ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * BR-MP-07/08 — Ticket Sales summary KPI (all-time per race).
   * `totalTickets` = SUM(quantity) ALL status (R3 line 242 "Tổng vé" = all).
   * `byStatus` ALWAYS includes paid/voided/pending (0 if absent); unknown status
   * appended. NO financial fields (BR-MP-09).
   */
  async getTicketSalesSummary(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesSummaryDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-summary:${userId}:${raceId}`;

    return this.cachedTicketRead(cacheKey, async () => {
      // COUNT DISTINCT om.id (LEFT JOIN multiplies rows by line item)
      const rows: Array<{
        financial_status: string | null;
        order_count: number | string;
        ticket_count: number | string;
      }> = await this.db.query(
        `SELECT om.financial_status,
                COUNT(DISTINCT om.id) AS order_count,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_metadata om
         LEFT JOIN order_line_item oli ON oli.order_id = om.id
         WHERE om.race_id = ? AND om.deleted = 0
         GROUP BY om.financial_status`,
        [raceId],
      );

      const byStatusMap = new Map<string, TicketStatusCountDto>();
      for (const row of rows) {
        const status = row.financial_status ?? 'unknown';
        byStatusMap.set(status, {
          financialStatus: status,
          orderCount: Number(row.order_count ?? 0),
          ticketCount: Number(row.ticket_count ?? 0),
        });
      }

      // Canonical 3 first (0-filled), then any extra status found
      const byStatus: TicketStatusCountDto[] = [];
      for (const status of CANONICAL_FINANCIAL_STATUSES) {
        byStatus.push(
          byStatusMap.get(status) ?? {
            financialStatus: status,
            orderCount: 0,
            ticketCount: 0,
          },
        );
        byStatusMap.delete(status);
      }
      for (const extra of byStatusMap.values()) byStatus.push(extra);

      const totalTickets = byStatus.reduce((s, b) => s + b.ticketCount, 0);
      const totalOrders = byStatus.reduce((s, b) => s + b.orderCount, 0);

      // F-IMPORT — "Tổng vé" TRUE source-of-truth = issued `codes` (ACTIVE/SENT),
      // which INCLUDE import/MANUAL-added BIBs that have no 5BIB order. BTC bán qua
      // nhiều nguồn rồi import toàn bộ vào 5BIB → order_metadata thiếu vé import.
      // `order_id IS NULL` = import (no 5BIB order); NOT NULL = sold via 5BIB.
      const issued = await this.pullIssuedCodeTotals(raceId);

      return {
        raceId,
        totalTickets,
        totalOrders,
        byStatus,
        ...issued,
      };
    });
  }

  /**
   * F-IMPORT — Canonical "valid issued ticket" predicate over the `codes` table:
   * `deleted = 0 AND status IN ('ACTIVE','SENT')`. INACTIVE = huỷ/void. This is the
   * sole counting basis that captures BOTH 5BIB-sold and imported BIBs. Source split:
   * `order_id IS NULL` → import (incl. MANUAL adds), else sold via 5BIB order.
   */
  private static readonly CODE_SOLD_FILTER =
    "c.deleted = 0 AND c.status IN ('ACTIVE','SENT')";

  /**
   * Issued-code totals for a race (single pass over non-deleted `codes`):
   * - issued (ACTIVE/SENT) total + 5BIB/import split
   * - cancelled = INACTIVE codes (vé đã phát rồi vô hiệu hoá). This is the REAL
   *   "vé đã huỷ" — NOT voided-order quantity, which counts abandoned/failed
   *   checkout attempts and massively over-states cancellations (F-077 follow-up).
   */
  private async pullIssuedCodeTotals(raceId: number): Promise<{
    totalIssued: number;
    issued5bib: number;
    issuedImport: number;
    cancelledIssued: number;
  }> {
    const rows: Array<{
      total_issued: number | string;
      sbib_count: number | string;
      import_count: number | string;
      cancelled_count: number | string;
    }> = await this.db.query(
      `SELECT
         SUM(CASE WHEN c.status IN ('ACTIVE','SENT') THEN 1 ELSE 0 END) AS total_issued,
         SUM(CASE WHEN c.status IN ('ACTIVE','SENT') AND c.order_id IS NOT NULL THEN 1 ELSE 0 END) AS sbib_count,
         SUM(CASE WHEN c.status IN ('ACTIVE','SENT') AND c.order_id IS NULL THEN 1 ELSE 0 END) AS import_count,
         SUM(CASE WHEN c.status = 'INACTIVE' THEN 1 ELSE 0 END) AS cancelled_count
       FROM codes c
       WHERE c.race_id = ? AND c.deleted = 0`,
      [raceId],
    );
    const r = rows?.[0];
    return {
      totalIssued: Number(r?.total_issued ?? 0),
      issued5bib: Number(r?.sbib_count ?? 0),
      issuedImport: Number(r?.import_count ?? 0),
      cancelledIssued: Number(r?.cancelled_count ?? 0),
    };
  }

  /**
   * BR-MP-07 — Vé bán theo cự ly (course). Paid-only (sold distribution).
   * Chain `oli→om→tt→rc` (om has NO race_course_id — DISC-1). GROUP BY rc.id
   * (NOT rc.name — distinct courses can share label e.g. two "2,9 km").
   */
  async getTicketSalesByCourse(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesBreakdownDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-by-course:${userId}:${raceId}`;

    return this.cachedTicketRead(cacheKey, async () => {
      // F-IMPORT — count issued `codes` per course (incl. imports), NOT paid orders.
      // codes carries course_id directly → no oli→om→tt→rc chain needed.
      const rows: Array<{
        course_id: number | string;
        course_name: string | null;
        ticket_count: number | string;
        sbib_count: number | string;
        import_count: number | string;
      }> = await this.db.query(
        `SELECT rc.id AS course_id, rc.name AS course_name,
                COUNT(*) AS ticket_count,
                SUM(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) AS sbib_count,
                SUM(CASE WHEN c.order_id IS NULL THEN 1 ELSE 0 END) AS import_count
         FROM codes c
         JOIN race_course rc ON c.course_id = rc.id
         WHERE c.race_id = ? AND ${MerchantPortalService.CODE_SOLD_FILTER}
         GROUP BY rc.id, rc.name
         ORDER BY ticket_count DESC`,
        [raceId],
      );
      return this.toBreakdown(raceId, rows, 'course_id', 'course_name');
    });
  }

  /**
   * BR-MP-07 — Vé bán theo loại vé (ticket type). Paid-only. Chain to ticket_type,
   * GROUP BY tt.id, display `tt.type_name` (DISC-4).
   */
  async getTicketSalesByType(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesBreakdownDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-by-type:${userId}:${raceId}`;

    return this.cachedTicketRead(cacheKey, async () => {
      // F-IMPORT — count issued `codes` per ticket type (incl. imports). codes
      // carries ticket_type_id directly.
      const rows: Array<{
        ticket_type_id: number | string;
        ticket_type_name: string | null;
        ticket_count: number | string;
        sbib_count: number | string;
        import_count: number | string;
      }> = await this.db.query(
        `SELECT tt.id AS ticket_type_id, tt.type_name AS ticket_type_name,
                COUNT(*) AS ticket_count,
                SUM(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) AS sbib_count,
                SUM(CASE WHEN c.order_id IS NULL THEN 1 ELSE 0 END) AS import_count
         FROM codes c
         JOIN ticket_type tt ON c.ticket_type_id = tt.id
         WHERE c.race_id = ? AND ${MerchantPortalService.CODE_SOLD_FILTER}
         GROUP BY tt.id, tt.type_name
         ORDER BY ticket_count DESC`,
        [raceId],
      );
      return this.toBreakdown(raceId, rows, 'ticket_type_id', 'ticket_type_name');
    });
  }

  /** Map raw breakdown rows → DTO + compute total base for % (shared course/type). */
  private toBreakdown(
    raceId: number,
    rows: Array<Record<string, number | string | null>>,
    idKey: string,
    nameKey: string,
  ): TicketSalesBreakdownDto {
    const items: TicketBreakdownItemDto[] = rows.map((row) => ({
      id: Number(row[idKey]),
      name: (row[nameKey] as string | null) ?? '',
      // F-IMPORT — orderCount now = codes sold via 5BIB (kept name for SDK back-compat);
      // count5bib/countImport expose the source split, ticketCount = total incl import.
      orderCount: Number(row.sbib_count ?? row.order_count ?? 0),
      ticketCount: Number(row.ticket_count ?? 0),
      count5bib: Number(row.sbib_count ?? 0),
      countImport: Number(row.import_count ?? 0),
    }));
    const totalTickets = items.reduce((s, i) => s + i.ticketCount, 0);
    return { raceId, totalTickets, items };
  }

  // ────────────────────────────────────────────────────────────────
  // F-072 — Participant Insights (size áo + giới/AG/quốc tịch) — ticket-scope, no-PII
  // ────────────────────────────────────────────────────────────────

  /** Pull raw participant rows (paid) for a race. Includes course name for export pivot. */
  private async pullParticipantRows(
    raceId: number,
  ): Promise<Array<RawParticipantRow & { course_name: string | null }>> {
    return this.db.query(
      `SELECT asi.tshirt_size AS tshirt_size, asi.gender AS gender, asi.dob AS dob,
              asi.nationality AS nationality, asi.city_province AS city_province,
              rc.name AS course_name
       FROM athlete_subinfo asi
       JOIN order_line_item oli ON oli.id = asi.order_line_item_id
       JOIN order_metadata om ON oli.order_id = om.id
       LEFT JOIN ticket_type tt ON oli.ticket_type_id = tt.id
       LEFT JOIN race_course rc ON tt.race_course_id = rc.id
       WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'`,
      [raceId],
    );
  }

  /** Race day (event_start_date) for age-group calc; falls back to now. */
  private async getRaceDay(raceId: number): Promise<Date> {
    try {
      const rows: Array<{ event_start_date: Date | string | null }> =
        await this.db.query(
          `SELECT event_start_date FROM races WHERE race_id = ? LIMIT 1`,
          [raceId],
        );
      const raw = rows[0]?.event_start_date;
      if (raw) {
        const d = new Date(raw as string);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch (err) {
      this.logger.warn(
        `getRaceDay(${raceId}) failed: ${(err as Error).message}`,
      );
    }
    return new Date();
  }

  /**
   * BR-72-01..10 — Aggregate participant insights (paid). Pull-then-aggregate in
   * Node for robust parsing of messy varchar dob/nationality/size. NO PII (counts only).
   */
  async getParticipantInsights(
    userId: string,
    raceId: number,
  ): Promise<ParticipantInsightsDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:participants:${userId}:${raceId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ParticipantInsightsDto;
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${(err as Error).message}`);
    }

    const [rows, asOf, issued] = await Promise.all([
      this.pullParticipantRows(raceId),
      this.getRaceDay(raceId),
      this.pullIssuedCodeTotals(raceId),
    ]);
    const agg = aggregateParticipants(rows, asOf);
    // F-IMPORT — total VĐV = issued codes (incl. imports). Demographics breakdown
    // (giới/AG/quốc tịch/tỉnh) only covers 5BIB-order tickets via athlete_subinfo;
    // import/MANUAL BIBs have no demographic row (no user_id, no clean FK).
    // To keep charts reconciling to the headline total, append a "Chưa có dữ liệu"
    // bucket = (totalIssued − withData) so every demographic breakdown SUMS to
    // totalIssued (Danny 2026-06-08: "7k VĐV mà thông số dưới chỉ ~3000"). Size áo
    // is left untouched — it has its own empty-state (size collection ≠ import gap).
    const gap = Math.max(0, issued.totalIssued - agg.totalParticipants);
    const withGap = (arr: typeof agg.genders) =>
      gap > 0 ? [...arr, { label: NO_DATA_LABEL, count: gap }] : arr;
    const dto: ParticipantInsightsDto = {
      raceId,
      ...agg,
      genders: withGap(agg.genders),
      ageGroups: withGap(agg.ageGroups),
      nationalities: withGap(agg.nationalities),
      provinces: withGap(agg.provinces),
      totalIssued: issued.totalIssued,
      participantsWithData: agg.totalParticipants,
      issuedImport: issued.issuedImport,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(dto), 'EX', 300);
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${(err as Error).message}`);
    }
    return dto;
  }

  /** F-072 — Excel export: Sheet1 size × cự ly, Sheet2 cơ cấu VĐV. */
  async getParticipantInsightsExport(
    userId: string,
    raceId: number,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    await this.assertRaceForUser(userId, raceId);
    const [rows, asOf] = await Promise.all([
      this.pullParticipantRows(raceId),
      this.getRaceDay(raceId),
    ]);
    const agg = aggregateParticipants(rows, asOf);

    // Per-course size pivot: course → (sizeLabel → count), reusing canonicalisation.
    const byCourse = new Map<string, Map<string, number>>();
    const sizeLabels = new Set<string>(agg.shirtSizes.map((s) => s.label));
    for (const courseName of new Set(
      rows.map((r) => (r.course_name ?? '').trim() || 'Không rõ'),
    )) {
      const subset = rows.filter(
        (r) => ((r.course_name ?? '').trim() || 'Không rõ') === courseName,
      );
      const courseAgg = aggregateParticipants(subset, asOf);
      const sizeMap = new Map<string, number>();
      for (const s of courseAgg.shirtSizes) {
        sizeMap.set(s.label, s.count);
        sizeLabels.add(s.label);
      }
      byCourse.set(courseName, sizeMap);
    }
    const sizeCols = [...sizeLabels];

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Merchant Portal';

    const s1 = wb.addWorksheet('Size áo theo cự ly');
    s1.columns = [
      { header: 'Cự ly', key: 'course', width: 28 },
      ...sizeCols.map((sz) => ({ header: sz, key: sz, width: 10 })),
      { header: 'Tổng', key: '__total', width: 10 },
    ];
    for (const [course, sizeMap] of byCourse) {
      const row: Record<string, string | number> = { course };
      let total = 0;
      for (const sz of sizeCols) {
        const c = sizeMap.get(sz) ?? 0;
        row[sz] = c;
        total += c;
      }
      row.__total = total;
      s1.addRow(row);
    }

    const s2 = wb.addWorksheet('Cơ cấu VĐV');
    s2.columns = [
      { header: 'Nhóm', key: 'group', width: 22 },
      { header: 'Giá trị', key: 'label', width: 24 },
      { header: 'Số VĐV', key: 'count', width: 12 },
    ];
    const dims: Array<[string, typeof agg.genders]> = [
      ['Giới tính', agg.genders],
      ['Nhóm tuổi', agg.ageGroups],
      ['Quốc tịch', agg.nationalities],
      ['Tỉnh/thành', agg.provinces],
    ];
    for (const [group, buckets] of dims) {
      for (const b of buckets) {
        s2.addRow({ group, label: b.label, count: b.count });
      }
    }

    const buffer = (await wb.xlsx.writeBuffer()) as Buffer;
    return {
      buffer,
      filename: `co-cau-vdv-race-${raceId}.xlsx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // F-074 — YoY (so với mùa trước) — ticket-scope, no-PII
  // ────────────────────────────────────────────────────────────────

  /** Race meta (tenant + event date + title) for YoY. */
  private async getRaceMeta(
    raceId: number,
  ): Promise<{ tenantId: number | null; eventStartDate: Date | null; title: string } | null> {
    const rows: Array<{
      tenant_id: number | string | null;
      event_start_date: Date | string | null;
      title: string | null;
    }> = await this.db.query(
      `SELECT tenant_id, event_start_date, title FROM races WHERE race_id = ? LIMIT 1`,
      [raceId],
    );
    const r = rows[0];
    if (!r) return null;
    const d = r.event_start_date ? new Date(r.event_start_date as string) : null;
    return {
      tenantId: r.tenant_id != null ? Number(r.tenant_id) : null,
      eventStartDate: d && !Number.isNaN(d.getTime()) ? d : null,
      title: (r.title ?? '').trim(),
    };
  }

  /**
   * BR-74 — Candidate races for YoY dropdown: same tenant, earlier event date,
   * accessible to the user (IDOR-safe). Non-draft, non-deleted.
   */
  async getYoyComparable(
    userId: string,
    raceId: number,
  ): Promise<YoyComparableDto> {
    await this.assertRaceForUser(userId, raceId);
    const cur = await this.getRaceMeta(raceId);
    if (!cur || cur.tenantId == null) return { raceId, candidates: [] };

    const accessible = await this.resolveAccessibleRaces(userId);
    const rows: Array<{
      race_id: number | string;
      title: string | null;
      event_start_date: Date | string | null;
    }> = await this.db.query(
      `SELECT race_id, title, event_start_date FROM races
       WHERE tenant_id = ? AND is_delete = 0 AND status != 'DRAFT' AND race_id != ?
         AND (event_start_date IS NULL OR event_start_date < ?)
       ORDER BY event_start_date DESC LIMIT 50`,
      [cur.tenantId, raceId, cur.eventStartDate ?? new Date()],
    );
    const candidates = rows
      .filter((r) => accessible.has(Number(r.race_id)))
      .map((r) => ({
        raceId: Number(r.race_id),
        title: (r.title ?? '').trim(),
        eventStartDate: r.event_start_date
          ? new Date(r.event_start_date as string).toISOString()
          : null,
      }));
    return { raceId, candidates };
  }

  /** Build one cumulative-by-days-before series for a race (paid orders). */
  private async buildYoySeries(raceId: number): Promise<YoySeriesDto> {
    const meta = await this.getRaceMeta(raceId);
    const evt = meta?.eventStartDate ?? null;
    const rows: Array<{ payment_on: Date | string | null }> = await this.db.query(
      `SELECT payment_on FROM order_metadata
       WHERE race_id = ? AND deleted = 0 AND financial_status = 'paid'
         AND payment_on IS NOT NULL`,
      [raceId],
    );
    const list = rows
      .map((r) => daysBefore(evt, r.payment_on ? new Date(r.payment_on as string) : null))
      .filter((d): d is number => d != null);
    return {
      raceId,
      title: meta?.title ?? '',
      eventStartDate: evt ? evt.toISOString() : null,
      points: cumulativeCurve(list),
    };
  }

  /**
   * BR-74 — YoY curve: overlay current vs a chosen earlier race aligned by
   * days-before-race. IDOR on BOTH races. Cache 300s.
   */
  async getYoyCurve(
    userId: string,
    raceId: number,
    compareRaceId: number,
  ): Promise<YoyCurveDto> {
    await this.assertRaceForUser(userId, raceId);
    await this.assertRaceForUser(userId, compareRaceId);
    const cacheKey = `merchant-portal:yoy:${userId}:${raceId}:${compareRaceId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as YoyCurveDto;
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${(err as Error).message}`);
    }

    const [current, compare] = await Promise.all([
      this.buildYoySeries(raceId),
      this.buildYoySeries(compareRaceId),
    ]);
    const dto: YoyCurveDto = { current, compare };

    try {
      await this.redis.set(cacheKey, JSON.stringify(dto), 'EX', 300);
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${(err as Error).message}`);
    }
    return dto;
  }

  // ────────────────────────────────────────────────────────────────
  // F-073 — Capacity / Quota (sức chứa từng cự ly) — ticket-scope
  // ────────────────────────────────────────────────────────────────

  /**
   * BR-73 — Capacity per course/ticket-type. Quota từ ticket_type.max_participate
   * + remained_ticket (race_course.max_participate KHÔNG dùng — toàn placeholder=1).
   * sold = quota - remaining. Aggregate per course in Node. Ticket-scope, no-PII.
   */
  async getCapacity(userId: string, raceId: number): Promise<RaceCapacityDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:capacity:${userId}:${raceId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as RaceCapacityDto;
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${(err as Error).message}`);
    }

    // F-IMPORT — `sold` = issued codes per ticket type (incl. imports), correlated
    // subquery over `codes` (tt.id is globally unique → no cross-race leak).
    const rows: RawCapacityRow[] = await this.db.query(
      `SELECT rc.id AS course_id, rc.name AS course_name,
              tt.id AS tt_id, tt.type_name AS type_name,
              tt.max_participate AS quota,
              (SELECT COUNT(*) FROM codes c
                 WHERE c.ticket_type_id = tt.id
                   AND ${MerchantPortalService.CODE_SOLD_FILTER}) AS sold
       FROM ticket_type tt
       JOIN race_course rc ON tt.race_course_id = rc.id
       WHERE rc.race_id = ? AND rc.deleted = 0 AND tt.deleted = 0
       GROUP BY rc.id, rc.name, tt.id, tt.type_name, tt.max_participate
       ORDER BY rc.id`,
      [raceId],
    );
    const dto = aggregateCapacity(raceId, rows);

    try {
      await this.redis.set(cacheKey, JSON.stringify(dto), 'EX', 300);
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${(err as Error).message}`);
    }
    return dto;
  }

  // ────────────────────────────────────────────────────────────────
  // M2b-3 — Revenue (BR-MP-10) — PERMISSION-GATED (revenue_report)
  // ────────────────────────────────────────────────────────────────

  /**
   * BR-MP-09b defense-in-depth: beyond LogtoMerchantFinanceGuard (Logto role),
   * verify the user's access config grants `revenue_report`. Throws 403 if not.
   */
  private assertRevenuePermission(cfg: ResolvedAccessConfig): void {
    if (!cfg.permissions.includes('revenue_report')) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_REVENUE_PERMISSION',
        message: {
          vi: 'Tài khoản của bạn không có quyền xem doanh thu',
          en: "Your account does not have revenue report permission",
        },
      });
    }
  }

  /**
   * BR-MP-10 — Revenue summary cho 1 race (GMV + fee + net).
   *
   * GMV (gross paid) = Σ(totalPrice − totalDiscounts) over the SAME order set
   * FeeService computes on → gmv/fee/net internally consistent (no query drift).
   * Fee = FeeService.computeFeeForOrdersAggregate per tenant (Tier 0→3 cascade,
   * MANUAL=VNĐ/vé vs %=rate invariant honored inside FeeService). Net = GMV − totalFee.
   *
   * A single race belongs to ONE tenant; loop over the pulled Map defensively
   * (aggregate if data anomaly puts >1 tenant under a race). Cache 60s.
   *
   * Cross-tenant "Tất cả BTC" aggregate (BR-MP-21b per-tenant loop over accessible
   * race subset) is DEFERRED to M2b-3b.
   */
  async getRevenueSummary(
    userId: string,
    raceId: number,
  ): Promise<RevenueSummaryDto> {
    const cfg = await this.getAccessConfig(userId); // 404/403 inactive
    this.assertRevenuePermission(cfg); // 403 no revenue_report
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId); // 403 IDOR

    const cacheKey = `merchant-portal:revenue-summary:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      // Pull paid orders for this race, grouped by tenant (chain via JOIN races).
      const byTenant = await pullOrdersForFeeAggregate(this.db, '', [], {
        raceId,
      });

      // `_period` is void-ed by FeeService (orders already filtered) — pass a
      // wide nominal window so the signature is satisfied (BR-58 docs param).
      const period = { from: '1970-01-01', to: '2999-12-31' };

      let gmv = 0;
      let orderCount = 0;
      let totalServiceFee = 0;
      let totalManualFee = 0;
      let totalVat = 0;
      let totalFee = 0;
      const warnings: string[] = [];

      for (const [tenantId, orders] of byTenant.entries()) {
        for (const o of orders) {
          gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
        }
        orderCount += orders.length;

        const fee = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          period,
        );
        totalServiceFee += fee.totalServiceFee;
        totalManualFee += fee.totalManualFee;
        totalVat += fee.totalVat;
        totalFee += fee.totalFee;
        this.logFeeWarningsInternal(fee.warnings); // hidden from merchant (leaks tenantId+tiers)
      }

      const net = gmv - totalFee;
      return {
        raceId,
        gmv,
        totalServiceFee,
        totalManualFee,
        totalVat,
        totalFee,
        net,
        orderCount,
        warnings,
      };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // M2b-3b — Revenue breakdown (BR-MP-12) + cross-tenant (BR-MP-21b)
  // ────────────────────────────────────────────────────────────────

  /** FeeService `_period` is void-ed (orders pre-filtered) — wide nominal window. */
  private static readonly NOMINAL_PERIOD = {
    from: '1970-01-01',
    to: '2999-12-31',
  };

  /**
   * BR-MP-12 — Revenue breakdown theo loại phí (Option A 2-group) cho 1 race.
   * Split paid orders → fee_percent vs fee_fixed (MANUAL). Per group: GMV +
   * fee (FeeService over group subset) + net + count. ALWAYS emits both groups
   * (0-fill). Finance-gated. Cache 60s.
   */
  async getRevenueByCategory(
    userId: string,
    raceId: number,
  ): Promise<RevenueByCategoryDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);

    const cacheKey = `merchant-portal:revenue-by-category:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenant = await pullOrdersForFeeAggregate(this.db, '', [], {
        raceId,
      });
      const warnings: string[] = [];

      // accumulators per group key
      const acc: Record<'fee_percent' | 'fee_fixed', {
        gmv: number;
        totalFee: number;
        orderCount: number;
      }> = {
        fee_percent: { gmv: 0, totalFee: 0, orderCount: 0 },
        fee_fixed: { gmv: 0, totalFee: 0, orderCount: 0 },
      };

      for (const [tenantId, orders] of byTenant.entries()) {
        // partition this tenant's orders by fee group
        const partitions: Record<'fee_percent' | 'fee_fixed', typeof orders> = {
          fee_percent: [],
          fee_fixed: [],
        };
        for (const o of orders) {
          partitions[categoryGroup(o.orderCategory ?? null)].push(o);
        }
        for (const key of ['fee_percent', 'fee_fixed'] as const) {
          const part = partitions[key];
          if (part.length === 0) continue;
          for (const o of part) {
            acc[key].gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
          }
          acc[key].orderCount += part.length;
          const fee = await this.feeService.computeFeeForOrdersAggregate(
            tenantId,
            part,
            MerchantPortalService.NOMINAL_PERIOD,
          );
          acc[key].totalFee += fee.totalFee;
          this.logFeeWarningsInternal(fee.warnings); // hidden from merchant (leaks tenantId+tiers)
        }
      }

      const groups: RevenueCategoryGroupDto[] = (
        ['fee_percent', 'fee_fixed'] as const
      ).map((key) => ({
        groupKey: key,
        gmv: acc[key].gmv,
        totalFee: acc[key].totalFee,
        net: acc[key].gmv - acc[key].totalFee,
        orderCount: acc[key].orderCount,
      }));
      const gmv = groups.reduce((s, g) => s + g.gmv, 0);

      return { raceId, gmv, groups, warnings };
    });
  }

  /**
   * BR-MP-21b — Cross-tenant "Tất cả BTC" revenue aggregate.
   *
   * Per-tenant FeeService loop (FeeService nhận 1 tenantId — mỗi tenant config
   * fee riêng, KHÔNG thể single multi-tenant query). Loop `cfg.tenantIds`; pull
   * each tenant's paid orders, FILTER to the accessible race set (applies
   * draft/include/exclude overrides), then GMV + fee + net per tenant.
   *
   * NOTE: include-override races belonging to tenants OUTSIDE cfg.tenantIds are
   * NOT in this agency rollup (they appear in /races + single-race revenue) —
   * see TD-F069-M2b3b-INCLUDE-OUTSIDE-TENANT.
   */
  async getRevenueAggregate(userId: string): Promise<RevenueAggregateDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);

    const cacheKey = `merchant-portal:revenue-aggregate:${userId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenantRows: RevenueTenantRowDto[] = [];
      const warnings: string[] = [];

      for (const tenantId of cfg.tenantIds) {
        const ordersMap = await pullOrdersForFeeAggregate(this.db, '', [], {
          tenantId,
        });
        const orders = (ordersMap.get(tenantId) ?? []).filter((o) =>
          accessible.has(o.raceId),
        );
        if (orders.length === 0) continue; // skip empty tenant rows

        let gmv = 0;
        for (const o of orders) {
          gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
        }
        const fee = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          MerchantPortalService.NOMINAL_PERIOD,
        );
        this.logFeeWarningsInternal(fee.warnings); // hidden from merchant (leaks tenantId+tiers)
        byTenantRows.push({
          tenantId,
          gmv,
          totalFee: fee.totalFee,
          net: gmv - fee.totalFee,
          orderCount: orders.length,
        });
      }

      byTenantRows.sort((a, b) => b.gmv - a.gmv);
      const totals = byTenantRows.reduce(
        (t, r) => {
          t.gmv += r.gmv;
          t.totalFee += r.totalFee;
          t.orderCount += r.orderCount;
          return t;
        },
        { gmv: 0, totalFee: 0, orderCount: 0 },
      );

      return {
        gmv: totals.gmv,
        totalFee: totals.totalFee,
        net: totals.gmv - totals.totalFee,
        orderCount: totals.orderCount,
        byTenant: byTenantRows,
        warnings,
      };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // M2b-2b — Ticket Sales charts (BR-MP-07) — NO financial data
  // ────────────────────────────────────────────────────────────────

  /**
   * SQL bucket expression per granularity — STRING-output forms for mysql2
   * TZ-safety (daily uses DATE_FORMAT not DATE() to avoid JS Date reinterpret).
   * `payment_on` unqualified is unambiguous (only on order_metadata).
   */
  private bucketExpr(granularity: TicketChartGranularity): string {
    switch (granularity) {
      case 'weekly':
        return 'YEARWEEK(om.payment_on, 3)'; // int YYYYWW → mysqlYearweekToWeekKey
      case 'monthly':
        return "DATE_FORMAT(om.payment_on, '%Y-%m')";
      case 'daily':
      default:
        return "DATE_FORMAT(om.payment_on, '%Y-%m-%d')";
    }
  }

  /** Map a raw SQL bucket value → {bucket key, VN label} for the given granularity. */
  private bucketKeyLabel(
    raw: unknown,
    granularity: TicketChartGranularity,
  ): { bucket: string; label: string } {
    if (granularity === 'weekly') {
      const key = mysqlYearweekToWeekKey(raw as number | string);
      return { bucket: key, label: labelForWeekKey(key) };
    }
    if (granularity === 'monthly') {
      const key = String(raw);
      return { bucket: key, label: labelForMonthKey(key) };
    }
    const key = String(raw); // 'YYYY-MM-DD'
    const label = `${key.slice(8, 10)}/${key.slice(5, 7)}`; // DD/MM
    return { bucket: key, label };
  }

  /**
   * BR-MP-07 chart #1 — Registration trend (paid orders over time buckets).
   * period via resolvePeriod (payment_on BETWEEN from/to); granularity via
   * bucketExpr. COUNT(DISTINCT om.id) per bucket. NO financial.
   */
  async getTicketSalesTrend(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<TicketTrendDto> {
    await this.assertRaceForUser(userId, raceId);
    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:ticket-trend:${userId}:${raceId}:${periodKey}:${granularity}`;

    return this.cachedTicketRead(cacheKey, async () => {
      const expr = this.bucketExpr(granularity);
      const rows: Array<{ bucket: number | string; order_count: number | string }> =
        await this.db.query(
          `SELECT ${expr} AS bucket, COUNT(DISTINCT om.id) AS order_count
           FROM order_metadata om
           WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
             AND om.payment_on >= ? AND om.payment_on < ?
           GROUP BY bucket
           ORDER BY bucket`,
          [raceId, fromIso, toIso],
        );
      const series: TicketTrendPointDto[] = rows.map((r) => {
        const { bucket, label } = this.bucketKeyLabel(r.bucket, granularity);
        return { bucket, label, orderCount: Number(r.order_count ?? 0) };
      });
      return { raceId, period, granularity, series };
    });
  }

  /**
   * BR-MP-07 chart #2 — AnStacked: ticket count (SUM quantity, paid) per course
   * × time bucket. Chain `oli→om→tt→rc`. `courses[]` stable order (total DESC).
   * Deviation from R2 (which said order count) — uses ticket count to reconcile
   * with by-course breakdown (M2b-2). NO financial.
   */
  async getTicketSalesStacked(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<TicketStackedDto> {
    await this.assertRaceForUser(userId, raceId);
    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:ticket-stacked:${userId}:${raceId}:${periodKey}:${granularity}`;

    return this.cachedTicketRead(cacheKey, async () => {
      const expr = this.bucketExpr(granularity);
      const rows: Array<{
        bucket: number | string;
        course_id: number | string;
        course_name: string | null;
        ticket_count: number | string;
      }> = await this.db.query(
        `SELECT ${expr} AS bucket, rc.id AS course_id, rc.name AS course_name,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_line_item oli
         JOIN order_metadata om ON oli.order_id = om.id
         JOIN ticket_type tt ON oli.ticket_type_id = tt.id
         JOIN race_course rc ON tt.race_course_id = rc.id
         WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
           AND om.payment_on >= ? AND om.payment_on < ?
         GROUP BY bucket, rc.id, rc.name
         ORDER BY bucket`,
        [raceId, fromIso, toIso],
      );

      // Aggregate course totals (for stable display order) + bucket map
      const courseTotal = new Map<number, { name: string; total: number }>();
      const bucketMap = new Map<
        string,
        { label: string; counts: Record<number, number> }
      >();
      for (const r of rows) {
        const courseId = Number(r.course_id);
        const tc = Number(r.ticket_count ?? 0);
        const ct = courseTotal.get(courseId) ?? {
          name: r.course_name ?? '',
          total: 0,
        };
        ct.total += tc;
        courseTotal.set(courseId, ct);

        const { bucket, label } = this.bucketKeyLabel(r.bucket, granularity);
        const entry = bucketMap.get(bucket) ?? { label, counts: {} };
        entry.counts[courseId] = (entry.counts[courseId] ?? 0) + tc;
        bucketMap.set(bucket, entry);
      }

      const courses: StackedCourseDto[] = [...courseTotal.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([courseId, v]) => ({ courseId, courseName: v.name }));

      const series: StackedSeriesPointDto[] = [...bucketMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([bucket, v]) => ({ bucket, label: v.label, counts: v.counts }));

      return { raceId, period, granularity, courses, series };
    });
  }

  /**
   * BR-MP-07 — Paginated order detail table. NO financial (BR-MP-09) — order id +
   * buyer NAME + course + ticket type + quantity + status + paymentOn. NO
   * total_price/email/phone (PII conservatism — TD-F069-M2b2b-ORDER-PII).
   * `search` matches buyer name (first_name/last_name/name LIKE).
   * NOT cached (filter/search/page combinatorial — low hit).
   */
  async getTicketSalesOrders(
    userId: string,
    raceId: number,
    page: number,
    pageSize: number,
    financialStatus?: string,
    search?: string,
  ): Promise<TicketOrderListDto> {
    await this.assertRaceForUser(userId, raceId);

    const conds: string[] = ['om.race_id = ?', 'om.deleted = 0'];
    const params: Array<string | number> = [raceId];
    if (financialStatus) {
      conds.push('om.financial_status = ?');
      params.push(financialStatus);
    }
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      conds.push(
        "(om.first_name LIKE ? OR om.last_name LIKE ? OR om.name LIKE ? OR CONCAT(COALESCE(om.first_name,''),' ',COALESCE(om.last_name,'')) LIKE ?)",
      );
      params.push(like, like, like, like);
    }
    const where = conds.join(' AND ');

    const countRows: Array<{ total: number | string }> = await this.db.query(
      `SELECT COUNT(*) AS total FROM order_metadata om WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const offset = (page - 1) * pageSize;
    // Row + course/type via a representative line item (1 order may have many;
    // pick the highest-quantity line for the display row, sum quantity overall).
    const rows: Array<{
      order_id: number | string;
      first_name: string | null;
      last_name: string | null;
      name: string | null;
      email: string | null;
      phone_number: string | null;
      financial_status: string | null;
      payment_on: Date | null;
      quantity: number | string | null;
      course_name: string | null;
      ticket_type_name: string | null;
    }> = await this.db.query(
      // Buyer contact (email/phone) included per Danny 2026-06-05 (BTC owns their
      // race's customer data). total_price still EXCLUDED (BR-MP-09 ticket=no financial).
      `SELECT om.id AS order_id, om.first_name, om.last_name, om.name,
              om.email, om.phone_number,
              om.financial_status, om.payment_on,
              oli_agg.quantity AS quantity,
              rc.name AS course_name, tt.type_name AS ticket_type_name
       FROM order_metadata om
       LEFT JOIN (
         SELECT order_id, SUM(quantity) AS quantity, MIN(ticket_type_id) AS ticket_type_id
         FROM order_line_item GROUP BY order_id
       ) oli_agg ON oli_agg.order_id = om.id
       LEFT JOIN ticket_type tt ON tt.id = oli_agg.ticket_type_id
       LEFT JOIN race_course rc ON rc.id = tt.race_course_id
       WHERE ${where}
       ORDER BY om.payment_on DESC, om.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const items: TicketOrderRowDto[] = rows.map((r) => {
      const fullName = [r.first_name, r.last_name]
        .filter((x) => x && x.trim())
        .join(' ')
        .trim();
      return {
        orderId: Number(r.order_id),
        buyerName: fullName || (r.name ?? '').trim(),
        buyerEmail: r.email ?? null,
        buyerPhone: r.phone_number ?? null,
        courseName: r.course_name ?? null,
        ticketTypeName: r.ticket_type_name ?? null,
        quantity: Number(r.quantity ?? 0),
        financialStatus: r.financial_status ?? '',
        paymentOn: r.payment_on,
      };
    });

    return { items, total, page, pageSize };
  }

  // ────────────────────────────────────────────────────────────────
  // M2c — Revenue trend (BR-MP-10/11) + Excel export — FINANCE-GATED
  // ────────────────────────────────────────────────────────────────

  /** In-memory bucket key + label for a Date (UTC, matches ISO week / month). */
  private dateBucketKeyLabel(
    d: Date,
    granularity: TicketChartGranularity,
  ): { bucket: string; label: string } {
    if (granularity === 'weekly') {
      const key = dateToWeekKey(d);
      return { bucket: key, label: labelForWeekKey(key) };
    }
    if (granularity === 'monthly') {
      const key = dateToMonthKey(d);
      return { bucket: key, label: labelForMonthKey(key) };
    }
    const key = ymdUtc(d);
    return { bucket: key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}` };
  }

  /**
   * BR-MP-10/11 — Revenue trend (GMV/fee/net) per time bucket.
   *
   * Date filter applied at PULL layer (`payment_on` range via clause); orders
   * bucketed IN-MEMORY (FeeService needs order objects per bucket); FeeService
   * per tenant PER bucket (cascade is per-order, can't aggregate then split).
   * Finance-gated. Cache 60s.
   *
   * PERF: N FeeService calls (one per non-empty bucket per tenant), each loads
   * MerchantConfig once — see TD-F069-M2c-TREND-FEE-PERBUCKET.
   */
  async getRevenueTrend(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<RevenueTrendDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);

    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:revenue-trend:${userId}:${raceId}:${periodKey}:${granularity}`;

    return this.cachedTicketRead(cacheKey, async () => {
      const byTenant = await pullOrdersForFeeAggregate(
        this.db,
        'om.payment_on >= ? AND om.payment_on < ?',
        [fromIso, toIso],
        { raceId },
      );
      const warnings: string[] = [];
      // bucket key → accumulator
      const bucketMap = new Map<
        string,
        { label: string; gmv: number; totalFee: number; orderCount: number }
      >();

      for (const [tenantId, orders] of byTenant.entries()) {
        // group this tenant's orders by bucket
        const perBucket = new Map<string, { label: string; list: typeof orders }>();
        for (const o of orders) {
          const d = normalizePaymentOn(o.createdAt);
          const { bucket, label } = this.dateBucketKeyLabel(d, granularity);
          const e = perBucket.get(bucket) ?? { label, list: [] };
          e.list.push(o);
          perBucket.set(bucket, e);
        }
        for (const [bucket, { label, list }] of perBucket.entries()) {
          let gmv = 0;
          for (const o of list) {
            gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
          }
          const fee = await this.feeService.computeFeeForOrdersAggregate(
            tenantId,
            list,
            { from: fromIso, to: toIso },
          );
          this.logFeeWarningsInternal(fee.warnings); // hidden from merchant (leaks tenantId+tiers)
          const acc = bucketMap.get(bucket) ?? {
            label,
            gmv: 0,
            totalFee: 0,
            orderCount: 0,
          };
          acc.gmv += gmv;
          acc.totalFee += fee.totalFee;
          acc.orderCount += list.length;
          bucketMap.set(bucket, acc);
        }
      }

      const series: RevenueTrendPointDto[] = [...bucketMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([bucket, v]) => ({
          bucket,
          label: v.label,
          gmv: v.gmv,
          totalFee: v.totalFee,
          net: v.gmv - v.totalFee,
          orderCount: v.orderCount,
        }));

      return { raceId, period, granularity, series, warnings };
    });
  }

  /**
   * BR-MP-10/11 — Excel export (.xlsx) for a race: Summary + By-Category sheets.
   * Reuses getRevenueSummary + getRevenueByCategory (both finance-gated +
   * scope-checked). Returns buffer + filename + mimeType for the controller to
   * stream. NOT cached (generated on demand).
   */
  async getRevenueExport(
    userId: string,
    raceId: number,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    // Both calls enforce finance permission + race access internally.
    const summary = await this.getRevenueSummary(userId, raceId);
    const byCategory = await this.getRevenueByCategory(userId, raceId);

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Merchant Portal';

    const s1 = wb.addWorksheet('Tổng quan doanh thu');
    s1.columns = [
      { header: 'Chỉ tiêu', key: 'k', width: 28 },
      { header: 'Giá trị (VND)', key: 'v', width: 20 },
    ];
    s1.addRows([
      { k: 'Race ID', v: summary.raceId },
      { k: 'GMV (gross paid)', v: summary.gmv },
      { k: 'Phí dịch vụ', v: summary.totalServiceFee },
      { k: 'Phí thủ công', v: summary.totalManualFee },
      { k: 'VAT', v: summary.totalVat },
      { k: 'Tổng phí 5BIB', v: summary.totalFee },
      { k: 'Net về BTC', v: summary.net },
      { k: 'Số đơn paid', v: summary.orderCount },
    ]);

    const s2 = wb.addWorksheet('Theo loại phí');
    s2.columns = [
      { header: 'Nhóm', key: 'g', width: 22 },
      { header: 'GMV', key: 'gmv', width: 18 },
      { header: 'Phí', key: 'fee', width: 18 },
      { header: 'Net', key: 'net', width: 18 },
      { header: 'Số đơn', key: 'n', width: 12 },
    ];
    const groupLabel: Record<string, string> = {
      fee_percent: 'Phí %',
      fee_fixed: 'Phí cố định (thủ công)',
    };
    for (const g of byCategory.groups) {
      s2.addRow({
        g: groupLabel[g.groupKey] ?? g.groupKey,
        gmv: g.gmv,
        fee: g.totalFee,
        net: g.net,
        n: g.orderCount,
      });
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const filename = `5bib-merchant-revenue-race-${raceId}.xlsx`;
    return {
      buffer,
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // F-070 — Advanced MKT analytics (forecast / heatmap / target).
  // Ticket-scope (BR-70-01/02) — NO financial values leaked.
  // ────────────────────────────────────────────────────────────────

  /**
   * F-070 BR-70-04/05/06 — Forecast: lũy kế vé thực tế + dự báo về ngày đua.
   *
   * Pipeline:
   *  1. assertRaceForUser (IDOR — BR-70-03).
   *  2. Read-through Redis cache `merchant-portal:forecast:<raceId>` TTL 300s.
   *  3. SQL daily paid-order counts (FULL window) → running cumsum.
   *  4. Race meta (event_start_date + status) → raceEnded + daysToRace.
   *  5. recentDailyRate = (lastCum − cum 7 ngày trước) / 7 (0 nếu <8 điểm).
   *  6. projectedValue = raceEnded || cumulative<8 ? null : round(lastCum + rate×daysToRace).
   *  7. target từ Mongo merchant_race_target (null nếu absent hoặc 0).
   */
  async getTicketForecast(
    userId: string,
    raceId: number,
    now?: Date,
  ): Promise<TicketForecastDto> {
    await this.assertRaceForUser(userId, raceId);

    const cacheKey = `merchant-portal:forecast:${raceId}`;
    const cachedForecast = await this.readJsonCache<TicketForecastDto>(cacheKey);
    if (cachedForecast) return cachedForecast;

    // 1) Daily paid-order counts (FULL window — BR-70-04).
    const dailyRows: Array<{ d: string | Date; n: number | string }> =
      await this.db.query(
        `SELECT DATE(om.payment_on) AS d, COUNT(DISTINCT om.id) AS n
         FROM order_metadata om
         WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
           AND om.payment_on IS NOT NULL
         GROUP BY d ORDER BY d ASC`,
        [raceId],
      );

    // 2) Running cumsum → cumulative[{date,value}].
    let running = 0;
    const cumulative: TicketForecastPointDto[] = dailyRows.map((row) => {
      running += Number(row.n ?? 0);
      return { date: this.toYmd(row.d), value: running };
    });

    // 3) Race meta (PRD 3.4 spec says `id` but races PK = race_id — R3 schema).
    const metaRows: Array<{
      event_start_date: Date | null;
      status: string | null;
    }> = await this.db.query(
      `SELECT event_start_date, status FROM races WHERE race_id = ? LIMIT 1`,
      [raceId],
    );
    const meta = metaRows[0];
    const eventStartDate = meta?.event_start_date ?? null;
    const status = (meta?.status ?? '').toUpperCase();

    const today = now ?? new Date();
    const todayMs = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const eventMs =
      eventStartDate != null
        ? Date.UTC(
            eventStartDate.getUTCFullYear(),
            eventStartDate.getUTCMonth(),
            eventStartDate.getUTCDate(),
          )
        : null;

    const raceEnded =
      status === 'COMPLETE' ||
      status === 'CANCEL' ||
      (eventMs != null && eventMs < todayMs);

    const daysToRace =
      eventMs != null
        ? Math.max(0, Math.ceil((eventMs - todayMs) / 86_400_000))
        : 0;

    // 4) recentDailyRate over last 7 days (need ≥8 points — BR-70-05).
    let recentDailyRate = 0;
    if (cumulative.length >= 8) {
      const lastCum = cumulative[cumulative.length - 1].value;
      const prevCum = cumulative[cumulative.length - 8].value;
      recentDailyRate = (lastCum - prevCum) / 7;
    }

    // 5) projection (BR-70-05/06).
    const projectedValue =
      raceEnded || cumulative.length < 8
        ? null
        : Math.round(
            cumulative[cumulative.length - 1].value +
              recentDailyRate * daysToRace,
          );

    const projectionDate =
      eventStartDate != null ? eventStartDate.toISOString() : null;

    // 6) target từ Mongo (null nếu absent hoặc 0 — BR-70-07/09).
    const targetDoc = await this.raceTargetModel
      .findOne({ raceId })
      .lean()
      .exec();
    const target =
      targetDoc && targetDoc.target > 0 ? targetDoc.target : null;

    const result: TicketForecastDto = {
      cumulative,
      projectedValue,
      projectionDate,
      recentDailyRate,
      target,
      raceEnded,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {
      this.logger.warn(
        `Redis write ${cacheKey} failed: ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * F-070 BR-70-10/11 — Heatmap: khung giờ vàng đăng ký (giờ VN).
   *
   * payment_on lưu SẴN giờ VN (GMT+7) — KHÔNG convert (UAT F-070 2026-06-07:
   * order mới nhất payment_on='2026-06-07 23:06' > dbnow UTC ~15:2x ⇒ nếu UTC sẽ
   * là tương lai → bất khả ⇒ column là VN-local). Dùng DAYOFWEEK/HOUR trực tiếp.
   * Grid 7 dòng (Mon..Sun) × 7 cột khung giờ [0-6,6-9,9-12,12-15,15-18,18-21,21-24].
   * MySQL DAYOFWEEK: 1=Sun..7=Sat → row index Mon=0..Sun=6.
   * Read-through Redis cache TTL 300s.
   */
  async getTicketHeatmap(
    userId: string,
    raceId: number,
  ): Promise<TicketHeatmapDto> {
    await this.assertRaceForUser(userId, raceId);

    const cacheKey = `merchant-portal:heatmap:${raceId}`;
    const cachedHeatmap = await this.readJsonCache<TicketHeatmapDto>(cacheKey);
    if (cachedHeatmap) return cachedHeatmap;

    const rows: Array<{
      dow: number | string;
      hr: number | string;
      n: number | string;
    }> = await this.db.query(
      `SELECT DAYOFWEEK(om.payment_on) AS dow,
              HOUR(om.payment_on) AS hr,
              COUNT(DISTINCT om.id) AS n
       FROM order_metadata om
       WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
         AND om.payment_on IS NOT NULL
       GROUP BY dow, hr`,
      [raceId],
    );

    // grid[row Mon..Sun][bucket 0..6] = count.
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array<number>(7).fill(0),
    );
    let max = 0;
    for (const row of rows) {
      const mysqlDow = Number(row.dow); // 1=Sun..7=Sat
      const hr = Number(row.hr); // 0..23
      const count = Number(row.n ?? 0);
      const rowIndex = this.mysqlDowToMonFirst(mysqlDow);
      const bucketIndex = this.hourToBucketIndex(hr);
      if (rowIndex < 0 || bucketIndex < 0) continue;
      grid[rowIndex][bucketIndex] += count;
      if (grid[rowIndex][bucketIndex] > max) max = grid[rowIndex][bucketIndex];
    }

    const result: TicketHeatmapDto = {
      dayLabels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      bucketLabels: [
        '0-6',
        '6-9',
        '9-12',
        '12-15',
        '15-18',
        '18-21',
        '21-24',
      ],
      grid,
      max,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {
      this.logger.warn(
        `Redis write ${cacheKey} failed: ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * F-070 BR-70-07/08/09 — Set per-race ticket target (WRITE).
   *
   * assertRaceForUser FIRST (IDOR — BR-70-08) → upsert Mongo merchant_race_target
   * (unique raceId → concurrent idempotent) → DEL forecast cache. Output
   * target=null khi dto.target===0 (BR-70-09 — 0 = xoá mục tiêu hiệu lực FE).
   */
  async setTicketTarget(
    userId: string,
    dto: { raceId: number; target: number },
  ): Promise<TicketTargetDto> {
    await this.assertRaceForUser(userId, dto.raceId);

    await this.raceTargetModel
      .findOneAndUpdate(
        { raceId: dto.raceId },
        { $set: { target: dto.target, updatedBy: userId } },
        { upsert: true, new: true },
      )
      .exec();

    try {
      await this.redis.del(`merchant-portal:forecast:${dto.raceId}`);
    } catch (err) {
      this.logger.warn(
        `Redis del forecast:${dto.raceId} failed: ${(err as Error).message}`,
      );
    }

    return {
      raceId: dto.raceId,
      target: dto.target === 0 ? null : dto.target,
    };
  }

  /**
   * Best-effort read-through JSON cache. Returns null on miss, Redis error, OR
   * corrupt payload (logged) so a poisoned cache entry never crashes the request
   * — caller recomputes from source-of-truth.
   */
  private async readJsonCache<T>(cacheKey: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (err) {
      this.logger.warn(
        `Redis read ${cacheKey} failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Normalize a SQL DATE result (Date or 'YYYY-MM-DD' string) → 'YYYY-MM-DD'. */
  private toYmd(value: string | Date): string {
    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
  }

  /** MySQL DAYOFWEEK (1=Sun..7=Sat) → grid row (Mon=0..Sun=6). */
  private mysqlDowToMonFirst(mysqlDow: number): number {
    // Sun(1)→6, Mon(2)→0, Tue(3)→1, … Sat(7)→5.
    if (mysqlDow < 1 || mysqlDow > 7) return -1;
    return mysqlDow === 1 ? 6 : mysqlDow - 2;
  }

  /** Hour 0..23 → bucket [0-6,6-9,9-12,12-15,15-18,18-21,21-24]. */
  private hourToBucketIndex(hr: number): number {
    if (hr < 0 || hr > 23) return -1;
    if (hr < 6) return 0;
    if (hr < 9) return 1;
    if (hr < 12) return 2;
    if (hr < 15) return 3;
    if (hr < 18) return 4;
    if (hr < 21) return 5;
    return 6; // 21-24
  }
}
