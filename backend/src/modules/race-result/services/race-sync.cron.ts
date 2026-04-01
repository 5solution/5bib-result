import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RaceResultService } from './race-result.service';

@Injectable()
export class RaceSyncCron {
  private readonly logger = new Logger(RaceSyncCron.name);
  private isSyncing = false;

  constructor(private readonly raceResultService: RaceResultService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    if (this.isSyncing) {
      this.logger.warn('Previous sync still in progress, skipping...');
      return;
    }

    try {
      this.isSyncing = true;
      this.logger.log('Starting scheduled race results sync');
      await this.raceResultService.syncAllRaceResults();
    } catch (error) {
      this.logger.error(`Cron job error: ${error.message}`, error.stack);
    } finally {
      this.isSyncing = false;
    }
  }
}
