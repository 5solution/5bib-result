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
import * as QRCode from 'qrcode';
import { env } from 'src/config';
import { MailService } from 'src/modules/notification/mail.service';
import { VolContractTemplate } from '../entities/vol-contract-template.entity';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import {
  RegistrationStatus,
  VolRegistration,
} from '../entities/vol-registration.entity';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
} from '../dto/contract-template.dto';
import {
  ContractViewDto,
  SendContractsResponseDto,
  SignContractResponseDto,
} from '../dto/sign-contract.dto';
import {
  docxToHtml,
  htmlToPdfBuffer,
  renderTemplate,
  sanitizeHtml,
  wrapContractDocument,
} from './pdf-renderer';
import { TeamContractNumberService } from './team-contract-number.service';
import { capitaliseFirst, vndToWords } from '../utils/vnd-to-words';

/**
 * Canonical list of template variables the contract renderer knows how to
 * fill. Keep in sync with buildPlaceholders() below and the admin editor's
 * variable picker. New variables MUST be added in all 3 places.
 */
export const VALID_VARIABLES = [
  'full_name',
  'phone',
  'email',
  'cccd',
  'dob',
  'birth_date',
  'cccd_issue_date',
  'cccd_issue_place',
  'address',
  'bank_account_number',
  'bank_name',
  'tax_code',
  'event_name',
  'event_start_date',
  'event_end_date',
  'event_location',
  'role_name',
  'daily_rate',
  'working_days',
  'total_compensation',
  'signed_date',
  'contract_number',
  'signature_image',
  // Party A (Bên A) — configurable per template
  'party_a_company_name',
  'party_a_address',
  'party_a_tax_code',
  'party_a_representative',
  'party_a_position',
  // Contract-specific aliases — present in the seeded DOCX template.
  'sign_date',        // alias for signed_date
  'cccd_number',      // alias for cccd
  'work_content',     // role.description ?? role.role_name
  'work_location',    // event.location
  'work_period',      // "event_start – event_end"
  'unit_price',       // alias for daily_rate
  'unit_price_words', // daily_rate in Vietnamese words
];

