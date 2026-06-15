import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { env } from '../../../config';
import {
  IGLOO_ACTIVE_STATUSES,
  IGLOO_MAX_RETRY,
  IGLOO_TERMINAL_STATUSES,
  IglooStatus,
} from '../igloo-insurance.constants';
import {
  IglooInsuranceRequest,
  IglooInsuranceRequestDocument,
} from '../schemas/igloo-insurance-request.schema';
import {
  CreateIglooRequestsResultDto,
  EligibleAthleteDto,
  EligibleAthleteListDto,
  IglooConfigDto,
  IglooRaceDto,
  IglooRequestDto,
  IglooRequestListDto,
} from '../dto/igloo-response.dto';
import {
  buildIglooPayload,
  buildPartnerRefId,
  computeCoverage,
  computePremium,
  LegacyAthleteRow,
  normalizeGender,
  normalizePhone,
  toYmd,
} from '../utils/igloo-helpers';
import { IglooSelectionService } from './igloo-selection.service';

interface QueueRowInput {
  row: LegacyAthleteRow;
  source: 'cron' | 'manual';
  actor: string;
}

@Injectable()
export class IglooRequestService {
  private readonly logger = new Logger(IglooRequestService.name);

  constructor(
    @InjectModel(IglooInsuranceRequest.name)
    private readonly model: Model<IglooInsuranceRequestDocument>,
    private readonly selection: IglooSelectionService,
  ) {}

  // ───────────── Config / read ─────────────

  getConfig(): IglooConfigDto {
    return {
      dailyEnabled: env.igloo.dailyEnabled,
      submitEnabled: env.igloo.submitEnabled,
      dailyCount: env.igloo.dailyCount,
    };
  }

  async listUpcomingRaces(): Promise<IglooRaceDto[]> {
    const races = await this.selection.listUpcomingRaces();
    return races.map((r) => ({
      mysqlRaceId: Number(r.mysqlRaceId),
      title: r.title,
      eventStartDate: r.eventStartDate ? new Date(r.eventStartDate).toISOString() : null,
      eventEndDate: r.eventEndDate ? new Date(r.eventEndDate).toISOString() : null,
      raceType: r.raceType,
    }));
  }

