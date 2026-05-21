import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RaceResult, RaceResultSchema } from './schemas/race-result.schema';
import { SyncLog, SyncLogSchema } from './schemas/sync-log.schema';
import { ResultClaim, ResultClaimSchema } from './schemas/result-claim.schema';
import { ShareEvent, ShareEventSchema } from './schemas/share-event.schema';
import { RaceResultController } from './race-result.controller';
import { RaceResultService } from './services/race-result.service';
// F-046 — Programmatic SEO Race Recap
import { RaceRecapService } from './services/race-recap.service';
import {
  RaceRecapInsight,
  RaceRecapInsightSchema,
} from './schemas/race-recap-insight.schema';
// F-047 — Athlete Profile Pages programmatic SEO
import { AthleteProfileService } from './services/athlete-profile.service';
// F-047 Phase 1B — Cross-race identity merge + photo upload + admin + cron + sitemap
import {
  AthleteProfile,
  AthleteProfileSchema,
} from './schemas/athlete-profile.schema';
import {
  AthletePhoto,
  AthletePhotoSchema,
} from './schemas/athlete-photo.schema';
import { AthleteIdentityMergeService } from './services/athlete-identity-merge.service';
import { AthletePhotoService } from './services/athlete-photo.service';
import { AthleteProfileBackfillCron } from './cron/athlete-profile-backfill.cron';
import { AthleteAdminController } from './admin/athlete-admin.controller';
// F-047 RESUME — cluster + race schema registration for cross-module identity lookup
import {
  AthleteIdentityCluster,
  AthleteIdentityClusterSchema,
} from '../race-master-data/schemas/athlete-identity-cluster.schema';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { S3Client } from '@aws-sdk/client-s3';
import { RaceResultApiService } from './services/race-result-api.service';
import { ResultImageService } from './services/result-image.service';
import { BadgeService } from './services/badge.service';
import { RaceSyncCron } from './services/race-sync.cron';
import { ShareEventService } from './services/share-event.service';
import { ShareNurtureCron } from './services/share-nurture.cron';
import { RacesModule } from '../races/races.module';
import { UploadModule } from '../upload/upload.module';
// F-029 — OptionalLogtoAuthGuard cho public race-result endpoint nhằm extract
// user role/scope (anon vẫn pass, nhưng staff/admin được unlock draft preview).
import { LogtoAuthModule } from '../logto-auth';
// F-017 — cross-module DI for chip lookup (ChipMappingService + ChipConfigService).
// Imports ChipVerificationModule which already exports both services. Race-day
// flow is MongoDB-only: ChipConfigService.findByMongoId → ChipMappingService.findByChipId
// → existing RaceResultService.getAthleteDetail. NEVER live MySQL at runtime.
import { ChipVerificationModule } from '../chip-verification/chip-verification.module';
// F-010 — read-only access to timing-alert config schema (pace_alert_threshold).
// Cross-module @InjectModel direct, NO TimingAlertModule import (avoid circular DI:
// TimingAlertModule already imports RaceResultModule for RaceResultApiService).
import {
  TimingAlertConfig,
  TimingAlertConfigSchema,
} from '../timing-alert/schemas/timing-alert-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
      { name: ShareEvent.name, schema: ShareEventSchema },
      // F-010 BR-FC-10/11 — register TimingAlertConfig schema for read-only
      // pace_alert_threshold lookup in RaceResultService.getPaceAlertThreshold().
      { name: TimingAlertConfig.name, schema: TimingAlertConfigSchema },
      // F-046 — Race recap insight (editorial 70/30 layer)
      { name: RaceRecapInsight.name, schema: RaceRecapInsightSchema },
      // F-047 Phase 1B — Athlete profile collection + photo collection
      { name: AthleteProfile.name, schema: AthleteProfileSchema },
      { name: AthletePhoto.name, schema: AthletePhotoSchema },
      // F-047 RESUME — cluster + race cross-module read for identity merge.
      // We re-register here (vs importing RaceMasterData/RacesModule for the
      // schemas) because RacesModule already imported above provides services
      // but does NOT re-export the @InjectModel(Race.name) token. Same pattern
      // as TimingAlertConfig above for cross-module schema injection.
      {
        name: AthleteIdentityCluster.name,
        schema: AthleteIdentityClusterSchema,
      },
      { name: Race.name, schema: RaceSchema },
    ]),
    // F-047 Phase 1B — Cron scheduling for backfill
    ScheduleModule.forRoot(),
    HttpModule,
    // Module-scoped throttler so @Throttle decorators on result-image /
    // share-count endpoints apply without colliding with other modules.
    // Default cap is an umbrella; per-endpoint @Throttle() decorators override.

    // temporatyly disable throttler to unblock sync while we investigate performance issues
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 60_000,
    //     limit: 60*20,
    //   },
    // ]),
    RacesModule,
    UploadModule,
    // F-017 — cross-module DI ChipMappingService + ChipConfigService.
    // ChipVerificationModule exports both per existing chip-verification.module.ts:61-62.
    ChipVerificationModule,
    // F-029 HIGH-RR-01 — OptionalLogtoAuthGuard cho GET /race-results.
    LogtoAuthModule,
  ],
  controllers: [RaceResultController, AthleteAdminController],
  providers: [
    RaceResultApiService,
    RaceResultService,
    ResultImageService,
    BadgeService,
    RaceSyncCron,
    ShareEventService,
    ShareNurtureCron,
    // F-046 — Race recap aggregation engine
    RaceRecapService,
    // F-047 — Athlete profile aggregation engine
    AthleteProfileService,
    // F-047 Phase 1B — Identity merge + photo + cron
    AthleteIdentityMergeService,
    AthletePhotoService,
    AthleteProfileBackfillCron,
    {
      provide: S3Client,
      useFactory: () =>
        new S3Client({
          region: process.env.AWS_REGION ?? 'ap-southeast-1',
          credentials: process.env.AWS_ACCESS_KEY_ID
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
              }
            : undefined,
        }),
    },
  ],
  // Phase 0 — export `RaceResultApiService` để Timing Alert module reuse
  // shared HTTP client (axios timeout, error handling, URL masking) thay vì
  // tự maintain HTTP client riêng. Timing Alert sẽ inject service này
  // trong poll engine (Phase 1B) qua module imports list.
  exports: [
    RaceResultService,
    RaceResultApiService,
    BadgeService,
    ShareEventService,
  ],
})
export class RaceResultModule {}
