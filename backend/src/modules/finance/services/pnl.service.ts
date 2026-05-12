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
   * Compute revenue + source per BR-PNL-01 / BR-PNL-04.
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
    const totalCost = costItems.reduce((s, c) => s + (c.amount || 0), 0);

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
}
