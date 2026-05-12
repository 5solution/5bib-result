import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogService } from '../../audit/services/audit-log.service';
import {
  Contract,
  ContractDocument,
} from '../../contracts/schemas/contract.schema';
import {
  ServiceCatalog,
  ServiceCatalogDocument,
  ServiceCategory,
} from '../../contracts/schemas/service-catalog.schema';
import { CostItem, CostItemDocument } from '../schemas/cost-item.schema';
import { CostCategory } from '../schemas/cost-item.schema';
import { CostSuggestionDto } from '../dto/cost-suggestion.dto';
import { CreateCostItemDto } from '../dto/create-cost-item.dto';
import { CostItemResponseDto } from '../dto/pnl-response.dto';
import { CostItemsService } from './cost-items.service';

/**
 * F-028 Phase 3 — gợi ý + bulk-create cost items từ HĐ ↔ Service Catalog.
 *
 * Mapping default từ `ServiceCategory` (catalog) → `CostCategory` (P&L) là
 * heuristic v1, đặt ở `CATEGORY_MAP` constant + comment rõ:
 *   - TIMING/RACEKIT → MATERIAL (vật tư race-day)
 *   - OPERATIONS → VENDOR (thuê đối tác vận hành)
 *   - GENERAL → OTHER
 * Admin có thể đổi category sau khi tạo qua PATCH endpoint cũ. Sau này nếu
 * muốn config hoá → move sang collection `cost_category_mapping` (out of v1
 * scope).
 *
 * Service `read-only` Contract + ServiceCatalog (KHÔNG own write). Bulk
 * create reuse `CostItemsService.create()` để giữ audit log + cache flush.
 *
 * Soft-deleted catalog items: lookup trả null → suggestion skip (warning
 * log, KHÔNG throw). Pattern Pre-Deploy Checklist (Skip silently khi
 * downstream reference đã bị xoá).
 */
@Injectable()
export class CostSuggestionsService {
  private readonly logger = new Logger(CostSuggestionsService.name);

  /**
   * Mapping catalog category → cost category. Default v1 — admin override
   * sau khi tạo nếu sai. KHÔNG hardcode trong logic — export constant để
   * dễ test + thay sau.
   */
  static readonly CATEGORY_MAP: Record<ServiceCategory, CostCategory> = {
    TIMING: 'MATERIAL',
    RACEKIT: 'MATERIAL',
    OPERATIONS: 'VENDOR',
    GENERAL: 'OTHER',
  };

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    @InjectModel(ServiceCatalog.name)
    private readonly catalogModel: Model<ServiceCatalogDocument>,
    @InjectModel(CostItem.name)
    private readonly costItemModel: Model<CostItemDocument>,
    private readonly costItemsService: CostItemsService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /**
   * Map catalog category → cost category. Public + static để test trực
   * tiếp không phải qua DI.
   */
  static mapCategory(catalogCategory: ServiceCategory): CostCategory {
    return CostSuggestionsService.CATEGORY_MAP[catalogCategory] ?? 'OTHER';
  }

  /**
   * Lấy list suggestions từ contract line items có `catalogItemId`.
   *
   * Edge cases:
   *   - Contract không tồn tại → 404
   *   - Contract không có line items với catalogItemId → trả [] (empty)
   *   - Catalog item đã soft delete → skip với warning log
   *   - referenceCost = 0 → suggestion amount = 0 (vẫn trả, admin có thể
   *     tick + chỉnh sửa amount ở dialog trước submit)
   */
  async getSuggestions(contractId: string): Promise<CostSuggestionDto[]> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new BadRequestException(`Invalid contractId: ${contractId}`);
    }
    const contract = await this.contractModel
      .findOne({ _id: contractId, deletedAt: null })
      .lean();
    if (!contract) throw new NotFoundException('Contract not found');

    const lineItemsWithCatalog = (contract.lineItems ?? []).filter(
      (li: any) =>
        li.catalogItemId && Types.ObjectId.isValid(li.catalogItemId),
    );
    if (lineItemsWithCatalog.length === 0) return [];

    // Unique catalogIds — line items có thể duplicate (cùng catalog × 2 STT)
    const catalogIds = Array.from(
      new Set(
        lineItemsWithCatalog.map((li: any) =>
          String(li.catalogItemId),
        ) as string[],
      ),
    );

    const catalogs = await this.catalogModel
      .find({
        _id: { $in: catalogIds.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      })
      .lean();
    const catalogMap = new Map<string, ServiceCatalog>(
      catalogs.map((c: any) => [String(c._id), c as ServiceCatalog]),
    );

    const suggestions: CostSuggestionDto[] = [];
    for (const li of lineItemsWithCatalog as any[]) {
      const catalog = catalogMap.get(String(li.catalogItemId));
      if (!catalog) {
        this.logger.warn(
          `[cost-suggestions] Catalog ${li.catalogItemId} không tồn tại (soft deleted?) — skip line item stt=${li.stt}`,
        );
        continue;
      }
      const costPerUnit = catalog.referenceCost ?? 0;
      const suggestedAmount = Math.round(costPerUnit * (li.quantity ?? 0));
      suggestions.push({
        catalogItemId: String(li.catalogItemId),
        description: catalog.name,
        category: CostSuggestionsService.mapCategory(catalog.category),
        quantity: li.quantity ?? 0,
        unit: catalog.unit,
        costPerUnit,
        suggestedAmount,
        contractLineItemStt: li.stt,
      });
    }
    return suggestions;
  }

  /**
   * Bulk insert N cost items cho 1 contract. Reuse `CostItemsService.create()`
   * mỗi item để KHÔNG bypass audit log + cache invalidate. Trade-off: chậm
   * hơn `insertMany` raw, nhưng đảm bảo BR-PNL-09 audit per-item +
   * BR-PNL-14 cache flush.
   *
   * Idempotency: KHÔNG dedupe — admin có thể cố ý tạo nhiều entry trùng
   * description (vd 2 dot vật tư cùng tên khác kỳ). Frontend dialog disable
   * nút submit sau click 1 để tránh double-submit nhầm.
   *
   * Throw 400 nếu items rỗng. Validate contractId trước khi tạo.
   */
  async bulkCreate(
    contractId: string,
    items: CreateCostItemDto[],
    actorId: string,
  ): Promise<CostItemResponseDto[]> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new BadRequestException(`Invalid contractId: ${contractId}`);
    }
    if (!items || items.length === 0) {
      throw new BadRequestException('Danh sách rỗng — chọn ít nhất 1 chi phí');
    }
    // Verify contract tồn tại (early fail tránh tạo N cost items orphan)
    const contractExists = await this.contractModel.exists({
      _id: contractId,
      deletedAt: null,
    });
    if (!contractExists) throw new NotFoundException('Contract not found');

    const created: CostItemResponseDto[] = [];
    for (const item of items) {
      const result = await this.costItemsService.create(
        contractId,
        item,
        actorId,
      );
      created.push(result);
    }

    // Emit aggregate audit (per-item audit đã có ở CostItemsService.create)
    await this.auditLog?.emit({
      actor: { userId: actorId },
      action: 'finance.cost_item.bulk_create_from_suggestions',
      entity: {
        type: 'contract',
        id: contractId,
        displayName: `bulk-cost-suggestions x${created.length}`,
      },
      metadata: {
        contractId,
        count: created.length,
        totalAmount: created.reduce((s, c) => s + c.amount, 0),
      },
    });

    return created;
  }
}
