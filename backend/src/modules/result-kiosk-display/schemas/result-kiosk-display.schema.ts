import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * F-017 Result Kiosk Display configuration.
 *
 * Lazy-create on first GET (no migration). One doc per Mongo race.
 *
 * Display config drives KioskResultCard rendering — admin chooses hero choice,
 * visible sections, theme color, sponsor logos, custom message, sound + idle.
 */

export type HeroChoice = 'rank' | 'finish-time' | 'photo';

export interface VisibleSections {
  rank: boolean;
  finishTime: boolean;
  splits: boolean;
  sponsorBanner: boolean;
  customMessage: boolean;
  qrShare: boolean; // Phase 2 — Phase 1 placeholder render
  photo: boolean;
}

@Schema({ collection: 'result_kiosk_displays', timestamps: true })
export class ResultKioskDisplay {
  @Prop({ required: true, index: true, unique: true })
  mongoRaceId: string;

  @Prop({ required: true, default: 'rank', enum: ['rank', 'finish-time', 'photo'] })
  heroChoice: HeroChoice;

  @Prop({
    type: Object,
    default: () => ({
      rank: true,
      finishTime: true,
      splits: true,
      sponsorBanner: true,
      customMessage: false,
      qrShare: false,
      photo: false,
    }),
  })
  visibleSections: VisibleSections;

  @Prop({ default: '#FF0E65' })
  themeColor: string;

  @Prop({ default: '' })
  customMessage: string;

  @Prop({ type: [String], default: [] })
  sponsorLogos: string[]; // S3 URLs under courses/result-kiosk-sponsors/

  @Prop({ default: true })
  soundEnabled: boolean;

  @Prop({ default: 60 })
  idleTimeoutSeconds: number;

  @Prop({ default: 'DEFAULT', enum: ['DEFAULT', 'MINIMAL', 'PREMIUM', 'CUSTOM'] })
  preset: 'DEFAULT' | 'MINIMAL' | 'PREMIUM' | 'CUSTOM';

  @Prop()
  updatedByUserId?: string;
}

export type ResultKioskDisplayDocument = ResultKioskDisplay & Document;
export const ResultKioskDisplaySchema =
  SchemaFactory.createForClass(ResultKioskDisplay);
