import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { LogtoAuthModule } from '../logto-auth';
import {
  PromoHubClick,
  PromoHubClickSchema,
} from './schemas/promo-hub-click.schema';
import {
  PromoHubView,
  PromoHubViewSchema,
} from './schemas/promo-hub-view.schema';
import { PromoHubAnalyticsController } from './promo-hub-analytics.controller';
import { PromoHubAnalyticsService } from './promo-hub-analytics.service';

/**
 * FEATURE-027 — PromoHubAnalyticsModule.
 *
 * Click/view event recording (public, rate-limited via Throttler) +
 * admin summary aggregation. Independent from PromoHubModule (no DI
 * cycle).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromoHubClick.name, schema: PromoHubClickSchema },
      { name: PromoHubView.name, schema: PromoHubViewSchema },
    ]),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    LogtoAuthModule,
  ],
  controllers: [PromoHubAnalyticsController],
  providers: [PromoHubAnalyticsService],
  exports: [PromoHubAnalyticsService],
})
export class PromoHubAnalyticsModule {}
