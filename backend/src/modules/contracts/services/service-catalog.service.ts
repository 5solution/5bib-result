import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ServiceCatalog,
  ServiceCatalogDocument,
} from '../schemas/service-catalog.schema';
import {
  CreateServiceCatalogDto,
  UpdateServiceCatalogDto,
} from '../dto/service-catalog.dto';
import { escapeRegex } from '../utils/escape-regex';

/**
 * F-024 BR-CM-16: Service Catalog (danh mục dịch vụ).
 * Soft delete only — line items in contracts are SNAPSHOT (not reference),
 * so delete catalog item KHÔNG affect existing contracts.
 */
@Injectable()
export class ServiceCatalogService {
  constructor(
    @InjectModel(ServiceCatalog.name)
    private model: Model<ServiceCatalogDocument>,
  ) {}

  async create(
    dto: CreateServiceCatalogDto,
    createdBy?: string,
  ): Promise<ServiceCatalog> {
    const doc = await this.model.create({ ...dto, createdBy });
    return doc.toObject();
  }

  async findAll(opts: { category?: string; search?: string } = {}) {
    const filter: any = { deletedAt: null };
    if (opts.category) filter.category = opts.category;
    // M-01 QC fix: escape regex special chars (defense vs ReDoS)
    if (opts.search)
      filter.name = { $regex: escapeRegex(opts.search), $options: 'i' };
    return this.model.find(filter).sort({ category: 1, sortOrder: 1, name: 1 }).lean();
  }

  async findOne(id: string): Promise<ServiceCatalog> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid catalog id');
    }
    const item = await this.model.findOne({ _id: id, deletedAt: null }).lean();
    if (!item) throw new NotFoundException('Service catalog item not found');
    return item as ServiceCatalog;
  }

  async update(id: string, dto: UpdateServiceCatalogDto): Promise<ServiceCatalog> {
    const item = await this.model
      .findOneAndUpdate({ _id: id, deletedAt: null }, dto, { new: true })
      .lean();
    if (!item) throw new NotFoundException('Service catalog item not found');
    return item as ServiceCatalog;
  }

  async remove(id: string): Promise<{ success: true }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid catalog id');
    }
    const result = await this.model.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Service catalog item not found');
    }
    return { success: true };
  }

  /**
   * FEATURE-031 — Batch check duplicate (name, category) pairs in 1 query.
   * Returns subset of input pairs that ALREADY EXIST trong collection (active items,
   * deletedAt=null). Used by ImportService cho duplicate detection — Skip + report
   * per PAUSE-31-02. KHÔNG check soft-deleted items.
   */
  async findByNameCategoryPairs(
    pairs: Array<{ name: string; category: string }>,
  ): Promise<Array<{ name: string; category: string }>> {
    if (pairs.length === 0) return [];
    const items = await this.model
      .find(
        {
          deletedAt: null,
          $or: pairs.map((p) => ({ name: p.name, category: p.category })),
        },
        { name: 1, category: 1, _id: 0 },
      )
      .lean();
    return items.map((i) => ({ name: i.name, category: i.category }));
  }
}
