import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  ChipRaceConfig,
  ChipRaceConfigSchema,
} from './schemas/chip-race-config.schema';
import {
  ChipMapping,
  ChipMappingSchema,
} from './schemas/chip-mapping.schema';
import {
  ChipVerification,
  ChipVerificationSchema,
} from './schemas/chip-verification.schema';
import { ChipMappingService } from './services/chip-mapping.service';
import { ChipConfigService } from './services/chip-config.service';
import { ChipLookupService } from './services/chip-lookup.service';
import { ChipStatsService } from './services/chip-stats.service';
import { ChipVerificationController } from './chip-verification.controller';
import { ChipVerificationPublicController } from './chip-verification-public.controller';
import { LogtoAuthModule } from '../logto-auth';
import { RaceMasterDataModule } from '../race-master-data/race-master-data.module';

/**
 * Chip Verification v1.3 — consume Race Master Data.
 *
 * Architectural change từ v1.2:
 *   - DROP TypeOrmModule.forFeature (5 read-only entity) → moved to race-master-data
 *   - DROP ChipCacheService (preload + delta + on-demand fallback) → master-data 3-tier
 *   - DROP ChipDeltaSyncCron → master-data có cron @Cron mỗi 5 phút
 *   - ADD RaceMasterDataModule import → inject RaceAthleteLookupService
 *
 * Module này CHỈ còn business logic riêng:
 *   - chip_mappings CRUD + CSV import (verify BIB exists qua master data)
 *   - chip_verifications log
 *   - Token lifecycle (GENERATE/ROTATE/DISABLE) — auto trigger master sync
 *   - Stats
 *
 * Locks:
 *   - is-first-verify (atomic SETNX) — vẫn giữ
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChipRaceConfig.name, schema: ChipRaceConfigSchema },
      { name: ChipMapping.name, schema: ChipMappingSchema },
      { name: ChipVerification.name, schema: ChipVerificationSchema },
    ]),
    RaceMasterDataModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    LogtoAuthModule,
  ],
  controllers: [ChipVerificationController, ChipVerificationPublicController],
  providers: [
    ChipConfigService,
    ChipMappingService,
    ChipLookupService,
    ChipStatsService,
  ],
  exports: [ChipConfigService, ChipMappingService],
})
export class ChipVerificationModule {}
