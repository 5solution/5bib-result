import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaceResultController } from './race-result.controller';
import { RaceResultEntity } from './entities/race-result.entity';
import { RaceResultService } from './services/race-result.service';
import { RaceSyncCron } from './services/race-sync.cron';

@Module({
  imports: [TypeOrmModule.forFeature([RaceResultEntity])],
  controllers: [RaceResultController],
  providers: [RaceResultService, RaceSyncCron],
  exports: [RaceResultService],
})
export class RaceResultModule {}
