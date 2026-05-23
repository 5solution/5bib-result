import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogtoAuthModule } from '../logto-auth';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import {
  ResultClaim,
  ResultClaimSchema,
} from '../race-result/schemas/result-claim.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../reconciliation/schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigSchema,
} from '../merchant/schemas/merchant-config.schema';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { DashboardController } from './dashboard.controller';
import { DashboardKpiService } from './services/kpi.service';
import { DashboardSparklineService } from './services/sparkline.service';
import { DashboardLiveRacesService } from './services/live-races.service';
import { DashboardUpcomingRacesService } from './services/upcoming-races.service';
import { DashboardPendingTasksService } from './services/pending-tasks.service';
import { DashboardRecentActivityService } from './services/recent-activity.service';
import { DashboardSystemStatusService } from './services/system-status.service';
import { DashboardAggregatorCron } from './services/dashboard-aggregator.cron';

/**
 * F-023 — Dashboard admin module.
 *
 * READ-ONLY module: chỉ aggregate + serve. Audit emit nằm ở `AuditModule`
 * và inject vào các module ghi (races/claims/recon/awards/medical) — cross-cutting.
 */
@Module({
  imports: [
    LogtoAuthModule,
    AuditModule,
    // Đăng ký feature trống cho connection 'platform' — đảm bảo DataSource
    // được Nest inject vào DashboardKpiService / DashboardSparklineService.
    TypeOrmModule.forFeature([], 'platform'),
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
      { name: Reconciliation.name, schema: ReconciliationSchema },
      // F-059 — MerchantConfig pre-load for sparkline 30-day cascade fee
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
    ]),
    // F-059 — FeeService.computeFeeForOrdersAggregate() delegation (F-058 reuse)
    FinanceModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardKpiService,
    DashboardSparklineService,
    DashboardLiveRacesService,
    DashboardUpcomingRacesService,
    DashboardPendingTasksService,
    DashboardRecentActivityService,
    DashboardSystemStatusService,
    DashboardAggregatorCron,
  ],
})
export class DashboardModule {}
