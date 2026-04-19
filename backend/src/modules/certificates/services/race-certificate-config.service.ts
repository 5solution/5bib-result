import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  RaceCertificateConfig,
  RaceCertificateConfigDocument,
} from '../schemas/race-certificate-config.schema';
import {
  CertificateTemplate,
  CertificateTemplateDocument,
  TemplateType,
} from '../schemas/certificate-template.schema';
import { UpsertRaceConfigDto } from '../dto/upsert-race-config.dto';
import { RaceConfigResponseDto } from '../dto/race-config-response.dto';

@Injectable()
export class RaceCertificateConfigService {
  private readonly logger = new Logger(RaceCertificateConfigService.name);

  constructor(
    @InjectModel(RaceCertificateConfig.name)
    private readonly configModel: Model<RaceCertificateConfigDocument>,
    @InjectModel(CertificateTemplate.name)
    private readonly templateModel: Model<CertificateTemplateDocument>,
  ) {}

  private toResponse(
    doc: RaceCertificateConfigDocument | Record<string, unknown>,
  ): RaceConfigResponseDto {
    const plain = (
      'toObject' in doc && typeof doc.toObject === 'function'
        ? doc.toObject()
        : doc
    ) as RaceCertificateConfig & { _id: Types.ObjectId };
    return {
      id: plain._id.toString(),
      race_id: plain.race_id,
      default_template_certificate: plain.default_template_certificate
        ? plain.default_template_certificate.toString()
        : null,
      default_template_share_card: plain.default_template_share_card
        ? plain.default_template_share_card.toString()
        : null,
      course_overrides: (plain.course_overrides ?? []).map((o) => ({
        course_id: o.course_id,
        template_certificate: o.template_certificate
          ? o.template_certificate.toString()
          : null,
        template_share_card: o.template_share_card
          ? o.template_share_card.toString()
          : null,
      })),
      enabled: plain.enabled,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
    };
  }

  async getByRaceId(raceId: string): Promise<RaceConfigResponseDto | null> {
    const doc = await this.configModel
      .findOne({ race_id: raceId })
      .lean()
      .exec();
    return doc ? this.toResponse(doc) : null;
  }

  async upsert(
    raceId: string,
    dto: UpsertRaceConfigDto,
  ): Promise<RaceConfigResponseDto> {
    await this.validateTemplateIds(raceId, dto);

    const update: Record<string, unknown> = {};
    if (dto.default_template_certificate !== undefined) {
      update.default_template_certificate = dto.default_template_certificate
        ? new Types.ObjectId(dto.default_template_certificate)
        : null;
    }
    if (dto.default_template_share_card !== undefined) {
      update.default_template_share_card = dto.default_template_share_card
        ? new Types.ObjectId(dto.default_template_share_card)
        : null;
    }
    if (dto.course_overrides !== undefined) {
      update.course_overrides = dto.course_overrides.map((o) => ({
        course_id: o.course_id,
        template_certificate: o.template_certificate
          ? new Types.ObjectId(o.template_certificate)
          : null,
        template_share_card: o.template_share_card
          ? new Types.ObjectId(o.template_share_card)
          : null,
      }));
    }
    if (dto.enabled !== undefined) update.enabled = dto.enabled;

    const doc = await this.configModel
      .findOneAndUpdate(
        { race_id: raceId },
        { $set: update, $setOnInsert: { race_id: raceId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();

    return this.toResponse(doc);
  }

  private async validateTemplateIds(
    raceId: string,
    dto: UpsertRaceConfigDto,
  ): Promise<void> {
    const ids: string[] = [];
    if (dto.default_template_certificate)
      ids.push(dto.default_template_certificate);
    if (dto.default_template_share_card)
      ids.push(dto.default_template_share_card);
    for (const o of dto.course_overrides ?? []) {
      if (o.template_certificate) ids.push(o.template_certificate);
      if (o.template_share_card) ids.push(o.template_share_card);
    }
    if (ids.length === 0) return;

    const objectIds = ids
      .filter(isValidObjectId)
      .map((id) => new Types.ObjectId(id));
    const templates = await this.templateModel
      .find({ _id: { $in: objectIds } }, { race_id: 1 })
      .lean()
      .exec();

    if (templates.length !== objectIds.length) {
      throw new BadRequestException('One or more templates not found');
    }
    const mismatch = templates.find((t) => t.race_id !== raceId);
    if (mismatch) {
      throw new BadRequestException(
        'All referenced templates must belong to the same race',
      );
    }
  }

  /**
   * Resolve which template to use for a render request.
   *
   * Priority order:
   *   1. RaceCertificateConfig course-specific override (if config exists + enabled)
   *   2. RaceCertificateConfig race default (if config exists + enabled)
   *   3. FALLBACK: most-recently-updated non-archived CertificateTemplate matching
   *      (race_id + type + course_id), with course-specific match ranked above
   *      null-course-id templates. Enables a simple "just-tag-the-template"
   *      workflow where an admin can drop a template on a race without having
   *      to explicitly upsert a RaceCertificateConfig document first.
   */
  async resolveTemplateId(
    raceId: string,
    courseId: string | undefined,
    type: TemplateType,
  ): Promise<Types.ObjectId | null> {
    const config = await this.configModel
      .findOne({ race_id: raceId, enabled: true })
      .lean()
      .exec();

    if (config) {
      if (courseId) {
        const override = config.course_overrides?.find(
          (o) => o.course_id === courseId,
        );
        if (override) {
          const id =
            type === 'certificate'
              ? override.template_certificate
              : override.template_share_card;
          if (id) return id;
        }
      }

      const defaultId =
        type === 'certificate'
          ? config.default_template_certificate
          : config.default_template_share_card;
      if (defaultId) return defaultId;
    }

    // Fallback: match by CertificateTemplate.race_id directly.
    // Prefer course-specific match, then course_id=null (applies to all courses).
    if (courseId) {
      const courseMatch = await this.templateModel
        .findOne({
          race_id: raceId,
          type,
          course_id: courseId,
          is_archived: false,
        })
        .sort({ updated_at: -1 })
        .select({ _id: 1 })
        .lean()
        .exec();
      if (courseMatch) return courseMatch._id;
    }

    const anyMatch = await this.templateModel
      .findOne({
        race_id: raceId,
        type,
        $or: [{ course_id: null }, { course_id: { $exists: false } }],
        is_archived: false,
      })
      .sort({ updated_at: -1 })
      .select({ _id: 1 })
      .lean()
      .exec();
    return anyMatch ? anyMatch._id : null;
  }
}
