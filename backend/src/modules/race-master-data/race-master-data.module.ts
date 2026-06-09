import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RaceAthlete,
  RaceAthleteSchema,
} from './schemas/race-athlete.schema';
import {
  RaceMasterSyncLog,
  RaceMasterSyncLogSchema,
} from './schemas/race-master-sync-log.schema';
// B-1: cron auto-warmup cần đọc ChipRaceConfig để biết race nào enable
// chip-verify. Forward import schema (KHÔNG import ChipVerificationModule
// để tránh circular: ChipVerificationModule imports RaceMasterDataModule).
import {
  ChipRaceConfig,
  ChipRaceConfigSchema,
} from '../chip-verification/schemas/chip-race-config.schema';
import { AthleteReadonly } from './entities/athlete-readonly.entity';
import { AthleteSubinfoReadonly } from './entities/athlete-subinfo-readonly.entity';
import { OrderLineItemReadonly } from './entities/order-line-item-readonly.entity';
import { TicketTypeReadonly } from './entities/ticket-type-readonly.entity';
import { RaceCourseReadonly } from './entities/race-course-readonly.entity';
import { CodeReadonly } from './entities/code-readonly.entity';
import { RaceMasterCacheService } from './services/race-master-cache.service';
import { RaceAthleteSyncService } from './services/race-athlete-sync.service';
import { RaceAthleteLookupService } from './services/race-athlete-lookup.service';
import { RaceMasterDeltaSyncCron } from './jobs/race-master-delta-sync.cron';
import { RaceMasterDataAdminController } from './controllers/race-master-data-admin.controller';
import { LogtoAuthModule } from '../logto-auth';
// F-048 Phase 1A — Race mapping migration (BR-48-01/02)
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { RaceReadonly } from '../promo-hub/entities/race-readonly.entity';
import { RaceMysqlIdBackfillService } from './services/race-mysql-id-backfill.service';
import { RaceMysqlIdBackfillController } from './controllers/race-mysql-id-backfill.controller';
// F-048 Phase 2 — Identity clustering (BR-48-11..19)
import {
  AthleteIdentityCluster,
  AthleteIdentityClusterSchema,
} from './schemas/athlete-identity-cluster.schema';
import { AthleteIdentityClusteringService } from './services/athlete-identity-clustering.service';
import { AthleteIdentityClusteringCron } from './jobs/athlete-identity-clustering.cron';
import {
  IdentityClusterAdminController,
  IdentityCoverageStatsController,
} from './controllers/identity-cluster-admin.controller';
// F-048 Phase 1B — Bulk sync orchestrator + ended-race cron (BR-48-06/09)
import { BulkSyncOrchestratorService } from './services/bulk-sync-orchestrator.service';
import { BulkSyncController } from './controllers/bulk-sync.controller';
import { EndedRaceMasterSyncCron } from './jobs/ended-race-master-sync.cron';

/**
 * Race Master Data — Foundation module.
 *
 * Single source of truth cho athlete pre-race data. Sync MySQL `'platform'`
 * → cache MongoDB → cache Redis → expose `RaceAthleteLookupService` (DI)
 * cho consumer modules.
 *
 * Conditional load: chỉ khởi tạo khi `env.platformDb.host` có giá trị
 * (configured trong `app.module.ts` cùng pattern Reconciliation).
 *
 * Exports duy nhất `RaceAthleteLookupService` — TypeORM entity + Sync
 * service KHÔNG được export ra ngoài. Boundary contract:
 *   - Consumer modules KHÔNG import entity hay TypeORM connection.
 *   - Consumer modules KHÔNG có cron riêng cho athlete sync.
 *   - Consumer modules call `triggerSync()` lazy init khi cần.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RaceAthlete.name, schema: RaceAthleteSchema },
      { name: RaceMasterSyncLog.name, schema: RaceMasterSyncLogSchema },
      // B-1 auto-warmup: read-only access cho cron bootstrap để filter
      // chip_verify_enabled races. Schema cũng đăng ký ở chip-verification
      // module — forFeature multi-register OK trong Mongoose.
      { name: ChipRaceConfig.name, schema: ChipRaceConfigSchema },
      // F-048 BR-48-01 — race.mysql_race_id field write access for migration
      { name: Race.name, schema: RaceSchema },
      // F-048 Phase 2 BR-48-11 — Identity clusters collection
      {
        name: AthleteIdentityCluster.name,
        schema: AthleteIdentityClusterSchema,
      },
    ]),
    TypeOrmModule.forFeature(
      [
        AthleteReadonly,
        AthleteSubinfoReadonly,
        OrderLineItemReadonly,
        TicketTypeReadonly,
        RaceCourseReadonly,
        CodeReadonly,
        // F-048 Adjustment #3 — cross-module entity reuse for migration lookup
        RaceReadonly,
      ],
      'platform',
    ),
    LogtoAuthModule,
  ],
  controllers: [
    RaceMasterDataAdminController,
    RaceMysqlIdBackfillController,
    // F-048 Phase 2 — Identity cluster admin endpoints
    IdentityClusterAdminController,
    IdentityCoverageStatsController,
    // F-048 Phase 1B — Bulk sync admin endpoints
    BulkSyncController,
  ],
  providers: [
    RaceMasterCacheService,
    RaceAthleteSyncService,
    RaceAthleteLookupService,
    RaceMasterDeltaSyncCron,
    // F-048 Phase 1A — Migration service
    RaceMysqlIdBackfillService,
    // F-048 Phase 2 — Identity clustering
    AthleteIdentityClusteringService,
    AthleteIdentityClusteringCron,
    // F-048 Phase 1B — Bulk sync + ended-race cron
    BulkSyncOrchestratorService,
    EndedRaceMasterSyncCron,
  ],
  exports: [
    RaceAthleteLookupService,
    // F-079 BR-79-21 — export AthleteIdentityClusteringService cho InvoiceReconcileModule
    // reuse `getRaceTitlesByMysqlIds()` method (Redis cache F-049 + Mongo fallback).
    // Forced cascade: Manager `/5bib-plan` đọc nhầm providers thành exports.
    AthleteIdentityClusteringService,
  ],
})
export class RaceMasterDataModule {}
