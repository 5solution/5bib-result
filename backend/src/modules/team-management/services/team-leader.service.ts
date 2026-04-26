import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import {
  CheckinMethod,
  VolRegistration,
} from '../entities/vol-registration.entity';
import { VolStation } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import { VolTeamCategory } from '../entities/vol-team-category.entity';
import { TeamCacheService } from './team-cache.service';
import { TeamPhotoService } from './team-photo.service';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

/**
 * Days of grace after the event ends for leaders to still confirm
 * completion / late check-ins. After this window the magic-token is
 * rejected by validateLeaderToken.
 */
const LEADER_PORTAL_GRACE_DAYS = 7;

export interface LeaderMemberView {
  id: number;
  full_name: string;
  phone: string;
  role_name: string;
  status: string;
  checked_in_at: string | null;
  avatar_url: string | null;
  id_card_url: string | null;
  suspicious_checkin: boolean;
}

export interface LeaderPortalResponse {
  leader: {
    id: number;
    full_name: string;
    role_name: string;
    event_id: number;
    event_name: string;
    is_leader: true;
    expires_at: string;
    // v1.5: leaders are always past the contract gate by virtue of being
    // on-site admins for their team — surface the group-chat link directly
    // so they don't need a roundtrip through the TNV portal.
    chat_platform: 'zalo' | 'telegram' | 'whatsapp' | 'other' | null;
    chat_group_url: string | null;
    // v1.8: Teams (categories) that this leader manages — derived from
    // leader role + descendants → distinct non-null category_id. Used by
    // crew UI to label the portal header with multi-team leader names.
    managed_category_ids: number[];
    managed_category_names: string[];
  };
  members: LeaderMemberView[];
}

export interface LeaderCheckinBulkSummary {
  confirmed: number;
  skipped: number;
  failed_ids: number[];
  suspicious_count: number;
}

type CheckinRequestMethod = 'qr_scan' | 'manual';

