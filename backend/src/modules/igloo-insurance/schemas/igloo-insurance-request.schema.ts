import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  IGLOO_SOURCES,
  IGLOO_STATUSES,
  IglooSource,
  IglooStatus,
} from '../igloo-insurance.constants';
import { CreateIglooRequestPayload } from '../utils/igloo-helpers';

export type IglooInsuranceRequestDocument =
  HydratedDocument<IglooInsuranceRequest>;

/**
 * FEATURE-085 — `igloo_insurance_requests`. 1 doc = 1 đơn bảo hiểm (cron hoặc
 * manual). Idempotency qua unique `partnerRefId` (BR-IGL-06). Danny chốt KHÔNG
 * mask PII → `insuredIdCard` lưu đầy đủ.
 */
@Schema({
  collection: 'igloo_insurance_requests',
  timestamps: true,
})
export class IglooInsuranceRequest {
  /** `igloo:<athletesId>:<mysqlRaceId>` — unique idempotency key. */
  @Prop({ required: true, unique: true, index: true })
  partnerRefId!: string;

  /** requestId Igloo trả về (202). null cho tới khi submit thành công. */
  @Prop({ type: String, default: null })
  iglooRequestId!: string | null;

  @Prop({
    required: true,
    enum: IGLOO_STATUSES,
    default: 'QUEUED',
    index: true,
  })
  status!: IglooStatus;

  @Prop({ required: true, enum: IGLOO_SOURCES })
  source!: IglooSource;

  /** Admin id (manual) hoặc 'cron'. */
  @Prop({ required: true })
  createdByActor!: string;

  @Prop({ required: true, index: true })
  athletesId!: number;

  @Prop({ required: true, index: true })
  mysqlRaceId!: number;

  @Prop({ type: String, default: null })
  raceTitle!: string | null;

  @Prop({ type: String, default: null })
  bib!: string | null;

  @Prop({ required: true })
  insuredName!: string;

  /** CCCD đầy đủ — Danny chốt KHÔNG mask (BR-IGL-14). */
  @Prop({ required: true })
  insuredIdCard!: string;

  @Prop({ required: true, default: 'ROAD' })
  packageCode!: string;

  @Prop({ type: Date, required: true })
  coverageFrom!: Date;

  @Prop({ type: Date, required: true })
  coverageTo!: Date;

  @Prop({ required: true, default: 1 })
  totalDays!: number;

  @Prop({ required: true })
  premium!: number;

  @Prop({ required: true })
  premiumVat!: number;

  @Prop({ required: true })
  totalPayment!: number;

  @Prop({ type: String, default: null })
  gicContractNo!: string | null;

  @Prop({ type: String, default: null })
  certificateUrl!: string | null;

  @Prop({ type: String, default: null })
  errorMessage!: string | null;

  @Prop({ required: true, default: 0 })
  retryCount!: number;

  @Prop({ type: Date, default: null })
  lastPolledAt!: Date | null;

  /**
   * Snapshot payload Igloo (frozen lúc chọn VĐV). submit-worker POST nguyên
   * cái này → tách selection khỏi submission, data không đổi giữa chừng.
   * Chứa PII đầy đủ (Danny chốt KHÔNG mask).
   */
  @Prop({ type: Object, required: true })
  payloadSnapshot!: CreateIglooRequestPayload;

  createdAt!: Date;
  updatedAt!: Date;
}

export const IglooInsuranceRequestSchema = SchemaFactory.createForClass(
  IglooInsuranceRequest,
);

// Poll-worker: lấy non-terminal cũ nhất theo lastPolledAt.
IglooInsuranceRequestSchema.index({ status: 1, lastPolledAt: 1 });
// List admin theo giải + trạng thái.
IglooInsuranceRequestSchema.index({ mysqlRaceId: 1, status: 1 });
