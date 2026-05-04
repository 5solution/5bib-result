import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingAlertSimulationDocument =
  HydratedDocument<TimingAlertSimulation>;

export type SimulationStatus = 'created' | 'running' | 'paused' | 'completed';

/**
 * Scenario types — special case injection để test miss-detection logic
 * mà không cần đợi data thật bị lỗi.
 */
export type ScenarioType =
  | 'MISS_FINISH'
  | 'MISS_MIDDLE_CP'
  | 'MISS_START'
  | 'MAT_FAILURE'
  | 'TOP_N_MISS_FINISH'
  | 'LATE_FINISHER'
  | 'PHANTOM_RUNNER';

@Schema({ _id: false })
export class SimulationScenario {
  /** UUID-ish stable id để FE update/delete row. */
  @Prop({ required: true })
  id!: string;

  @Prop({
    required: true,
    enum: [
      'MISS_FINISH',
      'MISS_MIDDLE_CP',
      'MISS_START',
      'MAT_FAILURE',
      'TOP_N_MISS_FINISH',
      'LATE_FINISHER',
      'PHANTOM_RUNNER',
    ],
  })
  type!: ScenarioType;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0, min: 0 })
  count!: number;

  /** MAT_FAILURE: checkpoint key cụ thể bị fail (VD "TM2"). */
  @Prop()
  checkpointKey?: string;

  /** TOP_N_MISS_FINISH: chọn Top N athletes (sort theo Finish time ASC). */
  @Prop({ default: 10 })
  topN?: number;

  /** LATE_FINISHER: số phút dời Finish time. */
  @Prop({ default: 30 })
  shiftMinutes?: number;

  /** Optional course filter — apply scenario chỉ cho 1 course (simCourseId). */
  @Prop()
  scopeSimCourseId?: string;

  @Prop()
  description?: string;
}

export const SimulationScenarioSchema =
  SchemaFactory.createForClass(SimulationScenario);

@Schema({ _id: false })
export class SimulationCourse {
  /**
   * Public simulator token (32-char hex). URL serve data tại
   * `https://{host}/api/timing-alert/simulator-data/{simCourseId}` —
   * BTC paste vào `course.apiUrl` để pretend là RR endpoint.
   *
   * Security: unguessable token serves as access control (same pattern RR
   * Simple API). KHÔNG có auth header — poll service hit URL trực tiếp.
   */
  @Prop({ required: true, unique: true, index: true })
  simCourseId!: string;

  @Prop({ required: true })
  label!: string; // VD "5K", "21K"

  @Prop({ required: true })
  sourceUrl!: string; // RR API URL gốc

  @Prop()
  snapshotFetchedAt?: Date;

  @Prop({ default: 0 })
  snapshotItems!: number; // số athletes trong snapshot

  /** Earliest timing point seconds (= race "Start" trên timeline). */
  @Prop({ type: Number })
  earliestSeconds?: number;

  /** Latest timing point seconds (= "Finish" của runner cuối). */
  @Prop({ type: Number })
  latestSeconds?: number;
}

export const SimulationCourseSchema =
  SchemaFactory.createForClass(SimulationCourse);

/**
 * Simulator giả lập RR API timeline — fetch real RR snapshot 1 lần,
 * replay theo simulation clock. Cho phép test timing-alert nhiều lần
 * mà KHÔNG cần đợi race thật, KHÔNG đụng RR live data.
 *
 * **Replay model:**
 * - `accumulatedSeconds` = simulation time tích lũy (tính cả các phase
 *   pause/resume).
 * - Khi `running`: simulation time hiện tại = accumulatedSeconds +
 *   (now - startedAt) * speedFactor.
 * - Khi `paused`: simulation time đứng yên ở accumulatedSeconds.
 *
 * **Per request behavior:**
 * - Public endpoint compute current simulation time → filter snapshot
 *   athletes' Chiptimes: chỉ giữ checkpoint times ≤ simTime.
 * - Athletes chưa qua bất kỳ checkpoint nào → vẫn return (giữ Bib +
 *   metadata, Chiptimes = "{}").
 */
@Schema({
  collection: 'timing_alert_simulations',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class TimingAlertSimulation {
  _id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  /** Tốc độ replay (1.0 = realtime, 5.0 = 5x). Caller có thể đổi runtime. */
  @Prop({ default: 1.0, min: 0.1, max: 100 })
  speedFactor!: number;

  /**
   * Offset cộng vào simulation time khi compute. Cho phép skip ngay tới
   * giờ T của race (VD start tại T=2h để test mat failure phase race).
   */
  @Prop({ default: 0 })
  startOffsetSeconds!: number;

  @Prop({
    enum: ['created', 'running', 'paused', 'completed'],
    default: 'created',
    index: true,
  })
  status!: SimulationStatus;

  /** Timestamp wall-clock khi `running` phase hiện tại bắt đầu. */
  @Prop({ type: Date })
  startedAt?: Date | null;

  /** Timestamp khi pause gần nhất (audit). */
  @Prop({ type: Date })
  pausedAt?: Date | null;

  /**
   * Simulation time (giây) tích lũy trước resume hiện tại. Update mỗi
   * lần pause/reset/seek.
   */
  @Prop({ default: 0 })
  accumulatedSeconds!: number;

  @Prop({ type: [SimulationCourseSchema], default: [] })
  courses!: SimulationCourse[];

  /**
   * Phase 2 — Scenarios injection. Apply tại serve() time, KHÔNG ghi đè
   * snapshot. BTC bật/tắt/edit live, athletes được chọn deterministic
   * theo hash(simCourseId+bib).
   */
  @Prop({ type: [SimulationScenarioSchema], default: [] })
  scenarios!: SimulationScenario[];

  @Prop({ default: 'unknown' })
  createdBy!: string;

  created_at!: Date;
  updated_at!: Date;
}

export const TimingAlertSimulationSchema = SchemaFactory.createForClass(
  TimingAlertSimulation,
);
