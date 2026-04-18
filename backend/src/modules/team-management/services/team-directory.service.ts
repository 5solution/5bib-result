import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { VolRegistration } from '../entities/vol-registration.entity';
import type { RegistrationStatus } from '../entities/vol-registration.entity';
import {
  DirectoryMemberDto,
  LeaderContactDto,
  TeamDirectoryResponseDto,
} from '../dto/team-directory.dto';
import { TeamCacheService } from './team-cache.service';

// v1.5 BR-DIR-01/02/06: only show registrations that are past the pending
// gate. Rejected/cancelled/waitlisted/pending_approval are always excluded.
const POST_APPROVE_STATUSES: RegistrationStatus[] = [
  'approved',
  'contract_sent',
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
];

// Leader portal grace — kept in sync with TeamLeaderService (LEADER_PORTAL_GRACE_DAYS=7).
const LEADER_PORTAL_GRACE_DAYS = 7;

// Directory moves quickly on race day (leaders check people in) so TTL is short.
const DIRECTORY_TTL_SECONDS = 60;

@Injectable()
export class TeamDirectoryService {
  private readonly logger = new Logger(TeamDirectoryService.name);

  constructor(
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    private readonly cache: TeamCacheService,
  ) {}

  /**
   * Shared token validator for v1.5 public endpoints (directory + contacts).
   * Unlike TeamLeaderService.validateLeaderToken, this accepts ANY valid
   * registration token — member or leader. Expiry differs:
   *  - Leader roles: valid until event_end_date + 7d 23:59:59
   *  - Members:       valid until magic_token_expires
   */
  async validateMemberToken(token: string): Promise<VolRegistration> {
    if (!token || token.length < 10) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg || !reg.role || !reg.event) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const now = Date.now();
    if (reg.role.is_leader_role) {
      const expiry = new Date(reg.event.event_end_date);
      expiry.setDate(expiry.getDate() + LEADER_PORTAL_GRACE_DAYS);
      expiry.setHours(23, 59, 59, 999);
      if (now > expiry.getTime()) {
        throw new UnauthorizedException('Token đã hết hạn');
      }
    } else {
      if (!reg.magic_token_expires || now > reg.magic_token_expires.getTime()) {
        throw new UnauthorizedException('Token đã hết hạn');
      }
    }
    return reg;
  }

  /**
   * v1.5 THAY ĐỔI 2: Team phone directory.
   *
   * - My team: every approved+ registration sharing my role_id.
   * - Other teams:
   *   • Leader caller → everyone approved+ in OTHER roles (BR-DIR-03).
   *   • Member caller → only leaders of other roles (privacy floor).
   *
   * Returns BOTH member-list (DirectoryMemberDto with avatar) and leader-list
   * (LeaderContactDto, no avatar to save presign calls).
   */
  async getDirectory(token: string): Promise<TeamDirectoryResponseDto> {
    const reg = await this.validateMemberToken(token);
    const cacheKey = TeamCacheService.keyDirectory(reg.event_id, reg.id);
    const cached = await this.cache.getJson<TeamDirectoryResponseDto>(cacheKey);
    if (cached) return cached;

    // ---------- My team members (same role) ----------
    const myTeamRows = await this.regRepo.find({
      where: {
        event_id: reg.event_id,
        role_id: reg.role_id,
        status: In(POST_APPROVE_STATUSES),
      },
      relations: { role: true },
    });
    // Leaders first, then alphabetical by full_name.
    myTeamRows.sort((a, b) => {
      const al = a.role?.is_leader_role ? 0 : 1;
      const bl = b.role?.is_leader_role ? 0 : 1;
      if (al !== bl) return al - bl;
      return a.full_name.localeCompare(b.full_name, 'vi');
    });

    const myTeamMembers: DirectoryMemberDto[] = [];
    for (const m of myTeamRows) {
      myTeamMembers.push({
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        role_name: m.role?.role_name ?? '',
        is_leader: m.role?.is_leader_role === true,
        status: m.status,
        avatar_url: m.avatar_photo_url ?? null,
      });
    }

    // ---------- Other teams ----------
    const otherRows = await this.regRepo.find({
      where: {
        event_id: reg.event_id,
        role_id: Not(reg.role_id),
        status: In(POST_APPROVE_STATUSES),
      },
      relations: { role: true },
    });

    const isCallerLeader = reg.role?.is_leader_role === true;
    // BR-DIR-02/03: members see only leaders of other teams; leaders see
    // every approved+ member across ALL other teams (so they can coordinate
    // cross-team on race day).
    const otherPeople = isCallerLeader
      ? otherRows
      : otherRows.filter((m) => m.role?.is_leader_role === true);

    const teamLeaders: LeaderContactDto[] = otherPeople
      .sort((a, b) => {
        // Leader rows first within each team, then alphabetical per team.
        const rn = (a.role?.role_name ?? '').localeCompare(
          b.role?.role_name ?? '',
          'vi',
        );
        if (rn !== 0) return rn;
        const al = a.role?.is_leader_role ? 0 : 1;
        const bl = b.role?.is_leader_role ? 0 : 1;
        if (al !== bl) return al - bl;
        return a.full_name.localeCompare(b.full_name, 'vi');
      })
      .map((m) => ({
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        role_name: m.role?.role_name ?? '',
        status: m.status,
        is_leader: m.role?.is_leader_role === true,
      }));

    // Sanity log so we can spot privacy bugs early.
    this.logger.debug(
      `DIRECTORY reg=${reg.id} event=${reg.event_id} role=${reg.role_id} ` +
        `leader_caller=${isCallerLeader} my=${myTeamMembers.length} ` +
        `leaders=${teamLeaders.length}`,
    );

    const response: TeamDirectoryResponseDto = {
      my_team: {
        role_name: reg.role?.role_name ?? '',
        members: myTeamMembers,
      },
      team_leaders: teamLeaders,
    };
    await this.cache.setJson(cacheKey, response, DIRECTORY_TTL_SECONDS);
    return response;
  }
}

