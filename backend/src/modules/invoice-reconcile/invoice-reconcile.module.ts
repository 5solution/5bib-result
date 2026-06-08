import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { OrderMetadataReadonly } from './entities/order-metadata-readonly.entity';
import { InvoiceReconcileController } from './invoice-reconcile.controller';
import { InvoiceReconcileService } from './services/invoice-reconcile.service';
import { MisaMeinvoiceClient } from './services/misa-meinvoice.client';
import { InvoiceTelegramClient } from './services/invoice-telegram.client';
import { InvoiceAlertService } from './services/invoice-alert.service';
import { DailyCountersService } from './services/daily-counters.service';
import { InvoiceScanTickCron } from './crons/scan-tick.cron';
import { InvoiceHourlyRecapCron } from './crons/hourly-recap.cron';
import { InvoiceEodRecapCron } from './crons/eod-recap.cron';
import { AuditModule } from '../audit/audit.module';

/**
 * F-076 — Invoice Reconcile module.
 *
 * KHÔNG reuse `notification/telegram.service.ts` (BR-14a) — F-076 dùng bot
 * RIÊNG `@invoice_5bib_daily_bot` qua `InvoiceTelegramClient`.
 *
 * NotificationModule là `@Global()` → MailService accessible without explicit
 * import (used for email fallback in InvoiceAlertService).
 *
 * AuditModule explicit import → optional inject in controller for audit emit.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderMetadataReadonly], 'platform'),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuditModule,
  ],
  controllers: [InvoiceReconcileController],
  providers: [
    InvoiceReconcileService,
    MisaMeinvoiceClient,
    InvoiceTelegramClient,
    InvoiceAlertService,
    DailyCountersService,
    InvoiceScanTickCron,
    InvoiceHourlyRecapCron,
    InvoiceEodRecapCron,
  ],
})
export class InvoiceReconcileModule {}