@Injectable()
export class TeamLeaderService {
  private readonly logger = new Logger(TeamLeaderService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolStationAssignment, 'volunteer')
    private readonly assignmentRepo: Repository<VolStationAssignment>,
    private readonly cache: TeamCacheService,
    private readonly photos: TeamPhotoService,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /**
   * Validate the leader's magic token against 4 gates (exist + is_leader_role
   * + magic expiry + event-window expiry). Throws an appropriate HTTP
   * exception so callers can assume the return value is valid.
   */
  async validateLeaderToken(token: string): Promise<{
    registration: VolRegistration;
    role: VolRole;
    event: VolEvent;
  }> {
    if (!token || token.length < 10) {
      throw new UnauthorizedException('Invalid token');
    }
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg || !reg.role || !reg.event) {
      throw new UnauthorizedException('Token not found');
    }
    if (!reg.role.is_leader_role) {
      throw new ForbiddenException('This token is not a leader token');
    }
    // Leader tokens are valid until `event_end_date + grace`, even if the
    // registration's own magic_token_expires is shorter — that field is for
    // the contract/status flow, not the leader tool.
    const end = new Date(reg.event.event_end_date);
    end.setDate(end.getDate() + LEADER_PORTAL_GRACE_DAYS);
    end.setHours(23, 59, 59, 999);
    if (Date.now() > end.getTime()) {
      throw new UnauthorizedException('Leader portal has expired');
    }
    return { registration: reg, role: reg.role, event: reg.event };
  }

  /**
   * Return the portal payload: the leader's own card + every other member
   * in the same event. CCCD photo URL access is audit-logged per member.
   */
  async getTeamMembers(
    leaderReg: VolRegistration,
  ): Promise<LeaderPortalResponse> {
    if (!leaderReg.event || !leaderReg.role) {
      throw new NotFoundException('Leader context missing relations');
    }

    // ── v1.8 fix: resolve managed categories FIRST so we can scope the
    // member query — prevents a leader from seeing members of OTHER teams.
    // Pre-v1.8 roles have null category_id → set is empty → fall back to
    // same role_id lookup (never expose cross-team PII).
    const managedCategoryIdSet = await this.hierarchy.resolveManagedCategoryIds(
      leaderReg.role_id,
    );
    const managedCategoryIds = Array.from(managedCategoryIdSet).sort(
      (a, b) => a - b,
    );

    // Scope query: has categories → roles whose category_id ∈ managed set.
    // No categories (legacy) → restrict to same role_id only.
    const qb = this.regRepo
      .createQueryBuilder('reg')
      .leftJoinAndSelect('reg.role', 'role')
      .where('reg.event_id = :eventId', { eventId: leaderReg.event_id })
      .orderBy('reg.full_name', 'ASC');

    if (managedCategoryIds.length > 0) {
      qb.andWhere('role.category_id IN (:...categoryIds)', {
        categoryIds: managedCategoryIds,
      });
    } else {
      // Fallback: only own-role members (safe for unscoped / pre-v1.8 data)
      qb.andWhere('reg.role_id = :roleId', { roleId: leaderReg.role_id });
    }

    const members = await qb.getMany();

    // Filter out the leader themselves — they don't need to check themselves in.
    const others = members.filter((m) => m.id !== leaderReg.id);

    const views: LeaderMemberView[] = [];
    for (const m of others) {
      let idCardUrl: string | null = null;
      if (m.cccd_photo_url) {
        try {
          idCardUrl = await this.photos.presignCccd(m.cccd_photo_url, 3600);
          // Danny Q5 = Có: audit every leader CCCD access.
          this.logger.log(
            `[AUDIT][LEADER] LEADER_CCCD_ACCESS leader_id=${leaderReg.id} member_id=${m.id} event_id=${leaderReg.event_id} ts=${new Date().toISOString()}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to presign CCCD member=${m.id}: ${(err as Error).message}`,
          );
        }
      }
      views.push({
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        role_name: m.role?.role_name ?? '',
        status: m.status,
        checked_in_at: m.checked_in_at ? m.checked_in_at.toISOString() : null,
        avatar_url: m.avatar_photo_url,
        id_card_url: idCardUrl,
        suspicious_checkin: m.suspicious_checkin === true,
      });
    }

    const expires = new Date(leaderReg.event.event_end_date);
    expires.setDate(expires.getDate() + LEADER_PORTAL_GRACE_DAYS);
    expires.setHours(23, 59, 59, 999);
    const managedCategories =
      managedCategoryIds.length === 0
        ? []
        : await this.categoryRepo.find({
            where: { id: In(managedCategoryIds) },
            order: { sort_order: 'ASC', id: 'ASC' },
          });
    // Re-sort IDs to match name order so the parallel arrays are coherent.
    const orderedIds = managedCategories.map((c) => c.id);
    const orderedNames = managedCategories.map((c) => c.name);

    // v1.5: leader role is past the contract-signed gate by definition
    // (leader portal already requires an active event). Expose the chat link
    // unconditionally so the leader sees the same join button members get.
    return {
      leader: {
        id: leaderReg.id,
        full_name: leaderReg.full_name,
        role_name: leaderReg.role.role_name,
        event_id: leaderReg.event_id,
        event_name: leaderReg.event.event_name,
        is_leader: true,
        expires_at: expires.toISOString(),
        chat_platform: leaderReg.role.chat_platform ?? null,
        chat_group_url: leaderReg.role.chat_group_url ?? null,
        managed_category_ids: orderedIds,
        managed_category_names: orderedNames,
      },
      members: views,
    };
  }

  /**
   * Leader check-ins a team member. BR-LDR-07: leaders cannot check
   * themselves in, and cross-event check-ins are rejected.
   */
  async leaderCheckin(
    leaderReg: VolRegistration,
    memberId: number,
    method: CheckinRequestMethod,
    qrCode?: string,
  ): Promise<VolRegistration> {
    if (memberId === leaderReg.id) {
      throw new ForbiddenException('Leader cannot check themselves in');
    }

    const updated = await this.dataSource.transaction(async (m) => {
      const member = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: memberId })
        .getOne();
      if (!member) throw new NotFoundException('Member not found');
      if (member.event_id !== leaderReg.event_id) {
        throw new ForbiddenException('Member is in a different event');
      }
      if (method === 'qr_scan') {
        if (!qrCode || qrCode.trim().length === 0) {
          throw new BadRequestException('qr_code is required for qr_scan method');
        }
        if (member.qr_code !== qrCode && member.magic_token !== qrCode) {
          throw new BadRequestException('QR does not match this member');
        }
      }
      if (member.status !== 'qr_sent') {
        throw new BadRequestException(
          `Cannot check in — member status is "${member.status}", expected "qr_sent"`,
        );
      }
      if (member.checked_in_at) {
        throw new BadRequestException(
          `Already checked in at ${member.checked_in_at.toISOString()}`,
        );
      }
      const now = new Date();
      member.checked_in_at = now;
      member.checkin_method = 'leader_checkin' as CheckinMethod;
      member.status = 'checked_in';
      // Append an audit line to notes — visible to admin but not to TNV.
      const stamp = now.toISOString();
      const line = `[${stamp}] leader_checkin by=${leaderReg.id}/${leaderReg.full_name} method=${method}`;
      member.notes = [member.notes, line].filter((s): s is string => !!s).join('\n');
      return m.getRepository(VolRegistration).save(member);
    });

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(
      `[AUDIT][LEADER] LEADER_CHECKIN leader_id=${leaderReg.id} member_id=${memberId} method=${method}`,
    );
    return updated;
  }

  /**
   * Leader confirms completion for one member. Computes worked minutes and
   * flags suspicious if under the event's threshold. Snapshots daily_rate
   * and working_days so later role edits don't change past payouts.
   */
  async confirmCompletion(
    leaderReg: VolRegistration,
    memberId: number,
    note?: string,
  ): Promise<{ suspicious: boolean; member: VolRegistration }> {
    if (memberId === leaderReg.id) {
      throw new ForbiddenException(
        'Leader cannot confirm their own completion',
      );
    }
    if (!leaderReg.event) {
      throw new NotFoundException('Event not loaded for leader');
    }
    const minHours = Number(leaderReg.event.min_work_hours_for_completion);
    const thresholdMs = Number.isFinite(minHours)
      ? minHours * 60 * 60 * 1000
      : 2 * 60 * 60 * 1000;

    const { updated, suspicious } = await this.dataSource.transaction(async (m) => {
      const member = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: memberId })
        .getOne();
      if (!member) throw new NotFoundException('Member not found');
      if (member.event_id !== leaderReg.event_id) {
        throw new ForbiddenException('Member is in a different event');
      }
      if (member.status !== 'checked_in') {
        throw new BadRequestException(
          `Cannot confirm completion — member status is "${member.status}", expected "checked_in"`,
        );
      }

      const role = await m
        .getRepository(VolRole)
        .findOne({ where: { id: member.role_id } });
      if (!role) throw new NotFoundException('Member role not found');

      const now = new Date();
      const workedMs = member.checked_in_at
        ? now.getTime() - member.checked_in_at.getTime()
        : 0;
      const suspicious = workedMs < thresholdMs;

      member.status = 'completed';
      member.completion_confirmed_at = now;
      member.completion_confirmed_by = 'leader';
      member.completion_confirmed_id = leaderReg.id;
      member.suspicious_checkin = suspicious;
      member.snapshot_daily_rate = String(role.daily_rate);
      member.snapshot_working_days = role.working_days;
      member.actual_working_days = role.working_days;
      member.actual_compensation = String(
        Number(role.daily_rate) * role.working_days,
      );

      const stamp = now.toISOString();
      const line = `[${stamp}] leader_complete by=${leaderReg.id}/${leaderReg.full_name}${
        note && note.trim().length > 0 ? ` note=${note.trim()}` : ''
      }${suspicious ? ' SUSPICIOUS' : ''}`;
      member.notes = [member.notes, line]
        .filter((s): s is string => !!s)
        .join('\n');

      const saved = await m.getRepository(VolRegistration).save(member);
      return { updated: saved, suspicious };
    });

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(
      `[AUDIT][LEADER] LEADER_COMPLETE leader_id=${leaderReg.id} member_id=${memberId} suspicious=${suspicious}`,
    );
    return { suspicious, member: updated };
  }

  /**
   * Bulk-confirm many members at once. Skips (no error) members that
   * aren't `checked_in` or belong to another event; fails are only thrown
   * for totally unexpected errors.
   */
  async confirmCompletionBulk(
    leaderReg: VolRegistration,
    memberIds: number[],
    note?: string,
  ): Promise<LeaderCheckinBulkSummary> {
    const unique = Array.from(new Set(memberIds)).filter(
      (id) => id !== leaderReg.id,
    );
    if (unique.length === 0) {
      return { confirmed: 0, skipped: 0, failed_ids: [], suspicious_count: 0 };
    }

    let confirmed = 0;
    let skipped = 0;
    let suspiciousCount = 0;
    const failed: number[] = [];

    for (const id of unique) {
      try {
        // Pre-flight check to convert most "skip" cases into a soft skip
        // rather than an exception-propagating failure.
        const member = await this.regRepo.findOne({ where: { id } });
        if (
          !member ||
          member.event_id !== leaderReg.event_id ||
          member.status !== 'checked_in'
        ) {
          skipped++;
          continue;
        }
        const { suspicious } = await this.confirmCompletion(
          leaderReg,
          id,
          note,
        );
        confirmed++;
        if (suspicious) suspiciousCount++;
      } catch (err) {
        this.logger.warn(
          `Bulk complete failed member=${id}: ${(err as Error).message}`,
        );
        failed.push(id);
      }
    }

    return {
      confirmed,
      skipped,
      failed_ids: failed,
      suspicious_count: suspiciousCount,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  Station management helpers — used by TeamLeaderController
  // ─────────────────────────────────────────────────────────────

  /**
   * Return the Set of category IDs managed by this leader (via hierarchy).
   * Exposed publicly so the controller can use it without re-importing the
   * hierarchy service.
   */
  async getManagedCategoryIds(reg: VolRegistration): Promise<Set<number>> {
    return this.hierarchy.resolveManagedCategoryIds(reg.role_id);
  }

  /**
   * Throw ForbiddenException if the given categoryId is NOT in the leader's
   * managed set.
   */
  async assertManagesCategory(
    reg: VolRegistration,
    categoryId: number,
  ): Promise<void> {
    const managed = await this.getManagedCategoryIds(reg);
    if (!managed.has(categoryId)) {
      throw new ForbiddenException(
        `Category ${categoryId} is not managed by this leader`,
      );
    }
  }

  /**
   * Load the station and verify its category is in the leader's managed set.
   * Returns the station for callers that need it.
   */
  async assertManagesStation(
    reg: VolRegistration,
    stationId: number,
  ): Promise<VolStation> {
    const station = await this.stationRepo.findOne({
      where: { id: stationId },
    });
    if (!station) throw new NotFoundException(`Station ${stationId} not found`);
    if (station.category_id == null) {
      throw new ForbiddenException('Station has no team category assigned');
    }
    await this.assertManagesCategory(reg, station.category_id);
    return station;
  }

  /**
   * Load the assignment, then verify the underlying station is managed by
   * this leader.
   */
  async assertManagesAssignment(
    reg: VolRegistration,
    assignmentId: number,
  ): Promise<VolStationAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { station: true },
    });
    if (!assignment)
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    await this.assertManagesStation(reg, assignment.station_id);
    return assignment;
  }
}
