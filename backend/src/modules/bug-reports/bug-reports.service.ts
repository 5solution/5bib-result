import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  BugReport,
  BugReportDocument,
  BugStatus,
} from './schemas/bug-report.schema';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { ListBugReportsQueryDto } from './dto/list-bug-reports.dto';
import {
  UpdateBugStatusDto,
  UpdateBugAssigneeDto,
  UpdateBugTriageDto,
} from './dto/update-bug-report.dto';
import {
  BugReportAdminDto,
  CreateBugReportResponseDto,
  PaginatedBugReportsAdminDto,
  BugReportStatsDto,
} from './dto/bug-report-response.dto';
import { sanitizeText } from './utils/sanitize';
import { isValidTransition, SEVERITY_SLA } from './utils/state-machine';

const MONGO_DUP_KEY = 11000;
const NOT_FOUND_MSG = 'Không tìm thấy báo cáo lỗi';

// Per-IP submit rate limit (sliding window via Redis INCR + EXPIRE).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 3600;

interface AdminActor {
  id: string;
  name: string;
}

@Injectable()
export class BugReportsService {
  private readonly logger = new Logger(BugReportsService.name);

  constructor(
    @InjectModel(BugReport.name)
    private readonly bugModel: Model<BugReportDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Public submit ────────────────────────────────────────────

  /** Returns true if the IP is under the limit (allowed to submit). */
  async checkAndConsumeRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const key = `ratelimit:bug-report:${ip}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, RATE_LIMIT_WINDOW_SEC);
      }
      if (count > RATE_LIMIT_MAX) {
        const ttl = await this.redis.ttl(key);
        return { allowed: false, retryAfterSec: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SEC };
      }
      return { allowed: true, retryAfterSec: 0 };
    } catch (err) {
      // If Redis is down, fail OPEN — better to accept a few extra reports
      // than to block all submits. The risk is bounded by client-side UX.
      this.logger.warn(`Rate-limit Redis check failed: ${(err as Error).message}`);
      return { allowed: true, retryAfterSec: 0 };
    }
  }

  async create(
    dto: CreateBugReportDto,
    ipAddress: string,
  ): Promise<CreateBugReportResponseDto> {
    // Honeypot — silent reject. Return 200 with a fake publicId so bots
    // can't tell their submission failed.
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(`Honeypot triggered from IP ${ipAddress}`);
      return {
        publicId: this.fakePublicId(),
        status: 'received',
        estimatedResponseTime: SEVERITY_SLA.unknown,
      };
    }

    const severity = dto.severity ?? 'unknown';
    const publicId = await this.generatePublicId();

    const sanitized = {
      title: sanitizeText(dto.title),
      description: sanitizeText(dto.description),
      stepsToReproduce: sanitizeText(dto.stepsToReproduce),
      urlAffected: sanitizeText(dto.urlAffected),
    };

    if (sanitized.title.length < 5) {
      throw new BadRequestException('Tiêu đề tối thiểu 5 ký tự sau khi loại bỏ HTML');
    }
    if (sanitized.description.length < 20) {
      throw new BadRequestException('Mô tả tối thiểu 20 ký tự sau khi loại bỏ HTML');
    }

    try {
      await this.bugModel.create({
        publicId,
        title: sanitized.title,
        description: sanitized.description,
        stepsToReproduce: sanitized.stepsToReproduce,
        category: dto.category,
        severity,
        status: 'new' as BugStatus,
        email: dto.email.toLowerCase().trim(),
        phoneNumber: dto.phoneNumber?.trim() ?? '',
        wantsUpdates: dto.wantsUpdates,
        urlAffected: sanitized.urlAffected,
        userAgent: dto.userAgent?.slice(0, 500) ?? '',
        viewport: dto.viewport?.slice(0, 20) ?? '',
        referrer: dto.referrer?.slice(0, 500) ?? '',
        ipAddress,
        statusHistory: [
          {
            fromStatus: null,
            toStatus: 'new',
            changedBy: null,
            changedByName: null,
            changedAt: new Date(),
            reason: 'Initial submission',
          },
        ],
      });

      this.logger.log(`Bug report created: ${publicId} (severity=${severity}, ip=${ipAddress})`);

      // Invalidate admin list caches
      await this.invalidateListCaches();

      return {
        publicId,
        status: 'received',
        estimatedResponseTime: SEVERITY_SLA[severity] ?? SEVERITY_SLA.unknown,
      };
    } catch (err) {
      const error = err as { code?: number; message?: string };
      if (error.code === MONGO_DUP_KEY) {
        // publicId race — extremely unlikely but possible. Retry once.
        const retryId = await this.generatePublicId();
        throw new ConflictException(
          `publicId conflict; retry with: ${retryId}`,
        );
      }
      throw err;
    }
  }

  // ─── Admin operations ────────────────────────────────────────

  async listAdmin(query: ListBugReportsQueryDto): Promise<PaginatedBugReportsAdminDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (!query.includeDeleted) filter.isDeleted = false;
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.category) filter.category = query.category;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { publicId: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      this.bugModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.bugModel.countDocuments(filter).exec(),
    ]);

    return {
      items: docs.map((d) => this.toAdminDto(d as BugReportDocument)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByPublicId(publicId: string): Promise<BugReportAdminDto> {
    const doc = await this.bugModel.findOne({ publicId }).lean().exec();
    if (!doc) throw new NotFoundException(NOT_FOUND_MSG);
    return this.toAdminDto(doc as BugReportDocument);
  }

  async updateStatus(
    publicId: string,
    dto: UpdateBugStatusDto,
    actor: AdminActor,
  ): Promise<BugReportAdminDto> {
    const doc = await this.bugModel.findOne({ publicId }).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND_MSG);

    if (doc.status === dto.toStatus) {
      throw new BadRequestException(`Status đã là "${dto.toStatus}"`);
    }
    if (!isValidTransition(doc.status, dto.toStatus)) {
      throw new BadRequestException(
        `Chuyển trạng thái không hợp lệ: ${doc.status} → ${dto.toStatus}`,
      );
    }

    if (dto.toStatus === 'duplicate') {
      if (!dto.duplicateOfPublicId) {
        throw new BadRequestException(
          'Cần cung cấp publicId của bug gốc khi đánh dấu duplicate',
        );
      }
      if (dto.duplicateOfPublicId === publicId) {
        throw new BadRequestException('Không thể đánh dấu duplicate của chính nó');
      }
      const target = await this.bugModel
        .findOne({ publicId: dto.duplicateOfPublicId })
        .select({ _id: 1 })
        .lean()
        .exec();
      if (!target) {
        throw new BadRequestException(
          `Không tìm thấy bug gốc: ${dto.duplicateOfPublicId}`,
        );
      }
      doc.duplicateOfPublicId = dto.duplicateOfPublicId;
    }

    const fromStatus = doc.status;
    // 'reopened' is a virtual transition; the resulting effective state is 'triaged'
    // so dashboards show it back in the active queue.
    const finalStatus: BugStatus = dto.toStatus === 'reopened' ? 'triaged' : dto.toStatus;

    doc.status = finalStatus;
    doc.statusHistory.push({
      fromStatus,
      toStatus: dto.toStatus,
      changedBy: actor.id,
      changedByName: actor.name,
      changedAt: new Date(),
      reason: dto.reason ?? null,
    });
    await doc.save();

    await this.invalidateListCaches();
    this.logger.log(
      `Bug ${publicId}: ${fromStatus} → ${dto.toStatus} by ${actor.name}`,
    );

    return this.toAdminDto(doc.toObject() as BugReportDocument);
  }

  async updateAssignee(
    publicId: string,
    dto: UpdateBugAssigneeDto,
    actor: AdminActor,
  ): Promise<BugReportAdminDto> {
    const doc = await this.bugModel.findOne({ publicId }).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND_MSG);

    doc.assigneeId = dto.assigneeId ?? null;
    doc.assigneeName = dto.assigneeName ?? null;
    await doc.save();

    await this.invalidateListCaches();
    this.logger.log(
      `Bug ${publicId} assignee → ${dto.assigneeName ?? '(unassigned)'} by ${actor.name}`,
    );

    return this.toAdminDto(doc.toObject() as BugReportDocument);
  }

  async updateTriage(
    publicId: string,
    dto: UpdateBugTriageDto,
  ): Promise<BugReportAdminDto> {
    const doc = await this.bugModel.findOne({ publicId }).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND_MSG);

    if (dto.severity) doc.severity = dto.severity;
    if (dto.category) doc.category = dto.category;
    await doc.save();

    await this.invalidateListCaches();
    return this.toAdminDto(doc.toObject() as BugReportDocument);
  }

  async softDelete(publicId: string): Promise<{ success: true }> {
    const result = await this.bugModel
      .updateOne({ publicId }, { $set: { isDeleted: true } })
      .exec();
    if (result.matchedCount === 0) throw new NotFoundException(NOT_FOUND_MSG);
    await this.invalidateListCaches();
    return { success: true };
  }

  async stats(): Promise<BugReportStatsDto> {
    const baseFilter = { isDeleted: false };
    const [statusCounts, severityCounts, total] = await Promise.all([
      this.bugModel.aggregate<{ _id: BugStatus; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.bugModel.aggregate<{ _id: string; count: number }>([
        { $match: { ...baseFilter, severity: 'critical', status: { $in: ['new', 'triaged', 'in_progress'] } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      this.bugModel.countDocuments(baseFilter).exec(),
    ]);

    const statusMap = new Map(statusCounts.map((s) => [s._id, s.count]));

    return {
      new: statusMap.get('new') ?? 0,
      triaged: statusMap.get('triaged') ?? 0,
      inProgress: statusMap.get('in_progress') ?? 0,
      resolved: statusMap.get('resolved') ?? 0,
      critical: severityCounts.reduce((sum, s) => sum + s.count, 0),
      total,
    };
  }

  // ─── Internals ────────────────────────────────────────────────

  private async generatePublicId(): Promise<string> {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const day = `${yyyy}${mm}${dd}`;
    const counterKey = `bug-report-counter:${day}`;

    try {
      const seq = await this.redis.incr(counterKey);
      if (seq === 1) {
        // Keep counter for 25h so we don't roll over mid-day at edge of UTC.
        await this.redis.expire(counterKey, 90000);
      }
      return `BUG-${day}-${String(seq).padStart(4, '0')}`;
    } catch (err) {
      // Redis fallback — use timestamp-based suffix (still unique per ms).
      this.logger.warn(`publicId Redis INCR failed, using ts fallback: ${(err as Error).message}`);
      const tsSuffix = String(Date.now() % 10000).padStart(4, '0');
      return `BUG-${day}-${tsSuffix}`;
    }
  }

  private fakePublicId(): string {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `BUG-${day}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  }

