import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MedicalIncidentDocument = HydratedDocument<MedicalIncident>;

/**
 * F-018 BR-MI-01..05 — ITRA-aligned 5-band severity scale.
 * Stored as numeric 1..5 (NOT string) for index efficiency + sorting.
 */
export const SEVERITIES = [1, 2, 3, 4, 5] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * F-018 BR-MI-06 — 8 essential categories Phase 1 (advisory §2.B).
 * Phase 2 add: respiratory / gastrointestinal / hypothermia.
 */
export const CATEGORIES = [
  'cardiac',
  'trauma',
  'heat_stroke',
  'dehydration',
  'musculoskeletal',
  'neurological',
  'allergic',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** F-018 BR-MI-08 — sub-type only for `trauma` Phase 1. */
export const TRAUMA_SUBTYPES = ['fall', 'laceration', 'head', 'other'] as const;
export type TraumaSubtype = (typeof TRAUMA_SUBTYPES)[number];

/**
 * F-018 BR-MI-11 — 8-state forward-only state machine (advisory §3.A).
 * `CLOSED` is terminal — closure_reason carries the disposition.
 */
export const STATES = [
  'REPORTED',
  'MEDIC_DISPATCHED',
  'MEDIC_ON_SITE',
  'AMB_REQUESTED',
  'HOSPITAL_TRANSFER',
  'RESOLVED_ONSITE',
  'RESOLVED_DNF',
  'CLOSED',
] as const;
export type IncidentState = (typeof STATES)[number];

/**
 * F-018 BR-MI-14 — `FALSE_ALARM` is a closure_reason on CLOSED, NOT a parallel state.
 */
export const CLOSURE_REASONS = [
  'RESOLVED',
  'FALSE_ALARM',
  'DUPLICATE',
  'ATHLETE_REFUSED_TREATMENT',
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const ACTOR_ROLES = ['operator', 'medic', 'race_director'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const GPS_SOURCES = [
  'manual',
  'course-pin',
  'aid-station',
  'device',
] as const;
export type GpsSource = (typeof GPS_SOURCES)[number];

@Schema({ _id: false })
export class GpsLocation {
  @Prop({ required: true, type: Number, min: -90, max: 90 }) lat: number;
  @Prop({ required: true, type: Number, min: -180, max: 180 }) lng: number;
  @Prop({ required: true, enum: GPS_SOURCES }) source: GpsSource;
  @Prop({ type: String }) aidStationId?: string;
  @Prop({ type: Number }) accuracyMeters?: number;
}
export const GpsLocationSchema = SchemaFactory.createForClass(GpsLocation);

@Schema({ _id: false })
export class IncidentAttachment {
  @Prop({ required: true }) s3Key: string;
  @Prop({ required: true }) mime: string;
  @Prop({ required: true, type: Number }) sizeBytes: number;
  @Prop({ required: true, type: Date, default: Date.now }) uploadedAt: Date;
  @Prop({ type: String }) uploadedByUserId?: string;
}
export const IncidentAttachmentSchema = SchemaFactory.createForClass(IncidentAttachment);

/**
 * F-018 A2 — Witness statements server-enforced ≥2 for Sev 4-5 closure.
 */
@Schema({ _id: false })
export class WitnessStatement {
  @Prop({ required: true }) name: string;
  @Prop({ type: String }) statement?: string;
  @Prop({ type: String }) contact?: string;
  @Prop({ required: true, type: Date, default: Date.now }) signedAt: Date;
}
export const WitnessStatementSchema = SchemaFactory.createForClass(WitnessStatement);

/**
 * F-018 A3 — Phase 1 typed-name signature (advisory §6).
 * Phase 2 = digital signature pad PNG → S3 + PDF embed.
 */
@Schema({ _id: false })
export class MedicalDirectorSignature {
  @Prop({ required: true }) name: string;
  @Prop({ required: true, type: Date }) signedAt: Date;
}
export const MedicalDirectorSignatureSchema = SchemaFactory.createForClass(
  MedicalDirectorSignature,
);

/**
 * F-018 BR-MI-15 — APPEND-ONLY audit trail per state transition.
 * CRITICAL: service layer NEVER mutates existing entries — only $push.
 */
@Schema({ _id: false })
export class IncidentTransition {
  @Prop({ required: true, enum: [...STATES, 'INITIAL'] }) from: string;
  @Prop({ required: true, enum: STATES }) to: IncidentState;
  @Prop({ required: true, type: String }) actorId: string;
  @Prop({ required: true, enum: ACTOR_ROLES }) actorRole: ActorRole;
  @Prop({ required: true, type: Date, default: Date.now }) at: Date;
  @Prop({ type: String }) reason?: string;
  @Prop({ type: GpsLocationSchema }) gps?: GpsLocation;
}
export const IncidentTransitionSchema = SchemaFactory.createForClass(IncidentTransition);

/**
 * F-018 medical_incidents — collection lazy-created on first POST.
 * NO MongoDB migration script needed (Manager Plan §3 + PAUSE-CODER-14).
 */
@Schema({ collection: 'medical_incidents', timestamps: true, strict: true })
export class MedicalIncident {
  // Race linkage — both raceId (slug-friendly) + canonical FK.
  @Prop({ required: true, index: true }) raceId: string;
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  mongoRaceId: Types.ObjectId;

  // BR-MI-23..25 — BIB optional but ≥1 of (bib / athleteName / description) required (DTO-enforced).
  @Prop({ type: String, index: true }) bib?: string;
  @Prop({ type: String }) athleteName?: string;

  // BR-MI-01 — severity 1..5
  @Prop({ required: true, type: Number, enum: SEVERITIES, index: true })
  severity: Severity;

  // BR-MI-06..08
  @Prop({ required: true, enum: CATEGORIES }) category: Category;
  @Prop({ enum: TRAUMA_SUBTYPES }) traumaSubtype?: TraumaSubtype;

  @Prop({ type: String }) description?: string;

  // BR-MI-19..22 — GPS source priority
  @Prop({ type: GpsLocationSchema, required: true })
  gpsLocation: GpsLocation;

  // Reporter audit
  @Prop({ required: true, type: String }) reportedByUserId: string;
  @Prop({ required: true, type: Date, default: Date.now, index: true })
  reportedAt: Date;

  // BR-MI-11 — state machine
  @Prop({ required: true, enum: STATES, default: 'REPORTED', index: true })
  state: IncidentState;

  @Prop({ enum: CLOSURE_REASONS }) closureReason?: ClosureReason;

  // BR-MI-15 — APPEND-ONLY audit trail
  @Prop({ type: [IncidentTransitionSchema], default: [] })
  incidentTransitions: IncidentTransition[];

  // F-018 A1 — multi-medic array from M0 (NOT single-string).
  @Prop({ type: [String], default: [] })
  medicalTeamAssigned: string[];

  // F-018 A2 — witness statements (server-enforced ≥2 for Sev 4-5 CLOSED transition).
  @Prop({ type: [WitnessStatementSchema], default: [] })
  witnessStatements: WitnessStatement[];

  // F-018 A3 — typed-name signature (Phase 1).
  @Prop({ type: MedicalDirectorSignatureSchema })
  medicalDirectorSignature?: MedicalDirectorSignature;

  // BR-MI-26..28 — photo attachments (required ≥1 for Sev 4-5).
  @Prop({ type: [IncidentAttachmentSchema], default: [] })
  attachments: IncidentAttachment[];

  // SLA tracking
  @Prop({ type: Date }) ambulanceETA?: Date;
  @Prop({ type: Date }) medicArrivedAt?: Date;
  @Prop({ type: String }) outcome?: string;

  // BR-MI-31 — anonymization flag (set after 7y by cron).
  @Prop({ type: Boolean, default: false }) anonymized: boolean;

  // BR-MI-29 — generated PDF S3 key (auto + manual exports).
  @Prop({ type: String }) latestPdfS3Key?: string;

  // Mongoose timestamps populates these.
  createdAt?: Date;
  updatedAt?: Date;
}

export const MedicalIncidentSchema = SchemaFactory.createForClass(MedicalIncident);

// BR-MI compound indexes per init §5.3.
MedicalIncidentSchema.index({ raceId: 1, reportedAt: -1 });
MedicalIncidentSchema.index({ raceId: 1, severity: -1 });
MedicalIncidentSchema.index({ raceId: 1, bib: 1 });
