import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingLeadDocument = HydratedDocument<TimingLead>;

export type TimingLeadStatus =
  | 'new'
  | 'contacted'
  | 'quoted'
  | 'closed_won'
  | 'closed_lost';

export type TimingPackageInterest =
  | 'basic'
  | 'advanced'
  | 'professional'
  | 'unspecified';

export type TimingLeadSource =
  | 'timing'
  | 'solution'
  | '5sport-btc'
  | '5sport-athlete'
  | '5solution-umbrella';

export type SportType = 'pickleball' | 'badminton' | 'both';
export type TournamentScale = 'lt50' | '50-200' | 'gt200';
export type TournamentTiming = '1-3m' | '3-6m' | 'tbd';

/** 5Solution umbrella landing — event category + modules of interest. */
export type SolEventType = 'race' | 'concert' | 'tournament' | 'other';
export type SolEventScale =
  | 'lt500'
  | '500-2000'
  | '2000-10000'
  | 'gt10000';
export type SolModule = '5bib' | '5ticket' | '5pix' | '5sport' | '5tech';

@Schema({
  collection: 'timing_leads',
  timestamps: true,
})
export class TimingLead {
  _id: string;

  @Prop({ required: true, index: true, unique: true })
  lead_number: number;

  @Prop({ required: true, trim: true, maxlength: 100 })
  full_name: string;

  @Prop({ required: true, trim: true, maxlength: 20, index: true })
  phone: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  organization: string;

  @Prop({ default: '', maxlength: 100 })
  athlete_count_range: string;

  @Prop({
    type: String,
    enum: ['basic', 'advanced', 'professional', 'unspecified'],
    default: 'unspecified',
  })
  package_interest: TimingPackageInterest;

  @Prop({ default: '', maxlength: 2000 })
  notes: string;

  @Prop({
    type: String,
    enum: ['new', 'contacted', 'quoted', 'closed_won', 'closed_lost'],
    default: 'new',
    index: true,
  })
  status: TimingLeadStatus;

  @Prop({
    type: String,
    enum: [
      'timing',
      'solution',
      '5sport-btc',
      '5sport-athlete',
      '5solution-umbrella',
    ],
    default: 'timing',
    index: true,
  })
  source: TimingLeadSource;

  /** 5Solution umbrella — category of event the lead is asking about. */
  @Prop({
    type: String,
    enum: ['race', 'concert', 'tournament', 'other', ''],
    default: '',
  })
  event_type: SolEventType | '';

  /** 5Solution umbrella — modules of interest (multi-select). */
  @Prop({ type: [String], default: [] })
  modules: SolModule[];

  @Prop({ default: '', maxlength: 100 })
  email: string;

  @Prop({
    type: String,
    enum: ['pickleball', 'badminton', 'both', ''],
    default: '',
  })
  sport_type: SportType | '';

  @Prop({
    type: String,
    enum: ['lt50', '50-200', 'gt200', ''],
    default: '',
  })
  tournament_scale: TournamentScale | '';

  @Prop({
    type: String,
    enum: ['1-3m', '3-6m', 'tbd', ''],
    default: '',
  })
  tournament_timing: TournamentTiming | '';

  @Prop({ default: '', maxlength: 100 })
  city: string;

  @Prop({ default: false, index: true })
  is_archived: boolean;

  @Prop({ default: '', maxlength: 5000 })
  staff_notes: string;

  @Prop({ default: '' })
  ip_address: string;

  @Prop({ default: '' })
  user_agent: string;

  createdAt: Date;
  updatedAt: Date;
}

export const TimingLeadSchema = SchemaFactory.createForClass(TimingLead);

TimingLeadSchema.index({ createdAt: -1 });
TimingLeadSchema.index({ is_archived: 1, status: 1, createdAt: -1 });
TimingLeadSchema.index({ source: 1, createdAt: -1 });
