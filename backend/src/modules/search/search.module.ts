import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: RaceResult.name, schema: RaceResultSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
