import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import {
  VolEventContact,
  type EventContactType,
} from '../entities/vol-event-contact.entity';
import { CreateEventContactDto } from '../dto/create-event-contact.dto';
import { UpdateEventContactDto } from '../dto/update-event-contact.dto';
import {
  EventContactDto,
  EventContactsGroupDto,
} from '../dto/event-contact.dto';
import { TeamCacheService } from './team-cache.service';

const CONTACT_TYPE_ORDER: EventContactType[] = [
  'medical',
  'rescue',
  'police',
  'btc',
  'other',
];

// Emergency contacts are prominent safety info — cache TTL is long because
// they rarely change (BR-EMR spec TTL = 300s).
const CONTACTS_TTL_SECONDS = 300;

/**
 * v1.5: CRUD for emergency contacts (BTC / Y tế / Cứu hộ / Công an / Khác)
 * per event. Admin endpoints list everything (inactive included); the public
 * endpoint groups by type, filters out inactive, and is Redis-cached.
 */
@Injectable()
export class TeamContactService {
  private readonly logger = new Logger(TeamContactService.name);

  constructor(
    @InjectRepository(VolEventContact, 'volunteer')
    private readonly contactRepo: Repository<VolEventContact>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly cache: TeamCacheService,
  ) {}

  /** Admin list — includes inactive rows, ordered by type priority. */
  async listForAdmin(eventId: number): Promise<EventContactDto[]> {
    await this.assertEventExists(eventId);
    const rows = await this.contactRepo.find({
      where: { event_id: eventId },
    });
    return this.sortByTypeThenOrder(rows).map((r) => this.toDto(r));
  }

  /**
   * Public (token-gated) list — only active rows, grouped by type. Cached
   * under `team:event:{id}:contacts` TTL 300s; dropped on every mutation.
   */
  async listForPublic(eventId: number): Promise<EventContactsGroupDto> {
    const cacheKey = TeamCacheService.keyEventContacts(eventId);
    const cached = await this.cache.getJson<EventContactsGroupDto>(cacheKey);
    if (cached) return cached;

    const rows = await this.contactRepo.find({
      where: { event_id: eventId, is_active: true },
    });
    const sorted = this.sortByTypeThenOrder(rows);
    const grouped: EventContactsGroupDto = {
      medical: [],
      rescue: [],
      police: [],
      btc: [],
      other: [],
    };
    for (const r of sorted) {
      grouped[r.contact_type].push(this.toDto(r));
    }
    await this.cache.setJson(cacheKey, grouped, CONTACTS_TTL_SECONDS);
    return grouped;
  }

  async create(
    eventId: number,
    dto: CreateEventContactDto,
  ): Promise<EventContactDto> {
    await this.assertEventExists(eventId);
    const row = this.contactRepo.create({
      event_id: eventId,
      contact_type: dto.contact_type,
      contact_name: dto.contact_name.trim(),
      phone: normalizePhone(dto.phone),
      phone2: dto.phone2 ? normalizePhone(dto.phone2) : null,
      note: dto.note?.trim() ?? null,
      sort_order: dto.sort_order ?? 0,
      is_active: dto.is_active ?? true,
    });
    const saved = await this.contactRepo.save(row);
    await this.cache.invalidateEventContacts(eventId);
    this.logger.log(
      `CONTACT_CREATE event=${eventId} id=${saved.id} type=${saved.contact_type}`,
    );
    return this.toDto(saved);
  }

  async update(id: number, dto: UpdateEventContactDto): Promise<EventContactDto> {
    const row = await this.contactRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');

    if (dto.contact_type !== undefined) row.contact_type = dto.contact_type;
    if (dto.contact_name !== undefined) row.contact_name = dto.contact_name.trim();
    if (dto.phone !== undefined) row.phone = normalizePhone(dto.phone);
    if (dto.phone2 !== undefined) {
      row.phone2 = dto.phone2 ? normalizePhone(dto.phone2) : null;
    }
    if (dto.note !== undefined) row.note = dto.note ? dto.note.trim() : null;
    if (dto.sort_order !== undefined) row.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) row.is_active = dto.is_active;

    const saved = await this.contactRepo.save(row);
    await this.cache.invalidateEventContacts(saved.event_id);
    return this.toDto(saved);
  }

  async toggleActive(id: number): Promise<EventContactDto> {
    const row = await this.contactRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');
    row.is_active = !row.is_active;
    const saved = await this.contactRepo.save(row);
    await this.cache.invalidateEventContacts(saved.event_id);
    return this.toDto(saved);
  }

  async remove(id: number): Promise<void> {
    const row = await this.contactRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');
    const eventId = row.event_id;
    await this.contactRepo.remove(row);
    await this.cache.invalidateEventContacts(eventId);
    this.logger.log(`CONTACT_DELETE event=${eventId} id=${id}`);
  }

  private async assertEventExists(eventId: number): Promise<void> {
    const exists = await this.eventRepo.exist({ where: { id: eventId } });
    if (!exists) throw new NotFoundException('Event not found');
  }

  private sortByTypeThenOrder(rows: VolEventContact[]): VolEventContact[] {
    const typeRank = new Map<EventContactType, number>(
      CONTACT_TYPE_ORDER.map((t, i) => [t, i]),
    );
    return [...rows].sort((a, b) => {
      const at = typeRank.get(a.contact_type) ?? 99;
      const bt = typeRank.get(b.contact_type) ?? 99;
      if (at !== bt) return at - bt;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.id - b.id;
    });
  }

  private toDto(row: VolEventContact): EventContactDto {
    return {
      id: row.id,
      event_id: row.event_id,
      contact_type: row.contact_type,
      contact_name: row.contact_name,
      phone: row.phone,
      phone2: row.phone2,
      note: row.note,
      sort_order: row.sort_order,
      is_active: row.is_active,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}

/**
 * Collapse all whitespace to preserve "0912345678" readability while still
 * accepting "+84 912 345 678" style input.
 */
function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
