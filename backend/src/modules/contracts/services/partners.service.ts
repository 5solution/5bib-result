import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Partner, PartnerDocument } from '../schemas/partner.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { CreatePartnerDto, UpdatePartnerDto } from '../dto/partner.dto';
import { escapeRegex } from '../utils/escape-regex';

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
  ) {}

  async create(dto: CreatePartnerDto, createdBy?: string): Promise<Partner> {
    const doc = await this.partnerModel.create({ ...dto, createdBy });
    return doc.toObject();
  }

  async findAll(opts: { search?: string; page?: number; limit?: number } = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const filter: any = { deletedAt: null };
    if (opts.search) {
      // M-01 QC fix: escape regex special chars (defense vs ReDoS)
      const safeSearch = escapeRegex(opts.search);
      filter.$or = [
        { entityName: { $regex: safeSearch, $options: 'i' } },
        { taxId: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.partnerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.partnerModel.countDocuments(filter),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Partner> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid partner id');
    }
    const partner = await this.partnerModel
      .findOne({ _id: id, deletedAt: null })
      .lean();
    if (!partner) throw new NotFoundException('Partner not found');
    return partner as Partner;
  }

  async update(id: string, dto: UpdatePartnerDto): Promise<Partner> {
    const partner = await this.partnerModel
      .findOneAndUpdate({ _id: id, deletedAt: null }, dto, { new: true })
      .lean();
    if (!partner) throw new NotFoundException('Partner not found');
    return partner as Partner;
  }

  /**
   * Soft delete partner.
   * UP-06: Reject delete if any contract still references this partner (deletedAt null).
   */
  async remove(id: string): Promise<{ success: true }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid partner id');
    }
    const refCount = await this.contractModel.countDocuments({
      partnerId: id,
      deletedAt: null,
    });
    if (refCount > 0) {
      throw new BadRequestException(
        `Không thể xoá đối tác — đang có ${refCount} hợp đồng tham chiếu.`,
      );
    }
    const result = await this.partnerModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Partner not found');
    }
    return { success: true };
  }

  /**
   * FEATURE-032 — Dual-key batch dedup check for Excel import.
   * - Rows có taxId → check by `taxId` (MST stable, sparse unique candidate)
   * - Rows không taxId → check by `entityName` exact match
   * Returns subset of input pairs that ALREADY EXIST trong active partners.
   */
  async findByTaxIdsOrNames(
    pairs: Array<{ taxId?: string; entityName: string }>,
  ): Promise<Array<{ taxId?: string; entityName: string }>> {
    if (pairs.length === 0) return [];
    const taxIds = pairs.filter((p) => p.taxId).map((p) => p.taxId!);
    const namesNoTax = pairs
      .filter((p) => !p.taxId)
      .map((p) => p.entityName);

    const orConditions: Array<Record<string, unknown>> = [];
    if (taxIds.length > 0) orConditions.push({ taxId: { $in: taxIds } });
    if (namesNoTax.length > 0)
      orConditions.push({ entityName: { $in: namesNoTax } });
    if (orConditions.length === 0) return [];

    const items = await this.partnerModel
      .find(
        { deletedAt: null, $or: orConditions },
        { entityName: 1, taxId: 1, _id: 0 },
      )
      .lean();
    return items.map((i) => ({
      entityName: i.entityName,
      taxId: i.taxId,
    }));
  }
}
