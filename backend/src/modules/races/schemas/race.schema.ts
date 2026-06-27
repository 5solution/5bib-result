import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceDocument = HydratedDocument<Race>;

@Schema({ _id: false })
export class CheckpointServices {
  @Prop({ default: false }) water: boolean;
  @Prop({ default: false }) food: boolean;
  @Prop({ default: false }) sleep: boolean;
  @Prop({ default: false }) dropBag: boolean;
  @Prop({ default: false }) medical: boolean;
  @Prop() notes?: string;
}
export const CheckpointServicesSchema =
  SchemaFactory.createForClass(CheckpointServices);

@Schema({ _id: false })
export class CourseCheckpoint {
  @Prop({ required: true }) key: string; // timing point key, e.g. "TM1", "TM2", "Finish"
  @Prop({ required: true }) name: string; // display name, e.g. "Trạm 1 - Suối Vàng"
  @Prop() distance?: string; // e.g. "5K" — display string (legacy)
  @Prop({ type: Number }) distanceKm?: number; // 5.0 — numeric km cho pace projection (timing-alert + charts)
  @Prop({ type: CheckpointServicesSchema }) services?: CheckpointServices;
  // F-006 BR-CM-04/05 — auto-matched waypoint OR manual drag position (WGS84)
  @Prop({ type: Number }) lat?: number;
  @Prop({ type: Number }) lng?: number;
}

export const CourseCheckpointSchema =
  SchemaFactory.createForClass(CourseCheckpoint);

@Schema({ _id: false })
export class RaceCourse {
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) name: string;
  @Prop() distance?: string;
  @Prop({ type: Number }) distanceKm?: number;
  @Prop({ enum: ['split', 'lap', 'team_relay', 'point_to_point'] })
  courseType?: string;
  @Prop() apiUrl?: string; // RaceResult API endpoint for this course
  @Prop({ default: 'json' }) apiFormat?: string; // 'json' | 'csv' — format of API response
  @Prop({ default: 0 }) splitCount?: number; // auto-detected from API
  @Prop({ default: 'idle' }) importStatus?: string;
  @Prop() imageUrl?: string; // Course cover image (S3)
  @Prop({ type: Number }) elevationGain?: number; // Total elevation gain in meters
  @Prop() startTime?: string; // e.g. "05:00"
  @Prop() startLocation?: string; // e.g. "Quảng trường Lâm Viên"
  @Prop() cutOffTime?: string; // Cut-off time e.g. "12:00:00" or "24 giờ"
  @Prop() mapUrl?: string; // Course map image URL (S3)
  @Prop() gpxUrl?: string; // GPX file URL (S3) — original .gpx/.kml
  // F-006 BR-CM-02/03/06 — server-parsed metadata (raw + simplified counts, distance, elevation, bounds)
  @Prop({ type: Object })
  gpxParsed?: {
    trackPoints: number;
    simplifiedPoints: number;
    totalDistanceKm: number;
    elevationGain: number | null;
    elevationLoss: number | null;
    maxElevation: number | null;
    minElevation: number | null;
    bounds: { north: number; south: number; east: number; west: number };
  };
  // F-006 BR-CM-11 — S3 URL of simplified GeoJSON (public-read)
  @Prop({ type: String })
  gpxSimplifiedUrl?: string;
  @Prop({ type: [CourseCheckpointSchema], default: [] })
  checkpoints: CourseCheckpoint[];

  // F-019 BR-AG-05/37/38 — AG preset config per course (optional, lazy default).
  // PAUSE-CODER-09: NO migration script needed — service code handles missing
  // field gracefully (defaultPresetFor(courseType) fallback).
  @Prop({ type: String })
  ageGroupPreset?: string; // 'vn_road_default' | 'road_5_year' | 'trail_itra' | 'trail_lite' | 'open_only'

  @Prop({ type: Object })
  ageGroupOverride?: {
    bracketsM?: Array<{ key: string; label: string; min: number; max: number }>;
    bracketsF?: Array<{ key: string; label: string; min: number; max: number }>;
    boundaryMode?: 'upper' | 'lower';
  };

  @Prop({ type: Number })
  paceThresholdOverride?: number; // sec/km lower bound override Pattern G

  /**
   * F-019 v2 — Race-specific bracket source override (Path B trust mode).
   *
   * - `'5bib'` (default): tự tính bracket từ master-data DOB (Path A primary).
   *   Khi DOB null → exclude athlete khỏi AG bucket.
   * - `'vendor'`: Path B trust mode — chỉ dùng vendor `Category` string.
   *   BTC chọn khi DOB coverage < 50% (xem AGEligibilityReport). Risk:
   *   vendor sai → 5BIB mất uy tín "trọng tài độc lập".
   * - `'hybrid'`: Path A first, fallback Path B cho athletes thiếu DOB.
   */
  @Prop({ enum: ['5bib', 'vendor', 'hybrid'], default: '5bib' })
  bracketSource?: '5bib' | 'vendor' | 'hybrid';
}

export const RaceCourseSchema = SchemaFactory.createForClass(RaceCourse);

/**
 * F-018 A4 — race-level medical config (insurance hotline shown in incident
 * detail drawer as `tel:` link). Optional, no migration backfill.
 */
@Schema({ _id: false })
export class RaceMedicalConfig {
  @Prop({ type: String }) insuranceHotline?: string;
  @Prop({ type: String }) insuranceCarrierName?: string;
  @Prop({ type: String }) medicalDirectorName?: string;
  @Prop({ type: String }) medicalDirectorContact?: string;
}
export const RaceMedicalConfigSchema =
  SchemaFactory.createForClass(RaceMedicalConfig);

