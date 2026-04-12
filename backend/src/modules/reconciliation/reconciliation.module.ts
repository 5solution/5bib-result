import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant } from '../merchant/entities/tenant.entity';
import {
  Reconciliation,
  ReconciliationSchema,
} from './schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigSchema,
} from '../merchant/schemas/merchant-config.schema';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationCalcService } from './services/reconciliation-calc.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'platform'),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
    ]),
  ],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    ReconciliationQueryService,
    ReconciliationCalcService,
    XlsxService,
    DocxService,
  ],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
