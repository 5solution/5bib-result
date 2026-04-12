import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReconciliationCronLogDocument = ReconciliationCronLog & Document;

@Schema({ collection: 'reconciliation_cron_logs', timestamps: false })
export class ReconciliationCronLog {
  @Prop({ required: true })
  period: string; // "2026-03"

  @Prop({ required: true, default: Date.now })
  ran_at: Date;

  @Prop({ default: 0 })
  created_count: number;

  @Prop({ default: 0 })
  skipped_count: number;

  @Prop({ default: 0 })
  error_count: number;

  @Prop({ type: [Object], default: [] })
  error_details: Array<{ tenant_id: number; merchant_name: string; race_title: string; reason: string }>;

  @Prop({ default: 'cron' })
  triggered_by: string; // 'cron' | 'manual'
}

export const ReconciliationCronLogSchema = SchemaFactory.createForClass(ReconciliationCronLog);
