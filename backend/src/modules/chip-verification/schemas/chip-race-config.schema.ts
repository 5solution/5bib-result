import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChipRaceConfigDocument = HydratedDocument<ChipRaceConfig>;

/**
 * Thay thế cho việc ALTER bảng `races` (legacy). Mỗi race muốn enable
 * chip verification thì có 1 doc ở đây. `mysql_race_id` link sang
 * legacy `races.race_id` qua connection 'platform'.
 */
@Schema({
  collection: 'chip_race_configs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class ChipRaceConfig {
  @Prop({ required: true, index: true, unique: true })
  mysql_race_id: number;

  /**
   * Mongo Race._id (5bib-result internal) — cho phép admin URL truy cập config
   * này qua mongoRaceId thay vì mysql_race_id. Sparse unique vì có thể có
   * config tạo trước khi BTC link tới Mongo race (legacy).
   */
  @Prop({ index: true, sparse: true, unique: true })
  mongo_race_id?: string | null;

  /** Snapshot tại thời điểm enable — không trust runtime tenant id. */
  @Prop({ required: true })
  tenant_id: number;

  @Prop({ required: true, default: false })
  chip_verify_enabled: boolean;

  /** 32-char base64url, sparse unique (null khi disable). */
  @Prop({ index: true, sparse: true, unique: true })
  chip_verify_token?: string | null;

  @Prop({ default: 0 })
  total_chip_mappings: number;

  @Prop()
  preload_completed_at?: Date | null;

  @Prop()
  enabled_by_user_id?: string | null;

  @Prop({ type: [String], default: [] })
  device_labels: string[];

  /** Audit log: mỗi lần token thay đổi (GENERATE/ROTATE/DISABLE) push 1 entry. */
  @Prop({
    type: [
      {
        action: { type: String, enum: ['GENERATE', 'ROTATE', 'DISABLE'] },
        at: { type: Date, default: Date.now },
        by_user_id: String,
        old_token_hash: String,
        new_token_hash: String,
      },
    ],
    default: [],
  })
  token_audit_log: Array<{
    action: 'GENERATE' | 'ROTATE' | 'DISABLE';
    at: Date;
    by_user_id?: string;
    old_token_hash?: string;
    new_token_hash?: string;
  }>;
}

export const ChipRaceConfigSchema = SchemaFactory.createForClass(ChipRaceConfig);
