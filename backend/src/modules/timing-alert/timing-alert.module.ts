import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TimingAlertConfig,
  TimingAlertConfigSchema,
} from './schemas/timing-alert-config.schema';
import {
  TimingAlert,
  TimingAlertSchema,
} from './schemas/timing-alert.schema';
import {
  TimingAlertPoll,
  TimingAlertPollSchema,
} from './schemas/timing-alert-poll.schema';
import { ApiKeyCrypto } from './crypto/api-key.crypto';
import { TimingAlertConfigService } from './services/timing-alert-config.service';
import { TimingAlertAdminController } from './controllers/timing-alert-admin.controller';
import { LogtoAuthModule } from '../logto-auth';
import { RaceResultModule } from '../race-result/race-result.module';

/**
 * Timing Miss Alert v1.0 — module độc lập 100% với MySQL legacy.
 *
 * **Architecture (Phase 1A skeleton):**
 * - Mongo: 3 collection (`timing_alert_configs`, `timing_alerts`, `timing_alert_polls`)
 * - Crypto: AES-256-GCM cho RR API keys at rest
 * - DI: import `RaceResultModule` để reuse `RaceResultApiService` shared HTTP
 *   client (Phase 1B sẽ inject vào poll engine).
 * - Auth: `LogtoAdminGuard` cho mọi admin endpoint
 *
 * **Phase 1A scope:** config CRUD + crypto. KHÔNG cron, KHÔNG SSE, KHÔNG
 * miss detector — Phase 1B/1C/2.
 *
 * **Conditional load:** module được wire vào `app.module.ts` chỉ khi
 * `env.timingAlert.encryptionKey` non-empty (giống pattern Reconciliation
 * theo `env.platformDb.host`). Nếu env unset → module skip → admin endpoint
 * 404 gracefully, KHÔNG crash app.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimingAlertConfig.name, schema: TimingAlertConfigSchema },
      { name: TimingAlert.name, schema: TimingAlertSchema },
      { name: TimingAlertPoll.name, schema: TimingAlertPollSchema },
    ]),
    LogtoAuthModule,
    // Phase 0 refactor: reuse `RaceResultApiService` (HTTP client) cho
    // poll engine race day. Phase 1A chưa dùng — import sẵn để Phase 1B
    // chỉ cần inject service vào poll service.
    RaceResultModule,
  ],
  controllers: [TimingAlertAdminController],
  providers: [ApiKeyCrypto, TimingAlertConfigService],
  exports: [TimingAlertConfigService],
})
export class TimingAlertModule {}
