import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailService } from '../notification/mail.service';
import { env } from 'src/config';
import {
  TimingLead,
  TimingLeadDocument,
  TimingLeadSource,
} from './schemas/timing-lead.schema';
import {
  TimingCounter,
  TimingCounterDocument,
} from './schemas/timing-counter.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';

const LEAD_COUNTER_ID = 'timing_lead';

@Injectable()
export class TimingService {
  private readonly logger = new Logger(TimingService.name);

  constructor(
    @InjectModel(TimingLead.name)
    private readonly leadModel: Model<TimingLeadDocument>,
    @InjectModel(TimingCounter.name)
    private readonly counterModel: Model<TimingCounterDocument>,
    private readonly mailService: MailService,
  ) {}

  /** Atomic counter — MongoDB findOneAndUpdate $inc + upsert guarantees monotonic sequence. */
  private async nextLeadNumber(): Promise<number> {
    const doc = await this.counterModel
      .findOneAndUpdate(
        { _id: LEAD_COUNTER_ID },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
    return doc.seq;
  }

  /** Normalize phone to canonical form for dedup check. */
  private normalizePhone(raw: string): string {
    const cleaned = raw.replace(/\s+/g, '');
    if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
    return cleaned;
  }

  /** Mask IPv4 address to x.x.x.x for privacy. */
  private maskIp(ip: string): string {
    if (!ip) return '';
    // Strip IPv6 prefix if mapped IPv4 (::ffff:1.2.3.4)
    const clean = ip.replace(/^::ffff:/, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) {
      return 'x.x.x.x';
    }
    // IPv6 — keep only /48 prefix
    if (clean.includes(':')) {
      const parts = clean.split(':');
      return parts.slice(0, 3).join(':') + ':x:x:x:x:x';
    }
    return 'x.x.x.x';
  }

  async createLead(
    dto: CreateLeadDto,
    meta: { ip: string; userAgent: string },
    source: TimingLeadSource = 'timing',
  ): Promise<{ success: boolean; lead_number: number }> {
    // Honeypot — silently accept but log + do not persist real lead
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(
        `[honeypot] Dropped submission from ip=${this.maskIp(meta.ip)} ua="${meta.userAgent}"`,
      );
      return { success: true, lead_number: 0 };
    }

    // Backward-compat: legacy tracks require phone + organization; 5sport-athlete may use email-only.
    if (source !== '5sport-athlete') {
      if (!dto.phone) {
        throw new BadRequestException('Vui lòng nhập số điện thoại');
      }
      if (!dto.organization) {
        throw new BadRequestException('Vui lòng nhập tên tổ chức');
      }
    } else {
      if (!dto.email && !dto.phone) {
        throw new BadRequestException('Vui lòng nhập email hoặc số điện thoại');
      }
    }

    const phoneNorm = dto.phone ? this.normalizePhone(dto.phone) : '';
    const emailNorm = (dto.email || '').trim().toLowerCase();

    // Dedup — same phone OR email within last 30 minutes = silently succeed (idempotent)
    const dedupFilter: Record<string, unknown>[] = [];
    if (phoneNorm) dedupFilter.push({ phone: phoneNorm });
    if (emailNorm) dedupFilter.push({ email: emailNorm });
    const recent =
      dedupFilter.length > 0
        ? await this.leadModel
            .findOne({
              $or: dedupFilter,
              createdAt: { $gte: new Date(Date.now() - 30 * 60_000) },
            })
            .lean()
            .exec()
        : null;
    if (recent) {
      this.logger.log(
        `[dedup] Duplicate lead phone=${phoneNorm} email=${emailNorm} within 30m — returning existing #${recent.lead_number}`,
      );
      return { success: true, lead_number: recent.lead_number };
    }

    const lead_number = await this.nextLeadNumber();

    const doc = await this.leadModel.create({
      lead_number,
      full_name: dto.full_name.trim(),
      phone: phoneNorm,
      email: emailNorm,
      organization: (dto.organization || '').trim(),
      athlete_count_range: dto.athlete_count_range || '',
      package_interest: dto.package_interest || 'unspecified',
      notes: dto.notes?.trim() || '',
      sport_type: dto.sport_type || '',
      tournament_scale: dto.tournament_scale || '',
      tournament_timing: dto.tournament_timing || '',
      city: (dto.city || '').trim(),
      source,
      status: 'new',
      is_archived: false,
      staff_notes: '',
      ip_address: this.maskIp(meta.ip),
      user_agent: meta.userAgent || '',
    });

    // Fire-and-forget notification — do not block response on email send
    const notifyEmails = env.timing.notifyEmails;
    if (notifyEmails.length > 0) {
      this.mailService
        .sendTimingLeadNotification({
          toEmails: notifyEmails,
          lead_number,
          full_name: doc.full_name,
          phone: doc.phone,
          organization: doc.organization,
          athlete_count_range: doc.athlete_count_range,
          package_interest: doc.package_interest,
          notes: doc.notes,
          adminUrl: `${env.timing.adminBaseUrl}/timing-leads/${doc._id.toString()}`,
        })
        .catch((err) =>
          this.logger.error(`Failed to queue lead notification email: ${err.message}`),
        );
    }

    return { success: true, lead_number };
  }

  async listLeads(query: ListLeadsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {};

    if (!query.include_archived) {
      filter.is_archived = { $ne: true };
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.source) {
      filter.source = query.source;
    }
    if (query.q && query.q.trim()) {
      const needle = query.q.trim();
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { full_name: rx },
        { phone: rx },
        { organization: rx },
      ];
    }

    const [items, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async getLead(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const doc = await this.leadModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Không tìm thấy lead');
    return doc;
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const update: Record<string, unknown> = {};
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.staff_notes !== undefined) update.staff_notes = dto.staff_notes;
    if (dto.is_archived !== undefined) update.is_archived = dto.is_archived;

    const doc = await this.leadModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy lead');
    return doc;
  }

  /** Return CSV payload of leads matching the same filter shape used by listLeads. */
  async exportCsv(query: ListLeadsQueryDto): Promise<string> {
    const filter: Record<string, unknown> = {};
    if (!query.include_archived) filter.is_archived = { $ne: true };
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.q && query.q.trim()) {
      const needle = query.q.trim();
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { full_name: rx },
        { phone: rx },
        { organization: rx },
      ];
    }

    const rows = await this.leadModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(10_000)
      .lean()
      .exec();

    const header = [
      'lead_number',
      'source',
      'created_at',
      'full_name',
      'phone',
      'organization',
      'athlete_count_range',
      'package_interest',
      'status',
      'is_archived',
      'notes',
      'staff_notes',
    ];
    const esc = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines: string[] = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.lead_number,
          r.source ?? 'timing',
          r.createdAt?.toISOString() ?? '',
          r.full_name,
          r.phone,
          r.organization,
          r.athlete_count_range,
          r.package_interest,
          r.status,
          r.is_archived ? 'true' : 'false',
          r.notes,
          r.staff_notes,
        ]
          .map(esc)
          .join(','),
      );
    }
    // BOM for Excel UTF-8 recognition
    return '\uFEFF' + lines.join('\n');
  }
}
