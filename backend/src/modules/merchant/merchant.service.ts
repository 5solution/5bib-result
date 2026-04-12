import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Repository } from 'typeorm';
import { Model } from 'mongoose';
import { Tenant } from './entities/tenant.entity';
import {
  MerchantConfig,
  MerchantConfigDocument,
  ContractStatus,
} from './schemas/merchant-config.schema';
import {
  MerchantFeeHistory,
  MerchantFeeHistoryDocument,
} from './schemas/merchant-fee-history.schema';
import { SearchMerchantsDto } from './dto/search-merchants.dto';
import { UpdateMerchantFeeDto } from './dto/update-merchant-fee.dto';
import { ApproveMerchantDto } from './dto/approve-merchant.dto';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Tenant, 'platform')
    private readonly tenantRepo: Repository<Tenant>,

    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,

    @InjectModel(MerchantFeeHistory.name)
    private readonly feeHistoryModel: Model<MerchantFeeHistoryDocument>,
  ) {}

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
    const tenantIds = tenants.map((t) => t.id);
    const configs = await this.configModel
      .find({ tenantId: { $in: tenantIds } })
      .lean()
      .exec();
    const configMap = new Map(configs.map((c) => [c.tenantId, c]));

    // 3. Merge MySQL + MongoDB
    let merged = tenants.map((t) =>
      this.mergeFormat(t, configMap.get(t.id) ?? null),
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

    // 5. Paginate in-memory (tổng số merchant chỉ ~58, OK)
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

  // ── Merge format helper ──────────────────────────────────────

  private mergeFormat(
    t: Tenant,
    config: Partial<MerchantConfig> | null,
  ) {
    return {
      id: t.id,
      name: t.name,
      tax_code: t.vat,
      // Platform approval (readonly from MySQL)
      is_approved: t.is_approved,
      api_token: t.api_token ? `${t.api_token.slice(0, 8)}••••` : null,
      owner_id: t.owner_id,
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
      // Contract / approval tracking từ MongoDB
      contract_status: config?.contract_status ?? 'pending',
      approved_at: config?.approved_at ?? null,
      approved_by: config?.approved_by ?? null,
      // Timestamps
      created_on: t.created_on,
    };
  }
}
