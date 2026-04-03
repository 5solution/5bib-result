import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RaceResultModule } from '../race-result/race-result.module';
import { RacesModule } from '../races/races.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [RaceResultModule, RacesModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
