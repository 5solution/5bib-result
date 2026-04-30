import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChipVerificationDocument = HydratedDocument<ChipVerification>;

export type ChipVerificationResult =
  | 'FOUND'
  | 'CHIP_NOT_FOUND'
  | 'BIB_UNASSIGNED'
  | 'DISABLED'
  | 'ALREADY_PICKED_UP';

/**
 * Audit log immutable — mỗi lần lookup tại Bàn 2 ghi 1 doc.
 * Denormalize snapshot 3 field để recent list không vỡ khi athlete bị
 * soft-delete sau verify (theo MUST-DO #4 từ Eng+QC review).
 */
@Schema({
  collection: 'chip_verifications',
  timestamps: { createdAt: 'verified_at', updatedAt: false },
})
export class ChipVerification {
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  @Prop({ required: true })
  chip_id: string;

  @Prop({ type: String, default: null })
  bib_number?: string | null;

  @Prop({ type: Number, default: null })
  athletes_id?: number | null;

  @Prop({
    required: true,
    enum: ['FOUND', 'CHIP_NOT_FOUND', 'BIB_UNASSIGNED', 'DISABLED', 'ALREADY_PICKED_UP'],
  })
  result: ChipVerificationResult;

  @Prop({ default: false })
  is_first_verify: boolean;

  @Prop()
  device_label?: string;

  @Prop()
  ip_address?: string;

  // Denormalized snapshots (resilient to athlete soft-delete after verify)
  @Prop({ type: String, default: null })
  athlete_name_snapshot?: string | null;

  @Prop({ type: String, default: null })
  bib_number_snapshot?: string | null;

  @Prop({ type: String, default: null })
  course_name_snapshot?: string | null;
}

export const ChipVerificationSchema =
  SchemaFactory.createForClass(ChipVerification);

// Composite indexes phục vụ truy vấn:
//   - is_first_verify check: (race, athletes_id, result) — chỉ FOUND mới count
//   - recent list: (race, verified_at desc)
ChipVerificationSchema.index(
  { mysql_race_id: 1, athletes_id: 1, result: 1 },
  { name: 'race_athlete_result' },
);

ChipVerificationSchema.index(
  { mysql_race_id: 1, verified_at: -1 },
  { name: 'race_verified_at_desc' },
);
