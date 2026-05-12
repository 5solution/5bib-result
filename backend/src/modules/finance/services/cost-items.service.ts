import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Model, Types } from 'mongoose';
import { AuditLogService } from '../../audit/services/audit-log.service';
import {
  CostItem,
  CostItemDocument,
} from '../schemas/cost-item.schema';
import { CreateCostItemDto } from '../dto/create-cost-item.dto';
import { UpdateCostItemDto } from '../dto/update-cost-item.dto';
import {
  CostItemResponseDto,
  PaginatedCostItemsDto,
} from '../dto/pnl-response.dto';

/**
 * F-028 — CRUD cost items với:
 *   - BR-PNL-09 audit log MỌI mutation (CREATE/UPDATE/DELETE)
 *   - BR-PNL-10 soft delete
 *   - BR-PNL-11 edit anytime (KHÔNG check contract.status)
 *   - BR-PNL-14 cache invalidate pattern: DEL `pnl:contract:<id>` + flush
 *     `pnl:dashboard:*` (clone articles/contracts invalidation pattern).
 *
 * KHÔNG validate contract tồn tại tại đây — PnLService làm khi compute (tránh
 * round-trip Mongo cho mỗi cost item write). Caller controller route đã có
 * guard admin-only.
 */
@Injectable()
export class CostItemsService {
  private readonly logger = new Logger(CostItemsService.name);

  constructor(
    @InjectModel(CostItem.name)
    private readonly model: Model<CostItemDocument>,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // Cache invalidation (BR-PNL-14)
  // ──────────────────────────────────────────────────────────────────────

  private async invalidateContractPnL(contractId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`pnl:contract:${contractId}`);
    } catch (e) {
      this.logger.warn(
        `[finance] invalidate pnl:contract:${contractId} fail: ${
          (e as Error).message
        }`,
      );
    }
  }

  private async flushDashboardCache(): Promise<void> {
    if (!this.redis) return;
    try {
      const stream = this.redis.scanStream({
        match: 'pnl:dashboard:*',
        count: 200,
      });
      const pipeline = this.redis.pipeline();
      let count = 0;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          for (const k of keys) {
            pipeline.del(k);
            count++;
          }
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      if (count > 0) await pipeline.exec();
    } catch (e) {
      this.logger.warn(
        `[finance] flush pnl:dashboard:* fail: ${(e as Error).message}`,
      );
    }
  }

  private async invalidateAfterMutation(contractId: string): Promise<void> {
    await this.invalidateContractPnL(contractId);
    await this.flushDashboardCache();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mapping (strip _id pitfall — inject id alias trước)
  // ──────────────────────────────────────────────────────────────────────

  private toResponse(doc: CostItemDocument): CostItemResponseDto {
    return {
      id: doc._id.toString(),
      contractId: doc.contractId.toString(),
      description: doc.description,
      category: doc.category,
      amount: doc.amount,
      note: doc.note,
      incurredDate: doc.incurredDate,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────

  async create(
    contractId: string,
    dto: CreateCostItemDto,
    actorId: string,
  ): Promise<CostItemResponseDto> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new BadRequestException(`Invalid contractId: ${contractId}`);
    }

    const created = await this.model.create({
      contractId: new Types.ObjectId(contractId),
      description: dto.description,
      category: dto.category,
      amount: dto.amount,
      note: dto.note,
      incurredDate: dto.incurredDate,
      createdBy: actorId,
    });

    await this.invalidateAfterMutation(contractId);

    await this.auditLog?.emit({
      actor: { userId: actorId },
      action: 'finance.cost_item.create',
      entity: {
        type: 'cost_item',
        id: created._id.toString(),
        displayName: dto.description,
      },
      metadata: {
        contractId,
        category: dto.category,
        amount: dto.amount,
      },
    });

    return this.toResponse(created);
  }

  async list(
    contractId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedCostItemsDto> {
    if (!Types.ObjectId.isValid(contractId)) {
      throw new BadRequestException(`Invalid contractId: ${contractId}`);
    }
    const filter = {
      contractId: new Types.ObjectId(contractId),
      deletedAt: null,
    };
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return {
      items: docs.map((d) => this.toResponse(d)),
      total,
      page,
      limit,
    };
  }

  /** Internal helper — full list (no pagination) cho compute totalCost. */
  async findAllActiveByContract(contractId: string): Promise<CostItemDocument[]> {
    if (!Types.ObjectId.isValid(contractId)) return [];
    return this.model
      .find({
        contractId: new Types.ObjectId(contractId),
        deletedAt: null,
      })
      .exec();
  }

  async findOne(
    contractId: string,
    id: string,
  ): Promise<CostItemDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid cost item id: ${id}`);
    }
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException(`Cost item not found: ${id}`);
    if (doc.contractId.toString() !== contractId) {
      throw new NotFoundException(
        `Cost item ${id} không thuộc contract ${contractId}`,
      );
    }
    return doc;
  }

  async update(
    contractId: string,
    id: string,
    dto: UpdateCostItemDto,
    actorId: string,
  ): Promise<CostItemResponseDto> {
    const doc = await this.findOne(contractId, id);
    if (doc.deletedAt) {
      throw new BadRequestException(
        'Chi phí đã xóa — không sửa được. Khôi phục trước rồi sửa.',
      );
    }

    const before = {
      description: doc.description,
      category: doc.category,
      amount: doc.amount,
      note: doc.note,
      incurredDate: doc.incurredDate,
    };

    if (dto.description !== undefined) doc.description = dto.description;
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.amount !== undefined) doc.amount = dto.amount;
    if (dto.note !== undefined) doc.note = dto.note;
    if (dto.incurredDate !== undefined) doc.incurredDate = dto.incurredDate;
    doc.updatedBy = actorId;

    await doc.save();
    await this.invalidateAfterMutation(contractId);

    await this.auditLog?.emit({
      actor: { userId: actorId },
      action: 'finance.cost_item.update',
      entity: {
        type: 'cost_item',
        id: doc._id.toString(),
        displayName: doc.description,
      },
      metadata: {
        contractId,
        before,
        after: {
          description: doc.description,
          category: doc.category,
          amount: doc.amount,
          note: doc.note,
          incurredDate: doc.incurredDate,
        },
      },
    });

    return this.toResponse(doc);
  }

  async softDelete(
    contractId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: true }> {
    const doc = await this.findOne(contractId, id);
    if (doc.deletedAt) {
      // Idempotent — đã xóa rồi vẫn return success (UX không hoang mang)
      return { success: true };
    }

    doc.deletedAt = new Date();
    doc.updatedBy = actorId;
    await doc.save();
    await this.invalidateAfterMutation(contractId);

    await this.auditLog?.emit({
      actor: { userId: actorId },
      action: 'finance.cost_item.delete',
      entity: {
        type: 'cost_item',
        id: doc._id.toString(),
        displayName: doc.description,
      },
      metadata: {
        contractId,
        amount: doc.amount,
        category: doc.category,
      },
    });

    return { success: true };
  }
}
