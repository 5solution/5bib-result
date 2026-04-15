import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: RaceResult.name, schema: RaceResultSchema },
    ]),
  ],
  controllers: [HomepageController],
  providers: [HomepageService],
  exports: [HomepageService],
})
export class HomepageModule {}
