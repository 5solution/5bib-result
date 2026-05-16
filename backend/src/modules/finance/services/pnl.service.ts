import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Model, Types } from 'mongoose';
import { Contract, ContractDocument } from '../../contracts/schemas/contract.schema';
import { CostItemsService } from './cost-items.service';
import { FeeService } from './fee.service';
import {
  aggregateByCategory,
  computePnL,
  RevenueSource,
} from '../utils/pnl-compute';
import { PnLSummaryDto } from '../dto/pnl-response.dto';
import {
  PnLDashboardFilterDto,
  DashboardPeriod,
} from '../dto/dashboard-filter.dto';
import {
  DashboardContractItemDto,
  DashboardGroupBucketDto,
  PnLDashboardResponseDto,
} from '../dto/dashboard-response.dto';
import {
  PnLContractsListFilterDto,
  type ContractsListSortBy,
  type SortDir,
} from '../dto/pnl-contracts-list-filter.dto';
import { PnLContractsListResponseDto } from '../dto/pnl-contracts-list-response.dto';
import { escapeRegex } from '../../contracts/utils/escape-regex';
import * as crypto from 'crypto';

/**
 * F-028 — compute P&L per contract.
 *
 * Revenue source rule (BR-PNL-01 + BR-PNL-04):
 *   - contractType=TICKET_SALES → cross-DB MySQL pull SUM total_price (Actual)
 *     fallback `revenueShare.estimatedFee` (Estimated)
 *   - else nếu acceptanceReport.status = 'FINALIZED' → actualTotalWithVat (Actual)
 *   - else → contract.totalAmount (Estimated)
 *
 * Cache `pnl:contract:<id>` TTL 60s (BR-PNL-13). Invalidate khi cost item
 * mutation HOẶC contract acceptance update — handle ở CostItemsService +
 * tương lai ContractsService hook (Phase 2).
 */
@Injectable()
export class PnLService {
  private readonly logger = new Logger(PnLService.name);

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    private readonly costItems: CostItemsService,
    private readonly feeService: FeeService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /**
   * Resolve tenantId + mysqlRaceId từ contract.
   *
   * F-028 Phase 1B (Danny chốt 2026-05-12 Q3.A): Contract schema có
   * `linkedTenantId` + `linkedMysqlRaceId` fields (sparse-indexed) populated
   * qua admin picker UI. Trước đây dùng `templateOverrides` convention
   * (`__platformTenantId` / `__platformMysqlRaceId`) — vẫn được respect
   * làm fallback để KHÔNG break HĐ legacy đã set qua override path.
   */
  private extractPlatformLinkage(contract: ContractDocument): {
    tenantId: number | null;
    mysqlRaceId: number | null;
  } {
    const c = contract as any;
    let tenantId =
      typeof c.linkedTenantId === 'number' ? c.linkedTenantId : null;
    let mysqlRaceId =
      typeof c.linkedMysqlRaceId === 'number' ? c.linkedMysqlRaceId : null;

    // Backward compat: legacy `templateOverrides` convention.
    if (tenantId === null || mysqlRaceId === null) {
      const overrides =
        (contract.templateOverrides as Record<string, string> | undefined) ??
        {};
      if (tenantId === null && overrides.__platformTenantId) {
        const v = Number(overrides.__platformTenantId);
        tenantId = Number.isFinite(v) ? v : null;
      }
      if (mysqlRaceId === null && overrides.__platformMysqlRaceId) {
        const v = Number(overrides.__platformMysqlRaceId);
        mysqlRaceId = Number.isFinite(v) ? v : null;
      }
    }

    return { tenantId, mysqlRaceId };
  }

