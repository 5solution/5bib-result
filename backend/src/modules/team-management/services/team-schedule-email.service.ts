import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailService } from 'src/modules/notification/mail.service';
import { VolTeamScheduleEmail } from '../entities/vol-team-schedule-email.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolEvent } from '../entities/vol-event.entity';
import {
  VolRegistration,
  type RegistrationStatus,
} from '../entities/vol-registration.entity';
import {
  ScheduleEmailResponseDto,
  ScheduleEmailRoleSummaryDto,
  SendBulkScheduleEmailResponseDto,
  UpsertScheduleEmailDto,
} from '../dto/schedule-email.dto';
import { sanitizeHtml } from './pdf-renderer';

/**
 * v1.4 BR-SCH-02 — eligibility set for schedule email delivery.
 * A member must already have a signed contract (contract_signed+) to
 * receive the schedule. Earlier states (approved, contract_sent) have not
 * committed yet and are intentionally excluded.
 */
const ELIGIBLE_STATUSES: RegistrationStatus[] = [
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
];

/**
 * Sample data shown in the admin "Send test" path. Kept alphabetized and
 * covering every variable in SCHEDULE_EMAIL_VARIABLES so an admin can see
 * each placeholder resolve, even if the live record doesn't have that
 * field populated yet.
 */
const SAMPLE_DATA: Record<string, string> = {
  full_name: 'Nguyễn Văn An',
  phone: '0901234567',
  email: 'test.member@example.com',
  cccd: '012345678901',
  dob: '01/01/1995',
  event_name: '5BIB Trail Marathon 2026',
  event_start_date: '15/05/2026',
  event_end_date: '16/05/2026',
  event_location: 'Đà Lạt, Lâm Đồng',
  role_name: 'Crew Hậu Cần',
  daily_rate: '500.000',
  working_days: '2',
  total_compensation: '1.000.000',
  signed_date: '01/04/2026',
  reporting_time: '05:00 sáng ngày 15/05/2026',
  gathering_point: 'Cổng A — Khu vực Race Village',
  team_contact_phone: '0909876543',
  special_note: 'Mang theo CCCD gốc và áo khoác ấm.',
};

@Injectable()
export class TeamScheduleEmailService {
  private readonly logger = new Logger(TeamScheduleEmailService.name);

  constructor(
    @InjectRepository(VolTeamScheduleEmail, 'volunteer')
    private readonly repo: Repository<VolTeamScheduleEmail>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    private readonly mail: MailService,
  ) {}

  /**
   * List every role in the event along with its schedule-email config
   * (or null). Also includes the count of eligible members so the admin
   * can decide whether it's worth sending.
   */
  async listForEvent(eventId: number): Promise<ScheduleEmailRoleSummaryDto[]> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (roles.length === 0) return [];

    const roleIds = roles.map((r) => r.id);
    const [configs, eligibleCounts] = await Promise.all([
      this.repo.find({ where: { event_id: eventId, role_id: In(roleIds) } }),
      this.countEligiblePerRole(eventId, roleIds),
    ]);
    const configByRole = new Map<number, VolTeamScheduleEmail>(
      configs.map((c) => [c.role_id, c]),
    );

