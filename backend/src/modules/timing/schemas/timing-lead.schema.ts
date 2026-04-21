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

export type TimingLeadSource = 'timing' | 'solution';

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
    enum: ['timing', 'solution'],
    default: 'timing',
    index: true,
  })
  source: TimingLeadSource;

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
