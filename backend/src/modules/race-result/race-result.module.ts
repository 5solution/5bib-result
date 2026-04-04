import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { RaceResult, RaceResultSchema } from './schemas/race-result.schema';
import { SyncLog, SyncLogSchema } from './schemas/sync-log.schema';
import { ResultClaim, ResultClaimSchema } from './schemas/result-claim.schema';
import { RaceResultController } from './race-result.controller';
import { RaceResultService } from './services/race-result.service';
import { ResultImageService } from './services/result-image.service';
import { RaceSyncCron } from './services/race-sync.cron';
import { RacesModule } from '../races/races.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
    ]),
    HttpModule,
    RacesModule,
    UploadModule,
  ],
  controllers: [RaceResultController],
  providers: [RaceResultService, ResultImageService, RaceSyncCron],
  exports: [RaceResultService],
})
export class RaceResultModule {}