    return roles.map((r) => {
      const cfg = configByRole.get(r.id) ?? null;
      const eligible = eligibleCounts.get(r.id) ?? 0;
      return {
        role_id: r.id,
        role_name: r.role_name,
        member_count_eligible: eligible,
        config: cfg ? this.toResponse(cfg, r.role_name, eligible) : null,
      };
    });
  }

  /**
   * Return the single (event, role) config or null. Throws 404 only when
   * the role itself doesn't exist / doesn't belong to the event.
   */
  async getForRole(
    eventId: number,
    roleId: number,
  ): Promise<ScheduleEmailResponseDto | null> {
    const role = await this.assertRole(eventId, roleId);
    const cfg = await this.repo.findOne({
      where: { event_id: eventId, role_id: roleId },
    });
    if (!cfg) return null;
    const eligible = await this.countEligibleOne(eventId, roleId);
    return this.toResponse(cfg, role.role_name, eligible);
  }

  /**
   * Insert or update by UNIQUE(event_id, role_id). body_html is sanitized
   * server-side — admins paste from templates / rich editor, same as
   * contract templates.
   */
  async upsert(
    eventId: number,
    roleId: number,
    dto: UpsertScheduleEmailDto,
  ): Promise<ScheduleEmailResponseDto> {
    const role = await this.assertRole(eventId, roleId);
    const existing = await this.repo.findOne({
      where: { event_id: eventId, role_id: roleId },
    });
    const sanitized = sanitizeHtml(dto.body_html);
    const payload: Partial<VolTeamScheduleEmail> = {
      event_id: eventId,
      role_id: roleId,
      subject: dto.subject,
      body_html: sanitized,
      reporting_time: dto.reporting_time ?? null,
      gathering_point: dto.gathering_point ?? null,
      team_contact_phone: dto.team_contact_phone ?? null,
      special_note: dto.special_note ?? null,
    };
    const saved = existing
      ? await this.repo.save(this.repo.merge(existing, payload))
      : await this.repo.save(this.repo.create(payload));
    const eligible = await this.countEligibleOne(eventId, roleId);
    return this.toResponse(saved, role.role_name, eligible);
  }

  /**
   * Render template with SAMPLE_DATA + role-level customs, send to
   * `testEmail` (falls back to `adminEmail`). Never mutates `last_sent_*`
   * — this path is for preview / verification only.
   */
  async sendTest(
    eventId: number,
    roleId: number,
    testEmail: string | undefined,
    adminEmail: string,
  ): Promise<{ sent: boolean; delivered_to: string }> {
    const role = await this.assertRole(eventId, roleId);
    const cfg = await this.repo.findOne({
      where: { event_id: eventId, role_id: roleId },
    });
    if (!cfg) {
      throw new BadRequestException(
        'Chưa có cấu hình email lịch trình cho role này — lưu cấu hình trước khi gửi test',
      );
    }
    const to = (testEmail ?? adminEmail ?? '').trim();
    if (!to) {
      throw new BadRequestException(
        'Không có địa chỉ nhận — truyền test_email hoặc đăng nhập với admin có email',
      );
    }
    // Fetch real event so test preview shows actual event_name / dates /
    // location instead of the hardcoded SAMPLE_DATA values.
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    const realOverrides: Partial<typeof SAMPLE_DATA> = event
      ? {
          event_name: event.event_name,
          event_start_date: formatDate(event.event_start_date),
          event_end_date: formatDate(event.event_end_date),
          event_location: event.location ?? '',
          role_name: role.role_name,
          daily_rate: formatVnd(Number(role.daily_rate)),
          working_days: String(role.working_days),
          total_compensation: formatVnd(
            Number(role.daily_rate) * role.working_days,
          ),
        }
      : {};
    const vars = { ...SAMPLE_DATA, ...realOverrides, ...this.roleCustoms(cfg) };
    const rendered = this.render(cfg.body_html, vars);
    const subject = this.render(cfg.subject, vars);
    const sent = await this.mail.sendCustomHtml(to, subject, rendered);
    this.logger.log(
      `Test schedule email event=${eventId} role=${roleId} to=${to} sent=${sent}`,
    );
    return { sent, delivered_to: to };
  }

  /**
   * Bulk send to every registration in BR-SCH-02 eligible set. Idempotent
   * in the "retry-safe" sense: counts are updated in a SINGLE UPDATE after
   * the batch finishes, using the per-run count (not += partial values
   * between retries). We intentionally do NOT dedupe by last_sent_at —
   * admin may legitimately re-blast if the schedule changes. The
   * front-end displays the last-send timestamp so they can reason about it.
   */
  async sendBulk(
    eventId: number,
    roleId: number,
  ): Promise<SendBulkScheduleEmailResponseDto> {
    await this.assertRole(eventId, roleId);
    const cfg = await this.repo.findOne({
      where: { event_id: eventId, role_id: roleId },
    });
    if (!cfg) {
      throw new BadRequestException(
        'Chưa có cấu hình email lịch trình — vui lòng lưu trước khi gửi hàng loạt',
      );
    }

    const allMembers = await this.regRepo.find({
      where: { event_id: eventId, role_id: roleId },
    });
    const eligible = allMembers.filter((r) =>
      ELIGIBLE_STATUSES.includes(r.status),
    );
    const skipped = allMembers.length - eligible.length;
    if (eligible.length === 0) {
      return { queued: 0, skipped };
    }

    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!event || !role) {
      throw new NotFoundException('Event or role vanished mid-send');
    }

    // Bounded concurrency (5) — mirror TeamContractService.sendContractsForRole
    // to avoid Mailchimp rate-limit spikes when sending to 50+ crew members.
    const CONCURRENCY = 5;
    let queued = 0;
    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const chunk = eligible.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((reg) => this.renderAndSendOne(reg, role, event, cfg)),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value) {
          queued++;
        } else if (r.status === 'rejected') {
          this.logger.warn(
            `schedule-email send failed reg=${chunk[j].id}: ${(r.reason as Error).message}`,
          );
        }
      }
    }

    // Single UPDATE — atomic bump of the counters. On retry we overwrite
    // last_sent_count with the new run total, which is the behavior the
    // spec's "N thành viên đã nhận trong lần gửi gần nhất" UI label wants.
    await this.repo
      .createQueryBuilder()
      .update()
      .set({
        last_sent_at: () => 'CURRENT_TIMESTAMP',
        last_sent_count: queued,
        total_sent_count: () => `total_sent_count + ${queued}`,
      })
      .where('id = :id', { id: cfg.id })
      .execute();

    return { queued, skipped };
  }

  // -------- helpers --------

  private async renderAndSendOne(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
    cfg: VolTeamScheduleEmail,
  ): Promise<boolean> {
    const vars = this.buildVars(reg, role, event, cfg);
    const html = this.render(cfg.body_html, vars);
    const subject = this.render(cfg.subject, vars);
    return this.mail.sendCustomHtml(reg.email, subject, html);
  }

  private roleCustoms(cfg: VolTeamScheduleEmail): Record<string, string> {
    return {
      reporting_time: cfg.reporting_time ?? '',
      gathering_point: cfg.gathering_point ?? '',
      team_contact_phone: cfg.team_contact_phone ?? '',
      special_note: cfg.special_note ?? '',
    };
  }

  private buildVars(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
    cfg: VolTeamScheduleEmail,
  ): Record<string, string> {
    const form = (reg.form_data ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      full_name: reg.full_name,
      phone: reg.phone,
      email: reg.email,
      cccd: asStr(form.cccd),
      dob: asStr(form.dob),
      event_name: event.event_name,
      event_start_date: formatDate(event.event_start_date),
      event_end_date: formatDate(event.event_end_date),
      event_location: event.location ?? '',
      role_name: role.role_name,
      daily_rate: formatVnd(Number(role.daily_rate)),
      working_days: String(role.working_days),
      total_compensation: formatVnd(
        Number(role.daily_rate) * role.working_days,
      ),
      signed_date: reg.contract_signed_at
        ? formatDate(reg.contract_signed_at)
        : '',
      ...this.roleCustoms(cfg),
    };
  }

  /**
   * Replace `{{var}}` tokens with the resolved value. Missing keys render
   * as `[var]` so the admin can spot typos in a test send. Used for both
   * subject and body — body_html is already sanitized at save time so
   * substituted values are HTML-escaped here to prevent per-record XSS
   * (e.g. a member with `<script>` in their full_name).
   */
  private render(template: string, vars: Record<string, string>): string {
    return template.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_match, key: string) => {
        if (key in vars) return escapeHtml(vars[key]);
        return `[${key}]`;
      },
    );
  }

  private async assertRole(
    eventId: number,
    roleId: number,
  ): Promise<VolRole> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.event_id !== eventId) {
      throw new BadRequestException('Role does not belong to this event');
    }
    return role;
  }

  private async countEligibleOne(
    eventId: number,
    roleId: number,
  ): Promise<number> {
    return this.regRepo.count({
      where: {
        event_id: eventId,
        role_id: roleId,
        status: In(ELIGIBLE_STATUSES),
      },
    });
  }

  private async countEligiblePerRole(
    eventId: number,
    roleIds: number[],
  ): Promise<Map<number, number>> {
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.role_id', 'role_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.event_id = :eventId', { eventId })
      .andWhere('r.role_id IN (:...roleIds)', { roleIds })
      .andWhere('r.status IN (:...statuses)', { statuses: ELIGIBLE_STATUSES })
      .groupBy('r.role_id')
      .getRawMany<{ role_id: string; cnt: string }>();
    return new Map(rows.map((r) => [Number(r.role_id), Number(r.cnt)]));
  }

  private toResponse(
    cfg: VolTeamScheduleEmail,
    roleName: string,
    eligible: number,
  ): ScheduleEmailResponseDto {
    return {
      id: cfg.id,
      event_id: cfg.event_id,
      role_id: cfg.role_id,
      role_name: roleName,
      member_count_eligible: eligible,
      subject: cfg.subject,
      body_html: cfg.body_html,
      reporting_time: cfg.reporting_time,
      gathering_point: cfg.gathering_point,
      team_contact_phone: cfg.team_contact_phone,
      special_note: cfg.special_note,
      last_sent_at: cfg.last_sent_at ? cfg.last_sent_at.toISOString() : null,
      last_sent_count: cfg.last_sent_count,
      total_sent_count: cfg.total_sent_count,
      created_at: cfg.created_at.toISOString(),
      updated_at: cfg.updated_at.toISOString(),
    };
  }
}

function formatVnd(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN');
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
