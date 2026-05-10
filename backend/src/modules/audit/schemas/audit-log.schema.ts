import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * F-023 BR-DASH-23/24 — Audit Log collection mới cho Recent Activity timeline.
 *
 * NOTE quan trọng: audit log chỉ track mutation TỪ thời điểm F-023 ship.
 * KHÔNG migrate legacy mutation. Các module khác inject `AuditLogService`
 * và call `emit()` sau khi mutation thành công (best-effort, không block business).
 *
 * Index `createdAt: -1` để hỗ trợ truy vấn DESC trong RecentActivityService.
 */

@Schema({ _id: false })
export class AuditActor {
  /** Logto userId của người thực hiện hành động. */
  @Prop({ required: true, type: String }) userId: string;

  /** Snapshot displayName tại thời điểm action (tránh phải join về user khi render). */
  @Prop({ type: String }) displayName?: string;

  /** Snapshot role (admin / operator / medic / race_director...). */
  @Prop({ type: String }) role?: string;
}
export const AuditActorSchema = SchemaFactory.createForClass(AuditActor);

@Schema({ _id: false })
export class AuditEntity {
  /** Loại entity bị tác động: 'race' | 'claim' | 'order' | 'reconciliation' | 'medical_incident' | 'awards_podium' | ... */
  @Prop({ required: true, type: String }) type: string;

  /** ID của entity (Mongo ObjectId stringified hoặc raceId/courseId tùy entity). */
  @Prop({ required: true, type: String }) id: string;

  /** Tên hiển thị (race title, claim bib, ...) — snapshot tại thời điểm emit. */
  @Prop({ type: String }) displayName?: string;
}
export const AuditEntitySchema = SchemaFactory.createForClass(AuditEntity);

@Schema({ collection: 'audit_logs', timestamps: true, strict: true })
export class AuditLog {
  @Prop({ type: AuditActorSchema, required: true })
  actor: AuditActor;

  /**
   * Action verb. Quy ước `<entity>.<verb>`:
   * `race.force_update_status`, `race.publish`, `race.lock`,
   * `recon.send`, `claim.approve`, `podium.publish`, `podium.final`,
   * `medical.state_change`. Extensible — chấp nhận chuỗi tự do.
   */
  @Prop({ required: true, type: String, index: true })
  action: string;

  @Prop({ type: AuditEntitySchema, required: true })
  entity: AuditEntity;

  /** Metadata tùy action (vd: `{ from: 'pre_race', to: 'live' }`). */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  /**
   * Timestamps được Mongoose điền tự động qua `timestamps: true`.
   * Khai báo lại để TypeScript không phàn nàn khi đọc.
   */
  createdAt?: Date;
  updatedAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Index để truy vấn timeline DESC cực nhanh.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'entity.type': 1, 'entity.id': 1, createdAt: -1 });
