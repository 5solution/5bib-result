import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CourseDataOpsService } from './services/course-data-ops.service';
import { RaceResultModule } from '../race-result/race-result.module';
import { RacesModule } from '../races/races.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import {
  SyncLog,
  SyncLogSchema,
} from '../race-result/schemas/sync-log.schema';

@Module({
  imports: [
    RaceResultModule, // exports RaceResultService + RaceSyncCron (F-068)
    RacesModule,
    NotificationModule,
    AuditModule, // F-068: AuditLogService for course.* audit emit
    // F-068: re-register schemas locally so CourseDataOpsService can inject
    // RaceResult + SyncLog models without going through RaceResultModule's
    // exports (which only expose the *Service layer).
    MongooseModule.forFeature([
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, CourseDataOpsService],
})
export class AdminModule {}
