import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MerchantFeeHistoryDocument = MerchantFeeHistory & Document;
export type FeeField = 'service_fee_rate' | 'manual_fee_per_ticket' | 'fee_vat_rate';

/**
 * Audit log mỗi lần thay đổi cấu hình phí của merchant.
 */
@Schema({ collection: 'merchant_fee_histories', timestamps: false })
export class MerchantFeeHistory {
  @Prop({ required: true, index: true })
  tenantId: number;

  /** Trường phí nào thay đổi */
  @Prop({
    required: true,
    enum: ['service_fee_rate', 'manual_fee_per_ticket', 'fee_vat_rate'],
  })
  fee_field: FeeField;

  /** Giá trị cũ (string để chứa cả % và số nguyên) */
  @Prop({ type: String, default: null })
  old_value: string | null;

  /** Giá trị mới */
  @Prop({ required: true })
  new_value: string;

  @Prop({ type: Date, default: () => new Date() })
  changed_at: Date;

  /** Admin ID đã thay đổi */
  @Prop({ type: Number, default: null })
  changed_by: number | null;

  /** Lý do thay đổi — bắt buộc */
  @Prop({ required: true })
  note: string;
}

export const MerchantFeeHistorySchema = SchemaFactory.createForClass(MerchantFeeHistory);