@Schema({ _id: false })
export class RaceStatusHistoryEntry {
  @Prop({ required: true }) from: string;
  @Prop({ required: true }) to: string;
  @Prop({ required: true }) reason: string;
  @Prop({ required: true }) changedBy: string; // admin userId
  @Prop({ default: () => new Date() }) changedAt: Date;
}

export const RaceStatusHistoryEntrySchema =
  SchemaFactory.createForClass(RaceStatusHistoryEntry);

@Schema({
  collection: 'races',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Race {
  _id: string;

  @Prop({ index: true }) productId: string;

  /**
   * F-048 BR-48-01 — Bridge to MySQL platform `races.race_id` for cross-DB
   * identity merge + race-master-data sync trigger.
   *
   * Populated via migration `2026-05-21-backfill-races-mysql-id.ts` which uses
   * hybrid 2-tier matching (BR-48-02):
   *   - Tier 1: MongoDB `slug` ↔ MySQL `url_name` exact match (confidence 1.0)
   *   - Tier 2: Fuzzy slug similarity ≥0.85 + endDate ±7 days (confidence 0.85)
   *   - Tier 3: Manual admin review queue
   *
   * Sparse index: most MongoDB races already mapped, allow null for orphans.
   */
  @Prop({ type: Number, index: true, sparse: true })
  mysql_race_id?: number | null;

  @Prop({ required: true }) title: string;
  @Prop() slug: string;
  @Prop({ default: 'pre_race' }) status: string; // draft | pre_race | live | ended
  @Prop() season: string;
  @Prop() province: string;
  @Prop() raceType: string; // running | triathlon | cycling
  @Prop() description: string;
  @Prop() imageUrl: string;
  @Prop() logoUrl: string;
  @Prop() bannerUrl: string;
  @Prop({ type: [String], default: [] }) sponsorBanners: string[];
  @Prop() brandColor: string;
  @Prop() startDate: Date;
  @Prop() endDate: Date;
  @Prop() location: string;
  @Prop() organizer: string;

  // Features toggles
  @Prop({ default: false }) enableEcert: boolean;
  @Prop({ default: false }) enableClaim: boolean;
  @Prop({ default: false }) enableLiveTracking: boolean;
  @Prop({ default: false }) enable5pix: boolean;
  @Prop() pixEventUrl: string; // 5Pix integration URL (mock)

  // Privacy toggles
  /** Ẩn toàn bộ biểu đồ thống kê (completion chart, time distribution, country ranking).
   *  F-093: mặc định BẬT — đa số BTC không muốn show số liệu/biểu đồ công khai. */
  @Prop({ default: true }) enableHideStats: boolean;
  /** Giới hạn danh sách VĐV: ẩn absolute counts, không phân trang khi không search */
  @Prop({ default: false }) enablePrivateList: boolean;
  /** Số VĐV hiển thị tối đa khi không có search query (chỉ dùng khi enablePrivateList=true) */
  @Prop({ default: 20 }) privateListLimit: number;

  // Cache config
  @Prop({ default: 60 }) cacheTtlSeconds: number;

  // Courses (embedded)
  @Prop({ type: [RaceCourseSchema], default: [] })
  courses: RaceCourse[];

  // External IDs
  @Prop() externalRaceId: string; // RaceResult race ID

  // ❌ DEPRECATED 2026-05-08 — F-015 Check-In Kiosk feature scrapped (duplicate of ORG.5bib.com).
  // Field left in schema to avoid migration. Always null. Will be hard-deleted when other
  // breaking schema changes need a migration anyway. DO NOT use in new code.
  @Prop({
    type: { start: { type: Date, default: null }, end: { type: Date, default: null } },
    default: null,
    _id: false,
  })
  checkInWindow?: { start: Date | null; end: Date | null } | null;

  // Status override audit trail (BR: forward-only normally; admin can override with reason)
  @Prop({ type: [RaceStatusHistoryEntrySchema], default: [] })
  statusHistory: RaceStatusHistoryEntry[];

  // F-018 A4 — race-level medical config (insurance hotline + medical director).
  // Optional, lazy-set by admin Settings page; no migration backfill required.
  @Prop({ type: RaceMedicalConfigSchema, default: () => ({}) })
  medicalConfig?: RaceMedicalConfig;

  /**
   * F-019 v2.1 — Compounding mode cho podium calc.
   * 'mutually_exclusive' (default VN amateur): top 3 overall EXCLUDED khỏi AG buckets.
   * 'compounding' (WA TR9): top 3 overall vẫn được tính top AG (cộng dồn).
   * Admin override per-race qua Race Settings UI.
   */
  @Prop({
    enum: ['mutually_exclusive', 'compounding'],
    default: 'mutually_exclusive',
  })
  awardsCompoundingMode: 'mutually_exclusive' | 'compounding';

  // Raw data from 5bib API (preserve all original fields)
  @Prop({ type: Object }) rawData: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export const RaceSchema = SchemaFactory.createForClass(Race);

// Compound index for homepage queries: filter by status, sort by startDate desc.
// Covers both "live/pre_race" lookups and "ended" grid pagination without full collection scan.
RaceSchema.index({ status: 1, startDate: -1 });

// Text search helper for global race name search (fuzzy name match on /api/search).
RaceSchema.index({ title: 'text', slug: 'text' });
