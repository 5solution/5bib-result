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
    ]),
    TypeOrmModule.forFeature(
      [
        AthleteReadonly,
        AthleteSubinfoReadonly,
        OrderLineItemReadonly,
        TicketTypeReadonly,
        RaceCourseReadonly,
        CodeReadonly,
      ],
      'platform',
    ),
    LogtoAuthModule,
  ],
  controllers: [RaceMasterDataAdminController],
  providers: [
    RaceMasterCacheService,
    RaceAthleteSyncService,
    RaceAthleteLookupService,
    RaceMasterDeltaSyncCron,
  ],
  exports: [RaceAthleteLookupService],
})
export class RaceMasterDataModule {}