  /**
   * F-029 HIGH-PERF-01 — Synchronous variant của `resolveRevenue` cho
   * dashboard batch flow. Caller PRE-FETCH `revenueByRaceId` Map qua
   * `feeService.getActualRevenueForRaces(raceIds)` rồi pass vào — eliminate
   * N+1 cross-DB query khi process N contracts. Race nào không có order
   * paid → Map.get trả undefined → fallback estimatedFee (giữ semantic
   * BR-PNL-04 edge case identical với async version).
   */
  private resolveRevenueSync(
    contract: ContractDocument,
    revenueByRaceId: Map<number, number>,
  ): { revenue: number; source: RevenueSource } {
    if (contract.contractType === 'TICKET_SALES') {
      const { tenantId, mysqlRaceId } = this.extractPlatformLinkage(contract);
      if (tenantId !== null && mysqlRaceId !== null) {
        const pulledRevenue = revenueByRaceId.get(mysqlRaceId);
        if (pulledRevenue !== undefined && pulledRevenue > 0) {
          return { revenue: pulledRevenue, source: 'ACTUAL' };
        }
      }
      // Fallback estimatedFee (mirrors `resolveRevenue` BR-PNL-04 edge case).
      const estimated = contract.revenueShare?.estimatedFee ?? 0;
      return { revenue: estimated, source: 'ESTIMATED' };
    }

    // Non-TICKET_SALES (TIMING / RACEKIT / OPERATIONS) — same as
    // `resolveRevenue` non-TICKET_SALES branch (already sync).
    const ar = contract.acceptanceReport;
    if (ar && ar.status === 'FINALIZED' && ar.actualTotalWithVat > 0) {
      return { revenue: ar.actualTotalWithVat, source: 'ACTUAL' };
    }
    return { revenue: contract.totalAmount ?? 0, source: 'ESTIMATED' };
  }

  /**
   * Compute revenue + source per BR-PNL-01 / BR-PNL-04.
   * **Used by per-contract `getSummary(contractId)` only** (1 MySQL query
   * acceptable). For batch dashboard, use `resolveRevenueSync` with
   * pre-fetched `revenueByRaceId` Map to avoid N+1 (F-029 HIGH-PERF-01).
   */
  private async resolveRevenue(
    contract: ContractDocument,
  ): Promise<{ revenue: number; source: RevenueSource; warning?: string }> {
    const contractId = contract._id.toString();

    if (contract.contractType === 'TICKET_SALES') {
      const { tenantId, mysqlRaceId } = this.extractPlatformLinkage(contract);
      const pulled = await this.feeService.getActualRevenueForRace(
        tenantId,
        mysqlRaceId,
        contractId,
      );
      if (pulled.revenue !== null && pulled.revenue > 0) {
        return { revenue: pulled.revenue, source: 'ACTUAL' };
      }
      // Fallback estimatedFee (BR-PNL-04 edge case)
      const estimated = contract.revenueShare?.estimatedFee ?? 0;
      return {
        revenue: estimated,
        source: 'ESTIMATED',
        warning: pulled.warning,
      };
    }

    // Non-TICKET_SALES (TIMING / RACEKIT / OPERATIONS)
    const ar = contract.acceptanceReport;
    if (ar && ar.status === 'FINALIZED' && ar.actualTotalWithVat > 0) {
      return { revenue: ar.actualTotalWithVat, source: 'ACTUAL' };
    }
    return { revenue: contract.totalAmount ?? 0, source: 'ESTIMATED' };
  }

