import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { MedicalIncidentController } from './medical-incident.controller';
import {
  MedicalIncident,
  MedicalIncidentSchema,
} from './schemas/medical-incident.schema';
import { MedicalIncidentService } from './services/medical-incident.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { MedicalIncidentSseService } from './services/sse-broadcaster.service';

/**
 * F-018 — Medical Incident Tracker.
 *
 * Cross-module DI: only Race schema (race ID resolution). F-006 CourseMapService
 * NOT injected — frontend imports `SnapToPolyline.helper.ts` standalone for GPS
 * picking; backend doesn't need polyline data for storage. RaceMasterDataService
 * for BIB autocomplete is invoked via the existing `master:athlete:bib:{raceId}`
 * Redis HSET (frontend reads it directly via existing race-master-data-api).
 *
 * No circular DI risk: this module is a leaf — only depends on RaceSchema,
 * LogtoAuthModule, and the global Redis module.
 */
@Module({
  imports: [
    LogtoAuthModule,
    MongooseModule.forFeature([
      { name: MedicalIncident.name, schema: MedicalIncidentSchema },
      { name: Race.name, schema: RaceSchema },
    ]),
  ],
  controllers: [MedicalIncidentController],
  providers: [
    MedicalIncidentService,
    PdfGeneratorService,
    MedicalIncidentSseService,
  ],
  exports: [MedicalIncidentService, MedicalIncidentSseService],
})
export class MedicalIncidentModule {}
