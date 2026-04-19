import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolStation } from '../entities/vol-station.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolTeamCategory } from '../entities/vol-team-category.entity';
import {
  CreateTeamCategoryDto,
  TeamCategoryDto,
  UpdateTeamCategoryDto,
} from '../dto/team-category.dto';
import { TeamCacheService } from './team-cache.service';

const SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * v1.8 — Team (category) CRUD. Categories group multiple roles of a
 * single operational team (Leader/Crew/TNV of Team Nước for example).
 * Stations + supply plans belong to a category, not to individual roles.
 */
@Injectable()
export class TeamCategoryService {
  private readonly logger = new Logger(TeamCategoryService.name);

  constructor(
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    private readonly cache: TeamCacheService,
  ) {}

  async list(eventId: number): Promise<TeamCategoryDto[]> {
    await this.assertEvent(eventId);
    const rows = await this.categoryRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (rows.length === 0) return [];
    return Promise.all(rows.map((r) => this.withCounts(r)));
  }

  async getById(id: number): Promise<TeamCategoryDto> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Team not found');
    return this.withCounts(row);
  }

  async create(
    eventId: number,
    dto: CreateTeamCategoryDto,
  ): Promise<TeamCategoryDto> {
    await this.assertEvent(eventId);
    const slug = this.normalizeSlug(dto.slug ?? dto.name);
    if (!slug || !SLUG_REGEX.test(slug)) {
      throw new BadRequestException(
        'Slug không hợp lệ (chỉ chữ thường + số + dấu gạch ngang).',
      );
    }
    const color = dto.color ?? '#3B82F6';

    const row = this.categoryRepo.create({
      event_id: eventId,
      name: dto.name.trim(),
      slug,
      color,
      sort_order: dto.sort_order ?? 0,
      description: dto.description?.trim() ?? null,
    });

    let saved: VolTeamCategory;
    try {
      saved = await this.categoryRepo.save(row);
    } catch (err) {
      throw this.mapDbError(err, 'Slug đã tồn tại trong event này');
    }

    await this.cache.invalidateEvent(eventId);
    this.logger.log(
      `TEAM_CATEGORY_CREATE event=${eventId} id=${saved.id} name="${saved.name}"`,
    );
    return this.withCounts(saved);
  }

  async update(
    id: number,
    dto: UpdateTeamCategoryDto,
  ): Promise<TeamCategoryDto> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Team not found');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = this.normalizeSlug(dto.slug);
      if (!slug || !SLUG_REGEX.test(slug)) {
        throw new BadRequestException('Slug không hợp lệ.');
      }
      row.slug = slug;
    }
    if (dto.color !== undefined) row.color = dto.color;
    if (dto.sort_order !== undefined) row.sort_order = dto.sort_order;
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() ?? null;
    }

    let saved: VolTeamCategory;
    try {
      saved = await this.categoryRepo.save(row);
    } catch (err) {
      throw this.mapDbError(err, 'Slug đã tồn tại trong event này');
    }
    await this.cache.invalidateEvent(saved.event_id);
    this.logger.log(`TEAM_CATEGORY_UPDATE id=${id}`);
    return this.withCounts(saved);
  }

  async remove(id: number): Promise<void> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Team not found');

    const [stationCount, planCount] = await Promise.all([
      this.stationRepo.count({ where: { category_id: id } }),
      this.planRepo.count({ where: { category_id: id } }),
    ]);
    if (stationCount > 0) {
      throw new ConflictException(
        `Team còn ${stationCount} trạm — hãy xoá hoặc chuyển trạm sang team khác trước.`,
      );
    }
    if (planCount > 0) {
      throw new ConflictException(
        `Team còn ${planCount} kế hoạch vật tư — hãy xoá trước khi xoá team.`,
      );
    }

    // Role FK uses ON DELETE SET NULL — roles thuộc team sẽ tự unlink.
    const eventId = row.event_id;
    await this.categoryRepo.remove(row);
    await this.cache.invalidateEvent(eventId);
    this.logger.log(`TEAM_CATEGORY_DELETE id=${id}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  private async assertEvent(eventId: number): Promise<void> {
    const exists = await this.eventRepo.exist({ where: { id: eventId } });
    if (!exists) throw new NotFoundException('Event not found');
  }

  private async withCounts(row: VolTeamCategory): Promise<TeamCategoryDto> {
    const [role_count, station_count, supply_plan_count] = await Promise.all([
      this.roleRepo.count({ where: { category_id: row.id } }),
      this.stationRepo.count({ where: { category_id: row.id } }),
      this.planRepo.count({ where: { category_id: row.id } }),
    ]);
    return {
      id: row.id,
      event_id: row.event_id,
      name: row.name,
      slug: row.slug,
      color: row.color,
      sort_order: row.sort_order,
      description: row.description,
      role_count,
      station_count,
      supply_plan_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Best-effort Vietnamese-friendly slugifier. Strips diacritics, lowercases,
   * hyphens only, max 60 chars. Caller may pass raw slug or a name.
   */
  private normalizeSlug(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private mapDbError(err: unknown, conflictMessage: string): Error {
    if (err instanceof QueryFailedError) {
      const code =
        (err as { code?: string; driverError?: { code?: string } }).driverError
          ?.code ?? (err as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY' || code === '23505') {
        return new ConflictException(conflictMessage);
      }
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
