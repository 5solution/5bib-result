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
import { VolContractTemplate } from '../entities/vol-contract-template.entity';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
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
  ) {}

  private signLockKey(regId: number): string {
    return `team:contract:signing:${regId}`;
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
    return this.templateRepo.save(existing);
  }

  async deleteTemplate(id: number): Promise<void> {
    const template = await this.getTemplate(id);
    // Safety: don't delete a template still referenced by a role
    const inUse = await this.roleRepo.count({ where: { contract_template_id: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete — template is assigned to ${inUse} role(s)`,
      );
    }
    await this.templateRepo.remove(template);
  }

  async importDocx(buffer: Buffer): Promise<{ content_html: string; warnings: string[] }> {
    const { html, warnings } = await docxToHtml(buffer);
    return { content_html: html, warnings };
  }

  // -------- Contract flow per registration --------

  /**
   * Build placeholder map shared by preview + signing.
   */
  private buildPlaceholders(
    reg: VolRegistration,
    role: VolRole,
    event: VolEvent,
  ): Record<string, string> {
    const form = (reg.form_data ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      full_name: reg.full_name,
      email: reg.email,
      phone: reg.phone,
      cccd: asStr(form.cccd),
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
    if (reg.contract_status === 'not_sent') {
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
    const vars = this.buildPlaceholders(reg, role, event);
    const rendered = renderTemplate(template.content_html, vars);
    return {
      html_content: wrapContractDocument(rendered),
      already_signed: reg.contract_status === 'signed',
      signed_at: reg.contract_signed_at ? reg.contract_signed_at.toISOString() : null,
      pdf_url: reg.contract_pdf_url,
    };
  }

  /**
   * Generate PDF and mark contract as signed. Idempotent: a second call
   * with a used sign token is rejected 400.
   */
  async signContract(
    token: string,
    confirmedName: string,
    clientIp?: string,
  ): Promise<SignContractResponseDto> {
    const { reg, role, event, template } = await this.loadContext(token);
    if (reg.contract_sign_token_used || reg.contract_status === 'signed') {
      throw new BadRequestException('Contract has already been signed');
    }

    const expected = reg.full_name.trim().toLowerCase();
    const got = confirmedName.trim().toLowerCase();
    if (expected !== got) {
      throw new BadRequestException('confirmed_name does not match registration');
    }

    // Serialize concurrent sign requests so we don't launch N chromium
    // instances for the same registration. The DB flag is still the
    // canonical single-use gate below.
    const lockOwner = await this.acquireSignLock(reg.id);
    try {
      const vars = this.buildPlaceholders(reg, role, event);
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
      // Atomic swap: only flip if not already used (single-use token).
      const update = await this.dataSource.transaction(async (m) => {
        return m
          .getRepository(VolRegistration)
          .createQueryBuilder()
          .update()
          .set({
            contract_status: 'signed',
            contract_signed_at: now,
            contract_pdf_url: key,
            contract_pdf_hash: hash,
            contract_sign_token_used: true,
          })
          .where('id = :id', { id: reg.id })
          .andWhere('contract_sign_token_used = :used', { used: false })
          .execute();
      });
      if (update.affected === 0) {
        throw new BadRequestException('Contract has already been signed');
      }

      this.logger.log(
        `Contract signed reg=${reg.id} hash=${hash.slice(0, 12)}… ip=${clientIp ?? '?'}`,
      );

      // 24h presigned URL — user can re-request from status page if expired.
      const presignedPdf = await this.presignContract(key, 3600 * 24);
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

    const targets = await this.regRepo.find({
      where: { role_id: roleId, status: 'approved' },
    });
    const notSent = targets.filter((r) => r.contract_status === 'not_sent');
    const alreadySent = targets.filter(
      (r) => r.contract_status === 'sent' || r.contract_status === 'signed',
    ).length;
    const skipped = targets.length - notSent.length - alreadySent;

    if (dryRun) {
      return { queued: notSent.length, already_sent: alreadySent, skipped };
    }

    if (notSent.length === 0) {
      return { queued: 0, already_sent: alreadySent, skipped };
    }

    let queued = 0;
    // Flip status PER registration only after the email resolves, so a
    // crash mid-loop doesn't leave rows stuck at `sent` without the user
    // ever receiving the email.
    for (const reg of notSent) {
      const magicLink = `${env.teamManagement.crewBaseUrl}/contract/${reg.magic_token}`;
      try {
        await this.mail.sendTeamContractSent({
          toEmail: reg.email,
          fullName: reg.full_name,
          eventName: event.event_name,
          roleName: role.role_name,
          magicLink,
        });
        await this.regRepo
          .createQueryBuilder()
          .update()
          .set({ contract_status: 'sent' })
          .where('id = :id', { id: reg.id })
          .execute();
        queued++;
      } catch (err) {
        this.logger.warn(
          `send-contract email failed reg=${reg.id}: ${(err as Error).message}`,
        );
        // leave contract_status as 'not_sent' so admin can retry
      }
    }

    return { queued, already_sent: alreadySent, skipped };
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
