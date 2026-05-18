import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Race, RaceSchema } from './schemas/race.schema';
import { SeoSyncLog, SeoSyncLogSchema } from './schemas/seo-sync-log.schema';
import { RacesController } from './races.controller';
import { RacesService } from './races.service';
import { CourseMapService } from './services/course-map.service';
import { SeoSlugSyncService } from './services/seo-slug-sync.service';
import { SeoSlugSyncCron } from './jobs/seo-slug-sync.cron';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: SeoSyncLog.name, schema: SeoSyncLogSchema },
    ]),
    HttpModule,
  ],
  controllers: [RacesController],
  providers: [RacesService, CourseMapService, SeoSlugSyncService, SeoSlugSyncCron],
  exports: [RacesService, CourseMapService, SeoSlugSyncService],
})
export class RacesModule {}
