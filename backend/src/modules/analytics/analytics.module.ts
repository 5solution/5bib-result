import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant } from '../merchant/entities/tenant.entity';
import {
  MerchantConfig,
  MerchantConfigSchema,
} from '../merchant/schemas/merchant-config.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../reconciliation/schemas/reconciliation.schema';
import {
  ResultClaim,
  ResultClaimSchema,
} from '../race-result/schemas/result-claim.schema';
import {
  RaceResult,
  RaceResultSchema,
} from '../race-result/schemas/race-result.schema';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCron } from './analytics.cron';

// F-058 — Import FinanceModule (export FeeService) + ReconciliationModule
// (export ReconciliationService) for analytics fee cascade + discrepancy check.
import { FinanceModule } from '../finance/finance.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

// F-026 services + cron
import { RepeatAthleteService } from './services/repeat-athlete.service';
import { MerchantChurnService } from './services/merchant-churn.service';
import { TimeToFillService } from './services/time-to-fill.service';
import { ClaimRateService } from './services/claim-rate.service';
import { GeographicDemographicService } from './services/geographic-demographic.service';
import { RefundCancelService } from './services/refund-cancel.service';
import { AnalyticsAggregatorCron } from './services/analytics-aggregator.cron';

// F-062 Wave 2B-2 — NEW merchant-comparison service (BR-SA-22 a/b/c)
import { MerchantComparisonService } from './services/merchant-comparison.service';

// F-062 Wave 2C-1 — NEW race-performance service (BR-SA-21 a/b/c)
import { RacePerformanceService } from './services/race-performance.service';

// F-062 Wave 2C-2 — NEW runner-analytics service (BR-SA-20 a-f)
import { RunnerAnalyticsService } from './services/runner-analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'platform'),
    MongooseModule.forFeature([
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
      { name: Reconciliation.name, schema: ReconciliationSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
      { name: RaceResult.name, schema: RaceResultSchema },
    ]),
    // F-058 — FeeService delegation + ReconciliationService for discrepancy-check
    FinanceModule,
    ReconciliationModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsCron,
    RepeatAthleteService,
    MerchantChurnService,
    TimeToFillService,
    ClaimRateService,
    GeographicDemographicService,
    RefundCancelService,
    AnalyticsAggregatorCron,
    // F-062 Wave 2B-2 — Merchant Comparison Analytics (BR-SA-22)
    MerchantComparisonService,
    // F-062 Wave 2C-1 — Race Performance Analytics (BR-SA-21)
    RacePerformanceService,
    // F-062 Wave 2C-2 — Runner Behavior Analytics (BR-SA-20 a-f)
    RunnerAnalyticsService,
  ],
})
export class AnalyticsModule {}
