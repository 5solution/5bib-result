import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import {
  RaceLanding,
  RaceLandingSchema,
} from './schemas/race-landing.schema';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';

/**
 * FEATURE-083 — LandingModule (lean-fork of F-027 PromoHubModule pattern).
 *
 * Reads Mongo + Redis only. Reads `Race` model (forFeature) for create-seed —
 * this is a MODEL read, NOT cross-module service DI (RacesService is NOT
 * injected). Section auto-data (course/sponsors/results) is fetched at the
 * PUBLIC frontend SSR layer, keeping the DI graph clean (same trade-off as
 * PromoHubModule).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceLanding.name, schema: RaceLandingSchema },
      { name: Race.name, schema: RaceSchema },
    ]),
    LogtoAuthModule,
  ],
  controllers: [LandingController],
  providers: [LandingService],
  exports: [LandingService],
})
export class LandingModule {}
