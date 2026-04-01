import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceDocument = HydratedDocument<Race>;

@Schema({ _id: false })
export class RaceCourse {
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) name: string;
  @Prop() distance?: string;
  @Prop({ type: Number }) distanceKm?: number;
  @Prop() courseType?: string;
  @Prop() apiUrl?: string; // RaceResult API endpoint for this course
  @Prop({ default: 0 }) splitCount?: number; // auto-detected from API
  @Prop({ default: 'idle' }) importStatus?: string;
  @Prop() imageUrl?: string; // Course cover image (S3)
  @Prop({ type: Number }) elevationGain?: number; // Total elevation gain in meters
  @Prop() startTime?: string; // e.g. "05:00"
  @Prop() startLocation?: string; // e.g. "Quảng trường Lâm Viên"
  @Prop() mapUrl?: string; // Course map image URL (S3)
  @Prop() gpxUrl?: string; // GPX file URL (S3)
}

export const RaceCourseSchema = SchemaFactory.createForClass(RaceCourse);

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

  // Raw data from 5bib API (preserve all original fields)
  @Prop({ type: Object }) rawData: Record<string, any>;

  created_at: Date;
  updated_at: Date;
}

export const RaceSchema = SchemaFactory.createForClass(Race);
