import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MailService } from 'src/modules/notification/mail.service';
import { VolRegistration } from '../entities/vol-registration.entity';
import { VolEvent } from '../entities/vol-event.entity';
import { MarkPaidResponseDto } from '../dto/payment.dto';

/**
 * Canonical gatekeeper for vol_registration.payment_status transitions
 * pending → paid. Centralises TWO paths:
 *
 *   1. markPaid(regId, actor) — standard: requires acceptance_status='signed'.
 *      Rejects 409 if unsigned. Also rejects 400 on suspicious_checkin flag
 *      (carry-forward from BR-LDR-06).
 *
 *   2. forcePaid(regId, reason, actor) — escape hatch for "crew unreachable,
 *      has to be paid anyway" edge cases. Requires a ≥10-char reason which is
 *      persisted to vol_registration.payment_forced_* columns and emitted as
 *      a structured audit log line:
 *        `PAYMENT_FORCE_PAID admin=<id> reg=<id> event=<id> reason="..."`
 *
 * Both paths are idempotent: if payment_status='paid' already, the call
 * returns a success response with was_forced derived from the stored
 * payment_forced_reason. No double-emails.
 *
 * Consistency with legacy PATCH /registrations/:id payment_status: the old
 * path in TeamRegistrationService.updateRegistration() still exists for
 * backwards compat but delegates the 'paid' transition to this service so
 * there's no back-door that bypasses the acceptance gate.
 */
@Injectable()
export class TeamPaymentService {
  private readonly logger = new Logger(TeamPaymentService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly mail: MailService,
  ) {}

  /**
   * Shared email emitter for both mark-paid and force-paid paths. Loads the
   * event row separately (small table, cache-friendly) so the email body
   * shows the correct "sự kiện" name instead of a blank string.
   */
  private async sendPaymentCompletedEmail(reg: VolRegistration): Promise<void> {
    const event = await this.eventRepo.findOne({
      where: { id: reg.event_id },
      select: { id: true, event_name: true },
    });
    await this.mail.sendTeamPaymentCompleted({
      toEmail: reg.email,
      fullName: reg.full_name,
      eventName: event?.event_name ?? '',
      contractNumber: reg.contract_number ?? '',
      acceptanceValue: formatVnd(reg.acceptance_value ?? 0),
    });
  }

  /**
   * Standard mark-paid. Acceptance must be signed. Admin identity is
   * used in the audit log; caller pulls it off the JwtPayload.
   */
  async markPaid(
    regId: number,
    adminIdentity: string,
  ): Promise<MarkPaidResponseDto> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');

    if (reg.payment_status === 'paid') {
      return this.toResponse(reg);
    }
    if (reg.suspicious_checkin) {
      throw new BadRequestException(
        'Cần xem xét trước khi thanh toán — registration is flagged as suspicious. Clear the flag first.',
      );
    }
    if (reg.acceptance_status !== 'signed') {
      // 409 Conflict — state forbids transition. Frontend should prompt the
      // admin to send + wait for the acceptance before retrying (or use the
      // force-paid path with a reason).
      throw new ConflictException(
        'Không thể đánh dấu đã thanh toán — biên bản nghiệm thu chưa ký. ' +
          `acceptance_status="${reg.acceptance_status}". ` +
          'Gửi biên bản nghiệm thu và đợi TNV ký, hoặc dùng force-paid với lý do.',
      );
    }

    const now = new Date();
    // Atomic swap: pending → paid, gated by conditional WHERE so two
    // concurrent clicks can't both emit the email.
    const update = await this.dataSource.transaction(async (m) => {
      return m
        .getRepository(VolRegistration)
        .createQueryBuilder()
        .update()
        .set({ payment_status: 'paid' })
        .where('id = :id', { id: regId })
        .andWhere('payment_status = :from', { from: 'pending' })
        .andWhere('acceptance_status = :acc', { acc: 'signed' })
        .execute();
    });
    if (!update.affected) {
      // Lost the race — re-read and return the current state. This is
      // idempotent from the admin's POV: either they see paid (someone
      // else did it), or they get a fresh 409 because acceptance changed.
      const fresh = await this.regRepo.findOne({ where: { id: regId } });
      if (fresh?.payment_status === 'paid') return this.toResponse(fresh);
      throw new ConflictException(
        'Trạng thái thay đổi giữa chừng — refresh và thử lại',
      );
    }

    this.logger.log(
      `PAYMENT_MARK_PAID admin=${adminIdentity} reg=${regId} event=${reg.event_id} value=${reg.acceptance_value ?? 0}`,
    );

    // Fire completion email. Best-effort — payment is committed regardless.
    // Resolve the event name via a separate lightweight query instead of
    // loading the relation on the hot path above; a missed email subject is
    // acceptable but a blank "sự kiện" in the body looked broken.
    void this.sendPaymentCompletedEmail(reg).catch((err) =>
      this.logger.warn(
        `payment completed email failed reg=${regId} to=${reg.email}: ${(err as Error).message}`,
      ),
    );

