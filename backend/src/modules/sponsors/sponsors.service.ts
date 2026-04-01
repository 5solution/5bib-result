import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sponsor, SponsorDocument } from './schemas/sponsor.schema';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

const LEVEL_ORDER: Record<string, number> = { diamond: 0, gold: 1, silver: 2 };

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    @InjectModel(Sponsor.name)
    private readonly sponsorModel: Model<SponsorDocument>,
  ) {}

  // ─── Public ──────────────────────────────────────────────────

  async findAllActive() {
    const list = await this.sponsorModel
      .find({ isActive: true })
      .lean()
      .exec();

    // Sort by level (diamond first) then by order
    list.sort((a, b) => {
      const levelDiff = (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99);
      if (levelDiff !== 0) return levelDiff;
      return (a.order ?? 0) - (b.order ?? 0);
    });

    return { data: list, success: true };
  }

  // ─── Admin CRUD ──────────────────────────────────────────────

  async findAll() {
    const list = await this.sponsorModel
      .find()
      .sort({ level: 1, order: 1 })
      .lean()
      .exec();

    return { data: list, success: true };
  }

  async create(dto: CreateSponsorDto) {
    const sponsor = await this.sponsorModel.create(dto);
    return { data: sponsor.toObject(), success: true };
  }

  async update(id: string, dto: UpdateSponsorDto) {
    const sponsor = await this.sponsorModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();

    if (!sponsor) {
      throw new NotFoundException('Sponsor not found');
    }

    return { data: sponsor, success: true };
  }

  async softDelete(id: string) {
    const sponsor = await this.sponsorModel
      .findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
      .lean()
      .exec();

    if (!sponsor) {
      throw new NotFoundException('Sponsor not found');
    }

    return { data: sponsor, success: true, message: 'Sponsor deactivated' };
  }
}