  async getSummary(contractId: string): Promise<PnLSummaryDto> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new NotFoundException(`Contract không tồn tại: ${contractId}`);
    }

    // Cache hit
    const cacheKey = `pnl:contract:${contractId}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as PnLSummaryDto;
        }
      } catch (e) {
        this.logger.warn(
          `[finance] redis get fail ${cacheKey}: ${(e as Error).message}`,
        );
      }
    }

    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract || contract.deletedAt) {
      throw new NotFoundException(`Contract không tồn tại: ${contractId}`);
    }

    const { revenue, source, warning } = await this.resolveRevenue(contract);

    const costItems = await this.costItems.findAllActiveByContract(contractId);
    const actualCost = costItems.reduce((s, c) => s + (c.amount || 0), 0);

    /**
     * FEATURE-036 (Danny 2026-05-14 fix F-033 semantic bug):
     * cost_items KHÔNG override line_items.cost — chúng ADD-ON.
     *
     *   estimatedCost = sum(line_items[i].cost × quantity) [quote-time base]
     *   actualCost    = sum(cost_items.amount) [chi phí phát sinh THÊM]
     *   totalCost     = estimatedCost + actualCost [ADDITIVE]
     *
     * Trước F-036 (F-033 design): cost_items override estimated → admin
     * nhập 1 chi phí phát sinh 1M làm P&L hiện chi phí 1M thay vì 185M+1M
     * = 186M → margin 99.5% thay vì 11% → SAI semantic.
     *
     * totalCostSource attribution mới (descriptive only, KHÔNG dùng cho compute):
     *   'none'      → cả 2 = 0
     *   'estimated' → chỉ line_items có cost (chưa có cost_items)
     *   'actual'    → chỉ cost_items có cost (line_items.cost = 0)
     *   'mixed'     → cả 2 có cost
     */
    const lineItemsList = (contract.lineItems ?? []) as Array<{
      cost?: number;
      quantity?: number;
      selected?: boolean;
    }>;
    const estimatedCost = lineItemsList
      .filter((li) => li.selected !== false)
      .reduce(
        (s, li) => s + (Number(li.cost) || 0) * (Number(li.quantity) || 0),
        0,
      );

    const totalCost = estimatedCost + actualCost;
    const totalCostSource: 'actual' | 'estimated' | 'mixed' | 'none' =
      estimatedCost > 0 && actualCost > 0
        ? 'mixed'
        : actualCost > 0
          ? 'actual'
          : estimatedCost > 0
            ? 'estimated'
            : 'none';

    const computed = computePnL({
      revenue,
      totalCost,
      revenueSource: source,
    });

    const costByCategory = aggregateByCategory(
      costItems.map((c) => ({ category: c.category, amount: c.amount })),
    );
    // Ensure all 5 keys present (UI chart consistency)
    for (const k of ['LABOR', 'MATERIAL', 'VENDOR', 'OUTSOURCE', 'OTHER']) {
      if (costByCategory[k] === undefined) costByCategory[k] = 0;
    }

    const result: PnLSummaryDto = {
      contractId,
      revenue: computed.revenue,
      revenueSource: computed.revenueSource,
      totalCost: computed.totalCost,
      // FEATURE-036 — breakdown 2 nguồn (UI display purpose)
      estimatedCost,
      actualCost,
      totalCostSource,
      profit: computed.profit,
      margin: computed.margin,
      marginTier: computed.marginTier,
      costItemCount: costItems.length,
      costByCategory,
      warning,
    };

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
      } catch (e) {
        this.logger.warn(
          `[finance] redis set fail ${cacheKey}: ${(e as Error).message}`,
        );
      }
    }

    return result;
  }

  // ────────────────────────────────────────────────────────────────────────
  // F-028 Phase 2 — Dashboard aggregated
  // ────────────────────────────────────────────────────────────────────────

  private readonly CONTRACT_TYPE_LABELS: Record<string, string> = {
    TICKET_SALES: 'Vé / Đăng ký',
    TIMING: 'Bấm giờ',
    RACEKIT: 'Racekit',
    OPERATIONS: 'Vận hành',
  };

  /**
   * BR-PNL-19 — resolve period preset → ISO range. UTC+7 anchor (giờ VN).
   *
   * BR-PNL-08 (Danny chốt 2026-05-12 — revision): scope STRICT whitelist
   * `ACTIVE` + `COMPLETED` only (HĐ đã chốt). Loại bỏ DRAFT (chưa ký), toàn
   * bộ quotation pipeline (SENT/ACCEPTED/CONVERTED_TO_CONTRACT), CANCELLED,
   * REJECTED. Lý do: HĐ chưa chốt KHÔNG được đưa vào P&L tổng hợp vì revenue
   * commitment chưa lock.
   */
  private resolveDateRange(filter: PnLDashboardFilterDto): {
    period: DashboardPeriod;
    dateFrom: Date;
    dateTo: Date;
  } {
    const period: DashboardPeriod = filter.period ?? 'last_3_months';
    const now = new Date();

    if (period === 'custom') {
      const from = filter.dateFrom
        ? new Date(`${filter.dateFrom}T00:00:00+07:00`)
        : new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const to = filter.dateTo
        ? new Date(`${filter.dateTo}T23:59:59+07:00`)
        : now;
      return { period, dateFrom: from, dateTo: to };
    }

    const dateTo = now;
    let dateFrom: Date;
    switch (period) {
      case 'current_month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_3_months':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last_6_months':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'last_12_months':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
      case 'ytd':
        dateFrom = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }
    return { period, dateFrom, dateTo };
  }

  private hashFilter(filter: PnLDashboardFilterDto): string {
    const norm = JSON.stringify({
      p: filter.period ?? 'last_3_months',
      g: filter.groupBy ?? 'month',
      f: filter.dateFrom ?? '',
      t: filter.dateTo ?? '',
    });
    return crypto.createHash('md5').update(norm).digest('hex').slice(0, 12);
  }

  private isoMonth(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private avg(values: Array<number | null>): number | null {
    const filtered = values.filter((v): v is number => v !== null);
    if (filtered.length === 0) return null;
    const sum = filtered.reduce((s, v) => s + v, 0);
    return Math.round((sum / filtered.length) * 10) / 10;
  }

  async getDashboardData(
    filter: PnLDashboardFilterDto,
  ): Promise<PnLDashboardResponseDto> {
    const { period, dateFrom, dateTo } = this.resolveDateRange(filter);

    const cacheKey = `pnl:dashboard:${this.hashFilter({ ...filter, period })}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as PnLDashboardResponseDto;
      } catch (e) {
        this.logger.warn(
          `[finance] dashboard cache get fail: ${(e as Error).message}`,
        );
      }
    }

    // ── 1. Pull contracts in scope (BR-PNL-08 — Danny chốt 2026-05-12:
    //       STRICT whitelist ACTIVE + COMPLETED only — HĐ đã chốt).
    //       Loại bỏ DRAFT + quotation pipeline (SENT/ACCEPTED/
    //       CONVERTED_TO_CONTRACT) + CANCELLED + REJECTED.
    //       Date anchor: signDate fallback createdAt.
    const contracts = await this.contractModel
      .find({
        deletedAt: null,
        status: { $in: ['ACTIVE', 'COMPLETED'] },
        $or: [
          { signDate: { $gte: dateFrom, $lte: dateTo } },
          {
            signDate: { $exists: false },
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
          {
            signDate: null,
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
        ],
      })
      .lean()
      .exec();

    const contractIds = contracts.map((c) => c._id as Types.ObjectId);

    // ── 2. Aggregate cost items bulk (1 query — no N+1)
    const costMap = await this.costItems.aggregateByContractIds(contractIds);

    // ── 2b. F-029 HIGH-PERF-01 — Pre-fetch bulk TICKET_SALES revenue from
    //        MySQL platform. Eliminates N+1 cross-DB queries (was
    //        `for (c of contracts) await resolveRevenue(c)` → 50 contracts =
    //        50 MySQL RTT). Bulk version chunks 100 race_id/query, GROUP BY
    //        rc.race_id, preserves DISTINCT semantics (1 order ≥2 line items
    //        same race → 1 sum).
    //
    //        Per-race revenue lookup downstream is now O(1) Map.get instead
    //        of awaited MySQL call. Per-contract `resolveRevenue` no longer
    //        async cho TICKET_SALES path (BBNT path was already sync).
    const ticketSalesRaceIds: number[] = [];
    for (const c of contracts) {
      if (c.contractType === 'TICKET_SALES') {
        const linkage = this.extractPlatformLinkage(c as ContractDocument);
        if (linkage.tenantId !== null && linkage.mysqlRaceId !== null) {
          ticketSalesRaceIds.push(linkage.mysqlRaceId);
        }
      }
    }
    const revenueByRaceId =
      ticketSalesRaceIds.length > 0
        ? await this.feeService.getActualRevenueForRaces(ticketSalesRaceIds)
        : new Map<number, number>();

    // ── 3. Resolve revenue per contract (TICKET_SALES → bulk Map lookup,
    //       BBNT → sync compute). Pure synchronous loop after pre-fetch.
    const items: DashboardContractItemDto[] = [];
    const totalCostByCategory: Record<string, number> = {
      LABOR: 0,
      MATERIAL: 0,
      VENDOR: 0,
      OUTSOURCE: 0,
      OTHER: 0,
    };
    for (const c of contracts) {
      const id = (c._id as Types.ObjectId).toString();
      const { revenue, source } = this.resolveRevenueSync(
        c as ContractDocument,
        revenueByRaceId,
      );
      const cost = costMap.get(id) ?? {
        totalCost: 0,
        costByCategory: {
          LABOR: 0,
          MATERIAL: 0,
          VENDOR: 0,
          OUTSOURCE: 0,
          OTHER: 0,
        },
      };
      for (const k of Object.keys(totalCostByCategory)) {
        totalCostByCategory[k] += cost.costByCategory[k] ?? 0;
      }

      /**
       * FEATURE-036 — Dashboard aggregation: cost_items ADD-ON line_items.
       * totalCost = estimated_from_line_items + actual_from_cost_items.
       * costByCategory chỉ chứa actual cost_items breakdown (estimated chưa
       * có category split — UI chart giữ behavior cũ).
       */
      const lineItemsList = ((c as ContractDocument).lineItems ?? []) as Array<{
        cost?: number;
        quantity?: number;
        selected?: boolean;
      }>;
      const estimatedCostDash = lineItemsList
        .filter((li) => li.selected !== false)
        .reduce(
          (s, li) => s + (Number(li.cost) || 0) * (Number(li.quantity) || 0),
          0,
        );
      const effectiveCost = cost.totalCost + estimatedCostDash;
      const profit = revenue - effectiveCost;
      const margin =
        revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
      const marginTier: DashboardContractItemDto['marginTier'] =
        margin === null
          ? 'neutral'
          : margin < 0
            ? 'loss'
            : margin <= 10
              ? 'thin'
              : 'healthy';

      const anchorDate = c.signDate ?? c.createdAt;
      items.push({
        contractId: id,
        contractNumber: c.contractNumber ?? null,
        partnerName: (c.client as any)?.entityName ?? null,
        raceName: c.raceName ?? null,
        contractType: c.contractType as any,
        status: c.status as string,
        revenue,
        revenueSource: source as 'ESTIMATED' | 'ACTUAL',
        totalCost: effectiveCost,
        profit,
        margin,
        marginTier,
        anchorMonth: anchorDate ? this.isoMonth(new Date(anchorDate)) : null,
      });
    }

    // ── 4. Totals
    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const totalCost = items.reduce((s, i) => s + i.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = this.avg(items.map((i) => i.margin));

    // ── 5. Group by type / partner / month
    const groupedReduce = (
      keyFn: (i: DashboardContractItemDto) => string,
      labelFn: (key: string) => string,
    ): DashboardGroupBucketDto[] => {
      const map = new Map<string, DashboardContractItemDto[]>();
      for (const i of items) {
        const k = keyFn(i);
        if (!k) continue;
        const arr = map.get(k) ?? [];
        arr.push(i);
        map.set(k, arr);
      }
      return Array.from(map.entries()).map(([key, group]) => ({
        key,
        label: labelFn(key),
        contractCount: group.length,
        totalRevenue: group.reduce((s, g) => s + g.revenue, 0),
        totalCost: group.reduce((s, g) => s + g.totalCost, 0),
        totalProfit: group.reduce((s, g) => s + g.profit, 0),
        avgMargin: this.avg(group.map((g) => g.margin)),
      }));
    };

    const byType = groupedReduce(
      (i) => i.contractType,
      (k) => this.CONTRACT_TYPE_LABELS[k] ?? k,
    );
    const byPartner = groupedReduce(
      (i) => i.partnerName ?? '(Chưa có)',
      (k) => k,
    ).sort((a, b) => b.totalProfit - a.totalProfit);
    const byMonth = groupedReduce(
      (i) => i.anchorMonth ?? '',
      (k) => k,
    ).sort((a, b) => a.key.localeCompare(b.key));

    // ── 6. Top profit + Loss-making
    const topProfit = [...items]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
    const lossMaking = items
      .filter((i) => i.margin !== null && i.margin < 0)
      .sort((a, b) => a.margin! - b.margin!); // worst margin first

    const result: PnLDashboardResponseDto = {
      period,
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      totals: {
        contractCount: items.length,
        totalRevenue,
        totalCost,
        totalProfit,
        avgMargin,
        costByCategory: totalCostByCategory,
      },
      byType,
      byPartner,
      byMonth,
      topProfit,
      lossMaking,
    };

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 120);
      } catch (e) {
        this.logger.warn(
          `[finance] dashboard cache set fail: ${(e as Error).message}`,
        );
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────
  // FEATURE-038 — Paginated contracts list with P&L per row
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Deterministic hash of list filter (sorted keys → same hash regardless of
   * key order). Used as Redis cache key suffix `pnl:contracts-list:<hash>`.
   * Includes all list-affecting params (period/dates/page/limit/sort/q).
   */
  private hashContractsListFilter(filter: PnLContractsListFilterDto): string {
    const norm = JSON.stringify({
      f: filter.dateFrom ?? '',
      l: filter.limit ?? 20,
      p: filter.period ?? 'last_3_months',
      pg: filter.page ?? 1,
      q: (filter.q ?? '').trim().toLowerCase(),
      sb: filter.sortBy ?? 'anchorMonth',
      sd: filter.sortDir ?? 'desc',
      t: filter.dateTo ?? '',
    });
    return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16);
  }

  /**
   * Compute each contract's P&L row + dataset-wide totals — identical
   * semantics with `getDashboardData()` body for items/totals computation
   * (BR-PNL-08 status whitelist + F-029 bulk MySQL revenue prefetch + F-036
   * additive cost ADD-ON). Used by `getContractsList()` only — extracted
   * here to keep `getDashboardData()` body untouched (regression safety for
   * 32 existing F-028 + F-029 + F-036 tests).
   */
  private async computeContractRows(filter: PnLContractsListFilterDto): Promise<{
    items: DashboardContractItemDto[];
    totals: {
      contractCount: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      avgMargin: number | null;
      costByCategory: Record<string, number>;
    };
    period: DashboardPeriod;
    dateFrom: Date;
    dateTo: Date;
  }> {
    const { period, dateFrom, dateTo } = this.resolveDateRange(filter);

    const contracts = await this.contractModel
      .find({
        deletedAt: null,
        status: { $in: ['ACTIVE', 'COMPLETED'] },
        $or: [
          { signDate: { $gte: dateFrom, $lte: dateTo } },
          {
            signDate: { $exists: false },
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
          {
            signDate: null,
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
        ],
      })
      .lean()
      .exec();

    const contractIds = contracts.map((c) => c._id as Types.ObjectId);
    const costMap = await this.costItems.aggregateByContractIds(contractIds);

    // F-029 HIGH-PERF-01 — bulk pre-fetch TICKET_SALES revenue.
    const ticketSalesRaceIds: number[] = [];
    for (const c of contracts) {
      if (c.contractType === 'TICKET_SALES') {
        const linkage = this.extractPlatformLinkage(c as ContractDocument);
        if (linkage.tenantId !== null && linkage.mysqlRaceId !== null) {
          ticketSalesRaceIds.push(linkage.mysqlRaceId);
        }
      }
    }
    const revenueByRaceId =
      ticketSalesRaceIds.length > 0
        ? await this.feeService.getActualRevenueForRaces(ticketSalesRaceIds)
        : new Map<number, number>();

    const items: DashboardContractItemDto[] = [];
    const totalCostByCategory: Record<string, number> = {
      LABOR: 0,
      MATERIAL: 0,
      VENDOR: 0,
      OUTSOURCE: 0,
      OTHER: 0,
    };

    for (const c of contracts) {
      const id = (c._id as Types.ObjectId).toString();
      const { revenue, source } = this.resolveRevenueSync(
        c as ContractDocument,
        revenueByRaceId,
      );
      const cost = costMap.get(id) ?? {
        totalCost: 0,
        costByCategory: {
          LABOR: 0,
          MATERIAL: 0,
          VENDOR: 0,
          OUTSOURCE: 0,
          OTHER: 0,
        },
      };
      for (const k of Object.keys(totalCostByCategory)) {
        totalCostByCategory[k] += cost.costByCategory[k] ?? 0;
      }

      // F-036 — totalCost = estimated (line_items) + actual (cost_items)
      const lineItemsList = ((c as ContractDocument).lineItems ?? []) as Array<{
        cost?: number;
        quantity?: number;
        selected?: boolean;
      }>;
      const estimatedCostDash = lineItemsList
        .filter((li) => li.selected !== false)
        .reduce(
          (s, li) => s + (Number(li.cost) || 0) * (Number(li.quantity) || 0),
          0,
        );
      const effectiveCost = cost.totalCost + estimatedCostDash;
      const profit = revenue - effectiveCost;
      const margin =
        revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
      const marginTier: DashboardContractItemDto['marginTier'] =
        margin === null
          ? 'neutral'
          : margin < 0
            ? 'loss'
            : margin <= 10
              ? 'thin'
              : 'healthy';

      const anchorDate = c.signDate ?? c.createdAt;
      items.push({
        contractId: id,
        contractNumber: c.contractNumber ?? null,
        partnerName: (c.client as any)?.entityName ?? null,
        raceName: c.raceName ?? null,
        contractType: c.contractType as DashboardContractItemDto['contractType'],
        status: c.status as string,
        revenue,
        revenueSource: source as 'ESTIMATED' | 'ACTUAL',
        totalCost: effectiveCost,
        profit,
        margin,
        marginTier,
        anchorMonth: anchorDate ? this.isoMonth(new Date(anchorDate)) : null,
      });
    }

    return {
      items,
      totals: {
        contractCount: items.length,
        totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
        totalCost: items.reduce((s, i) => s + i.totalCost, 0),
        totalProfit: items.reduce((s, i) => s + (i.revenue - i.totalCost), 0),
        avgMargin: this.avg(items.map((i) => i.margin)),
        costByCategory: totalCostByCategory,
      },
      period,
      dateFrom,
      dateTo,
    };
  }

  /**
   * Filter items by combined search keyword across contractNumber +
   * partnerName + raceName. Regex-escaped (BR-38-05 ReDoS defense via
   * `escapeRegex` util). Empty/whitespace `q` → no filter applied.
   */
  private filterBySearch(
    items: DashboardContractItemDto[],
    q?: string,
  ): DashboardContractItemDto[] {
    const trimmed = q?.trim();
    if (!trimmed) return items;
    const safe = escapeRegex(trimmed);
    const re = new RegExp(safe, 'i');
    return items.filter(
      (i) =>
        re.test(i.contractNumber ?? '') ||
        re.test(i.partnerName ?? '') ||
        re.test(i.raceName ?? ''),
    );
  }

  /**
   * Sort items by `sortBy` / `sortDir`. Null values (margin neutral) sort
   * LAST regardless of direction → loss-making contracts surface top on
   * ASC margin sort, healthy contracts top on DESC. String columns
   * (contractNumber, anchorMonth) use locale compare for natural order.
   */
  private sortItems(
    items: DashboardContractItemDto[],
    sortBy: ContractsListSortBy,
    sortDir: SortDir,
  ): DashboardContractItemDto[] {
    const sorted = [...items];
    const dirMul = sortDir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      // Null/undefined always last (regardless of asc/desc)
      const aNull = aVal === null || aVal === undefined;
      const bNull = bVal === null || bVal === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      // Numeric vs string
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dirMul;
      }
      return String(aVal).localeCompare(String(bVal)) * dirMul;
    });
    return sorted;
  }

  /**
   * FEATURE-038 — paginated contracts list with P&L per row.
   *
   * Pipeline:
   *   1. Resolve date range + Mongo query (BR-38-01 status whitelist +
   *      BR-38-02 period filter)
   *   2. Bulk cost aggregation + bulk MySQL revenue (F-029 HIGH-PERF-01)
   *   3. Compute P&L per row (F-036 additive cost) → dataset items + totals
   *   4. Search filter (BR-38-05, regex-escaped)
   *   5. Sort (BR-38-04)
   *   6. Paginate (BR-38-06, max 100)
   *
   * Cache `pnl:contracts-list:<sha256-filter-hash>` TTL 60s. Invalidate via
   * `cost-items.service.ts` + `contracts.service.ts` mutation hooks
   * (BR-38-09). `totals` aggregates ALL filtered items (NOT paged subset)
   * for accurate footer summary.
   */
  async getContractsList(
    filter: PnLContractsListFilterDto,
  ): Promise<PnLContractsListResponseDto> {
    // Cache check
    const cacheKey = `pnl:contracts-list:${this.hashContractsListFilter(filter)}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as PnLContractsListResponseDto;
      } catch (e) {
        this.logger.warn(
          `[finance] contracts-list cache get fail: ${(e as Error).message}`,
        );
      }
    }

    // Compute dataset
    const { items: allItems, totals, period, dateFrom, dateTo } =
      await this.computeContractRows(filter);

    // Search (BR-38-05)
    const searched = this.filterBySearch(allItems, filter.q);

    // Filtered totals (after search but before pagination) — for footer
    const filteredTotals = {
      contractCount: searched.length,
      totalRevenue: searched.reduce((s, i) => s + i.revenue, 0),
      totalCost: searched.reduce((s, i) => s + i.totalCost, 0),
      totalProfit: searched.reduce((s, i) => s + i.profit, 0),
      avgMargin: this.avg(searched.map((i) => i.margin)),
      costByCategory: totals.costByCategory, // dataset-wide; donut still uses dataset totals
    };

    // Sort (BR-38-04)
    const sortBy: ContractsListSortBy = filter.sortBy ?? 'anchorMonth';
    const sortDir: SortDir = filter.sortDir ?? 'desc';
    const sorted = this.sortItems(searched, sortBy, sortDir);

    // Paginate (BR-38-06)
    const page = Math.max(1, filter.page ?? 1);
    const limit = filter.limit ?? 20;
    const total = sorted.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const paged = sorted.slice((page - 1) * limit, page * limit);

    const result: PnLContractsListResponseDto = {
      period,
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      items: paged,
      total,
      page,
      limit,
      totalPages,
      totals: filteredTotals,
    };

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
      } catch (e) {
        this.logger.warn(
          `[finance] contracts-list cache set fail: ${(e as Error).message}`,
        );
      }
    }

    return result;
  }
}
