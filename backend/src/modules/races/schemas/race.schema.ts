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
  @Prop() distance?: string; // e.g. "5K"
  @Prop({ type: CheckpointServicesSchema }) services?: CheckpointServices;
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
  @Prop() gpxUrl?: string; // GPX file URL (S3)
  @Prop({ type: [CourseCheckpointSchema], default: [] })
  checkpoints: CourseCheckpoint[];
}

export const RaceCourseSchema = SchemaFactory.createForClass(RaceCourse);

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

  // Cache config
  @Prop({ default: 60 }) cacheTtlSeconds: number;

  // Courses (embedded)
  @Prop({ type: [RaceCourseSchema], default: [] })
  courses: RaceCourse[];

  // External IDs
  @Prop() externalRaceId: string; // RaceResult race ID

  // Status override audit trail (BR: forward-only normally; admin can override with reason)
  @Prop({ type: [RaceStatusHistoryEntrySchema], default: [] })
  statusHistory: RaceStatusHistoryEntry[];

  // Raw data from 5bib API (preserve all original fields)
  @Prop({ type: Object }) rawData: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export const RaceSchema = SchemaFactory.createForClass(Race);