@Injectable()
export class TeamContractService {
  private readonly logger = new Logger(TeamContractService.name);
  private readonly bucket = env.teamManagement.s3Bucket;

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolContractTemplate, 'volunteer')
    private readonly templateRepo: Repository<VolContractTemplate>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly s3: S3Client,
    private readonly mail: MailService,
    @InjectRedis() private readonly redis: Redis,
    private readonly contractNumbers: TeamContractNumberService,
  ) {}

  private signLockKey(regId: number): string {
    return `team:contract:signing:${regId}`;
  }

  /**
   * Retry helper for MariaDB deadlocks (errno 1213) and lock-wait
   * timeouts (errno 1205). Used around the contract-number reservation
   * transaction which races on the `vol_contract_number_sequence` row
   * lock when batch=5 admin sends fire concurrently.
   *
   * 3 attempts with jittered exponential backoff (50/150/450ms ± 50%).
   * Final failure surfaces as ConflictException so the admin UI can
   * report which reg IDs need manual retry, instead of a generic 500.
   */
  private async withDeadlockRetry<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const delays = [50, 150, 450];
    let lastErr: unknown;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const errno = (err as { errno?: number; code?: string }).errno;
        const isLockErr = errno === 1213 || errno === 1205;
        if (!isLockErr) throw err;
        lastErr = err;
        const jitter = Math.floor(Math.random() * 50);
        const waitMs = delays[attempt] + jitter;
        this.logger.warn(
          `${label}: lock conflict (errno=${errno}) attempt=${attempt + 1}/3, retry in ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw new ConflictException(
      `${label}: lock conflict after 3 retries — concurrent batch may be running. Try again in a moment.`,
    );
  }

  /**
   * Acquire a 60s Redis lock before doing expensive PDF work. If another
   * request is already signing this registration we throw 409 — the single-
   * use DB flag still protects against double-sign, but the lock stops N
   * puppeteer instances from spinning up and blowing memory.
   */
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
      throw new ConflictException('Another sign request is in progress. Try again shortly.');
    }
    return owner;
  }

  /** Release the lock only if we still own it (prevent stealing). */
  private async releaseSignLock(regId: number, owner: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    try {
      await this.redis.eval(script, 1, this.signLockKey(regId), owner);
    } catch (err) {
      this.logger.warn(`Sign lock release failed reg=${regId}: ${(err as Error).message}`);
    }
  }

  // -------- Template CRUD (admin) --------

  async listTemplates(): Promise<VolContractTemplate[]> {
    return this.templateRepo.find({ order: { created_at: 'DESC' } });
  }

  async getTemplate(id: number): Promise<VolContractTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async createTemplate(
    dto: CreateContractTemplateDto,
    createdBy: string,
  ): Promise<VolContractTemplate> {
    const template = this.templateRepo.create({
      template_name: dto.template_name,
      content_html: sanitizeHtml(dto.content_html),
      variables: dto.variables,
      is_active: dto.is_active ?? true,
      created_by: createdBy,
      party_a_company_name: dto.party_a_company_name ?? null,
      party_a_address: dto.party_a_address ?? null,
      party_a_tax_code: dto.party_a_tax_code ?? null,
      party_a_representative: dto.party_a_representative ?? null,
      party_a_position: dto.party_a_position ?? null,
    });
    return this.templateRepo.save(template);
  }

  async updateTemplate(
    id: number,
    dto: UpdateContractTemplateDto,
  ): Promise<VolContractTemplate> {
    const existing = await this.getTemplate(id);
    if (dto.template_name != null) existing.template_name = dto.template_name;
    if (dto.content_html != null)
      existing.content_html = sanitizeHtml(dto.content_html);
    if (dto.variables != null) existing.variables = dto.variables;
    if (dto.is_active != null) existing.is_active = dto.is_active;
    // Party A fields: update if key present in DTO (null = explicit clear).
    if ('party_a_company_name' in dto) existing.party_a_company_name = dto.party_a_company_name ?? null;
    if ('party_a_address' in dto) existing.party_a_address = dto.party_a_address ?? null;
    if ('party_a_tax_code' in dto) existing.party_a_tax_code = dto.party_a_tax_code ?? null;
    if ('party_a_representative' in dto) existing.party_a_representative = dto.party_a_representative ?? null;
    if ('party_a_position' in dto) existing.party_a_position = dto.party_a_position ?? null;
    return this.templateRepo.save(existing);
  }

  async deleteTemplate(id: number): Promise<void> {
    const template = await this.getTemplate(id);
    // Safety: don't delete a template still referenced by a role
    const inUse = await this.roleRepo.count({ where: { contract_template_id: id } });
    if (inUse > 0) {
      // 409 Conflict — resource is referenced elsewhere and cannot be removed.
      // BadRequestException (400) was misleading: the client's request is
      // well-formed, the state just forbids deletion.
      throw new ConflictException(
        `Template đang được sử dụng — đang gán cho ${inUse} role`,
      );
    }
    await this.templateRepo.remove(template);
  }

  /**
   * Deep-clone a template. Copies content + variables, appends " (bản sao)"
   * to the name, resets created_by + is_active=true. Lets an admin start a
   * new template from an existing one without hand-copying HTML.
   */
  async duplicateTemplate(
    id: number,
    createdBy: string,
  ): Promise<VolContractTemplate> {
    const source = await this.getTemplate(id);
    const copy = this.templateRepo.create({
      template_name: `${source.template_name} (bản sao)`,
      content_html: source.content_html,
      // Clone array — don't share reference with the source row.
      variables: [...(source.variables ?? [])],
      is_active: true,
      created_by: createdBy,
    });
    return this.templateRepo.save(copy);
  }

  /**
   * Scan HTML for `{{variable}}` tokens and return any that are not in the
   * canonical VALID_VARIABLES list. Used by the admin editor to warn about
   * typos before save — backend still accepts the HTML (stored as-is) since
   * future templates may legitimately introduce new variables.
   */
  validateTemplate(contentHtml: string): {
    valid: boolean;
    unknownVars: string[];
  } {
    const found = new Set<string>();
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(contentHtml)) !== null) {
      found.add(m[1].trim());
    }
    const unknownVars = Array.from(found).filter(
      (v) => !VALID_VARIABLES.includes(v),
    );
    return { valid: unknownVars.length === 0, unknownVars };
  }

  async importDocx(buffer: Buffer): Promise<{ content_html: string; warnings: string[] }> {
    const { html, warnings } = await docxToHtml(buffer);
    return { content_html: html, warnings };
  }

  // -------- Contract flow per registration --------

  /**
   * Build placeholder map shared by preview + signing. The optional
   * `signatureImage` param is the full `data:image/png;base64,...` URL
   * — when present it's injected into `{{signature_image}}`. Safe because
   * renderTemplate's HTML-escape is a no-op on base64 charset, and the
   * template was sanitized at save time (allows `<img src={{...}}>`).
   */
  private buildPlaceholders(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
    signatureImage?: string,
    template?: VolContractTemplate,
  ): Record<string, string> {
    const form = (reg.form_data ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
    const cccd = asStr(form.cccd);
    return {
      full_name: reg.full_name,
      email: reg.email,
      phone: reg.phone,
      cccd,
      // `dob` kept as alias for legacy templates; new field is `birth_date`.
      dob: reg.birth_date ? formatDate(reg.birth_date) : '',
      birth_date: reg.birth_date ? formatDate(reg.birth_date) : '',
      cccd_issue_date: reg.cccd_issue_date ? formatDate(reg.cccd_issue_date) : '',
      cccd_issue_place: reg.cccd_issue_place ?? '',
      address: asStr(form.address),
      bank_account_number: asStr(form.bank_account_number),
      bank_name: asStr(form.bank_name),
      // MST = CCCD — no separate field (Option chốt).
      tax_code: cccd,
      role_name: role.role_name,
      daily_rate: formatVnd(Number(role.daily_rate)),
      working_days: String(role.working_days),
      total_compensation: formatVnd(
        Number(role.daily_rate) * role.working_days,
      ),
      event_name: event.event_name,
      event_start_date: formatDate(event.event_start_date),
      event_end_date: formatDate(event.event_end_date),
      event_location: event.location ?? '',
      signed_date: formatDate(new Date()),
      contract_number: reg.contract_number ?? '',
      // Empty string when no signature yet (preview path) — results in
      // `<img src="">` which renders nothing in puppeteer.
      signature_image: signatureImage ?? '',
      // Party A fields — sourced from the template so each legal entity
      // can use its own company info. Falls back to '' if not configured.
      party_a_company_name: template?.party_a_company_name ?? '',
      party_a_address: template?.party_a_address ?? '',
      party_a_tax_code: template?.party_a_tax_code ?? '',
      party_a_representative: template?.party_a_representative ?? '',
      party_a_position: template?.party_a_position ?? '',
      // Aliases used in the seeded DOCX contract template.
      sign_date: formatDate(new Date()),
      cccd_number: cccd,
      work_content: role.description ?? role.role_name,
      work_location: event.location ?? '',
      work_period: `${formatDate(event.event_start_date)} – ${formatDate(event.event_end_date)}`,
      unit_price: formatVnd(Number(role.daily_rate)),
      unit_price_words: capitaliseFirst(vndToWords(Number(role.daily_rate))),
    };
  }

  private async loadContext(token: string): Promise<{
    reg: VolRegistration;
    role: VolRole;
    event: VolEvent;
    template: VolContractTemplate;
  }> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    // v1.4 state-machine gate: only rows that have received the contract
    // can view / sign it. Rows further along (qr_sent, checked_in, completed)
    // keep read access to their signed PDF; earlier rows get 400.
    const viewable: RegistrationStatus[] = [
      'contract_sent',
      'contract_signed',
      'qr_sent',
      'checked_in',
      'completed',
    ];
    if (!viewable.includes(reg.status)) {
      throw new BadRequestException('Contract has not been sent yet');
    }
    const role = reg.role!;
    const event = reg.event!;
    if (!role.contract_template_id) {
      throw new BadRequestException('Role has no contract template configured');
    }
    const template = await this.templateRepo.findOne({
      where: { id: role.contract_template_id },
    });
    if (!template) throw new NotFoundException('Contract template missing');
    return { reg, role, event, template };
  }

  async viewContract(token: string): Promise<ContractViewDto> {
    const { reg, role, event, template } = await this.loadContext(token);
    const vars = this.buildPlaceholders(reg, role, event, undefined, template);
    const rendered = renderTemplate(template.content_html, vars);
    return {
      html_content: wrapContractDocument(rendered),
      already_signed: reg.contract_status === 'signed',
      signed_at: reg.contract_signed_at ? reg.contract_signed_at.toISOString() : null,
      pdf_url: reg.contract_pdf_url,
      full_name: reg.full_name,
    };
  }

  /**
   * Generate PDF and mark contract as signed. Idempotent: a second call
   * with a used sign token is rejected 400.
   */
  async signContract(
    token: string,
    confirmedName: string,
    signatureImage: string,
    clientIp?: string,
  ): Promise<SignContractResponseDto> {
    const { reg, role, event, template } = await this.loadContext(token);
    if (reg.contract_sign_token_used || reg.contract_status === 'signed') {
      throw new BadRequestException('Contract has already been signed');
    }
    // v1.4 state-machine guard: must be in contract_sent to sign.
    if (reg.status !== 'contract_sent') {
      throw new BadRequestException(
        `Cannot sign — registration status is "${reg.status}", expected "contract_sent"`,
      );
    }

    const expected = reg.full_name.trim().toLowerCase();
    const got = confirmedName.trim().toLowerCase();
    if (expected !== got) {
      throw new BadRequestException('confirmed_name does not match registration');
    }

    // Decode + size-check the signature PNG before kicking off expensive
    // PDF work. DTO regex already enforces the prefix shape.
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

    // Serialize concurrent sign requests so we don't launch N chromium
    // instances for the same registration. The DB flag is still the
    // canonical single-use gate below.
    const lockOwner = await this.acquireSignLock(reg.id);
    try {
      // Upload signature to S3 first — failing after the PDF is generated
      // would mean the contract_pdf_hash doesn't match a reproducible
      // render. Private bucket, served only via presigned URL.
      const sigKey = `team-signatures/${event.id}/${reg.id}-${Date.now()}.png`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: sigKey,
          Body: signatureBuffer,
          ContentType: 'image/png',
        }),
      );

      // Inject the full data URL into template — renderTemplate's HTML-
      // escape is a no-op on base64 charset. Template was sanitized at
      // save time; skip second sanitize after templating.
      const vars = this.buildPlaceholders(reg, role, event, signatureImage, template);
      const body = renderTemplate(template.content_html, vars);
      const pdfHtml = wrapContractDocument(body);
      const pdfBuffer = await htmlToPdfBuffer(pdfHtml);
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      const key = `team-contracts/${event.id}/${reg.id}-${Date.now()}.pdf`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      const now = new Date();
      // Atomic swap: single-use token + state transition contract_sent →
      // contract_signed. Combining both guards lets us detect double-sign
      // AND mid-flight admin cancellation in one round-trip.
      const update = await this.dataSource.transaction(async (m) => {
        return m
          .getRepository(VolRegistration)
          .createQueryBuilder()
          .update()
          .set({
            status: 'contract_signed',
            contract_status: 'signed',
            contract_signed_at: now,
            contract_pdf_url: key,
            contract_pdf_hash: hash,
            contract_signature_url: sigKey,
            contract_sign_token_used: true,
          })
          .where('id = :id', { id: reg.id })
          .andWhere('contract_sign_token_used = :used', { used: false })
          .andWhere('status = :from', { from: 'contract_sent' })
          .execute();
      });
      if (update.affected === 0) {
        throw new BadRequestException(
          'Contract has already been signed or the registration has been cancelled',
        );
      }

      this.logger.log(
        `Contract signed reg=${reg.id} hash=${hash.slice(0, 12)}… ip=${clientIp ?? '?'}`,
      );

      // 24h presigned URL — user can re-request from status page if expired.
      const presignedPdf = await this.presignContract(key, 3600 * 24);
      // Fire QR email + transition contract_signed → qr_sent asynchronously.
      // Failure here doesn't block the HTTP response — admin can re-send QR
      // from the personnel tab (PATCH action).
      void this.sendQrAndTransition(reg.id).catch((err) =>
        this.logger.warn(`qr-send after sign failed reg=${reg.id}: ${err.message}`),
      );
      void this.mail
        .sendTeamContractSigned({
          toEmail: reg.email,
          fullName: reg.full_name,
          eventName: event.event_name,
          roleName: role.role_name,
          totalCompensation: formatVnd(Number(role.daily_rate) * role.working_days),
          pdfBuffer,
          pdfFilename: `contract-${event.event_name}-${reg.id}.pdf`,
        })
        .catch((err) =>
          this.logger.warn(`sign email failed reg=${reg.id}: ${err.message}`),
        );

      return { success: true, pdf_url: presignedPdf, signed_at: now.toISOString() };
    } finally {
      await this.releaseSignLock(reg.id, lockOwner);
    }
  }

  /**
   * Admin path — look up registration by ID and return a short-lived
   * presigned URL for its signed contract PDF. Throws 404 if no contract
   * is signed yet.
   */
  async getSignedContractUrlForRegistration(
    regId: number,
    ttlSeconds = 600,
  ): Promise<string> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.contract_status !== 'signed' || !reg.contract_pdf_url) {
      throw new BadRequestException('Contract has not been signed yet');
    }
    return this.presignContract(reg.contract_pdf_url, ttlSeconds);
  }

  /**
   * Public path — verify magic token, return presigned URL only when the
   * contract is already signed. 404/400 otherwise. Rate-limited by the
   * controller decorator.
   */
  async getSignedContractUrlForToken(
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
    if (reg.contract_status !== 'signed' || !reg.contract_pdf_url) {
      throw new BadRequestException('Contract has not been signed yet');
    }
    return this.presignContract(reg.contract_pdf_url, ttlSeconds);
  }

  /**
   * Admin path — presigned URL for the handwritten signature PNG.
   * Throws 404/400 if the registration has no signature on file.
   * Audit-logged the same way as CCCD access (sensitive biometric).
   */
  async getSignatureUrlForRegistration(
    regId: number,
    adminIdentity: string,
    ttlSeconds = 600,
  ): Promise<string> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (!reg.contract_signature_url) {
      throw new BadRequestException('No signature on file');
    }
    this.logger.log(
      `SIGNATURE_ACCESS admin=${adminIdentity} reg=${regId} event=${reg.event_id}`,
    );
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: reg.contract_signature_url,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  /**
   * Return a short-lived presigned URL for a signed-contract PDF key.
   */
  async presignContract(key: string, ttlSeconds = 3600): Promise<string> {
    const realKey = key.startsWith('team-contracts/')
      ? key
      : key.replace(/^https?:\/\/[^/]+\//, '');
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: realKey }),
      { expiresIn: ttlSeconds },
    );
  }

  // -------- Batch: send contract magic links for a role --------

  async sendContractsForRole(
    roleId: number,
    dryRun: boolean,
  ): Promise<SendContractsResponseDto> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.contract_template_id) {
      throw new BadRequestException('Role has no contract template configured');
    }
    const event = await this.eventRepo.findOne({ where: { id: role.event_id } });
    if (!event) throw new NotFoundException('Event not found');

    // v1.4: only `approved` rows are valid targets. Anything further along
    // the state machine (contract_sent+) has already received the email.
    const targets = await this.regRepo.find({
      where: { role_id: roleId, status: 'approved' },
    });
    const alreadySent = await this.regRepo.count({
      where: [
        { role_id: roleId, status: 'contract_sent' },
        { role_id: roleId, status: 'contract_signed' },
        { role_id: roleId, status: 'qr_sent' },
        { role_id: roleId, status: 'checked_in' },
        { role_id: roleId, status: 'completed' },
      ],
    });

    if (dryRun) {
      return {
        queued: targets.length,
        already_sent: alreadySent,
        skipped: 0,
        skipped_ids: [],
        skip_reasons: [],
      };
    }

    if (targets.length === 0) {
      return {
        queued: 0,
        already_sent: alreadySent,
        skipped: 0,
        skipped_ids: [],
        skip_reasons: [],
      };
    }

    // Bounded concurrency: chunks of 5 concurrent email sends. Per-reg
    // transition to `contract_sent` runs only after the email resolves,
    // guarded by a conditional UPDATE (WHERE status='approved') so two
    // concurrent batch runs can't both win.
    //
    // v2.1 — track failures explicitly. The previous version returned
    // `skipped: 0` even when N/10 emails actually failed, because the
    // `Promise.allSettled` rejections were only logged to console. The
    // admin had no way to know who didn't get the magic link.
    const CONCURRENCY = 5;
    let queued = 0;
    const skippedIds: number[] = [];
    const skipReasons: string[] = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const chunk = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((reg) => this.sendContractToRegistration(reg, role, event)),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          queued++;
        } else {
          const regId = chunk[j].id;
          const reason = (r.reason as Error).message;
          this.logger.warn(`send-contract failed reg=${regId}: ${reason}`);
          skippedIds.push(regId);
          skipReasons.push(reason);
        }
      }
    }

    return {
      queued,
      already_sent: alreadySent,
      skipped: skippedIds.length,
      skipped_ids: skippedIds,
      skip_reasons: skipReasons,
    };
  }

  /**
   * Send the contract magic link to a single registration. Must be called
   * only when reg.status === 'approved'. Transitions → 'contract_sent' on
   * successful queue via conditional UPDATE; leaves status intact on
   * failure so the admin can retry.
   */
  async sendContractToRegistration(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
  ): Promise<number> {
    // Allow sending (initial) or re-sending (resend to same magic link).
    // States further than contract_sent mean the crew already signed —
    // resending the sign link makes no sense at that point.
    if (reg.status !== 'approved' && reg.status !== 'contract_sent') {
      throw new BadRequestException(
        `Cannot send contract — registration status is "${reg.status}". ` +
          `Expected "approved" (initial send) or "contract_sent" (resend).`,
      );
    }

    // Resend fast-path: crew already has a contract_number + magic_token,
    // no status change needed — just re-send the email with the same link.
    // Always refresh magic_token_expires so a resend never goes to a dead link.
    if (reg.status === 'contract_sent') {
      this.logger.log(
        `sendContractToRegistration reg=${reg.id}: resend to ${reg.email} (already contract_sent)`,
      );
      const newExpiry = this.tokenExpiry();
      await this.regRepo.update(reg.id, { magic_token_expires: newExpiry });
      const magicLink = `${env.teamManagement.crewBaseUrl}/contract/${reg.magic_token}`;
      await this.mail.sendTeamContractSent({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName: event.event_name,
        roleName: role.role_name,
        magicLink,
      });
      return reg.id;
    }

    // Initial send path (approved → contract_sent):
    // v2.0 — reserve contract_number inside the status-transition
    // transaction. Sequence row is locked FOR UPDATE so concurrent batch
    // runs serialize naturally on REPEATABLE READ (MariaDB default). The
    // SERIALIZABLE isolation that was here originally caused 9/10 lock
    // conflicts under 10x parallel load (gap locks block range scans).
    // Atomicity comes from the FOR UPDATE row lock alone — verified by
    // QC: 0 duplicate contract_numbers under 10x burst.
    //
    // Wrapped in withDeadlockRetry: even the bare row lock can deadlock
    // if MariaDB picks competing victims, so retry up to 3x with
    // exponential backoff before surfacing a 409 to the admin.
    const result = await this.withDeadlockRetry(
      `sendContractToRegistration(reg=${reg.id})`,
      () =>
        // READ COMMITTED: each statement sees the latest committed
        // version, so the LAST_INSERT_ID atomic counter UPDATE doesn't
        // conflict with sister transactions' snapshots. REPEATABLE READ
        // (MariaDB default) raises errno 1020 "Record has changed since
        // last read" under 10x concurrent updates because each txn
        // holds its own row snapshot.
        this.dataSource.transaction('READ COMMITTED', async (m) => {
          // Re-read inside txn so we see the committed contract_number if any.
          const latest = await m
            .getRepository(VolRegistration)
            .findOne({ where: { id: reg.id } });
          if (!latest) {
            throw new NotFoundException('Registration vanished mid-transaction');
          }
          let contractNumber = latest.contract_number;
          if (!contractNumber) {
            contractNumber = await this.contractNumbers.reserveNextInTransaction(
              m,
              event.id,
            );
          }
          const upd = await m
            .getRepository(VolRegistration)
            .createQueryBuilder()
            .update()
            .set({
              status: 'contract_sent',
              contract_status: 'sent',
              contract_number: contractNumber,
              // Refresh expiry so the emailed link is always valid for 7 days.
              magic_token_expires: this.tokenExpiry(),
            })
            .where('id = :id', { id: reg.id })
            .andWhere('status = :from', { from: 'approved' })
            .execute();
          // Refresh the in-memory object so downstream email/log has the number.
          reg.contract_number = contractNumber;
          return upd;
        }),
    );

    if (!result.affected) {
      this.logger.warn(
        `sendContractToRegistration reg=${reg.id}: status changed under us, skip transition (contract_number reserved=${reg.contract_number})`,
      );
      // Still attempt the email so admin retry isn't wasted — the reg is
      // already in contract_sent so the email link works.
    }

    const magicLink = `${env.teamManagement.crewBaseUrl}/contract/${reg.magic_token}`;
    try {
      await this.mail.sendTeamContractSent({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName: event.event_name,
        roleName: role.role_name,
        magicLink,
      });
    } catch (err) {
      // Don't revert the contract_number / status — reserving a gap is
      // acceptable (audit-safe), rolling back a committed sequence isn't.
      this.logger.warn(
        `send-contract email failed reg=${reg.id} (state already contract_sent): ${(err as Error).message}`,
      );
      throw err;
    }
    return reg.id;
  }

  /**
   * Fire the QR email and transition contract_signed → qr_sent. Safe to
   * call multiple times: the conditional UPDATE silently skips if the
   * status has already moved past contract_signed.
   *
   * Kept inside TeamContractService (not TeamRegistrationService) so the
   * magic_token handling + email templating stays co-located with the rest
   * of the contract flow and avoids a circular DI edge.
   */
  async sendQrAndTransition(regId: number): Promise<void> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status !== 'contract_signed' && reg.status !== 'qr_sent') {
      // No-op for rows that are already further along or still earlier —
      // admin re-send from personnel tab should call this, so tolerate
      // qr_sent as already-done (idempotent).
      this.logger.warn(
        `sendQrAndTransition reg=${regId}: status=${reg.status}, skipping`,
      );
      return;
    }
    // v1.9: Skip QR/checkin flow entirely in Lite mode. Crew portal hides
    // the scan UI and admin manually confirms attendance via /confirm-nghiem-thu
    // (which requires status='contract_signed' in Lite mode). If we let this
    // method transition contract_signed → qr_sent, confirm-nghiem-thu would
    // then reject the reg with "yêu cầu status contract_signed".
    if (reg.event?.feature_mode === 'lite') {
      this.logger.log(
        `sendQrAndTransition reg=${regId}: event is Lite mode, skipping QR transition`,
      );
      return;
    }

    // Issue / refresh QR code. Mirror the magic_token for compatibility
    // with existing scan flows — the QR scan route looks up by qr_code.
    const qrToken = reg.magic_token;
    const qrDataUrl = await QRCode.toDataURL(qrToken);
    const magicLink = `${env.teamManagement.crewBaseUrl}/status/${reg.magic_token}`;

    await this.mail.sendTeamRegistrationApproved({
      toEmail: reg.email,
      fullName: reg.full_name,
      eventName: reg.event?.event_name ?? '',
      roleName: reg.role?.role_name ?? '',
      magicLink,
      qrDataUrl,
    });

    const res = await this.regRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'qr_sent', qr_code: qrToken })
      .where('id = :id', { id: regId })
      .andWhere('status IN (:...from)', {
        from: ['contract_signed', 'qr_sent'],
      })
      .execute();
    if (!res.affected) {
      this.logger.warn(
        `sendQrAndTransition reg=${regId}: status changed under us, not transitioning to qr_sent`,
      );
    }
  }

  /**
   * Admin-triggered wrapper: look up reg/role/event by id and fire the
   * contract email. Used by PATCH /registrations/:id/approve in the
   * controller which approves THEN immediately sends the contract.
   */
  async sendContractForRegistrationId(regId: number): Promise<number> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (!reg.role) throw new NotFoundException('Role not loaded');
    if (!reg.event) throw new NotFoundException('Event not loaded');

    // No-contract fast-path: when the role has no contract template
    // configured, skip contract_sent/contract_signed and deliver the QR
    // + portal email directly. Status: approved → qr_sent.
    if (!reg.role.contract_template_id) {
      await this.sendApprovedNoContract(reg, reg.role, reg.event);
      return reg.id;
    }

    return this.sendContractToRegistration(reg, reg.role, reg.event);
  }

  /**
   * Fired when a registration is approved but the role has NO contract
   * template configured. Sends the "you're approved — here's your QR +
   * portal link" email and transitions approved → qr_sent atomically.
   *
   * Keeps the same final state as the contract flow so downstream
   * check-in / completion logic doesn't need a second branch.
   */
  private async sendApprovedNoContract(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
  ): Promise<void> {
    if (reg.status !== 'approved') {
      this.logger.warn(
        `sendApprovedNoContract reg=${reg.id}: status=${reg.status}, skipping`,
      );
      return;
    }
    const qrToken = reg.magic_token;
    const qrDataUrl = await QRCode.toDataURL(qrToken);
    const magicLink = `${env.teamManagement.crewBaseUrl}/status/${reg.magic_token}`;

    await this.mail.sendTeamRegistrationApproved({
      toEmail: reg.email,
      fullName: reg.full_name,
      eventName: event.event_name,
      roleName: role.role_name,
      magicLink,
      qrDataUrl,
    });

    const result = await this.regRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'qr_sent', qr_code: qrToken })
      .where('id = :id', { id: reg.id })
      .andWhere('status = :from', { from: 'approved' })
      .execute();
    if (!result.affected) {
      this.logger.warn(
        `sendApprovedNoContract reg=${reg.id}: status changed under us, not transitioning to qr_sent`,
      );
    } else {
      this.logger.log(
        `APPROVE_NO_CONTRACT reg=${reg.id} role=${role.id} → qr_sent (role has no contract_template_id)`,
      );
    }
  }

  /** Returns a Date that is MAGIC_TOKEN_EXPIRES_DAYS days from now (UTC). */
  private tokenExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + env.teamManagement.magicTokenDays);
    return d;
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