  private async invalidateListCaches() {
    // Reserved for v1.1 — we'll add list caching when traffic grows.
    // For now this is a no-op so the function exists at every mutation site
    // and we don't have to retrofit cache invalidation later.
  }

  private toAdminDto(doc: BugReportDocument): BugReportAdminDto {
    return {
      id: String(doc._id),
      publicId: doc.publicId,
      title: doc.title,
      description: doc.description,
      stepsToReproduce: doc.stepsToReproduce ?? '',
      category: doc.category,
      severity: doc.severity,
      status: doc.status,
      email: doc.email,
      phoneNumber: doc.phoneNumber ?? '',
      wantsUpdates: doc.wantsUpdates,
      urlAffected: doc.urlAffected ?? '',
      userAgent: doc.userAgent ?? '',
      viewport: doc.viewport ?? '',
      referrer: doc.referrer ?? '',
      ipAddress: doc.ipAddress,
      assigneeId: doc.assigneeId ?? null,
      assigneeName: doc.assigneeName ?? null,
      duplicateOfPublicId: doc.duplicateOfPublicId ?? null,
      statusHistory: (doc.statusHistory ?? []).map((h) => ({
        fromStatus: h.fromStatus ?? null,
        toStatus: h.toStatus,
        changedBy: h.changedBy ?? null,
        changedByName: h.changedByName ?? null,
        changedAt: h.changedAt,
        reason: h.reason ?? null,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isDeleted: doc.isDeleted,
    };
  }
}
