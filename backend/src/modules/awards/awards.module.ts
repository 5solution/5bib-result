import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogtoAuthModule } from '../logto-auth';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import {
  RaceAthlete,
  RaceAthleteSchema,
} from '../race-master-data/schemas/race-athlete.schema';
import { AthleteReadonly } from '../race-master-data/entities/athlete-readonly.entity';
import {
  Podium,
  PodiumSchema,
} from './schemas/podium.schema';
import {
  AnomalyWarning,
  AnomalyWarningSchema,
} from './schemas/anomaly-warning.schema';
import { AwardsService } from './services/awards.service';
import { AGBracketCalcService } from './services/ag-bracket-calc.service';
import { ConfidenceScorerService } from './services/confidence-scorer.service';
import { AnomalyDetectorService } from './services/anomaly-detector.service';
import { NormalizeVendorQuirksService } from './services/normalize-vendor-quirks.service';
import { PodiumStateMachineService } from './services/podium-state-machine.service';
import { PredictedRankService } from './services/predicted-rank.service';
import { PodiumPdfService } from './services/podium-pdf.service';
import { AwardsSseService } from './services/awards-sse.service';
import { AwardsAutoFinalCron } from './services/awards-auto-final.cron';
// F-019 v2 — independent calc + 2-layer verify
import { AgeComputerService } from './services/age-computer.service';
import { IndependentRankingService } from './services/independent-ranking.service';
import { VendorMismatchDetectorService } from './services/vendor-mismatch-detector.service';
import { AGEligibilityReportService } from './services/ag-eligibility-report.service';
import { AwardsController } from './awards.controller';

/**
 * F-019 — Awards Age Group Podium + Warnings (Race Ops Cluster #9 #2).
 * F-019 v2 — Independent calc + 2-layer verify (5BIB primary + Vendor cross-check).
 *
 * Cross-module DI:
 *   - Mongoose: Race + RaceResult + RaceAthlete (master-data) read-only.
 *   - TypeORM 'platform': AthleteReadonly (1-hop dob lookup) cho AgeComputer.
 *
 * F-018 audit trail pattern verbatim ported via stateHistory[] $push only.
 * F-013 PDF pattern verbatim ported via PodiumPdfService (@napi-rs/canvas).
 *
 * v2 services:
 *   - AgeComputerService: DOB → ageOnRaceDay (privacy boundary BR-03 preserved).
 *   - IndependentRankingService: 5BIB tự rank, không trust vendor OverallRank.
 *   - VendorMismatchDetectorService: Pattern H VENDOR_MISMATCH cross-check.
 *   - AGEligibilityReportService: pre-race readiness DOB coverage + bracket dist.
 */
@Module({
  imports: [
    LogtoAuthModule,
    MongooseModule.forFeature([
      { name: Podium.name, schema: PodiumSchema },
      { name: AnomalyWarning.name, schema: AnomalyWarningSchema },
      { name: Race.name, schema: RaceSchema },
      { name: RaceResult.name, schema: RaceResultSchema },
      { name: RaceAthlete.name, schema: RaceAthleteSchema },
    ]),
    TypeOrmModule.forFeature([AthleteReadonly], 'platform'),
  ],
  controllers: [AwardsController],
  providers: [
    AwardsService,
    AGBracketCalcService,
    ConfidenceScorerService,
    AnomalyDetectorService,
    NormalizeVendorQuirksService,
    PodiumStateMachineService,
    PredictedRankService,
    PodiumPdfService,
    AwardsSseService,
    AwardsAutoFinalCron,
    // F-019 v2
    AgeComputerService,
    IndependentRankingService,
    VendorMismatchDetectorService,
    AGEligibilityReportService,
  ],
  exports: [AwardsService],
})
export class AwardsModule {}
