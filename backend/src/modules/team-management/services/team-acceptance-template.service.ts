import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { VolAcceptanceTemplate } from '../entities/vol-acceptance-template.entity';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import {
  CreateAcceptanceTemplateDto,
  UpdateAcceptanceTemplateDto,
} from '../dto/acceptance-template.dto';
import { sanitizeHtml } from './pdf-renderer';

/**
 * Canonical variables the acceptance renderer injects. Kept in sync with the
 * seeded default template (migration 031) + TeamAcceptanceService.buildPlaceholders.
 * Admin-authored templates are still accepted with any variables — the admin
 * UI warns about unknown tokens but doesn't block save.
 */
export const VALID_ACCEPTANCE_VARIABLES = [
  'contract_number',
  'acceptance_date',
  'full_name',
  'birth_date',
  'cccd_number',
  'cccd_issue_date',
  'cccd_issue_place',
  'phone',
  'email',
  'address',
  'bank_account_number',
  'bank_name',
  'tax_code',
  'work_content',
  'acceptance_value',
  'acceptance_value_words',
  'event_name',
  'signature_image',
];

@Injectable()
export class TeamAcceptanceTemplateService {
  private readonly logger = new Logger(TeamAcceptanceTemplateService.name);

  constructor(
    @InjectRepository(VolAcceptanceTemplate, 'volunteer')
    private readonly templateRepo: Repository<VolAcceptanceTemplate>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
  ) {}

  async listTemplates(eventId?: number): Promise<VolAcceptanceTemplate[]> {
    return this.templateRepo.find({
      where: eventId === undefined ? {} : [{ event_id: eventId }, { event_id: IsNull() }],
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  async getTemplate(id: number): Promise<VolAcceptanceTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Acceptance template not found');
    return t;
  }

  /**
   * Resolve the effective template for an event. Prefers an event-scoped
   * active template; falls back to the global default (event_id=NULL,
   * is_default=TRUE, is_active=TRUE). Throws 404 if neither exists.
   *
   * ORDER BY id ASC LIMIT 1 makes the fallback deterministic if someone
   * accidentally seeds multiple `is_default` rows (Phase A QC note L0).
   */
  async resolveForEvent(eventId: number): Promise<VolAcceptanceTemplate> {
    const scoped = await this.templateRepo.findOne({
      where: { event_id: eventId, is_active: true },
      order: { id: 'ASC' },
    });
    if (scoped) return scoped;
    const fallback = await this.templateRepo.findOne({
      where: { event_id: IsNull(), is_default: true, is_active: true },
      order: { id: 'ASC' },
    });
    if (!fallback) {
      throw new NotFoundException(
        'No acceptance template configured — seed the default template (migration 031) or create one in admin.',
      );
    }
    return fallback;
  }

  async createTemplate(
    dto: CreateAcceptanceTemplateDto,
    createdBy: string,
  ): Promise<VolAcceptanceTemplate> {
    // Verify event exists when scoped.
    if (dto.event_id != null) {
      const evt = await this.eventRepo.findOne({ where: { id: dto.event_id } });
      if (!evt) throw new NotFoundException(`Event ${dto.event_id} not found`);
    }
    const row = this.templateRepo.create({
      event_id: dto.event_id ?? null,
      template_name: dto.template_name.trim(),
      // sanitize at save-time so we don't trust admin-pasted HTML at render
      content_html: sanitizeHtml(dto.content_html),
      variables: dto.variables,
      is_active: dto.is_active ?? true,
      is_default: false,
      created_by: createdBy,
    });
    const saved = await this.templateRepo.save(row);
    this.logger.log(
      `ACCEPTANCE_TPL_CREATED id=${saved.id} event=${saved.event_id ?? 'global'} by=${createdBy}`,
    );
    return saved;
  }

  async updateTemplate(
    id: number,
    dto: UpdateAcceptanceTemplateDto,
  ): Promise<VolAcceptanceTemplate> {
    const existing = await this.getTemplate(id);
    if (existing.is_default && dto.content_html !== undefined) {
      // Allow editing default template's HTML but LOG — this is a rare,
      // high-impact action (affects all events without an event-scoped
      // template). Admin UI should confirm on the frontend.
      this.logger.warn(
        `ACCEPTANCE_TPL_DEFAULT_EDITED id=${id} — content_html being replaced`,
      );
    }
    if (dto.template_name != null) existing.template_name = dto.template_name.trim();
    if (dto.content_html != null) existing.content_html = sanitizeHtml(dto.content_html);
    if (dto.variables != null) existing.variables = dto.variables;
    if (dto.is_active != null) existing.is_active = dto.is_active;
    return this.templateRepo.save(existing);
  }

  async deleteTemplate(id: number): Promise<void> {
    const tpl = await this.getTemplate(id);
    if (tpl.is_default) {
      throw new BadRequestException(
        'Không thể xoá template mặc định. Sửa nội dung thay vì xoá.',
      );
    }
    // Don't let admin delete a template still referenced by a reg.
    // FK is ON DELETE SET NULL so technically safe, but losing the link is
    // ugly — force admin to confirm.
    const inUse = await this.regRepo.count({ where: { acceptance_template_id: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `Template đang được ${inUse} biên bản tham chiếu — không thể xoá. ` +
          'Deactivate (is_active=false) thay vì xoá.',
      );
    }
    await this.templateRepo.remove(tpl);
    this.logger.log(`ACCEPTANCE_TPL_DELETED id=${id}`);
  }

  /**
   * Scan HTML for {{placeholder}} tokens and flag any not in
   * VALID_ACCEPTANCE_VARIABLES. Mirror of TeamContractService.validateTemplate.
   */
  validateTemplate(contentHtml: string): {
    valid: boolean;
    unknownVars: string[];
  } {
    const found = new Set<string>();
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(contentHtml)) !== null) {
      found.add(m[1].trim());
    }
    const unknownVars = Array.from(found).filter(
      (v) => !VALID_ACCEPTANCE_VARIABLES.includes(v),
    );
    return { valid: unknownVars.length === 0, unknownVars };
  }
}
