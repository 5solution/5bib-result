import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { AthleteReadonly } from './entities/athlete-readonly.entity';
import { AthleteSubinfoReadonly } from './entities/athlete-subinfo-readonly.entity';
import { OrderLineItemReadonly } from './entities/order-line-item-readonly.entity';
import { TicketTypeReadonly } from './entities/ticket-type-readonly.entity';
import { RaceCourseReadonly } from './entities/race-course-readonly.entity';
import { CodeReadonly } from './entities/code-readonly.entity';
import { ChipMappingService } from './services/chip-mapping.service';
import { ChipConfigService } from './services/chip-config.service';
import { ChipCacheService } from './services/chip-cache.service';
import { ChipLookupService } from './services/chip-lookup.service';
import { ChipStatsService } from './services/chip-stats.service';
import { ChipDeltaSyncCron } from './jobs/chip-delta-sync.cron';
import { ChipVerificationController } from './chip-verification.controller';
import { ChipVerificationPublicController } from './chip-verification-public.controller';
import { LogtoAuthModule } from '../logto-auth';

/**
 * Chip Verification module — only loads when env.platformDb.host is set
 * (conditional in app.module.ts, same pattern as Reconciliation/Merchant).
 *
 * Locks:
 *   - lookup-lock (anti-stampede on cache miss)
 *   - cron-lock   (per-race tick exclusivity)
 *   - is-first-verify (atomic SETNX guarantee)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChipRaceConfig.name, schema: ChipRaceConfigSchema },
      { name: ChipMapping.name, schema: ChipMappingSchema },
      { name: ChipVerification.name, schema: ChipVerificationSchema },
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    LogtoAuthModule,
  ],
  controllers: [ChipVerificationController, ChipVerificationPublicController],
  providers: [
    ChipConfigService,
    ChipMappingService,
    ChipCacheService,
    ChipLookupService,
    ChipStatsService,
    ChipDeltaSyncCron,
  ],
  exports: [ChipConfigService, ChipMappingService],
})
export class ChipVerificationModule {}
