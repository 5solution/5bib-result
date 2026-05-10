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
      filter.$or = [
        { entityName: { $regex: opts.search, $options: 'i' } },
        { taxId: { $regex: opts.search, $options: 'i' } },
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
}
