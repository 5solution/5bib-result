import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsTeamDocument = HydratedDocument<OpsTeam>;

@Schema({
  collection: 'ops_teams',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsTeam {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ required: true })
  name: string; // "Team Nước", "Team ANĐC"

  @Prop({ required: true })
  code: string; // "WATER", "SECURITY" — unique per event, auto-slug hoặc user-provided

  @Prop({ type: Types.ObjectId, default: null })
  leader_user_id: Types.ObjectId | null;

  @Prop({ default: 0 })
  target_crew: number;

  @Prop({ default: 0 })
  target_tnv: number;

  @Prop({ type: [String], default: [] })
  station_ids: string[]; // ["N00", "N01", ...]

  /** UI helpers per feedback #6 */
  @Prop({ default: 0 })
  order: number;

  @Prop()
  color?: string; // hex "#ea580c"

  @Prop({ type: [String], default: [] })
  tags: string[]; // ["water", "medical"]

  /**
   * Khi event LIVE → locked = true. Service layer chặn delete + rename code.
   * Fields như target_crew/target_tnv/station_ids vẫn edit được.
   */
  @Prop({ default: false })
  locked: boolean;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsTeamSchema = SchemaFactory.createForClass(OpsTeam);

// Unique chỉ enforce trên doc chưa soft-delete — cho phép reuse code sau archive.
OpsTeamSchema.index(
  { event_id: 1, code: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);
OpsTeamSchema.index({ event_id: 1, order: 1 });
