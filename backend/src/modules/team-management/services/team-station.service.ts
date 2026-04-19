import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { VolStation } from '../entities/vol-station.entity';
import type { StationStatus } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import type { RegistrationStatus } from '../entities/vol-registration.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolEvent } from '../entities/vol-event.entity';
import { VolTeamCategory } from '../entities/vol-team-category.entity';
import {
  AssignableMemberDto,
  AssignmentMemberBriefDto,
  CreateAssignmentDto,
  CreateStationDto,
  MyStationViewDto,
  StationWithAssignmentSummaryDto,
  UpdateStationDto,
} from '../dto/station.dto';
import { TeamCacheService } from './team-cache.service';
import { TeamDirectoryService } from './team-directory.service';

// v1.6 BR-STN-02: only registrations past the approval gate can be assigned.
// Matches the spec + directory service's POST_APPROVE_STATUSES. Keep both in
// sync if registration states evolve.
const POST_APPROVE_SET: ReadonlySet<RegistrationStatus> = new Set<RegistrationStatus>([
  'approved',
  'contract_sent',
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
]);

// Stations list cache — short TTL so admin UI updates feel live without
// hammering DB. My-station view uses the same TTL since race-day state
// changes fast.
const STATION_LIST_TTL_SECONDS = 60;
const MY_STATION_TTL_SECONDS = 60;

@Injectable()
export class TeamStationService {
  private readonly logger = new Logger(TeamStationService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolStationAssignment, 'volunteer')
    private readonly assignmentRepo: Repository<VolStationAssignment>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    private readonly cache: TeamCacheService,
    private readonly directory: TeamDirectoryService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // Admin — station CRUD
  // ──────────────────────────────────────────────────────────────────────

