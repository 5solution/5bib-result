import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';
import { Tenant } from '../merchant/entities/tenant.entity';
import { NotificationModule } from '../notification/notification.module';

import { MerchantPortalAdminController } from './merchant-portal-admin.controller';
import { MerchantPortalController } from './merchant-portal.controller';
import {
  MerchantPortalAccess,
  MerchantPortalAccessSchema,
} from './schemas/merchant-portal-access.schema';
import {
  MerchantRaceTarget,
  MerchantRaceTargetSchema,
} from './schemas/merchant-race-target.schema';
import { MerchantPortalAccessService } from './services/merchant-portal-access.service';
import { MerchantPortalService } from './services/merchant-portal.service';

/**
 * F-069 M2a — MerchantPortalModule.
 *
 * M2a scope: Admin endpoints + access config CRUD service. Merchant-facing
 * report endpoints + service core (resolveAccessibleRaces) deferred to M2b.
 *
 * Imports:
 *  - MongooseModule.forFeature MerchantPortalAccess (M2a)
 *  - TypeOrmModule.forFeature Tenant với named connection 'platform' (BR-MP-33 validation)
 *  - LogtoAuthModule (LogtoAdminGuard + LogtoService cho M1 lookup reuse)
 *  - AuditModule (AuditLogService cho BR-MP-17 emit)
 *
 * Exports MerchantPortalAccessService cho M2b service depend on it via
 * resolveAccessibleRaces composition.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MerchantPortalAccess.name, schema: MerchantPortalAccessSchema },
      { name: MerchantRaceTarget.name, schema: MerchantRaceTargetSchema }, // F-070
    ]),
    TypeOrmModule.forFeature([Tenant], 'platform'),
    LogtoAuthModule,
    AuditModule,
    FinanceModule, // M2b-3 — FeeService for revenue fee cascade (BR-MP-10)
    NotificationModule, // M3b — MailService for auto-provision invite email
  ],
  controllers: [MerchantPortalAdminController, MerchantPortalController],
  providers: [MerchantPortalAccessService, MerchantPortalService],
  exports: [MerchantPortalAccessService, MerchantPortalService],
})
export class MerchantPortalModule {}
