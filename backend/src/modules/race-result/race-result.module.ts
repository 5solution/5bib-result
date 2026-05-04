import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { RaceResult, RaceResultSchema } from './schemas/race-result.schema';
import { SyncLog, SyncLogSchema } from './schemas/sync-log.schema';
import { ResultClaim, ResultClaimSchema } from './schemas/result-claim.schema';
import { ShareEvent, ShareEventSchema } from './schemas/share-event.schema';
import { RaceResultController } from './race-result.controller';
import { RaceResultService } from './services/race-result.service';
import { RaceResultApiService } from './services/race-result-api.service';
import { ResultImageService } from './services/result-image.service';
import { BadgeService } from './services/badge.service';
import { RaceSyncCron } from './services/race-sync.cron';
import { ShareEventService } from './services/share-event.service';
import { ShareNurtureCron } from './services/share-nurture.cron';
import { RacesModule } from '../races/races.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
      { name: ShareEvent.name, schema: ShareEventSchema },
    ]),
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
  ],
  controllers: [RaceResultController],
  providers: [
    RaceResultApiService,
    RaceResultService,
    ResultImageService,
    BadgeService,
    RaceSyncCron,
    ShareEventService,
    ShareNurtureCron,
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
export class RaceResultModule { }
