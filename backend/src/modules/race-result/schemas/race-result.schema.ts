import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceResultDocument = HydratedDocument<RaceResult>;

@Schema({ _id: false })
export class SplitTime {
  @Prop() name: string; // "5km", "10km", "Half"
  @Prop() time: string; // "00:25:30"
  @Prop() pace: string; // "5:06/km"
  @Prop() rank: number; // rank at this checkpoint (from API)
  @Prop() speed: number; // km/h at this segment
}

export const SplitTimeSchema = SchemaFactory.createForClass(SplitTime);

@Schema({ _id: false })
export class EditHistoryEntry {
  @Prop({ required: true }) editedBy: string; // userId admin
  @Prop({ required: true }) editedAt: Date;
  @Prop({ required: true }) field: string; // field name changed
  @Prop({ type: Object }) oldValue: unknown;
  @Prop({ type: Object }) newValue: unknown;
  @Prop({ required: true }) reason: string;
}

export const EditHistoryEntrySchema = SchemaFactory.createForClass(EditHistoryEntry);

@Schema({
  collection: 'race_results',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RaceResult {
  _id: string;

  @Prop({ required: true, index: true }) raceId: string;
  @Prop({ required: true, index: true }) courseId: string;
  @Prop({ required: true, index: true }) bib: string;
  @Prop() name: string;
  @Prop() distance: string;

  // Rankings
  @Prop() overallRank: string;
  @Prop() overallRankNumeric: number;
  @Prop() genderRank: string;
  @Prop() genderRankNumeric: number;
  @Prop() categoryRank: string;
  @Prop() categoryRankNumeric: number;

  // Times
  @Prop() chipTime: string;
  @Prop() gunTime: string;
  @Prop() pace: string;

  // Demographics
  @Prop() gender: string;
  @Prop() category: string; // age group
  @Prop() nationality: string;
  @Prop() nation: string;
  @Prop() club: string;

  // Legacy fields from RaceResult API
  @Prop() timingPoint: string;
  @Prop() certi: string;
  @Prop() certificate: string;
  @Prop() overallRanks: string;
  @Prop() genderRanks: string;
  @Prop() chiptimes: string;
  @Prop() guntimes: string;
  @Prop() paces: string;
  @Prop() tods: string;
  @Prop() sectors: string;
  @Prop() overrankLive: string;
  @Prop() overrankLiveNumeric: number;
  @Prop() gap: string;

  // Split times (dynamic, auto-detected)
  @Prop({ type: [SplitTimeSchema], default: [] })
  splits: SplitTime[];

  // Team relay member mapping (JSON string: lap → member name)
  @Prop() member: string;

  // Manual edit audit trail (BR-03)
  @Prop({ type: [EditHistoryEntrySchema], default: [] })
  editHistory: EditHistoryEntry[];

  @Prop({ default: false, index: true })
  isManuallyEdited: boolean;

  // Course-level counters (from external API)
  @Prop() started: number;
  @Prop() finished: number;
  @Prop() dnf: number;

  // Raw data from API (flexible)
  @Prop({ type: Object }) rawData: Record<string, any>;

  // Avatar (P2-B-ii)
  @Prop() email?: string;
  @Prop() avatarUrl?: string;

  @Prop() syncedAt: Date;

  created_at: Date;
  updated_at: Date;
}

export const RaceResultSchema = SchemaFactory.createForClass(RaceResult);

// Composite unique index
RaceResultSchema.index({ raceId: 1, courseId: 1, bib: 1 }, { unique: true });
// Index for sorting
RaceResultSchema.index({ overallRankNumeric: 1 });
