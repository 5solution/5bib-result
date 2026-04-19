import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  CertificateTemplate,
  CertificateTemplateDocument,
} from '../schemas/certificate-template.schema';
import {
  RaceCertificateConfig,
  RaceCertificateConfigDocument,
} from '../schemas/race-certificate-config.schema';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { ListTemplatesQueryDto } from '../dto/list-templates-query.dto';
import {
  TemplateResponseDto,
  TemplateListResponseDto,
} from '../dto/template-response.dto';

@Injectable()
export class CertificateTemplateService {
  private readonly logger = new Logger(CertificateTemplateService.name);

  constructor(
    @InjectModel(CertificateTemplate.name)
    private readonly templateModel: Model<CertificateTemplateDocument>,
    @InjectModel(RaceCertificateConfig.name)
    private readonly configModel: Model<RaceCertificateConfigDocument>,
  ) {}

  private toResponse(
    doc: CertificateTemplateDocument | Record<string, unknown>,
  ): TemplateResponseDto {
    const plain = (
      'toObject' in doc && typeof doc.toObject === 'function'
        ? doc.toObject()
        : doc
    ) as CertificateTemplate & {
      _id: Types.ObjectId;
    };
    return {
      id: plain._id.toString(),
      name: plain.name,
      race_id: plain.race_id,
      course_id: plain.course_id ?? null,
      type: plain.type,
      canvas: plain.canvas,
      layers: plain.layers,
      photo_area: plain.photo_area ?? null,
      placeholder_photo_url: plain.placeholder_photo_url,
      photo_behind_background: plain.photo_behind_background ?? false,
      is_archived: plain.is_archived,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
    };
  }

  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    if (dto.type === 'share_card' && dto.photo_area) {
      throw new BadRequestException(
        'share_card templates must not have photo_area (typography-focused)',
      );
    }
    const created = await this.templateModel.create(dto);
    return this.toResponse(created);
  }

  async list(query: ListTemplatesQueryDto): Promise<TemplateListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter: Record<string, unknown> = {};
    if (query.raceId) filter.race_id = query.raceId;
    if (query.courseId) filter.course_id = query.courseId;
    if (query.type) filter.type = query.type;
    if (!query.includeArchived) filter.is_archived = false;

    const [docs, total] = await Promise.all([
      this.templateModel
        .find(filter)
        .sort({ updated_at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.templateModel.countDocuments(filter).exec(),
    ]);

    return {
      data: docs.map((d) => this.toResponse(d)),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: string): Promise<TemplateResponseDto> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid template id');
    }
    const doc = await this.templateModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Template not found');
    return this.toResponse(doc);
  }

  async findByIdRaw(
    id: string,
  ): Promise<CertificateTemplateDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.templateModel.findById(id).exec();
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid template id');
    }

    // Guard: share_card must not have photo_area.
    // When PATCH omits `type`, we must read the stored type to determine
    // the effective type — otherwise a partial PATCH can silently add
    // photo_area to an existing share_card template.
    if (dto.photo_area !== undefined) {
      const existing = await this.templateModel
        .findById(id)
        .select({ type: 1 })
        .lean()
        .exec();
      const effectiveType = dto.type ?? existing?.type;
      if (effectiveType === 'share_card') {
        throw new BadRequestException(
          'share_card templates must not have photo_area',
        );
      }
    }
    const updated = await this.templateModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Template not found');
    return this.toResponse(updated);
  }

  async remove(id: string): Promise<{ success: true }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid template id');
    }
    const objectId = new Types.ObjectId(id);
    const inUse = await this.configModel
      .exists({
        $or: [
          { default_template_certificate: objectId },
          { default_template_share_card: objectId },
          { 'course_overrides.template_certificate': objectId },
          { 'course_overrides.template_share_card': objectId },
        ],
      })
      .exec();
    if (inUse) {
      throw new ConflictException(
        'Template is referenced by a RaceCertificateConfig — unassign before deleting',
      );
    }
    const res = await this.templateModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Template not found');
    return { success: true };
  }
}