  /** VĐV eligible của 1 giải + cờ hasOrder (BR-IGL-12 manual select). */
  async listEligibleAthletes(
    raceId: number,
    q: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<EligibleAthleteListDto> {
    const { rows, total } = await this.selection.findEligibleForRace(raceId, {
      q,
      page,
      pageSize,
    });
    const existing = await this.existingActivePartnerRefIds(
      raceId,
      rows.map((r) => r.athletes_id),
    );
    const items: EligibleAthleteDto[] = rows.map((r) => ({
      athletesId: r.athletes_id,
      fullName: (r.name ?? '').trim(),
      bib: r.bib_number,
      gender: normalizeGender(r.gender) === 'FEMALE' ? 'Nữ' : 'Nam',
      dateOfBirth: toYmd(r.dob),
      idCard: String(r.id_number ?? '').trim(),
      phone: normalizePhone(r.contact_phone) ?? '',
      email: (r.email ?? '').trim(),
      hasOrder: existing.has(buildPartnerRefId(r.athletes_id, raceId)),
    }));
    return { items, total, page, pageSize };
  }

  async list(filter: {
    status?: string;
    raceId?: number;
    page: number;
    pageSize: number;
  }): Promise<IglooRequestListDto> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.raceId) query.mysqlRaceId = filter.raceId;
    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize)
        .lean<IglooInsuranceRequest[]>()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return {
      items: docs.map((d) => this.toDto(d)),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async getOne(id: string): Promise<IglooRequestDto> {
    const doc = await this.model.findById(id).lean<IglooInsuranceRequest>().exec();
    if (!doc) throw new NotFoundException('Không tìm thấy đơn');
    return this.toDto(doc);
  }

  // ───────────── Create (manual + cron) ─────────────

  /** Manual create (BR-IGL-12). */
  async createBatch(
    raceId: number,
    athleteIds: number[],
    actor: string,
  ): Promise<CreateIglooRequestsResultDto> {
    const skipped: CreateIglooRequestsResultDto['skipped'] = [];
    let created = 0;
    let totalPremium = 0;

    const existing = await this.existingActivePartnerRefIds(raceId, athleteIds);

    for (const athletesId of athleteIds) {
      const refId = buildPartnerRefId(athletesId, raceId);
      if (existing.has(refId)) {
        skipped.push({ athletesId, reason: 'ALREADY_HAS_ORDER' });
        continue;
      }
      const row = await this.selection.findRow(athletesId, raceId);
      if (!row) {
        skipped.push({ athletesId, reason: 'NOT_ELIGIBLE' });
        continue;
      }
      const ok = await this.queueOne({ row, source: 'manual', actor });
      if (ok) {
        created += 1;
        totalPremium += computePremium().totalPayment;
      } else {
        skipped.push({ athletesId, reason: 'ALREADY_HAS_ORDER' });
      }
    }

    this.logger.log(
      `[create] actor=${actor} race=${raceId} created=${created} skipped=${skipped.length}`,
    );
    return { created, skipped, totalPremium };
  }

  /** Cron daily — chọn + queue đúng `count` (BR-IGL-02/05). */
  async selectAndQueueDaily(count: number): Promise<number> {
    const buffer = count * 4;
    const today = await this.selection.findNewTodayCandidates(buffer);
    let queued = await this.queueFromCandidates(today, count, 'cron');

    if (queued < count) {
      const pool = await this.selection.findPoolCandidates(count * 6);
      queued += await this.queueFromCandidates(pool, count - queued, 'cron');
    }
    this.logger.log(`[daily] queued=${queued}/${count}`);
    return queued;
  }

  private async queueFromCandidates(
    rows: LegacyAthleteRow[],
    need: number,
    actor: string,
  ): Promise<number> {
    let queued = 0;
    for (const row of rows) {
      if (queued >= need) break;
      const refId = buildPartnerRefId(row.athletes_id, row.race_id);
      const exists = await this.model.exists({
        partnerRefId: refId,
        status: { $in: IGLOO_ACTIVE_STATUSES },
      });
      if (exists) continue;
      const ok = await this.queueOne({ row, source: 'cron', actor });
      if (ok) queued += 1;
    }
    return queued;
  }

  /** Insert 1 row QUEUED. Trả false nếu trùng (E11000). */
  private async queueOne(input: QueueRowInput): Promise<boolean> {
    const { row, source, actor } = input;
    const payload = buildIglooPayload(row);
    const coverage = computeCoverage(row.event_start_date)!;
    const premium = computePremium();
    try {
      await this.model.create({
        partnerRefId: payload.partnerRefId,
        iglooRequestId: null,
        status: 'QUEUED',
        source,
        createdByActor: actor,
        athletesId: row.athletes_id,
        mysqlRaceId: row.race_id,
        raceTitle: row.race_title,
        bib: row.bib_number,
        insuredName: payload.insured.name,
        insuredIdCard: payload.insured.idCard,
        packageCode: payload.coverage.packageCode,
        coverageFrom: new Date(coverage.from),
        coverageTo: new Date(coverage.to),
        totalDays: coverage.totalDays,
        premium: premium.premium,
        premiumVat: premium.premiumVat,
        totalPayment: premium.totalPayment,
        retryCount: 0,
        payloadSnapshot: payload,
      });
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return false; // duplicate
      throw err;
    }
  }

  // ───────────── Submit-worker hooks ─────────────

  async getQueuedToSubmit(limit: number): Promise<IglooInsuranceRequestDocument[]> {
    return this.model
      .find({ status: 'QUEUED' })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  async markSubmitted(id: string, iglooRequestId: string): Promise<void> {
    await this.model
      .findByIdAndUpdate(id, {
        $set: { status: 'PENDING', iglooRequestId, errorMessage: null },
      })
      .exec();
  }

  async markFailed(id: string, message: string): Promise<void> {
    await this.model
      .findByIdAndUpdate(id, {
        $set: { status: 'FAILED', errorMessage: message.slice(0, 500) },
      })
      .exec();
  }

  // ───────────── Poll-worker hooks ─────────────

  async getToPoll(limit: number): Promise<IglooInsuranceRequestDocument[]> {
    return this.model
      .find({
        status: { $nin: IGLOO_TERMINAL_STATUSES },
        iglooRequestId: { $ne: null },
      })
      .sort({ lastPolledAt: 1 })
      .limit(limit)
      .exec();
  }

  async applyStatus(
    id: string,
    status: IglooStatus,
    gicContractNo: string | null,
    certificateUrl: string | null,
  ): Promise<void> {
    await this.model
      .findByIdAndUpdate(id, {
        $set: {
          status,
          gicContractNo,
          certificateUrl,
          lastPolledAt: new Date(),
        },
      })
      .exec();
  }

  // ───────────── Retry (BR-IGL-11) ─────────────

  async retry(id: string): Promise<IglooRequestDto> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy đơn');
    if (doc.status !== 'FAILED') {
      throw new BadRequestException('Chỉ retry được đơn ở trạng thái Thất bại');
    }
    if (doc.retryCount >= IGLOO_MAX_RETRY) {
      throw new BadRequestException('Đơn đã vượt số lần thử lại tối đa');
    }
    // Nếu đã có iglooRequestId (fail ở bước lấy cert) → re-poll thay vì tạo mới.
    doc.status = doc.iglooRequestId ? 'PENDING' : 'QUEUED';
    doc.retryCount += 1;
    doc.errorMessage = null;
    await doc.save();
    return this.toDto(doc.toObject() as IglooInsuranceRequest);
  }

  // ───────────── helpers ─────────────

  private async existingActivePartnerRefIds(
    raceId: number,
    athleteIds: number[],
  ): Promise<Set<string>> {
    if (!athleteIds.length) return new Set();
    const refIds = athleteIds.map((id) => buildPartnerRefId(id, raceId));
    const docs = await this.model
      .find({
        partnerRefId: { $in: refIds },
        status: { $in: IGLOO_ACTIVE_STATUSES },
      })
      .select('partnerRefId')
      .lean<{ partnerRefId: string }[]>()
      .exec();
    return new Set(docs.map((d) => d.partnerRefId));
  }

  private toDto(d: IglooInsuranceRequest & { _id?: unknown }): IglooRequestDto {
    return {
      id: String(d._id),
      status: d.status,
      packageCode: d.packageCode,
      insuredName: d.insuredName,
      insuredIdCard: d.insuredIdCard,
      bib: d.bib,
      raceTitle: d.raceTitle,
      mysqlRaceId: d.mysqlRaceId,
      totalPayment: d.totalPayment,
      source: d.source,
      gicContractNo: d.gicContractNo,
      certificateUrl: d.certificateUrl,
      errorMessage: d.errorMessage,
      retryCount: d.retryCount,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
    };
  }
}
