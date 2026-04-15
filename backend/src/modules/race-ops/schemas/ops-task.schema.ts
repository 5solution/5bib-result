import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsTaskDocument = HydratedDocument<OpsTask>;

export type OpsTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

/**
 * Task từ Timeline Excel (`TIMELINE` sheet) hoặc admin tạo manual.
 * Event-wide task: team_id = null (VD "Setup start/finish").
 */
@Schema({
  collection: 'ops_tasks',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsTask {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  team_id: Types.ObjectId | null;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  due_at: Date;

  @Prop()
  due_end_at?: Date; // Excel có FROM/TO → end time optional

  @Prop({
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'],
    default: 'PENDING',
    index: true,
  })
  status: OpsTaskStatus;

  @Prop({ type: [Types.ObjectId], default: [] })
  assignee_user_ids: Types.ObjectId[];

  @Prop()
  blocker_reason?: string;

  @Prop()
  completed_at?: Date;

  @Prop({ type: Types.ObjectId, default: null })
  completed_by: Types.ObjectId | null;

  /** Import source (Excel row origin) — giữ cho audit khi Excel re-import */
  @Prop()
  source_excel_row?: number;

  @Prop()
  source_excel_sheet?: string; // "TIMELINE"

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsTaskSchema = SchemaFactory.createForClass(OpsTask);

OpsTaskSchema.index({ event_id: 1, team_id: 1, due_at: 1 });
OpsTaskSchema.index({ event_id: 1, status: 1 });
