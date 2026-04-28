import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BugReportDocument = HydratedDocument<BugReport>;

export const BUG_CATEGORIES = [
  'payment',
  'race_result',
  'bib_avatar',
  'account_login',
  'ui_display',
  'mobile_app',
  'other',
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const BUG_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'unknown',
] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export const BUG_STATUSES = [
  'new',
  'triaged',
  'in_progress',
  'resolved',
  'wont_fix',
  'duplicate',
  'reopened',
] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export interface BugStatusHistoryEntry {
  fromStatus: BugStatus | null;
  toStatus: BugStatus;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: Date;
  reason: string | null;
}

@Schema({
  collection: 'bugReports',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class BugReport {
  _id: string;

  // Public-facing ID: BUG-YYYYMMDD-NNNN — friendly for user reference.
  @Prop({ required: true, unique: true, index: true }) publicId: string;

  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
  @Prop({ default: '' }) stepsToReproduce: string;

  @Prop({ required: true, enum: BUG_CATEGORIES, index: true })
  category: BugCategory;

  @Prop({ required: true, enum: BUG_SEVERITIES, default: 'unknown' })
  severity: BugSeverity;

  @Prop({ required: true, enum: BUG_STATUSES, default: 'new', index: true })
  status: BugStatus;

  // Reporter
  @Prop({ required: true, index: true }) email: string;
  @Prop({ default: '' }) phoneNumber: string;
  @Prop({ default: true }) wantsUpdates: boolean;

  // Client-provided metadata (untrusted, debug-only)
  @Prop({ default: '' }) urlAffected: string;
  @Prop({ default: '' }) userAgent: string;
  @Prop({ default: '' }) viewport: string;
  @Prop({ default: '' }) referrer: string;

  // Server-recorded (trusted)
  @Prop({ required: true, index: true }) ipAddress: string;

  // Workflow
  @Prop({ default: null }) assigneeId: string | null;
  @Prop({ default: null }) assigneeName: string | null;
  @Prop({ default: null }) duplicateOfPublicId: string | null;

  // Audit trail
  @Prop({ default: false, index: true }) isDeleted: boolean;
  @Prop({ type: [Object], default: [] })
  statusHistory: BugStatusHistoryEntry[];

  createdAt: Date;
  updatedAt: Date;
}

export const BugReportSchema = SchemaFactory.createForClass(BugReport);

// Compound indexes — cover admin-list filter+sort patterns.
BugReportSchema.index({ status: 1, createdAt: -1 });
BugReportSchema.index({ severity: 1, status: 1, createdAt: -1 });
BugReportSchema.index({ category: 1, createdAt: -1 });
BugReportSchema.index({ assigneeId: 1, status: 1 });
BugReportSchema.index({ ipAddress: 1, createdAt: -1 });
BugReportSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
