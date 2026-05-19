import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MerchantConfigDocument = MerchantConfig & Document;

export type ContractStatus = 'pending' | 'active' | 'suspended' | 'terminated';

/**
 * F-043: Event-level fee override sub-document.
 *
 * Cho phép merchant có mức phí khác nhau cho từng sự kiện (raceId từ MySQL
 * platform). Mỗi field rate/manual/vat NULL = fallback merchant default.
 *
 * Lookup priority trong `fee.service.computeSelfFee()` (BR-43-05):
 *   1. event_fee_overrides[raceId] AND effective_from <= periodFrom (TIER 0)
 *   2. MerchantConfig.<field> (TIER 1 — merchant default)
 *   3. contract.revenueShare.feePercentage (TIER 2 — chỉ cho service_fee_rate)
 *   4. hardcoded default 5.5% / 5000 VNĐ / 0% (TIER 3)
 *
 * Per-tenant per-raceId là unique constraint (BR-43-04).
 */
@Schema({ _id: false, timestamps: true })
export class EventFeeOverride {
  /** MySQL platform race.id — phải tồn tại trong `races` table */
  @Prop({ type: Number, required: true })
  raceId: number;

  /** % phí dịch vụ — null = dùng merchant.service_fee_rate */
  @Prop({ type: Number, default: null })
  service_fee_rate: number | null;

  /** Phí cố định VNĐ/vé cho MANUAL — null = dùng merchant.manual_fee_per_ticket */
  @Prop({ type: Number, default: null })
  manual_fee_per_ticket: number | null;

  /** % VAT trên fee — null = dùng merchant.fee_vat_rate */
  @Prop({ type: Number, default: null })
  fee_vat_rate: number | null;

  /** Ngày bắt đầu áp dụng (YYYY-MM-DD) — required cho versioning per BR-43-07 */
  @Prop({ type: String, required: true })
  effective_from: string;

  /** Ghi chú admin */
  @Prop({ type: String, default: null })
  note: string | null;

  /** ID admin tạo override */
  @Prop({ type: Number, default: null })
  createdBy: number | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EventFeeOverrideSchema = SchemaFactory.createForClass(EventFeeOverride);

/**
 * Config mở rộng của merchant — lưu trong MongoDB của 5bib-result.
 * Keyed bằng tenantId từ MySQL 5bib_platform_live.tenant.id
 */
@Schema({ collection: 'merchant_configs', timestamps: true })
export class MerchantConfig {
  /** ID tham chiếu đến tenant.id trong MySQL platform DB */
  @Prop({ required: true, unique: true, index: true })
  tenantId: number;

  /** Tỉ lệ phí dịch vụ (%) áp dụng cho đơn ORDINARY/PERSONAL_GROUP/CHANGE_COURSE */
  @Prop({ type: Number, default: null })
  service_fee_rate: number | null;

  /** Phí cố định VNĐ/vé cho đơn MANUAL */
  @Prop({ type: Number, default: 5000 })
  manual_fee_per_ticket: number;

  /** VAT trên tiền phí dịch vụ (%) — thường 0 hoặc 8 */
  @Prop({ type: Number, default: 0 })
  fee_vat_rate: number;

  /** Ngày bắt đầu áp dụng tỉ lệ phí hiện tại */
  @Prop({ type: String, default: null })
  fee_effective_date: string | null;

  /** Ghi chú về phí */
  @Prop({ type: String, default: null })
  fee_note: string | null;

  /** Trạng thái hợp đồng — ta tự quản lý, không phụ thuộc vào MySQL */
  @Prop({
    type: String,
    enum: ['pending', 'active', 'suspended', 'terminated'],
    default: 'pending',
  })
  contract_status: ContractStatus;

  /** Thời điểm được duyệt trong hệ thống admin này */
  @Prop({ type: Date, default: null })
  approved_at: Date | null;

  /** Admin ID đã duyệt */
  @Prop({ type: Number, default: null })
  approved_by: number | null;

  /** Ghi chú lý do từ chối */
  @Prop({ type: String, default: null })
  rejection_note: string | null;

  /** Đánh dấu merchant quan trọng — hiển thị đầu danh sách */
  @Prop({ type: Boolean, default: false })
  is_starred: boolean;

  // ── Thông tin công ty (admin tự chỉnh sửa) ──────────────

  /** Tên pháp nhân / tên công ty chính thức (khác với tên hiển thị trên platform) */
  @Prop({ type: String, default: null })
  legal_name: string | null;

  /** Mã số thuế (admin nhập, có thể khác với vat trên platform) */
  @Prop({ type: String, default: null })
  tax_code: string | null;

  /** Địa chỉ đăng ký kinh doanh */
  @Prop({ type: String, default: null })
  business_address: string | null;

  /** Người đại diện pháp luật */
  @Prop({ type: String, default: null })
  representative_name: string | null;

  /** Chức vụ người đại diện */
  @Prop({ type: String, default: null })
  representative_title: string | null;

  /** Số tài khoản ngân hàng */
  @Prop({ type: String, default: null })
  bank_account: string | null;

  /** Tên ngân hàng */
  @Prop({ type: String, default: null })
  bank_name: string | null;

  /** Chi nhánh ngân hàng */
  @Prop({ type: String, default: null })
  bank_branch: string | null;

  /** Ghi chú admin */
  @Prop({ type: String, default: null })
  admin_note: string | null;

  // ── F-043: Event-level fee overrides ────────────────────
  /**
   * Array of fee overrides per race event. Empty default — existing 58
   * configs lazy default `[]` (no migration needed per BR-43-02).
   *
   * Lookup priority documented in `EventFeeOverride` schema docstring.
   */
  @Prop({ type: [EventFeeOverrideSchema], default: [] })
  event_fee_overrides: EventFeeOverride[];
}

export const MerchantConfigSchema = SchemaFactory.createForClass(MerchantConfig);

// F-043 BR-43-03 — Compound index cho fast event override lookup
// theo (tenantId, event_fee_overrides.raceId)
MerchantConfigSchema.index({
  tenantId: 1,
  'event_fee_overrides.raceId': 1,
});
