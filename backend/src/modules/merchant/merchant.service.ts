import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { Model } from 'mongoose';
import { ConflictException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import {
  MerchantConfig,
  MerchantConfigDocument,
  ContractStatus,
  EventFeeOverride,
} from './schemas/merchant-config.schema';
import {
  MerchantFeeHistory,
  MerchantFeeHistoryDocument,
} from './schemas/merchant-fee-history.schema';
import { SearchMerchantsDto } from './dto/search-merchants.dto';
import { UpdateMerchantFeeDto } from './dto/update-merchant-fee.dto';
import { UpdateMerchantCompanyDto } from './dto/update-merchant-company.dto';
import { ApproveMerchantDto } from './dto/approve-merchant.dto';
import {
  CreateEventFeeOverrideDto,
  UpdateEventFeeOverrideDto,
  EventFeeOverrideResponseDto,
} from './dto/event-fee-override.dto';
// F-043: Cross-DB validation raceId via RaceReadonly entity (named connection 'platform')
import { RaceReadonly } from '../promo-hub/entities/race-readonly.entity';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    @InjectRepository(Tenant, 'platform')
    private readonly tenantRepo: Repository<Tenant>,

    // F-043 BR-43-10: Cross-DB validation raceId via RaceReadonly (named conn 'platform')
    @InjectRepository(RaceReadonly, 'platform')
    private readonly raceRepo: Repository<RaceReadonly>,

    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,

    @InjectModel(MerchantFeeHistory.name)
    private readonly feeHistoryModel: Model<MerchantFeeHistoryDocument>,

    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /**
   * FEATURE-040 BR-40-11 — flush all `pnl:*:tenant=<tenantId>` cache keys
   * after fee config mutation. Uses scanStream + pipeline DEL for atomic
   * batch removal. Patterns covered:
   *   - pnl:ticket-sales-fee:*:tenant=<id>
   *   - pnl:fee-source:*:tenant=<id>
   *   - pnl:gross-gmv:*:tenant=<id>
   *   - pnl:fee-breakdown:*:tenant=<id>
   *
   * Also flushes aggregated dashboard/list keys (broader pattern `pnl:*`)
   * because tenant rate change may affect MANY contracts' aggregated totals.
   */
  private async flushPnLCacheForTenant(tenantId: number): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `pnl:*:tenant=${tenantId}`;
      const keys: string[] = [];
      // Use scanStream for non-blocking iteration. Match scoped pattern first.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.redis as any).scanStream({
        match: pattern,
        count: 200,
      });
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: string[]) => keys.push(...chunk));
        stream.on('end', () => resolve());
        stream.on('error', (e: Error) => reject(e));
      });
      if (keys.length > 0) {
        const pipe = this.redis.pipeline();
        for (const k of keys) pipe.del(k);
        await pipe.exec();
      }
      // Also flush aggregated dashboard + contracts-list keys (no tenant suffix)
      const aggKeys: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aggStream = (this.redis as any).scanStream({
        match: 'pnl:dashboard:*',
        count: 200,
      });
      await new Promise<void>((resolve, reject) => {
        aggStream.on('data', (chunk: string[]) => aggKeys.push(...chunk));
        aggStream.on('end', () => resolve());
        aggStream.on('error', (e: Error) => reject(e));
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listStream = (this.redis as any).scanStream({
        match: 'pnl:contracts-list:*',
        count: 200,
      });
      await new Promise<void>((resolve, reject) => {
        listStream.on('data', (chunk: string[]) => aggKeys.push(...chunk));
        listStream.on('end', () => resolve());
        listStream.on('error', (e: Error) => reject(e));
      });
      if (aggKeys.length > 0) {
        const pipe = this.redis.pipeline();
        for (const k of aggKeys) pipe.del(k);
        await pipe.exec();
      }
      this.logger.log(
        `[F-040] flushed PnL cache for tenantId=${tenantId} — scoped=${keys.length}, aggregated=${aggKeys.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `[F-040] flushPnLCacheForTenant fail tenantId=${tenantId}: ${(e as Error).message}`,
      );
    }
  }

  // ── List ─────────────────────────────────────────────────────

  async findAll(dto: SearchMerchantsDto) {
    const { q, approval, contract_status, fee_status, page = 0, pageSize = 20 } = dto;

    // 1. Query MySQL tenants (text search + approval filter)
    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .where('t.deleted = 0')
      .orderBy('t.created_on', 'DESC');

    if (q) {
      qb.andWhere(
        "(t.name LIKE :q OR t.vat LIKE :q OR JSON_UNQUOTE(JSON_EXTRACT(t.metadata, '$.email')) LIKE :q)",
        { q: `%${q}%` },
      );
    }

    if (approval === 'approved') {
      qb.andWhere('t.is_approved = 1');
    } else if (approval === 'pending') {
      qb.andWhere('t.is_approved = 0');
    }

    const tenants = await qb.getMany();

    // 2. Load tất cả MongoDB configs cho batch này
    // Note: MySQL bigint returns string, MongoDB stores number → normalize to number
    const tenantIds = tenants.map((t) => Number(t.id));
    const configs = await this.configModel
      .find({ tenantId: { $in: tenantIds } })
      .lean()
      .exec();
    const configMap = new Map(configs.map((c) => [c.tenantId, c]));

    // 3. Merge MySQL + MongoDB
    let merged = tenants.map((t) =>
      this.mergeFormat(t, configMap.get(Number(t.id)) ?? null),
    );

    // 4. Apply MongoDB-based filters (contract_status, fee_status)
    if (contract_status && contract_status !== 'all') {
      merged = merged.filter((m) => m.contract_status === contract_status);
    }
    if (fee_status === 'has_fee') {
      merged = merged.filter((m) => m.service_fee_rate !== null);
    } else if (fee_status === 'no_fee') {
      merged = merged.filter((m) => m.service_fee_rate === null);
    }

    // 5. Sort: starred first, then by created_on DESC
    merged.sort((a, b) => {
      if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
      return 0; // keep original order (already sorted by created_on DESC from MySQL)
    });

    // 6. Paginate in-memory (tổng số merchant chỉ ~58, OK)
    const total = merged.length;
    const totalPages = Math.ceil(total / pageSize);
    const list = merged.slice(page * pageSize, (page + 1) * pageSize);

    return {
      data: { list, total, totalPages, currentPage: page },
    };
  }

  // ── Detail ───────────────────────────────────────────────────

  async findOne(id: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!tenant) throw new NotFoundException(`Merchant #${id} không tồn tại`);

    const config = await this.configModel.findOne({ tenantId: id }).lean().exec();
    return { data: this.mergeFormat(tenant, config) };
  }

  // ── Update fee (write to MongoDB) ────────────────────────────

  async updateFee(id: number, dto: UpdateMerchantFeeDto, adminId?: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!tenant) throw new NotFoundException(`Merchant #${id} không tồn tại`);

    const { service_fee_rate, manual_fee_per_ticket, fee_vat_rate, fee_effective_date, note } = dto;

    if (
      service_fee_rate === undefined &&
      manual_fee_per_ticket === undefined &&
      fee_vat_rate === undefined
    ) {
      throw new BadRequestException('Phải cung cấp ít nhất một trường phí cần thay đổi');
    }

    // Lấy config hiện tại (hoặc tạo mới nếu chưa có)
    let config = await this.configModel.findOne({ tenantId: id }).exec();
    const historyDocs: Partial<MerchantFeeHistory>[] = [];

    if (!config) {
      config = new this.configModel({ tenantId: id });
    }

    if (service_fee_rate !== undefined) {
      historyDocs.push({
        tenantId: id,
        fee_field: 'service_fee_rate',
        old_value: config.service_fee_rate != null ? String(config.service_fee_rate) : null,
        new_value: String(service_fee_rate),
        changed_by: adminId ?? null,
        note,
      });
      config.service_fee_rate = service_fee_rate;
    }

    if (manual_fee_per_ticket !== undefined) {
      historyDocs.push({
        tenantId: id,
        fee_field: 'manual_fee_per_ticket',
        old_value: String(config.manual_fee_per_ticket ?? 5000),
        new_value: String(manual_fee_per_ticket),
        changed_by: adminId ?? null,
        note,
      });
      config.manual_fee_per_ticket = manual_fee_per_ticket;
    }

    if (fee_vat_rate !== undefined) {
      historyDocs.push({
        tenantId: id,
        fee_field: 'fee_vat_rate',
        old_value: String(config.fee_vat_rate ?? 0),
        new_value: String(fee_vat_rate),
        changed_by: adminId ?? null,
        note,
      });
      config.fee_vat_rate = fee_vat_rate;
    }

    if (fee_effective_date) {
      config.fee_effective_date = fee_effective_date;
    }

    await config.save();
    await this.feeHistoryModel.insertMany(historyDocs);

    // F-040 BR-40-11 — invalidate PnL cache for this tenant after fee change.
    // Affects: pnl:ticket-sales-fee, pnl:fee-source, pnl:gross-gmv,
    //          pnl:fee-breakdown (scoped) + aggregated dashboard/list (broad).
    if (
      service_fee_rate !== undefined ||
      manual_fee_per_ticket !== undefined ||
      fee_vat_rate !== undefined
    ) {
      await this.flushPnLCacheForTenant(id);
    }

    return { data: this.mergeFormat(tenant, config.toObject()) };
  }

  // ── Fee history (from MongoDB) ───────────────────────────────

  async getFeeHistory(id: number) {
    const history = await this.feeHistoryModel
      .find({ tenantId: id })
      .sort({ changed_at: -1 })
      .limit(50)
      .lean()
      .exec();
    return { data: history };
  }

  // ── Approve / Reject (write to MongoDB config) ───────────────

  async approve(id: number, dto: ApproveMerchantDto, adminId?: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!tenant) throw new NotFoundException(`Merchant #${id} không tồn tại`);

    let config = await this.configModel.findOne({ tenantId: id }).exec();
    if (!config) {
      config = new this.configModel({ tenantId: id });
    }

    if (dto.contract_status) {
      config.contract_status = dto.contract_status as ContractStatus;
    }

    if (dto.is_approved !== undefined && dto.is_approved) {
      config.approved_at = new Date();
      config.approved_by = adminId ?? null;
      config.rejection_note = null;
      if (!dto.contract_status) {
        config.contract_status = 'active';
      }
    }

    if (dto.rejection_note && dto.is_approved === false) {
      config.rejection_note = dto.rejection_note;
    }

    await config.save();
    return { data: this.mergeFormat(tenant, config.toObject()) };
  }

  // ── Toggle star (write to MongoDB) ────────────────────────────

  async toggleStar(id: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!tenant) throw new NotFoundException(`Merchant #${id} không tồn tại`);

    let config = await this.configModel.findOne({ tenantId: id }).exec();
    if (!config) {
      config = new this.configModel({ tenantId: id });
    }

    config.is_starred = !config.is_starred;
    await config.save();
    return { data: this.mergeFormat(tenant, config.toObject()) };
  }

  // ── Update company info (write to MongoDB) ───────────────────

  async updateCompany(id: number, dto: UpdateMerchantCompanyDto) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!tenant) throw new NotFoundException(`Merchant #${id} không tồn tại`);

    let config = await this.configModel.findOne({ tenantId: id }).exec();
    if (!config) {
      config = new this.configModel({ tenantId: id });
    }

    const fields = [
      'legal_name',
      'tax_code',
      'business_address',
      'representative_name',
      'representative_title',
      'bank_account',
      'bank_name',
      'bank_branch',
      'admin_note',
    ] as const;

    for (const field of fields) {
      if (dto[field] !== undefined) {
        (config as any)[field] = dto[field];
      }
    }

    await config.save();
    return { data: this.mergeFormat(tenant, config.toObject()) };
  }

  // ── Get races for a merchant (from MySQL) ───────────────────

  async getRaces(tenantId: number) {
    const sql = `
      SELECT r.race_id, r.title, r.created_on, r.modified_on
      FROM races r
      WHERE r.tenant_id = ?
      ORDER BY r.created_on DESC
    `;
    const races = await this.tenantRepo.manager.query(sql, [tenantId]);
    return { data: races };
  }

  // ── Merge format helper ──────────────────────────────────────

  private mergeFormat(
    t: Tenant,
    config: Partial<MerchantConfig> | null,
  ) {
    return {
      id: Number(t.id),
      name: t.name,
      tax_code: t.vat,
      // Platform approval (readonly from MySQL)
      is_approved: t.is_approved,
      api_token: t.api_token ? `${t.api_token.slice(0, 8)}••••` : null,
      owner_id: t.owner_id ? Number(t.owner_id) : null,
      // Contact info từ metadata JSON (platform data)
      contact_name: t.metadata?.name ?? t.metadata?.companyName ?? null,
      contact_email: t.metadata?.email ?? null,
      contact_phone: t.metadata?.phone ?? null,
      address: t.metadata?.address ?? null,
      website: t.metadata?.website ?? null,
      company_name: t.metadata?.companyName ?? null,
      company_tax: t.metadata?.companyTax ?? t.vat ?? null,
      // Fee config từ MongoDB
      service_fee_rate: config?.service_fee_rate ?? null,
      manual_fee_per_ticket: config?.manual_fee_per_ticket ?? 5000,
      fee_vat_rate: config?.fee_vat_rate ?? 0,
      fee_effective_date: config?.fee_effective_date ?? null,
      fee_note: config?.fee_note ?? null,
      // Starred / Contract / approval tracking từ MongoDB
      is_starred: config?.is_starred ?? false,
      contract_status: config?.contract_status ?? 'pending',
      approved_at: config?.approved_at ?? null,
      approved_by: config?.approved_by ?? null,
      // Thông tin công ty (admin chỉnh sửa, lưu MongoDB)
      legal_name: config?.legal_name ?? null,
      admin_tax_code: config?.tax_code ?? null,
      business_address: config?.business_address ?? null,
      representative_name: config?.representative_name ?? null,
      representative_title: config?.representative_title ?? null,
      bank_account: config?.bank_account ?? null,
      bank_name: config?.bank_name ?? null,
      bank_branch: config?.bank_branch ?? null,
      admin_note: config?.admin_note ?? null,
      // Timestamps
      created_on: t.created_on,
    };
  }

  // ════════════════════════════════════════════════════════════
  // F-043 — Event-level fee override CRUD
  // ════════════════════════════════════════════════════════════

  /**
   * F-043 BR-43-10 — Validate raceId tồn tại trong MySQL platform `races`.
   * Throw 400 nếu raceId không hợp lệ. Trả về race entity nếu OK.
   */
  private async validateRaceExists(raceId: number): Promise<RaceReadonly> {
    // RaceReadonly.raceId là bigint string (MySQL `races.race_id`) — convert.
    const race = await this.raceRepo.findOne({
      where: { raceId: String(raceId) },
    });
    if (!race) {
      throw new BadRequestException({
        message: `Sự kiện #${raceId} không tồn tại trong hệ thống`,
        code: 'RACE_NOT_FOUND',
      });
    }
    return race;
  }

  /**
   * F-043 BR-43-12 — Insert audit log per field change.
   * fee_field naming: `event_override.<raceId>.<field>` để phân biệt với
   * regular merchant-level fee history.
   */
  private async logEventOverrideAudit(
    tenantId: number,
    raceId: number,
    field: 'service_fee_rate' | 'manual_fee_per_ticket' | 'fee_vat_rate',
    oldVal: number | null | undefined,
    newVal: number | null | undefined,
    adminId: number | null,
    note?: string | null,
  ): Promise<void> {
    // Skip nếu không thay đổi (treat undefined == null cho comparison)
    if ((oldVal ?? null) === (newVal ?? null)) return;
    await this.feeHistoryModel.create({
      tenantId,
      fee_field: `event_override.${raceId}.${field}`,
      old_value: oldVal != null ? String(oldVal) : null,
      new_value: newVal != null ? String(newVal) : null,
      changed_by: adminId,
      note: note ?? null,
    });
  }

  /**
   * F-043 — Format override sub-document → response DTO với raceName joined.
   * Skip raceName join nếu race không còn tồn tại (graceful — admin sẽ thấy "—").
   */
  private async formatOverrideResponse(
    override: EventFeeOverride,
  ): Promise<EventFeeOverrideResponseDto> {
    let raceName: string | null = null;
    try {
      const race = await this.raceRepo.findOne({
        where: { raceId: String(override.raceId) },
      });
      raceName = race?.title ?? null;
    } catch {
      // Cross-DB unreachable → graceful null (UI render "—")
    }
    return {
      raceId: override.raceId,
      raceName,
      service_fee_rate: override.service_fee_rate,
      manual_fee_per_ticket: override.manual_fee_per_ticket,
      fee_vat_rate: override.fee_vat_rate,
      effective_from: override.effective_from,
      note: override.note,
      createdBy: override.createdBy,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }

  /**
   * F-043 — GET list event fee overrides của 1 merchant.
   * Sort by effective_from DESC. Race name joined for UI display.
   */
  async listEventFeeOverrides(
    tenantId: number,
  ): Promise<EventFeeOverrideResponseDto[]> {
    // Verify tenant exists
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId, deleted: false },
    });
    if (!tenant) {
      throw new NotFoundException(`Merchant #${tenantId} không tồn tại`);
    }

    const config = await this.configModel.findOne({ tenantId }).lean();
    const overrides = (config?.event_fee_overrides ?? []) as EventFeeOverride[];

    // Sort by effective_from DESC (latest first)
    const sorted = [...overrides].sort((a, b) =>
      b.effective_from.localeCompare(a.effective_from),
    );

    // Format mỗi entry với raceName joined
    return Promise.all(sorted.map((o) => this.formatOverrideResponse(o)));
  }

  /**
   * F-043 — Create event fee override.
   * BR-43-04: Unique (tenantId, raceId) — 409 nếu duplicate.
   * BR-43-10: Validate raceId cross-DB.
   * BR-43-12: Audit log per field set.
   * BR-43-14: Flush cache patterns sau mutation.
   */
  async createEventFeeOverride(
    tenantId: number,
    dto: CreateEventFeeOverrideDto,
    adminId: number | null,
  ): Promise<EventFeeOverrideResponseDto> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId, deleted: false },
    });
    if (!tenant) {
      throw new NotFoundException(`Merchant #${tenantId} không tồn tại`);
    }

    // BR-43-10 Cross-DB validation
    await this.validateRaceExists(dto.raceId);

    // Get or create MerchantConfig (lazy)
    let config = await this.configModel.findOne({ tenantId });
    if (!config) {
      config = new this.configModel({ tenantId });
    }

    // BR-43-04 Unique constraint check
    const existing = config.event_fee_overrides?.find(
      (o) => o.raceId === dto.raceId,
    );
    if (existing) {
      throw new ConflictException({
        message: `Override cho sự kiện #${dto.raceId} đã tồn tại — dùng PUT để cập nhật`,
        code: 'EVENT_OVERRIDE_DUPLICATE',
      });
    }

    // Build new override (timestamps auto by sub-schema)
    const newOverride: Partial<EventFeeOverride> = {
      raceId: dto.raceId,
      service_fee_rate: dto.service_fee_rate ?? null,
      manual_fee_per_ticket: dto.manual_fee_per_ticket ?? null,
      fee_vat_rate: dto.fee_vat_rate ?? null,
      effective_from: dto.effective_from,
      note: dto.note ?? null,
      createdBy: adminId,
    };
    config.event_fee_overrides = [
      ...(config.event_fee_overrides ?? []),
      newOverride as EventFeeOverride,
    ];
    await config.save();

    // BR-43-12 Audit log — only fields explicitly set (non-null)
    await Promise.all([
      this.logEventOverrideAudit(
        tenantId,
        dto.raceId,
        'service_fee_rate',
        null,
        dto.service_fee_rate,
        adminId,
        dto.note,
      ),
      this.logEventOverrideAudit(
        tenantId,
        dto.raceId,
        'manual_fee_per_ticket',
        null,
        dto.manual_fee_per_ticket,
        adminId,
        dto.note,
      ),
      this.logEventOverrideAudit(
        tenantId,
        dto.raceId,
        'fee_vat_rate',
        null,
        dto.fee_vat_rate,
        adminId,
        dto.note,
      ),
    ]);

    // BR-43-14 Cache flush
    await this.flushPnLCacheForTenant(tenantId);
    await this.flushEventOverrideCache(tenantId);

    const saved = config.event_fee_overrides[config.event_fee_overrides.length - 1];
    return this.formatOverrideResponse(saved);
  }

  /**
   * F-043 — Update existing event fee override (raceId immutable, từ path).
   * Throw 404 nếu override không tồn tại.
   */
  async updateEventFeeOverride(
    tenantId: number,
    raceId: number,
    dto: UpdateEventFeeOverrideDto,
    adminId: number | null,
  ): Promise<EventFeeOverrideResponseDto> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId, deleted: false },
    });
    if (!tenant) {
      throw new NotFoundException(`Merchant #${tenantId} không tồn tại`);
    }

    const config = await this.configModel.findOne({ tenantId });
    const override = config?.event_fee_overrides?.find(
      (o) => o.raceId === raceId,
    );
    if (!config || !override) {
      throw new NotFoundException(
        `Override cho sự kiện #${raceId} của merchant #${tenantId} không tồn tại`,
      );
    }

    // Capture old values for audit
    const oldRate = override.service_fee_rate;
    const oldManual = override.manual_fee_per_ticket;
    const oldVat = override.fee_vat_rate;

    // Apply patch (only fields present in dto)
    if (dto.service_fee_rate !== undefined) {
      override.service_fee_rate = dto.service_fee_rate;
    }
    if (dto.manual_fee_per_ticket !== undefined) {
      override.manual_fee_per_ticket = dto.manual_fee_per_ticket;
    }
    if (dto.fee_vat_rate !== undefined) {
      override.fee_vat_rate = dto.fee_vat_rate;
    }
    if (dto.effective_from !== undefined) {
      override.effective_from = dto.effective_from;
    }
    if (dto.note !== undefined) {
      override.note = dto.note ?? null;
    }

    // Mongoose mutates nested array — need to mark modified
    config.markModified('event_fee_overrides');
    await config.save();

    // Audit per field change (helper skips if old===new)
    if (dto.service_fee_rate !== undefined) {
      await this.logEventOverrideAudit(
        tenantId,
        raceId,
        'service_fee_rate',
        oldRate,
        dto.service_fee_rate,
        adminId,
        dto.note,
      );
    }
    if (dto.manual_fee_per_ticket !== undefined) {
      await this.logEventOverrideAudit(
        tenantId,
        raceId,
        'manual_fee_per_ticket',
        oldManual,
        dto.manual_fee_per_ticket,
        adminId,
        dto.note,
      );
    }
    if (dto.fee_vat_rate !== undefined) {
      await this.logEventOverrideAudit(
        tenantId,
        raceId,
        'fee_vat_rate',
        oldVat,
        dto.fee_vat_rate,
        adminId,
        dto.note,
      );
    }

    await this.flushPnLCacheForTenant(tenantId);
    await this.flushEventOverrideCache(tenantId);

    return this.formatOverrideResponse(override);
  }

  /**
   * F-043 — Delete event fee override.
   * Audit 3 history docs (1 per field) với new_value=null.
   */
  async deleteEventFeeOverride(
    tenantId: number,
    raceId: number,
    adminId: number | null,
  ): Promise<{ success: true; deletedRaceId: number }> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId, deleted: false },
    });
    if (!tenant) {
      throw new NotFoundException(`Merchant #${tenantId} không tồn tại`);
    }

    const config = await this.configModel.findOne({ tenantId });
    const override = config?.event_fee_overrides?.find(
      (o) => o.raceId === raceId,
    );
    if (!config || !override) {
      throw new NotFoundException(
        `Override cho sự kiện #${raceId} của merchant #${tenantId} không tồn tại`,
      );
    }

    // Capture old values trước khi xoá để audit
    const oldRate = override.service_fee_rate;
    const oldManual = override.manual_fee_per_ticket;
    const oldVat = override.fee_vat_rate;

    // Filter out the override
    config.event_fee_overrides = config.event_fee_overrides.filter(
      (o) => o.raceId !== raceId,
    );
    await config.save();

    // Audit — 3 docs với new_value=null
    await Promise.all([
      this.logEventOverrideAudit(
        tenantId,
        raceId,
        'service_fee_rate',
        oldRate,
        null,
        adminId,
        'Override deleted',
      ),
      this.logEventOverrideAudit(
        tenantId,
        raceId,
        'manual_fee_per_ticket',
        oldManual,
        null,
        adminId,
        'Override deleted',
      ),
      this.logEventOverrideAudit(
        tenantId,
        raceId,
        'fee_vat_rate',
        oldVat,
        null,
        adminId,
        'Override deleted',
      ),
    ]);

    await this.flushPnLCacheForTenant(tenantId);
    await this.flushEventOverrideCache(tenantId);

    return { success: true, deletedRaceId: raceId };
  }

  /**
   * F-043 BR-43-14 — Flush event override cache key (TTL 3600s).
   * Pattern: `merchant:fee-overrides:<tenantId>`
   *
   * F-058 BR-58-06 — Extend flush thêm 6 analytics pattern qua scanStream
   * (per conventions.md Pattern 1: Dual-pattern cache flush helper).
   * Trigger trên POST/PUT/DELETE event override.
   */
  private async flushEventOverrideCache(tenantId: number): Promise<void> {
    if (!this.redis) return;

    // F-043 — single-key DEL existing
    try {
      await this.redis.del(`merchant:fee-overrides:${tenantId}`);
    } catch (e) {
      this.logger.warn(
        `[F-043] flushEventOverrideCache fail tenantId=${tenantId}: ${(e as Error).message}`,
      );
    }

    // F-058 — 6 analytics pattern flush. Override mutation invalidates ALL
    // analytics cache vì cascade Tier 0 ảnh hưởng aggregate per tenant.
    const ANALYTICS_FLUSH_PATTERNS = [
      'analytics:overview:*',
      'analytics:daily:*',
      'analytics:top-races:*',
      'analytics:rev-by-cat:*',
      'analytics:merchants:*',
      'analytics:races:*',
    ];
    for (const pattern of ANALYTICS_FLUSH_PATTERNS) {
      try {
        const stream = (
          this.redis as unknown as {
            scanStream: (opts: { match: string; count: number }) => NodeJS.ReadableStream;
          }
        ).scanStream({ match: pattern, count: 200 });
        const pipeline = this.redis.pipeline();
        let count = 0;
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            for (const k of keys) {
              pipeline.del(k);
              count++;
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', (err: Error) => reject(err));
        });
        if (count > 0) await pipeline.exec();
      } catch (e) {
        this.logger.warn(
          `[F-058] flush ${pattern} fail tenantId=${tenantId}: ${(e as Error).message}`,
        );
      }
    }
  }
}
