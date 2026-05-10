import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PodiumDocument = HydratedDocument<Podium>;

/**
 * F-019 BR-AG-23 — 8-state forward-only podium lifecycle.
 * Pattern verbatim port từ F-018 IncidentState (forward-only enforced trong service).
 */
export const PODIUM_STATES = [
  'RAW_RESULT',
  'AG_COMPUTED',
  'WARNINGS_GENERATED',
  'BTC_REVIEW',
  'PODIUM_DRAFT',
  'PODIUM_LOCKED',
  'PODIUM_PUBLISHED',
  'DISPUTE_OPEN',
  'PODIUM_FINAL',
] as const;
export type PodiumState = (typeof PODIUM_STATES)[number];

export const GENDERS = ['M', 'F'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * F-020 — `PODIUM_GENDERS` mở rộng `GENDERS` để chấp nhận `'mixed'` cho OVERALL
 * podium (top chung cuộc — không chia M/F). KHÔNG đụng `Gender` type chính
 * (giữ tương thích cho AG bucket calc + vendor mismatch detector chỉ làm việc
 * trên AG = M/F). Schema field `gender` dùng enum mở rộng này.
 */
export const PODIUM_GENDERS = ['M', 'F', 'mixed'] as const;
export type PodiumGender = (typeof PODIUM_GENDERS)[number];

/**
 * F-020 BR-AG-43 — discriminator field cho Podium docs.
 *  - `'AG'` (default): podium nhóm tuổi (giữ nguyên từ F-019).
 *  - `'OVERALL'`: top chung cuộc per course (BR-AG-41/42, persist trong cả 2 modes).
 */
export const PODIUM_TYPES = ['AG', 'OVERALL'] as const;
export type PodiumType = (typeof PODIUM_TYPES)[number];

/** F-020 — sentinel ageGroupKey cho OVERALL podium (distinct với AG buckets). */
export const OVERALL_AGE_GROUP_KEY = '__OVERALL__';

export const COMPOUNDING_MODES = [
  'compounding',
  'mutually_exclusive',
] as const;
export type CompoundingMode = (typeof COMPOUNDING_MODES)[number];

@Schema({ _id: false })
export class PodiumAthlete {
  @Prop({ required: true }) bib: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, type: Number }) rank: number;
  @Prop({ type: Number }) chipTimeMs?: number;
  @Prop() chipTime?: string;
  @Prop({ type: Number }) gunTimeMs?: number;
  @Prop() gender?: string;
  @Prop({ type: Number }) ageOnRaceDay?: number;
  @Prop() nationality?: string;
  @Prop({ type: String }) athleteId?: string;
  /** True khi athlete chia rank với khác (ex-aequo). */
  @Prop({ type: Boolean, default: false }) tied?: boolean;
}
export const PodiumAthleteSchema = SchemaFactory.createForClass(PodiumAthlete);

/**
 * F-019 BR-AG-28 — APPEND-ONLY audit trail per state transition.
 * Pattern verbatim port từ F-018 `IncidentTransition` schema.
 * Service layer NEVER mutates existing entries — only $push.
 */
@Schema({ _id: false })
export class PodiumStateTransition {
  @Prop({ required: true, enum: [...PODIUM_STATES, 'INITIAL'] })
  fromState: string;
  @Prop({ required: true, enum: PODIUM_STATES }) toState: PodiumState;
  @Prop({ required: true, type: String }) actorId: string;
  @Prop({ required: true, type: Date, default: Date.now }) at: Date;
  @Prop({ type: String }) note?: string;
  @Prop({ type: String }) evidenceUrl?: string;
}
export const PodiumStateTransitionSchema = SchemaFactory.createForClass(
  PodiumStateTransition,
);

/**
 * F-019 podiums — collection lazy-created on first POST.
 * NO MongoDB migration script needed (Manager Plan §3 + PAUSE-CODER-09).
 * 1 doc per (raceId × courseId × ageGroup × gender).
 */
@Schema({ collection: 'podiums', timestamps: true, strict: true })
export class Podium {
  // Race linkage
  @Prop({ required: true, index: true }) raceId: string;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  mongoRaceId: Types.ObjectId;

  // Course linkage
  @Prop({ required: true, index: true }) courseId: string;
  @Prop({ required: true }) courseName: string;
  @Prop({ type: Number }) courseDistanceKm?: number;

  // AG identity (compound unique)
  @Prop({ required: true }) ageGroup: string; // e.g. "30-39"
  @Prop({ required: true }) ageGroupKey: string; // e.g. "M_30-39"
  @Prop({ required: true }) ageGroupLabel: string; // e.g. "Nam 30-39"
  /**
   * F-020 — gender mở rộng `'mixed'` cho OVERALL podium. AG bucket vẫn dùng
   * 'M'/'F'. Type là `PodiumGender` (superset của `Gender`).
   */
  @Prop({ required: true, enum: PODIUM_GENDERS }) gender: PodiumGender;

  /**
   * F-020 BR-AG-43 — discriminator giữa AG bucket vs OVERALL podium (top chung cuộc).
   * Default `'AG'` để 39 docs hiện trường (F-019 ship) tự apply giá trị cũ —
   * KHÔNG cần migration script (theo pattern F-019 v2 lazy default).
   */
  @Prop({ enum: PODIUM_TYPES, default: 'AG', index: true })
  podiumType: PodiumType;

  // Preset reference (ageGroupOverride snapshot if applicable)
  @Prop({ required: true }) presetKey: string;
  @Prop({ enum: COMPOUNDING_MODES, default: 'compounding' })
  compoundingMode: CompoundingMode;
  @Prop({ default: 3, type: Number }) agTopN: number;

  // Top N athletes after ranking
  @Prop({ type: [PodiumAthleteSchema], default: [] })
  athletes: PodiumAthlete[];

  // State machine
  @Prop({
    required: true,
    enum: PODIUM_STATES,
    default: 'RAW_RESULT',
    index: true,
  })
  state: PodiumState;

  @Prop({ type: [PodiumStateTransitionSchema], default: [] })
  stateHistory: PodiumStateTransition[];

  // Lifecycle timestamps
  @Prop({ type: Date }) computedAt?: Date;
  @Prop({ type: Date }) lockedAt?: Date;
  @Prop({ type: Date }) publishedAt?: Date;
  @Prop({ type: Date }) disputedAt?: Date;
  @Prop({ type: Date }) finalAt?: Date;

  // Latest PDF artifact (BR-AG-33)
  @Prop({ type: String }) latestPdfS3Key?: string;
  @Prop({ type: Date }) latestPdfGeneratedAt?: Date;

  // Mongoose timestamps populates these.
  createdAt?: Date;
  updatedAt?: Date;
}

export const PodiumSchema = SchemaFactory.createForClass(Podium);

// Compound unique index — 1 doc per (race × course × AG × gender).
PodiumSchema.index(
  { raceId: 1, courseId: 1, ageGroupKey: 1, gender: 1 },
  { unique: true },
);

// Race-day filter: list per state (banner counts).
PodiumSchema.index({ raceId: 1, state: 1 });

// Cron auto-final scan: PUBLISHED docs older than 30 phút.
PodiumSchema.index({ state: 1, publishedAt: 1 });
