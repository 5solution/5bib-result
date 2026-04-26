import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { env } from 'src/config';
import { MailService } from 'src/modules/notification/mail.service';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import { VolAcceptanceTemplate } from '../entities/vol-acceptance-template.entity';
import {
  AcceptanceViewDto,
  SendAcceptanceBatchDto,
  SendAcceptanceBatchResponseDto,
  SignAcceptanceResponseDto,
} from '../dto/acceptance.dto';
import {
  htmlToPdfBuffer,
  renderTemplate,
  wrapContractDocument,
} from './pdf-renderer';
import { TeamAcceptanceTemplateService } from './team-acceptance-template.service';
import { capitaliseFirst, vndToWords } from '../utils/vnd-to-words';

/**
 * Orchestrator for biên bản nghiệm thu (post-event acceptance minutes).
 *
 * State machine (on vol_registration):
 *   not_ready  ─admin sends─► pending_sign
 *   pending_sign ─crew signs─► signed
 *   pending_sign/signed ─admin disputes─► disputed
 *   disputed ─admin re-sends─► pending_sign
 *
 * Only regs with `status='completed'` are eligible to be sent. Completion
 * is confirmed by the leader/admin checkout flow (sets snapshot compensation).
 * Missing Bên B fields (bank_account_number, cccd, cccd_issue_date,
 * cccd_issue_place, birth_date) skip the send and are returned as reasons.
 *
 * Contract-number reuse: the acceptance document shares the same
 * `contract_number` that was reserved when the contract was sent. We do NOT
 * reserve a new number here — if the reg lacks contract_number (legacy row,
 * contract skipped), the send is rejected with a clear reason.
 */
