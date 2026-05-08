import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RaceAthlete,
  RaceAthleteSchema,
} from '../../race-master-data/schemas/race-athlete.schema';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { CheckInSseService } from './check-in-sse.service';
import { CheckInLog, CheckInLogSchema } from './check-in-log.schema';

/**
 * F-015 Check-In Kiosk module.
 *
 * BR-CK-20 boundary: this module does NOT import `ChipVerificationModule`
 * or any of its services. Read/write convergence is at MongoDB only via
 * `RaceAthlete` schema (registered by `forFeature` here AND by
 * `RaceMasterDataModule` separately — Mongoose deduplicates).
 *
 * Registered into `RaceResultModule` (sibling) so its routes mount under
 * `/api/race-results/...` per Manager Plan §4.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceAthlete.name, schema: RaceAthleteSchema },
      { name: CheckInLog.name, schema: CheckInLogSchema },
    ]),
  ],
  controllers: [CheckInController],
  providers: [CheckInService, CheckInSseService],
  exports: [CheckInService, CheckInSseService],
})
export class CheckInModule {}