    return {
      success: true,
      registration_id: regId,
      payment_status: 'paid',
      paid_at: now.toISOString(),
      was_forced: false,
    };
  }

  /**
   * Force-paid path — bypass the acceptance-signed gate. Required reason is
   * validated at the DTO layer (≥10 chars). We still block suspicious_checkin
   * because that's a separate anti-fraud flag, not related to acceptance.
   *
   * Audit: three vol_registration columns + structured log line. Auditor can
   * query `SELECT id, event_id, payment_forced_reason, payment_forced_at,
   * payment_forced_by FROM vol_registration WHERE payment_forced_at IS NOT
   * NULL` (index idx_reg_payment_forced_at).
   */
  async forcePaid(
    regId: number,
    forceReason: string,
    adminIdentity: string,
  ): Promise<MarkPaidResponseDto> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');

    if (reg.payment_status === 'paid') {
      return this.toResponse(reg);
    }
    if (reg.suspicious_checkin) {
      throw new BadRequestException(
        'Cần xem xét trước khi thanh toán — registration is flagged as suspicious. Clear the flag first.',
      );
    }

    // Reason is validated by DTO but double-check here so this method is
    // safe to call programmatically (e.g., migration scripts).
    const reason = forceReason?.trim() ?? '';
    if (reason.length < 10) {
      throw new BadRequestException(
        'force_reason phải có ít nhất 10 ký tự — lý do phải rõ ràng để audit',
      );
    }
    if (reason.length > 2000) {
      throw new BadRequestException('force_reason tối đa 2000 ký tự');
    }

    const now = new Date();
    const update = await this.dataSource.transaction(async (m) => {
      return m
        .getRepository(VolRegistration)
        .createQueryBuilder()
        .update()
        .set({
          payment_status: 'paid',
          payment_forced_reason: reason,
          payment_forced_at: now,
          payment_forced_by: adminIdentity,
        })
        .where('id = :id', { id: regId })
        .andWhere('payment_status = :from', { from: 'pending' })
        .execute();
    });
    if (!update.affected) {
      const fresh = await this.regRepo.findOne({ where: { id: regId } });
      if (fresh?.payment_status === 'paid') return this.toResponse(fresh);
      throw new ConflictException(
        'Trạng thái thay đổi giữa chừng — refresh và thử lại',
      );
    }

    // Structured audit line — parseable by log aggregation.
    // QC F-4: strip CR/LF so a crafted force_reason cannot inject fake log
    // lines (e.g. "valid\nPAYMENT_MARK_PAID admin=victim ..."). Replace all
    // whitespace runs with a single space before escaping quotes.
    const logSafeReason = reason.replace(/\s+/g, ' ').replace(/"/g, "'");
    this.logger.log(
      `PAYMENT_FORCE_PAID admin=${adminIdentity} reg=${regId} event=${reg.event_id} acceptance_status=${reg.acceptance_status} value=${reg.acceptance_value ?? 0} reason="${logSafeReason}"`,
    );

    // Completion email fires regardless of forced path — the TNV's
    // point of view is the same.
    void this.sendPaymentCompletedEmail(reg).catch((err) =>
      this.logger.warn(
        `payment completed (forced) email failed reg=${regId} to=${reg.email}: ${(err as Error).message}`,
      ),
    );

    return {
      success: true,
      registration_id: regId,
      payment_status: 'paid',
      paid_at: now.toISOString(),
      was_forced: true,
    };
  }

  /**
   * Revert paid → pending. Rare — used when admin discovers a clerical
   * mistake (wrong reg, wrong bank account). Audit log but no required
   * reason at the moment; the frontend confirms with a modal.
   *
   * Clears force-paid audit fields as well, so a later mark-paid via the
   * standard gate starts fresh.
   */
  async revertPaid(regId: number, adminIdentity: string): Promise<void> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.payment_status !== 'paid') {
      throw new BadRequestException(
        `Không thể huỷ thanh toán — trạng thái hiện tại là "${reg.payment_status}"`,
      );
    }
    const update = await this.regRepo
      .createQueryBuilder()
      .update()
      .set({
        payment_status: 'pending',
        payment_forced_reason: null,
        payment_forced_at: null,
        payment_forced_by: null,
      })
      .where('id = :id', { id: regId })
      .andWhere('payment_status = :from', { from: 'paid' })
      .execute();
    if (!update.affected) {
      throw new ConflictException(
        'Trạng thái thay đổi giữa chừng — refresh và thử lại',
      );
    }
    this.logger.warn(
      `PAYMENT_REVERTED admin=${adminIdentity} reg=${regId} event=${reg.event_id}`,
    );
  }

  private toResponse(reg: VolRegistration): MarkPaidResponseDto {
    return {
      success: true,
      registration_id: reg.id,
      payment_status: reg.payment_status,
      // When called on an already-paid row we don't have an accurate
      // "when did it flip" — payment_forced_at if forced, else a best-effort
      // updated_at (rows track their last mutation, not strictly the paid
      // transition; acceptable for audit purposes since the primary source
      // of truth is the log line emitted at transition time).
      paid_at: (reg.payment_forced_at ?? reg.updated_at ?? new Date()).toISOString(),
      was_forced: reg.payment_forced_reason != null,
    };
  }
}

function formatVnd(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN');
}