@Injectable()
export class TeamAcceptanceService {
  private readonly logger = new Logger(TeamAcceptanceService.name);
  private readonly bucket = env.teamManagement.s3Bucket;

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolAcceptanceTemplate, 'volunteer')
    private readonly templateRepo: Repository<VolAcceptanceTemplate>,
    private readonly templateService: TeamAcceptanceTemplateService,
    private readonly s3: S3Client,
    private readonly mail: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ───── Redis sign-lock helpers ─────

  private signLockKey(regId: number): string {
    return `team:acceptance:signing:${regId}`;
  }

  private async acquireSignLock(regId: number): Promise<string> {
    const owner = crypto.randomBytes(16).toString('hex');
    const ok = await this.redis.set(
      this.signLockKey(regId),
      owner,
      'EX',
      60,
      'NX',
    );
    if (ok !== 'OK') {
      throw new ConflictException(
        'Another acceptance sign request is in progress. Try again shortly.',
      );
    }
    return owner;
  }

  private async releaseSignLock(regId: number, owner: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    try {
      await this.redis.eval(script, 1, this.signLockKey(regId), owner);
    } catch (err) {
      this.logger.warn(
        `Acceptance sign-lock release failed reg=${regId}: ${(err as Error).message}`,
      );
    }
  }

  // ───── Placeholder builder (shared by preview + sign) ─────

  /**
   * Build placeholder map for the acceptance template. Kept in sync with
   * the seeded default template (migration 031) and
   * VALID_ACCEPTANCE_VARIABLES in TeamAcceptanceTemplateService.
   *
   * MST = CCCD decision: `tax_code` mirrors `cccd_number` — no separate field.
   */
  private buildPlaceholders(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
    acceptanceValue: number,
    template: VolAcceptanceTemplate,
    signatureImage?: string,
    acceptanceDate?: Date,
  ): Record<string, string> {
    const form = (reg.form_data ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
    const cccd = asStr(form.cccd);
    const bankAccount = asStr(form.bank_account_number);
    const bankName = asStr(form.bank_name);
    const address = asStr(form.address);
    const workContent = role.description ?? role.role_name;
    const acceptanceValueWords = capitaliseFirst(vndToWords(acceptanceValue));
    return {
      contract_number: reg.contract_number ?? '',
      acceptance_date: formatDate(acceptanceDate ?? new Date()),
      full_name: reg.full_name,
      birth_date: reg.birth_date ? formatDate(reg.birth_date) : '',
      cccd_number: cccd,
      cccd_issue_date: reg.cccd_issue_date ? formatDate(reg.cccd_issue_date) : '',
      cccd_issue_place: reg.cccd_issue_place ?? '',
      phone: reg.phone,
      email: reg.email,
      address,
      bank_account_number: bankAccount,
      bank_name: bankName,
      // MST = CCCD (Option chốt — no separate tax_code field).
      tax_code: cccd,
      work_content: workContent,
      acceptance_value: formatVnd(acceptanceValue),
      acceptance_value_words: acceptanceValueWords,
      event_name: event.event_name,
      // v1.9 RT-11 fix: Inject Party A from acceptance template so 5 different
      // legal entities each render their own info on biên bản nghiệm thu.
      // Template-scoped (matches contract template Party A binding).
      party_a_company_name: template.party_a_company_name ?? '',
      party_a_address: template.party_a_address ?? '',
      party_a_tax_code: template.party_a_tax_code ?? '',
      party_a_representative: template.party_a_representative ?? '',
      party_a_position: template.party_a_position ?? '',
      // Templates use `<img src="{{signature_image}}" ...>`. Empty src
      // renders as broken-image icon in browsers, so use a 1×1 transparent
      // PNG before signing. After signing, signatureImage is the full
      // `data:image/png;base64,...` URL of the user's drawn signature.
      signature_image:
        signatureImage ??
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    };
  }

  // ───── Eligibility checks ─────

  /**
   * Validate a single reg for acceptance send. Returns null if eligible, or
   * a human-readable reason string (Vietnamese) if not.
   *
   * Required: status='completed', contract_number set, Bên B fields present.
   * Idempotent skip: already signed → reason "Đã ký rồi" (not an error, just
   * skipped from the batch so the admin can see it in response.skipped).
   */
  private validateEligibility(reg: VolRegistration): string | null {
    if (reg.status !== 'completed' && reg.status !== 'checked_in') {
      return `Trạng thái phải là "checked_in" hoặc "completed" (hiện tại: "${reg.status}")`;
    }
    if (!reg.contract_number) {
      return 'Thiếu số hợp đồng — hợp đồng chưa được gửi';
    }
    if (reg.acceptance_status === 'signed') {
      return 'Đã ký nghiệm thu';
    }
    const form = (reg.form_data ?? {}) as Record<string, unknown>;
    const missing: string[] = [];
    if (!reg.birth_date) missing.push('ngày sinh');
    if (!reg.cccd_issue_date) missing.push('ngày cấp CCCD');
    if (!reg.cccd_issue_place) missing.push('nơi cấp CCCD');
    if (!form.cccd) missing.push('số CCCD');
    if (!form.bank_account_number) missing.push('số tài khoản');
    if (!form.bank_name) missing.push('tên ngân hàng');
    if (!form.address) missing.push('địa chỉ');
    if (missing.length > 0) {
      return `Thiếu thông tin Bên B: ${missing.join(', ')}`;
    }
    return null;
  }

  /**
   * Compute the default acceptance_value for a reg when the admin doesn't
   * override. Uses `actual_working_days` (leader/admin-confirmed at
   * completion) times the snapshot_daily_rate captured at completion. Falls
   * back to role.daily_rate × role.working_days if the snapshot is missing
   * (pre-v2.0 legacy rows).
   */
  private computeDefaultAcceptanceValue(
    reg: VolRegistration,
    role: VolRole,
  ): number {
    const dailyRate = reg.snapshot_daily_rate
      ? parseFloat(reg.snapshot_daily_rate)
      : Number(role.daily_rate);
    const days =
      reg.actual_working_days ??
      reg.snapshot_working_days ??
      role.working_days;
    const value = Math.round(dailyRate * days);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  // ───── Load context (shared by view + sign) ─────

  private async loadContextByToken(token: string): Promise<{
    reg: VolRegistration;
    role: VolRole;
    event: VolEvent;
    template: VolAcceptanceTemplate;
  }> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    if (
      reg.acceptance_status !== 'pending_sign' &&
      reg.acceptance_status !== 'signed' &&
      reg.acceptance_status !== 'disputed'
    ) {
      // 'not_ready' — admin hasn't queued the acceptance yet.
      throw new BadRequestException('Acceptance has not been sent yet');
    }
    if (!reg.role) throw new NotFoundException('Role not loaded');
    if (!reg.event) throw new NotFoundException('Event not loaded');
    if (!reg.acceptance_template_id) {
      throw new BadRequestException('Acceptance template was not recorded');
    }
    const template = await this.templateRepo.findOne({
      where: { id: reg.acceptance_template_id },
    });
    if (!template) {
      throw new NotFoundException('Acceptance template missing');
    }
    return { reg, role: reg.role, event: reg.event, template };
  }

  // ───── Public API: batch send ─────

  /**
   * Send acceptance magic links to a list of registrations within an event.
   * Each reg is validated individually; failures are collected into
   * response.skipped[] + skip_reasons[] rather than aborting the batch.
   *
   * Concurrency: runs chunks of 5 parallel email sends. Per-reg transition
   * to `pending_sign` is a conditional UPDATE that tolerates mid-flight
   * admin actions.
   */
  async sendAcceptanceBatch(
    eventId: number,
    dto: SendAcceptanceBatchDto,
    actorIdentity: string,
  ): Promise<SendAcceptanceBatchResponseDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Dedupe to guard against admin hitting send twice in one POST payload.
    const uniqueIds = Array.from(new Set(dto.registration_ids));

    const regs = await this.regRepo.find({
      where: uniqueIds.map((id) => ({ id, event_id: eventId })),
      relations: { role: true },
    });
    const foundIds = new Set(regs.map((r) => r.id));

    // Resolve the template ONCE for the batch — either the explicit override
    // from the DTO (validated to exist) or the effective template for the
    // event (event-scoped → global default).
    let template: VolAcceptanceTemplate;
    if (dto.template_id != null) {
      template = await this.templateService.getTemplate(dto.template_id);
    } else {
      template = await this.templateService.resolveForEvent(eventId);
    }

    const skipped: number[] = [];
    const skipReasons: string[] = [];

    // Reg IDs the admin asked about but which don't exist in this event.
    for (const id of uniqueIds) {
      if (!foundIds.has(id)) {
        skipped.push(id);
        skipReasons.push('Registration không tồn tại trong sự kiện này');
      }
    }

    const eligible = regs.filter((reg) => {
      const reason = this.validateEligibility(reg);
      if (reason !== null) {
        skipped.push(reg.id);
        skipReasons.push(reason);
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      return { queued: 0, skipped, skip_reasons: skipReasons };
    }

    const CONCURRENCY = 5;
    let queued = 0;
    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const chunk = eligible.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((reg) =>
          this.sendAcceptanceForRegistrationInternal(
            reg,
            reg.role!,
            event,
            template,
            dto.acceptance_value,
          ),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value === true) {
          queued++;
        } else if (r.status === 'fulfilled' && r.value === false) {
          skipped.push(chunk[j].id);
          skipReasons.push(
            'Trạng thái đã đổi giữa chừng — skip transition (có thể đã gửi rồi)',
          );
        } else if (r.status === 'rejected') {
          skipped.push(chunk[j].id);
          skipReasons.push(
            `Lỗi gửi email: ${(r.reason as Error).message || 'unknown'}`,
          );
        }
      }
    }

    this.logger.log(
      `ACCEPTANCE_BATCH_SENT event=${eventId} actor=${actorIdentity} queued=${queued} skipped=${skipped.length}`,
    );

    return { queued, skipped, skip_reasons: skipReasons };
  }

  /**
   * Single-reg send. Used by POST /registrations/:id/acceptance/send. Throws
   * BadRequest if ineligible (surfaces the reason to the admin inline).
   */
  async sendAcceptanceForRegistration(
    regId: number,
    overrideValue: number | undefined,
    templateId: number | undefined,
    actorIdentity: string,
  ): Promise<void> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException(`Registration ${regId} not found`);
    if (!reg.role) throw new NotFoundException('Role not loaded');
    if (!reg.event) throw new NotFoundException('Event not loaded');

    const reason = this.validateEligibility(reg);
    if (reason) throw new BadRequestException(reason);

    const template =
      templateId != null
        ? await this.templateService.getTemplate(templateId)
        : await this.templateService.resolveForEvent(reg.event_id);

    const ok = await this.sendAcceptanceForRegistrationInternal(
      reg,
      reg.role,
      reg.event,
      template,
      overrideValue,
    );
    if (!ok) {
      throw new ConflictException(
        'Không thể chuyển trạng thái — có thể đã gửi rồi hoặc admin vừa huỷ. Refresh và thử lại.',
      );
    }
    this.logger.log(
      `ACCEPTANCE_SENT reg=${regId} event=${reg.event_id} actor=${actorIdentity}`,
    );
  }

  /**
   * Inner helper used by both batch + single paths. Runs one atomic
   * transaction: stamp acceptance_* fields + extend magic_token_expires +
   * transition to pending_sign, gated by conditional WHERE. Returns `true`
   * when the UPDATE affected 1 row, `false` when another concurrent update
   * won. Email is sent AFTER the DB commit so a DB failure never triggers
   * a misleading email.
   */
  private async sendAcceptanceForRegistrationInternal(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
    template: VolAcceptanceTemplate,
    overrideValue: number | undefined,
  ): Promise<boolean> {
    const acceptanceValue =
      overrideValue != null
        ? overrideValue
        : this.computeDefaultAcceptanceValue(reg, role);

    // Magic token is often weeks past its original +7d expiry at this point
    // (acceptance is post-event). Extend 14 days inside the same transaction
    // so the crew has room to sign.
    const newExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const update = await this.dataSource.transaction(async (m) => {
      // Conditional UPDATE — only transition when acceptance_status is in a
      // sendable state (not_ready or disputed). If someone raced us (double-
      // click batch button) acceptance_status is already 'pending_sign' and
      // the UPDATE is a no-op.
      return m
        .getRepository(VolRegistration)
        .createQueryBuilder()
        .update()
        .set({
          acceptance_status: 'pending_sign',
          acceptance_template_id: template.id,
          acceptance_value: acceptanceValue,
          acceptance_sent_at: now,
          magic_token_expires: newExpiry,
          // Clear any prior dispute note when re-sending after a dispute.
          acceptance_notes: null,
        })
        .where('id = :id', { id: reg.id })
        .andWhere('status IN (:...sendable)', {
          sendable: ['checked_in', 'completed'],
        })
        .andWhere('acceptance_status IN (:...from)', {
          from: ['not_ready', 'disputed'],
        })
        .execute();
    });

    if (!update.affected) {
      this.logger.warn(
        `sendAcceptance reg=${reg.id}: row not in sendable state, skip`,
      );
      return false;
    }

    const magicLink = `${env.teamManagement.crewBaseUrl}/acceptance/${reg.magic_token}`;
    try {
      await this.mail.sendTeamAcceptanceSent({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName: event.event_name,
        contractNumber: reg.contract_number ?? '',
        acceptanceValue: formatVnd(acceptanceValue),
        magicLink,
      });
    } catch (err) {
      // Email is best-effort — DB transition already committed, admin can
      // trigger re-send from the admin UI. Log with enough context to trace.
      this.logger.warn(
        `acceptance email failed reg=${reg.id} (state already pending_sign): ${
          (err as Error).message
        }`,
      );
    }
    return true;
  }

  // ───── Public API: crew view ─────

  async viewAcceptance(token: string): Promise<AcceptanceViewDto> {
    const { reg, role, event, template } = await this.loadContextByToken(token);
    const value = reg.acceptance_value ?? 0;
    const vars = this.buildPlaceholders(
      reg,
      role,
      event,
      value,
      template,
      undefined,
      reg.acceptance_signed_at ?? undefined,
    );
    const rendered = renderTemplate(template.content_html, vars);
    const html = wrapContractDocument(rendered);
    const pdfUrl =
      reg.acceptance_status === 'signed' && reg.acceptance_pdf_url
        ? await this.presignAcceptance(reg.acceptance_pdf_url, 600)
        : null;
    return {
      html_content: html,
      acceptance_status: reg.acceptance_status,
      signed_at: reg.acceptance_signed_at
        ? reg.acceptance_signed_at.toISOString()
        : null,
      pdf_url: pdfUrl,
      full_name: reg.full_name,
      contract_number: reg.contract_number ?? '',
      acceptance_value: value,
      // Defensive gate: notes hold admin-written dispute reasons and should
      // only be surfaced when the acceptance is actually disputed. In every
      // other state the field is leftover metadata from a prior dispute and
      // must be hidden from the crew.
      notes: reg.acceptance_status === 'disputed' ? reg.acceptance_notes : null,
    };
  }

  // ───── Public API: crew sign ─────

  /**
   * Render PDF with signature embedded, upload to S3, atomically flip
   * acceptance_status → signed via conditional UPDATE. Idempotent: a second
   * call finds acceptance_status='signed' and throws 400.
   */
  async signAcceptance(
    token: string,
    confirmedName: string,
    signatureImage: string,
    clientIp?: string,
  ): Promise<SignAcceptanceResponseDto> {
    const { reg, role, event, template } = await this.loadContextByToken(token);
    if (reg.acceptance_status === 'signed') {
      throw new BadRequestException('Acceptance has already been signed');
    }
    if (reg.acceptance_status !== 'pending_sign') {
      // 'disputed' — admin must re-send before crew can re-sign.
      throw new BadRequestException(
        `Cannot sign — acceptance status is "${reg.acceptance_status}"`,
      );
    }

    const expected = reg.full_name.trim().toLowerCase();
    const got = confirmedName.trim().toLowerCase();
    if (expected !== got) {
      throw new BadRequestException('confirmed_name does not match registration');
    }

    // Decode + size-check BEFORE acquiring the lock — cheap sanity first.
    const b64 = signatureImage.replace(/^data:image\/png;base64,/, '');
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(b64, 'base64');
    } catch {
      throw new BadRequestException('Invalid signature_image base64');
    }
    if (signatureBuffer.length === 0) {
      throw new BadRequestException('signature_image is empty');
    }
    if (signatureBuffer.length > 500 * 1024) {
      throw new BadRequestException(
        'signature_image too large (max 500KB decoded)',
      );
    }

    const lockOwner = await this.acquireSignLock(reg.id);
    try {
      const now = new Date();
      const value = reg.acceptance_value ?? 0;
      const vars = this.buildPlaceholders(
        reg,
        role,
        event,
        value,
        template,
        signatureImage,
        now,
      );
      const body = renderTemplate(template.content_html, vars);
      const pdfHtml = wrapContractDocument(body);
      const pdfBuffer = await htmlToPdfBuffer(pdfHtml);
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // Path convention shared with contract PDFs (same bucket/prefix root).
      // `{hash}.pdf` leaf makes the object content-addressable — re-sign
      // attempts with the same bytes hit the same key (idempotent at S3
      // layer). If body differs the hash differs, and we never overwrite an
      // existing signed PDF because the DB atomic-swap below blocks it.
      const key = `team-contracts/acceptances/${reg.id}/${hash}.pdf`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      // Atomic state swap. Conditional WHERE acceptance_status='pending_sign'
      // gates against: (a) double-sign from refresh, (b) admin mid-flight
      // dispute. Affected=0 → throw 400 and roll back the S3 write
      // logically (object stays but DB never references it; safe because
      // keys are content-addressed by hash).
      const update = await this.dataSource.transaction(async (m) => {
        return m
          .getRepository(VolRegistration)
          .createQueryBuilder()
          .update()
          .set({
            acceptance_status: 'signed',
            acceptance_signed_at: now,
            acceptance_pdf_url: key,
            acceptance_pdf_hash: hash,
          })
          .where('id = :id', { id: reg.id })
          .andWhere('acceptance_status = :from', { from: 'pending_sign' })
          .execute();
      });
      if (!update.affected) {
        throw new BadRequestException(
          'Acceptance has already been signed or the admin has marked it as disputed',
        );
      }

      this.logger.log(
        `ACCEPTANCE_SIGNED reg=${reg.id} hash=${hash.slice(0, 12)}… ip=${clientIp ?? '?'}`,
      );

      const presignedPdf = await this.presignAcceptance(key, 3600 * 24);

      // Fire post-sign email with the PDF attached. Best-effort.
      void this.mail
        .sendTeamAcceptanceSigned({
          toEmail: reg.email,
          fullName: reg.full_name,
          eventName: event.event_name,
          contractNumber: reg.contract_number ?? '',
          acceptanceValue: formatVnd(value),
          pdfBuffer,
          pdfFilename: `acceptance-${reg.contract_number ?? reg.id}.pdf`,
        })
        .catch((err) =>
          this.logger.warn(
            `acceptance signed email failed reg=${reg.id}: ${err.message}`,
          ),
        );

      return {
        success: true,
        pdf_url: presignedPdf,
        signed_at: now.toISOString(),
      };
    } finally {
      await this.releaseSignLock(reg.id, lockOwner);
    }
  }

  // ───── Presigned URL helpers ─────

  async presignAcceptance(key: string, ttlSeconds = 3600): Promise<string> {
    const realKey = key.startsWith('team-contracts/')
      ? key
      : key.replace(/^https?:\/\/[^/]+\//, '');
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: realKey }),
      { expiresIn: ttlSeconds },
    );
  }

  async getSignedAcceptanceUrlForRegistration(
    regId: number,
    ttlSeconds = 600,
  ): Promise<string> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.acceptance_status !== 'signed' || !reg.acceptance_pdf_url) {
      throw new BadRequestException('Acceptance has not been signed yet');
    }
    return this.presignAcceptance(reg.acceptance_pdf_url, ttlSeconds);
  }

  async getSignedAcceptanceUrlForToken(
    token: string,
    ttlSeconds = 600,
  ): Promise<string> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    if (reg.acceptance_status !== 'signed' || !reg.acceptance_pdf_url) {
      throw new BadRequestException('Acceptance has not been signed yet');
    }
    return this.presignAcceptance(reg.acceptance_pdf_url, ttlSeconds);
  }

  // ───── Admin: dispute ─────

  /**
   * Admin marks the acceptance as disputed with a reason. Can be called
   * while acceptance is pending_sign or already signed (e.g., crew flags
   * a discrepancy after the fact). Sets acceptance_notes + transitions
   * status → 'disputed'. Admin must re-send (transitions back to
   * pending_sign) before the crew can re-sign.
   */
  async markDisputed(
    regId: number,
    reason: string,
    actorIdentity: string,
  ): Promise<void> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (
      reg.acceptance_status !== 'pending_sign' &&
      reg.acceptance_status !== 'signed'
    ) {
      throw new BadRequestException(
        `Cannot dispute — acceptance status is "${reg.acceptance_status}"`,
      );
    }
    const update = await this.regRepo
      .createQueryBuilder()
      .update()
      .set({ acceptance_status: 'disputed', acceptance_notes: reason })
      .where('id = :id', { id: regId })
      .andWhere('acceptance_status IN (:...from)', {
        from: ['pending_sign', 'signed'],
      })
      .execute();
    if (!update.affected) {
      throw new ConflictException(
        'Trạng thái nghiệm thu đã thay đổi trong khi xử lý — refresh và thử lại',
      );
    }
    this.logger.log(
      `ACCEPTANCE_DISPUTED reg=${regId} actor=${actorIdentity} reason="${reason.slice(0, 80)}"`,
    );
  }
}

// ───── Module-local formatting helpers ─────

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
