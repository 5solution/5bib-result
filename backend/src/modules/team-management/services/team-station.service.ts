import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { VolStation } from '../entities/vol-station.entity';
import type { StationStatus } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import type { AssignmentRole } from '../entities/vol-station-assignment.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import type { RegistrationStatus } from '../entities/vol-registration.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolEvent } from '../entities/vol-event.entity';
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
    private readonly cache: TeamCacheService,
    private readonly directory: TeamDirectoryService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // Admin — station CRUD
  // ──────────────────────────────────────────────────────────────────────

  /**
   * List every station under (event, role), enriched with assignments split
   * into crew vs volunteer. Redis-cached per-(event,role) for 60s.
   */
  async listStationsWithSummary(
    eventId: number,
    roleId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    await this.assertEventAndRole(eventId, roleId);

    const cacheKey = TeamCacheService.keyStations(eventId, roleId);
    const cached =
      await this.cache.getJson<StationWithAssignmentSummaryDto[]>(cacheKey);
    if (cached) return cached;

    const stations = await this.stationRepo.find({
      where: { event_id: eventId, role_id: roleId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return this.enrichStations(stations, cacheKey);
  }

  /**
   * v1.6 — flat event-wide list for the new Trạm page (no role picker).
   * Each station carries role_id + role_name so UI can group or filter.
   */
  async listAllStationsInEvent(
    eventId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    const stations = await this.stationRepo.find({
      where: { event_id: eventId },
      relations: { role: true },
      order: { role_id: 'ASC', sort_order: 'ASC', id: 'ASC' },
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
    const assignments = await this.assignmentRepo.find({
      where: { station_id: In(stationIds) },
      relations: { registration: true },
      order: { assignment_role: 'ASC', sort_order: 'ASC', id: 'ASC' },
    });

    const byStation = new Map<number, VolStationAssignment[]>();
    for (const a of assignments) {
      const bucket = byStation.get(a.station_id) ?? [];
      bucket.push(a);
      byStation.set(a.station_id, bucket);
    }

    const result = stations.map((s) => this.toStationSummary(s, byStation.get(s.id) ?? []));
    if (cacheKey) await this.cache.setJson(cacheKey, result, STATION_LIST_TTL_SECONDS);
    return result;
  }

  async createStation(
    eventId: number,
    roleId: number,
    dto: CreateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    await this.assertEventAndRole(eventId, roleId);
    const row = this.stationRepo.create({
      event_id: eventId,
      role_id: roleId,
      station_name: dto.station_name.trim(),
      location_description: dto.location_description?.trim() ?? null,
      gps_lat: this.numberToDecimalString(dto.gps_lat),
      gps_lng: this.numberToDecimalString(dto.gps_lng),
      sort_order: dto.sort_order ?? 0,
      status: 'setup',
      is_active: true,
    });
    const saved = await this.stationRepo.save(row);
    await this.cache.invalidateStations(eventId, roleId);
    this.logger.log(
      `STATION_CREATE event=${eventId} role=${roleId} id=${saved.id} name="${saved.station_name}"`,
    );
    return this.toStationSummary(saved, []);
  }

  async updateStation(
    id: number,
    dto: UpdateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const row = await this.stationRepo.findOne({ where: { id } });
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
    await this.cache.invalidateStations(saved.event_id, saved.role_id);
    await this.cache.invalidateStation(saved.id);

    const assignments = await this.assignmentRepo.find({
      where: { station_id: saved.id },
      relations: { registration: true },
      order: { assignment_role: 'ASC', sort_order: 'ASC', id: 'ASC' },
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
    const row = await this.stationRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Station not found');
    row.status = newStatus;
    const saved = await this.stationRepo.save(row);
    await this.cache.invalidateStations(saved.event_id, saved.role_id);
    await this.cache.invalidateStation(saved.id);

    const assignments = await this.assignmentRepo.find({
      where: { station_id: saved.id },
      relations: { registration: true },
      order: { assignment_role: 'ASC', sort_order: 'ASC', id: 'ASC' },
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
    const { event_id: eventId, role_id: roleId } = row;
    await this.stationRepo.remove(row);
    await this.cache.invalidateStations(eventId, roleId);
    await this.cache.invalidateStation(id);
    this.logger.log(`STATION_DELETE event=${eventId} role=${roleId} id=${id}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Admin — assignment management
  // ──────────────────────────────────────────────────────────────────────

  /**
   * List every member who COULD be assigned to this station:
   *  - same event + same role as the station
   *  - registration.status ∈ POST_APPROVE_SET
   *  - NOT currently assigned to any station (UNIQUE registration_id)
   *  - role.is_leader_role = FALSE (BR-STN-03 — leaders can't be assigned)
   */
  async listAssignableMembers(stationId: number): Promise<AssignableMemberDto[]> {
    const station = await this.stationRepo.findOne({
      where: { id: stationId },
      relations: { role: true },
    });
    if (!station) throw new NotFoundException('Station not found');

    // Leaders are gated out at the role level — if the station's role itself
    // is a leader role we return [] because there's no one valid to assign.
    if (station.role?.is_leader_role === true) return [];

    const rows = await this.regRepo
      .createQueryBuilder('r')
      .leftJoin(
        VolStationAssignment,
        'a',
        'a.registration_id = r.id',
      )
      .where('r.event_id = :eid', { eid: station.event_id })
      .andWhere('r.role_id = :rid', { rid: station.role_id })
      .andWhere('r.status IN (:...statuses)', {
        statuses: Array.from(POST_APPROVE_SET),
      })
      .andWhere('a.id IS NULL')
      .orderBy('r.full_name', 'ASC')
      .getMany();

    return rows.map((r) => ({
      registration_id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      status: r.status,
      avatar_url: r.avatar_photo_url ?? null,
    }));
  }

  /**
   * Create a single (station, registration) assignment inside a transaction
   * with a pessimistic-write lock on the registration row. That plus the DB
   * UNIQUE constraint guarantees we never double-assign the same person if
   * two admins click "Assign" at the same moment.
   */
  async createAssignment(
    stationId: number,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentMemberBriefDto> {
    const { saved, eventId, roleId } = await this.dataSource.transaction(
      async (m) => {
        const station = await m.getRepository(VolStation).findOne({
          where: { id: stationId },
          relations: { role: true },
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
        if (reg.role_id !== station.role_id) {
          throw new BadRequestException(
            'Registration role does not match station role',
          );
        }
        // BR-STN-03: leaders can't be assigned.
        if (reg.role?.is_leader_role === true) {
          throw new BadRequestException('Không thể gán leader vào trạm');
        }
        // BR-STN-02: must be past approval gate.
        if (!POST_APPROVE_SET.has(reg.status)) {
          throw new BadRequestException(
            `Registration status "${reg.status}" chưa đủ điều kiện gán trạm`,
          );
        }

        const row = m.getRepository(VolStationAssignment).create({
          station_id: station.id,
          registration_id: reg.id,
          assignment_role: dto.assignment_role,
          note: dto.note?.trim() ?? null,
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
          roleId: station.role_id,
          reg,
        };
      },
    );

    await this.cache.invalidateStations(eventId, roleId);
    await this.cache.invalidateStation(stationId);
    this.logger.log(
      `STATION_ASSIGN station=${stationId} reg=${dto.registration_id} role=${dto.assignment_role}`,
    );

    // Reload with registration relation so we can build the brief.
    const withReg = await this.assignmentRepo.findOne({
      where: { id: saved.id },
      relations: { registration: true },
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
    const roleId = row.station?.role_id ?? null;
    await this.assignmentRepo.remove(row);
    if (eventId !== null && roleId !== null) {
      await this.cache.invalidateStations(eventId, roleId);
    }
    await this.cache.invalidateStation(stationId);
    this.logger.log(`STATION_UNASSIGN station=${stationId} assignment=${assignmentId}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public portal — "my station" view
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Portal endpoint used by TNV/Crew. Validates the magic token, finds the
   * caller's assignment (if any), then loads sibling assignments on the same
   * station and splits them into crew_list + teammate_list.
   *
   * If the caller has no assignment yet, returns an empty-station payload so
   * the frontend can render a friendly "chưa được gán" state rather than 404.
   */
  async getMyStationView(token: string): Promise<MyStationViewDto> {
    const reg = await this.directory.validateMemberToken(token);

    const assignment = await this.assignmentRepo.findOne({
      where: { registration_id: reg.id },
    });
    if (!assignment) {
      return {
        station: null,
        my_assignment_role: null,
        crew_list: [],
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
    });
    if (!station) {
      // Assignment exists but station was hard-deleted under it — defensive.
      return {
        station: null,
        my_assignment_role: null,
        crew_list: [],
        teammate_list: [],
      };
    }

    const siblings = await this.assignmentRepo.find({
      where: { station_id: station.id },
      relations: { registration: true },
      order: { assignment_role: 'ASC', sort_order: 'ASC', id: 'ASC' },
    });

    const crew_list: AssignmentMemberBriefDto[] = [];
    const teammate_list: AssignmentMemberBriefDto[] = [];
    for (const s of siblings) {
      const brief = this.toAssignmentBrief(s);
      if (s.assignment_role === 'crew') {
        crew_list.push(brief);
      } else if (s.registration_id !== reg.id) {
        // teammate_list excludes the caller themselves (spec: "exclude self").
        teammate_list.push(brief);
      }
    }

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
        location_description: station.location_description,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        google_maps_url,
        status: station.status,
      },
      my_assignment_role: assignment.assignment_role,
      crew_list,
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
    const crew: AssignmentMemberBriefDto[] = [];
    const volunteers: AssignmentMemberBriefDto[] = [];
    for (const a of assignments) {
      const brief = this.toAssignmentBrief(a);
      if (a.assignment_role === 'crew') crew.push(brief);
      else volunteers.push(brief);
    }
    return {
      id: station.id,
      station_name: station.station_name,
      location_description: station.location_description,
      gps_lat: station.gps_lat,
      gps_lng: station.gps_lng,
      status: station.status,
      sort_order: station.sort_order,
      is_active: station.is_active,
      role_id: station.role_id,
      role_name: station.role?.role_name ?? null,
      crew,
      volunteers,
      crew_count: crew.length,
      volunteer_count: volunteers.length,
      has_crew: crew.length > 0,
    };
  }

  private toAssignmentBrief(a: VolStationAssignment): AssignmentMemberBriefDto {
    return {
      assignment_id: a.id,
      registration_id: a.registration_id,
      full_name: a.registration?.full_name ?? '',
      phone: a.registration?.phone ?? '',
      status: a.registration?.status ?? '',
      assignment_role: a.assignment_role as AssignmentRole,
      note: a.note,
    };
  }

  private async assertEventAndRole(eventId: number, roleId: number): Promise<void> {
    const event = await this.eventRepo.exist({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.event_id !== eventId) {
      throw new BadRequestException('Role does not belong to this event');
    }
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
