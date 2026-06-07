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
import { MerchantPortalAccessService } from './services/merchant-portal-access.service';
import { MerchantPortalService } from './services/merchant-portal.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MerchantPortalAccess.name, schema: MerchantPortalAccessSchema },
    ]),
    TypeOrmModule.forFeature([Tenant], 'platform'),
    LogtoAuthModule,
    AuditModule,
    FinanceModule,
    NotificationModule,
  ],
  controllers: [MerchantPortalAdminController, MerchantPortalController],
  providers: [MerchantPortalAccessService, MerchantPortalService],
  exports: [MerchantPortalAccessService, MerchantPortalService],
})
export class MerchantPortalModule {}
