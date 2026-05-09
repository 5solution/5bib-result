import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AnomalyWarningDocument = HydratedDocument<AnomalyWarning>;

/**
 * F-019 BR-AG-11..18 — 7 anomaly patterns A-G.
 * F-019 v2 — Pattern H added: VENDOR_MISMATCH (5BIB top-3 AG vs Vendor top-3
 * lệch ≥1/2 BIB → tier 2/1/0 escalate per Race Ops advisory v2 §3 + Manager
 * Plan v2 §2 PAUSE-MGR-V2-05 LOCKED).
 */
export const ANOMALY_PATTERNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type AnomalyPattern = (typeof ANOMALY_PATTERNS)[number];

/** F-019 BR-AG-19 — 3-tier system. */
export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

/** F-019 — resolution outcome (BR-AG-22). */
export const RESOLUTIONS = [
  'pending',
  'ignored',
  'fixed',
  'btc_override',
] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * F-019 BR-AG-22 — APPEND-ONLY audit trail cho warning lifecycle.
 * Pattern verbatim port từ F-018 incidentTransitions[].
 */
@Schema({ _id: false })
export class WarningTransition {
  @Prop({ required: true }) action: string; // 'ack' | 'resolve' | 'override'
  @Prop({ required: true, type: String }) actorId: string;
  @Prop({ required: true, type: Date, default: Date.now }) at: Date;
  @Prop({ type: String }) note?: string;
  @Prop({ type: String }) evidenceUrl?: string;
  @Prop({ type: Number }) priorTier?: number;
  @Prop({ type: Number }) newTier?: number;
}
export const WarningTransitionSchema =
  SchemaFactory.createForClass(WarningTransition);

@Schema({ collection: 'anomaly_warnings', timestamps: true, strict: true })
export class AnomalyWarning {
  @Prop({ required: true, index: true }) raceId: string;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  mongoRaceId: Types.ObjectId;

  @Prop({ required: true, index: true }) courseId: string;
  @Prop({ required: true, index: true }) bib: string;
  @Prop({ type: String, index: true }) athleteId?: string;
  @Prop({ type: String }) athleteName?: string;

  @Prop({ required: true, enum: ANOMALY_PATTERNS }) pattern: AnomalyPattern;
  @Prop({ required: true, type: Number, enum: TIERS, index: true })
  tier: Tier;
  @Prop({
    required: true,
    type: Number,
    min: 0.0,
    max: 1.0,
  })
  confidence: number;

  /** Computed signals + vendor raw evidence (Section B §2-3). */
  @Prop({ type: Object, default: {} })
  evidence: Record<string, unknown>;

  // Acknowledgement (Mức 2 ack flow per BR-AG-19)
  @Prop({ type: String }) ackedBy?: string;
  @Prop({ type: Date }) ackedAt?: Date;
  @Prop({ type: String }) ackNote?: string;

  // Resolution (BR-AG-22)
  @Prop({ enum: RESOLUTIONS, default: 'pending', index: true })
  resolution: Resolution;
  @Prop({ type: String }) resolvedBy?: string;
  @Prop({ type: Date }) resolvedAt?: Date;
  @Prop({ type: String }) resolutionNote?: string;

  // BTC tier override (BR-AG-22) — KHÔNG mutate confidence original
  @Prop({ type: Number }) overrideTier?: number;

  // Audit trail APPEND-ONLY (BR-AG-28 verbatim port từ F-018).
  @Prop({ type: [WarningTransitionSchema], default: [] })
  transitionHistory: WarningTransition[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const AnomalyWarningSchema =
  SchemaFactory.createForClass(AnomalyWarning);

// Race-day filter (banner counts per tier).
AnomalyWarningSchema.index({ raceId: 1, courseId: 1, tier: 1 });

// SLA query (Mức 1 still pending).
AnomalyWarningSchema.index({ raceId: 1, resolution: 1, tier: 1 });