  /**
   * v1.8 — list every station under a Team (category), enriched with
   * supervisor/worker split. Redis-cached per-category for 60s.
   */
  async listStationsWithSummary(
    categoryId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    const category = await this.assertCategory(categoryId);

    const cacheKey = TeamCacheService.keyStations(category.event_id, categoryId);
    const cached =
      await this.cache.getJson<StationWithAssignmentSummaryDto[]>(cacheKey);
    if (cached) return cached;

    const stations = await this.stationRepo.find({
      where: { category_id: categoryId },
      relations: { category: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return this.enrichStations(stations, cacheKey);
  }

  /**
   * v1.8 — flat event-wide list (no picker). Each station carries
   * category_id + category_name + category_color for client-side grouping.
   */
  async listAllStationsInEvent(
    eventId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    const stations = await this.stationRepo.find({
      where: { event_id: eventId },
      relations: { category: true },
      order: { category_id: 'ASC', sort_order: 'ASC', id: 'ASC' },
    });
    return this.enrichStations(stations);
  }

  private async enrichStations(
    stations: VolStation[],
    cacheKey?: string,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    if (stations.length === 0) {
      const empty: StationWithAssignmentSummaryDto[] = [];
      if (cacheKey) await this.cache.setJson(cacheKey, empty, STATION_LIST_TTL_SECONDS);
      return empty;
    }
    const stationIds = stations.map((s) => s.id);
    // Load assignments with their registration + the registration's role
    // (we need role.is_leader_role to derive supervisor/worker).
    const assignments = await this.assignmentRepo.find({
      where: { station_id: In(stationIds) },
      relations: { registration: { role: true } },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    const byStation = new Map<number, VolStationAssignment[]>();
    for (const a of assignments) {
      const bucket = byStation.get(a.station_id) ?? [];
      bucket.push(a);
      byStation.set(a.station_id, bucket);
    }

    const result = stations.map((s) =>
      this.toStationSummary(s, byStation.get(s.id) ?? []),
    );
    if (cacheKey) await this.cache.setJson(cacheKey, result, STATION_LIST_TTL_SECONDS);
    return result;
  }

  async createStation(
    categoryId: number,
    dto: CreateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const category = await this.assertCategory(categoryId);
    const row = this.stationRepo.create({
      event_id: category.event_id,
      category_id: categoryId,
      station_name: dto.station_name.trim(),
      location_description: dto.location_description?.trim() ?? null,
      gps_lat: this.numberToDecimalString(dto.gps_lat),
      gps_lng: this.numberToDecimalString(dto.gps_lng),
      sort_order: dto.sort_order ?? 0,
      status: 'setup',
      is_active: true,
    });
    const saved = await this.stationRepo.save(row);
    saved.category = category;
    await this.cache.invalidateStations(category.event_id, categoryId);
    this.logger.log(
      `STATION_CREATE event=${category.event_id} category=${categoryId} id=${saved.id} name="${saved.station_name}"`,
    );
    return this.toStationSummary(saved, []);
  }

  async updateStation(
    id: number,
    dto: UpdateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const row = await this.stationRepo.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!row) throw new NotFoundException('Station not found');

    if (dto.station_name !== undefined) row.station_name = dto.station_name.trim();
    if (dto.location_description !== undefined) {
      row.location_description = dto.location_description
        ? dto.location_description.trim()
        : null;
    }
    if (dto.gps_lat !== undefined) {
      row.gps_lat = this.numberToDecimalString(dto.gps_lat);
    }
    if (dto.gps_lng !== undefined) {
      row.gps_lng = this.numberToDecimalString(dto.gps_lng);
    }
    if (dto.sort_order !== undefined) row.sort_order = dto.sort_order;

    const saved = await this.stationRepo.save(row);
    await this.cache.invalidateStations(saved.event_id, saved.category_id);
    await this.cache.invalidateStation(saved.id);

    const assignments = await this.assignmentRepo.find({
      where: { station_id: saved.id },
      relations: { registration: { role: true } },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return this.toStationSummary(saved, assignments);
  }

  /**
   * Per spec (Danny Q1): status is a free-form lifecycle — any of
   * setup/active/closed can follow any other (e.g. closed → active is
   * legal if the admin reopens a station). We just validate the target
   * value is one of the enum values (already enforced by DTO @IsEnum).
   */
  async updateStatus(
    id: number,
    newStatus: StationStatus,
  ): Promise<StationWithAssignmentSummaryDto> {
    const row = await this.stationRepo.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!row) throw new NotFoundException('Station not found');
    row.status = newStatus;
    const saved = await this.stationRepo.save(row);
    await this.cache.invalidateStations(saved.event_id, saved.category_id);
    await this.cache.invalidateStation(saved.id);

    const assignments = await this.assignmentRepo.find({
      where: { station_id: saved.id },
      relations: { registration: { role: true } },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return this.toStationSummary(saved, assignments);
  }

  async deleteStation(id: number): Promise<void> {
    const row = await this.stationRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Station not found');
    const count = await this.assignmentRepo.count({ where: { station_id: id } });
    if (count > 0) {
      throw new ConflictException(`Trạm có ${count} người đang được gán`);
    }
    const { event_id: eventId, category_id: categoryId } = row;
    await this.stationRepo.remove(row);
    await this.cache.invalidateStations(eventId, categoryId);
    await this.cache.invalidateStation(id);
    this.logger.log(`STATION_DELETE event=${eventId} category=${categoryId} id=${id}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Admin — assignment management
  // ──────────────────────────────────────────────────────────────────────

  /**
   * v1.8 — list every member who COULD be assigned to this station:
   *  - same event + role.category_id === station.category_id (ANY rank)
   *  - registration.status ∈ POST_APPROVE_SET
   *  - NOT currently assigned to any station (UNIQUE registration_id)
   *
   * BR-STN-03 v1.8 RELAXED: leaders are RETURNED in the list. The UI may
   * surface a warning when assigning a leader, but the service no longer
   * blocks. Rationale: operator may want a leader to "cầm trạm" in edge cases.
   */
  async listAssignableMembers(stationId: number): Promise<AssignableMemberDto[]> {
    const station = await this.stationRepo.findOne({
      where: { id: stationId },
      relations: { category: true },
    });
    if (!station) throw new NotFoundException('Station not found');

    const rows = await this.regRepo
      .createQueryBuilder('r')
      .leftJoin(VolStationAssignment, 'a', 'a.registration_id = r.id')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: station.event_id })
      .andWhere('role.category_id = :cid', { cid: station.category_id })
      .andWhere('r.status IN (:...statuses)', {
        statuses: Array.from(POST_APPROVE_SET),
      })
      .andWhere('a.id IS NULL')
      .orderBy('role.is_leader_role', 'DESC')
      .addOrderBy('r.full_name', 'ASC')
      .getMany();

    return rows.map((r) => ({
      registration_id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      status: r.status,
      role_id: r.role?.id ?? r.role_id,
      role_name: r.role?.role_name ?? '',
      is_leader_role: r.role?.is_leader_role === true,
      avatar_url: r.avatar_photo_url ?? null,
    }));
  }

  /**
   * Create a single (station, registration) assignment inside a transaction
   * with a pessimistic-write lock on the registration row. That plus the DB
   * UNIQUE constraint guarantees we never double-assign the same person if
   * two admins click "Assign" at the same moment.
   *
   * v1.8: supervisor/worker derived — not stored on the assignment.
   */
  async createAssignment(
    stationId: number,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentMemberBriefDto> {
    const { saved, eventId, categoryId } = await this.dataSource.transaction(
      async (m) => {
        const station = await m.getRepository(VolStation).findOne({
          where: { id: stationId },
        });
        if (!station) throw new NotFoundException('Station not found');

        // Pessimistic write lock on the registration row — blocks any
        // concurrent INSERT into vol_station_assignment for the same reg.
        const reg = await m
          .getRepository(VolRegistration)
          .createQueryBuilder('r')
          .setLock('pessimistic_write')
          .leftJoinAndSelect('r.role', 'role')
          .where('r.id = :id', { id: dto.registration_id })
          .getOne();
        if (!reg) throw new NotFoundException('Registration not found');

        if (reg.event_id !== station.event_id) {
          throw new BadRequestException('Registration belongs to a different event');
        }
        if (!reg.role || reg.role.category_id !== station.category_id) {
          throw new BadRequestException(
            'Registration role không thuộc team (category) của trạm',
          );
        }
        // BR-STN-02: must be past approval gate.
        if (!POST_APPROVE_SET.has(reg.status)) {
          throw new BadRequestException(
            `Registration status "${reg.status}" chưa đủ điều kiện gán trạm`,
          );
        }
        // v1.8: Leader có thể assign — chỉ log warning.
        if (reg.role.is_leader_role === true) {
          this.logger.warn(
            `LEADER_ASSIGNED station=${station.id} reg=${reg.id} role=${reg.role.id} — unusual pattern`,
          );
        }

        const row = m.getRepository(VolStationAssignment).create({
          station_id: station.id,
          registration_id: reg.id,
          duty: dto.duty?.trim() ? dto.duty.trim() : null,
          note: dto.note?.trim() ? dto.note.trim() : null,
          sort_order: 0,
        });

        let persisted: VolStationAssignment;
        try {
          persisted = await m.getRepository(VolStationAssignment).save(row);
        } catch (err) {
          if (err instanceof QueryFailedError) {
            const code = (err as { code?: string; driverError?: { code?: string } })
              .driverError?.code
              ?? (err as { code?: string }).code;
            if (code === 'ER_DUP_ENTRY' || code === '23505') {
              // BR-STN-01: 1 registration → max 1 station.
              throw new ConflictException('Người này đã được gán vào một trạm khác');
            }
          }
          throw err;
        }

        return {
          saved: persisted,
          eventId: station.event_id,
          categoryId: station.category_id,
        };
      },
    );

    await this.cache.invalidateStations(eventId, categoryId);
    await this.cache.invalidateStation(stationId);
    this.logger.log(
      `STATION_ASSIGN station=${stationId} reg=${dto.registration_id}`,
    );

    // Reload with registration + role so we can build the brief.
    const withReg = await this.assignmentRepo.findOne({
      where: { id: saved.id },
      relations: { registration: { role: true } },
    });
    if (!withReg) {
      // Shouldn't happen — we just saved it.
      throw new NotFoundException('Assignment vanished after save');
    }
    return this.toAssignmentBrief(withReg);
  }

  async removeAssignment(assignmentId: number): Promise<void> {
    const row = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { station: true },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    const stationId = row.station_id;
    const eventId = row.station?.event_id ?? null;
    const categoryId = row.station?.category_id ?? null;
    await this.assignmentRepo.remove(row);
    if (eventId !== null && categoryId !== null) {
      await this.cache.invalidateStations(eventId, categoryId);
    }
    await this.cache.invalidateStation(stationId);
    this.logger.log(`STATION_UNASSIGN station=${stationId} assignment=${assignmentId}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public portal — "my station" view
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Portal endpoint used by TNV/Crew/Leader. Validates magic token, finds
   * caller's assignment (if any), then loads sibling assignments on the same
   * station and splits them into supervisor_list + teammate_list.
   *
   * v1.8: supervisor/worker split derived from each sibling's role flag.
   */
  async getMyStationView(token: string): Promise<MyStationViewDto> {
    const reg = await this.directory.validateMemberToken(token);

    const assignment = await this.assignmentRepo.findOne({
      where: { registration_id: reg.id },
      relations: { registration: { role: true } },
    });
    if (!assignment) {
      return {
        station: null,
        my_is_supervisor: null,
        supervisor_list: [],
        teammate_list: [],
      };
    }

    const cacheKey = TeamCacheService.keyStationMyView(
      assignment.station_id,
      reg.id,
    );
    const cached = await this.cache.getJson<MyStationViewDto>(cacheKey);
    if (cached) return cached;

    const station = await this.stationRepo.findOne({
      where: { id: assignment.station_id },
      relations: { category: true },
    });
    if (!station) {
      // Assignment exists but station was hard-deleted under it — defensive.
      return {
        station: null,
        my_is_supervisor: null,
        supervisor_list: [],
        teammate_list: [],
      };
    }

    const siblings = await this.assignmentRepo.find({
      where: { station_id: station.id },
      relations: { registration: { role: true } },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    const supervisor_list: AssignmentMemberBriefDto[] = [];
    const teammate_list: AssignmentMemberBriefDto[] = [];
    for (const s of siblings) {
      const brief = this.toAssignmentBrief(s);
      if (brief.is_supervisor) {
        supervisor_list.push(brief);
      } else if (s.registration_id !== reg.id) {
        // teammate_list excludes the caller themselves.
        teammate_list.push(brief);
      }
    }

    const myIsSupervisor =
      assignment.registration?.role?.is_leader_role === true;

    const gpsLat = station.gps_lat;
    const gpsLng = station.gps_lng;
    const google_maps_url =
      gpsLat && gpsLng
        ? `https://www.google.com/maps?q=${gpsLat},${gpsLng}`
        : null;

    const response: MyStationViewDto = {
      station: {
        id: station.id,
        station_name: station.station_name,
        category_id: station.category_id,
        category_name: station.category?.name ?? null,
        category_color: station.category?.color ?? null,
        location_description: station.location_description,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        google_maps_url,
        status: station.status,
      },
      my_is_supervisor: myIsSupervisor,
      supervisor_list,
      teammate_list,
    };
    await this.cache.setJson(cacheKey, response, MY_STATION_TTL_SECONDS);
    return response;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  private toStationSummary(
    station: VolStation,
    assignments: VolStationAssignment[],
  ): StationWithAssignmentSummaryDto {
    const supervisors: AssignmentMemberBriefDto[] = [];
    const workers: AssignmentMemberBriefDto[] = [];
    for (const a of assignments) {
      const brief = this.toAssignmentBrief(a);
      if (brief.is_supervisor) supervisors.push(brief);
      else workers.push(brief);
    }
    return {
      id: station.id,
      event_id: station.event_id,
      station_name: station.station_name,
      location_description: station.location_description,
      gps_lat: station.gps_lat,
      gps_lng: station.gps_lng,
      status: station.status,
      sort_order: station.sort_order,
      is_active: station.is_active,
      category_id: station.category_id,
      category_name: station.category?.name ?? null,
      category_color: station.category?.color ?? null,
      supervisors,
      workers,
      supervisor_count: supervisors.length,
      worker_count: workers.length,
      has_supervisor: supervisors.length > 0,
    };
  }

  private toAssignmentBrief(a: VolStationAssignment): AssignmentMemberBriefDto {
    const role = a.registration?.role;
    return {
      assignment_id: a.id,
      registration_id: a.registration_id,
      full_name: a.registration?.full_name ?? '',
      phone: a.registration?.phone ?? '',
      status: a.registration?.status ?? '',
      is_supervisor: role?.is_leader_role === true,
      role_id: role?.id ?? null,
      role_name: role?.role_name ?? null,
      duty: a.duty,
      note: a.note,
    };
  }

  private async assertCategory(categoryId: number): Promise<VolTeamCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Team (category) not found');
    return category;
  }

  /** Mirror of the TypeORM decimal-string convention (entity stores as string). */
  private numberToDecimalString(
    value: number | null | undefined,
  ): string | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
}
