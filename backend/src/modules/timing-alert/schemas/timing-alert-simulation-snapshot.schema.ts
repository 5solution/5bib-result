import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';

export type TimingAlertSimulationSnapshotDocument =
  HydratedDocument<TimingAlertSimulationSnapshot>;

/**
 * Snapshot raw RR API response cho 1 course của 1 simulation.
 *
 * Tách collection riêng vì size: 1 course có thể 1000-5000 athletes ×
 * ~1KB/athlete (Chiptimes JSON) → 1-5MB. Tách ra để query simulation
 * meta nhanh, snapshot chỉ load khi public endpoint cần.
 *
 * **Compound index** `(simCourseId)` unique — public endpoint lookup
 * by simCourseId trực tiếp.
 */
@Schema({
  collection: 'timing_alert_simulation_snapshots',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class TimingAlertSimulationSnapshot {
  _id!: string;

  @Prop({ required: true, unique: true, index: true })
  simCourseId!: string;

  @Prop({ required: true, index: true })
  simulationId!: string;

  /**
   * Raw RR API response array (Mongoose Mixed type — preserve all
   * vendor fields: Bib, Chiptimes JSON string, TimingPoint, etc.).
   */
  @Prop({ type: [Object], default: [] })
  data!: RaceResultApiItem[];

  @Prop({ required: true })
  fetchedAt!: Date;

  created_at!: Date;
  updated_at!: Date;
}

export const TimingAlertSimulationSnapshotSchema = SchemaFactory.createForClass(
  TimingAlertSimulationSnapshot,
);
