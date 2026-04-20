import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AthleteStarsController } from './athlete-stars.controller';
import { AthleteStarsService } from './athlete-stars.service';
import {
  AthleteStar,
  AthleteStarSchema,
} from './schemas/athlete-star.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { ClerkAuthModule } from '../clerk-auth';

@Module({
  imports: [
    ClerkAuthModule,
    MongooseModule.forFeature([
      { name: AthleteStar.name, schema: AthleteStarSchema },
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: Race.name, schema: RaceSchema },
    ]),
  ],
  controllers: [AthleteStarsController],
  providers: [AthleteStarsService],
  exports: [AthleteStarsService],
})
export class AthleteStarsModule {}
