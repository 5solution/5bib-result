import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TimingAlertConfig,
  TimingAlertConfigSchema,
} from './schemas/timing-alert-config.schema';
import {
  TimingAlert,
  TimingAlertSchema,
} from './schemas/timing-alert.schema';
import {
  TimingAlertPoll,
  TimingAlertPollSchema,
} from './schemas/timing-alert-poll.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { TimingAlertConfigService } from './services/timing-alert-config.service';
import { TimingAlertPollService } from './services/timing-alert-poll.service';
import { MissDetectorService } from './services/miss-detector.service';
import { ProjectedRankService } from './services/projected-rank.service';
import { TimingAlertSseService } from './services/timing-alert-sse.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { CheckpointDiscoveryService } from './services/checkpoint-discovery.service';
import { DashboardSnapshotService } from './services/dashboard-snapshot.service';
import { PodiumService } from './services/podium.service';
import { SimulatorService } from './services/simulator.service';
import { TimingAlertMigrationsService } from './migrations/timing-alert-migrations';
import { TimingAlertPollCron } from './jobs/timing-alert-poll.cron';
import { TimingAlertAdminController } from './controllers/timing-alert-admin.controller';
import { TimingAlertSseController } from './controllers/timing-alert-sse.controller';
import { TimingAlertSimulatorAdminController } from './controllers/simulator-admin.controller';
import { TimingAlertSimulatorPublicController } from './controllers/simulator-public.controller';
import {
  TimingAlertSimulation,
  TimingAlertSimulationSchema,
} from './schemas/timing-alert-simulation.schema';
import {
  TimingAlertSimulationSnapshot,
  TimingAlertSimulationSnapshotSchema,
} from './schemas/timing-alert-simulation-snapshot.schema';
import { LogtoAuthModule } from '../logto-auth';
import { RaceResultModule } from '../race-result/race-result.module';

/**
 * Timing Miss Alert v1.0 — Mongo-native, dependency on Race document.
 *
 * **Architecture (Manager refactor 03/05/2026):**
 * - Mongo: 3 collection (`timing_alert_configs`, `timing_alerts`, `timing_alert_polls`)
 * - Read race document Mongo cho `apiUrl`, checkpoints, cutoff, window
 * - DROP crypto (race document đã có apiUrl plaintext, race-result module
 *   đã dùng OK 2 năm)
 * - DI: import `RaceResultModule` để reuse `RaceResultApiService` shared HTTP
 * - Auth: `LogtoAdminGuard` cho mọi admin endpoint
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimingAlertConfig.name, schema: TimingAlertConfigSchema },
      { name: TimingAlert.name, schema: TimingAlertSchema },
      { name: TimingAlertPoll.name, schema: TimingAlertPollSchema },
      // Read-only access — Mongoose forFeature multi-register OK.
      { name: RaceResult.name, schema: RaceResultSchema },
      // Race document — single source of truth cho apiUrl + checkpoints +
      // cutoff + start/endDate. Cùng schema đăng ký ở RacesModule (write).
      { name: Race.name, schema: RaceSchema },
      // Simulator — replay RR snapshots theo simulation clock cho test
      { name: TimingAlertSimulation.name, schema: TimingAlertSimulationSchema },
      {
        name: TimingAlertSimulationSnapshot.name,
        schema: TimingAlertSimulationSnapshotSchema,
      },
    ]),
    LogtoAuthModule,
    RaceResultModule,
  ],
  controllers: [
    TimingAlertAdminController,
    TimingAlertSseController,
    TimingAlertSimulatorAdminController,
    TimingAlertSimulatorPublicController,
  ],
  providers: [
    TimingAlertConfigService,
    TimingAlertPollService,
    MissDetectorService,
    ProjectedRankService,
    TimingAlertSseService,
    NotificationDispatcherService,
    TimingAlertPollCron,
    // Phase 2 — Operation Dashboard cockpit services
    CheckpointDiscoveryService,
    DashboardSnapshotService,
    PodiumService,
    SimulatorService,
    // Phase 3 — auto migrations on startup (drop legacy index + backfill detection_type)
    TimingAlertMigrationsService,
  ],
  exports: [TimingAlertConfigService],
})
export class TimingAlertModule {}
