import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogtoAuthModule } from '../logto-auth';
import { PromoHub, PromoHubSchema } from './schemas/promo-hub.schema';
import { PromoHubController } from './promo-hub.controller';
import { PromoHubService } from './promo-hub.service';

/**
 * FEATURE-027 — PromoHubModule.
 *
 * Independent module — only reads from Mongo + Redis. Cross-module
 * dependencies (RacesService, SponsorsService, RaceResultService) needed
 * only by section-config render path (race_calendar/featured_races/
 * sponsors/recent_results auto-sync). To avoid circular DI, that lookup
 * happens at section render time on the PUBLIC frontend page (SSR fetch
 * from those service APIs) — backend service KHÔNG inject those services
 * here. Trade-off: 1 extra service call per section type that needs
 * external data, but DI graph clean.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PromoHub.name, schema: PromoHubSchema }]),
    LogtoAuthModule,
  ],
  controllers: [PromoHubController],
  providers: [PromoHubService],
  exports: [PromoHubService],
})
export class PromoHubModule {}
