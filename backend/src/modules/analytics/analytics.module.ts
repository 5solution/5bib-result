import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant } from '../merchant/entities/tenant.entity';
import {
  MerchantConfig,
  MerchantConfigSchema,
} from '../merchant/schemas/merchant-config.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../reconciliation/schemas/reconciliation.schema';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'platform'),
    MongooseModule.forFeature([
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
