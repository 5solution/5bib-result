import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { TeamCacheService } from './team-cache.service';

/**
 * v1.5: Normalize a user-provided chat group URL.
 * - undefined → undefined (caller treats as "no patch")
 * - null or empty/whitespace-only string → null (stored as "no link")
 * - Existing protocol (http/https/tel/mailto/zalo/etc) → returned as-is, trimmed
 * - Bare "zalo.me/g/xxx" or "t.me/foo" → "https://" prepended
 */
function normalizeChatGroupUrl(input: string | null | undefined): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

@Injectable()
export class TeamEventService {
  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
  ) {}

  async createEvent(dto: CreateEventDto): Promise<VolEvent> {
    if (new Date(dto.event_end_date) < new Date(dto.event_start_date)) {
      throw new BadRequestException('event_end_date before event_start_date');
    }
    if (new Date(dto.registration_close) <= new Date(dto.registration_open)) {
      throw new BadRequestException('registration_close must be after registration_open');
    }
    const entity = this.eventRepo.create({
      ...dto,
      location_lat: dto.location_lat != null ? String(dto.location_lat) : null,
      location_lng: dto.location_lng != null ? String(dto.location_lng) : null,
      registration_open: new Date(dto.registration_open),
      registration_close: new Date(dto.registration_close),
    });
    const saved = await this.eventRepo.save(entity);
    await this.cache.invalidateEvent(saved.id);
    return saved;
  }

  async listEvents(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ data: VolEvent[]; total: number; page: number }> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.event_start_date', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    if (params.status) qb.andWhere('e.status = :status', { status: params.status });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: params.page };
  }

  async getEvent(id: number): Promise<VolEvent & { roles: VolRole[] }> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const roles = await this.roleRepo.find({
      where: { event_id: id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return { ...event, roles };
  }

  async updateEvent(id: number, dto: UpdateEventDto): Promise<VolEvent> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === 'completed') {
      throw new BadRequestException('Cannot edit event in completed status');
    }
    Object.assign(event, {
      ...dto,
      location_lat: dto.location_lat != null ? String(dto.location_lat) : event.location_lat,
      location_lng: dto.location_lng != null ? String(dto.location_lng) : event.location_lng,
      registration_open:
        dto.registration_open != null ? new Date(dto.registration_open) : event.registration_open,
      registration_close:
        dto.registration_close != null ? new Date(dto.registration_close) : event.registration_close,
    });
    const saved = await this.eventRepo.save(event);
    await this.cache.invalidateEvent(id);
    return saved;
  }

  async deleteEvent(id: number): Promise<void> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'draft') {
      throw new BadRequestException('Only draft events can be deleted');
    }
    await this.eventRepo.remove(event);
    await this.cache.invalidateEvent(id);
  }

  async createRole(eventId: number, dto: CreateRoleDto): Promise<VolRole> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const normalizedChatUrl = normalizeChatGroupUrl(dto.chat_group_url);
    const role = this.roleRepo.create({
      ...dto,
      event_id: eventId,
      daily_rate: String(dto.daily_rate),
      filled_slots: 0,
      chat_platform: dto.chat_platform ?? null,
      // normalizedChatUrl can be undefined (user didn't pass) — coerce to null
      // so the column is populated correctly on INSERT.
      chat_group_url: normalizedChatUrl === undefined ? null : normalizedChatUrl,
    });
    const saved = await this.roleRepo.save(role);
    await this.cache.invalidateEvent(eventId, [saved.id]);
    return saved;
  }

  async listRoles(eventId: number): Promise<VolRole[]> {
    return this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
  }

  async updateRole(roleId: number, dto: UpdateRoleDto): Promise<VolRole> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (dto.max_slots != null && dto.max_slots < role.filled_slots) {
      throw new BadRequestException(
        `max_slots (${dto.max_slots}) cannot be smaller than filled_slots (${role.filled_slots})`,
      );
    }
    // v1.5 chat fields: honor explicit null ("clear"), undefined means "leave
    // unchanged", non-empty string gets normalized to https:// + kept.
    // Strip chat fields from the spread first so undefined doesn't clobber
    // the persisted value via Object.assign.
    const {
      chat_platform: chatPlatformIn,
      chat_group_url: chatGroupUrlIn,
      ...restDto
    } = dto;
    Object.assign(role, {
      ...restDto,
      daily_rate: dto.daily_rate != null ? String(dto.daily_rate) : role.daily_rate,
    });
    if ('chat_platform' in dto) {
      role.chat_platform = chatPlatformIn ?? null;
    }
    if ('chat_group_url' in dto) {
      const normalized = normalizeChatGroupUrl(chatGroupUrlIn);
      if (normalized !== undefined) role.chat_group_url = normalized;
    }
    const saved = await this.roleRepo.save(role);
    await this.cache.invalidateEvent(role.event_id, [roleId]);
    return saved;
  }

  async deleteRole(roleId: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.filled_slots > 0) {
      throw new BadRequestException('Cannot delete role with existing registrations');
    }
    await this.roleRepo.remove(role);
    await this.cache.invalidateEvent(role.event_id, [roleId]);
  }

  /**
   * Public event listing — only events whose registration window is open now.
   */
  async listPublicEvents(): Promise<VolEvent[]> {
    const now = new Date();
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: 'open' })
      .andWhere('e.registration_open <= :now', { now })
      .andWhere('e.registration_close >= :now', { now })
      .orderBy('e.event_start_date', 'ASC')
      .getMany();
  }

  /**
   * Public event detail — 404 for drafts / closed / completed events OR
   * events whose registration window is not currently active. Draft events
   * must not leak through the public endpoint.
   */
  async getPublicEvent(id: number): Promise<VolEvent & { roles: VolRole[] }> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const now = new Date();
    const isVisible =
      event.status === 'open' &&
      event.registration_open <= now &&
      event.registration_close >= now;
    if (!isVisible) {
      throw new NotFoundException('Event not found');
    }
    const roles = await this.roleRepo.find({
      where: { event_id: id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return { ...event, roles };
  }
}
