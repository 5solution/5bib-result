import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MerchantConfigDocument = MerchantConfig & Document;

export type ContractStatus = 'pending' | 'active' | 'suspended' | 'terminated';

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
}

export const MerchantConfigSchema = SchemaFactory.createForClass(MerchantConfig);
