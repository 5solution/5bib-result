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
import {
  ReconciliationCronLog,
  ReconciliationCronLogSchema,
} from './schemas/reconciliation-cron-log.schema';
import { ExportJob, ExportJobSchema } from './export/export-job.schema';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationCalcService } from './services/reconciliation-calc.service';
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { ReconciliationCron } from './services/reconciliation.cron';
import { BatchExportService } from './export/batch-export.service';
import { TongHopService } from './export/tong-hop.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'platform'),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
      { name: ReconciliationCronLog.name, schema: ReconciliationCronLogSchema },
      { name: ExportJob.name, schema: ExportJobSchema },
    ]),
  ],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    ReconciliationQueryService,
    ReconciliationCalcService,
    ReconciliationPreflightService,
    XlsxService,
    DocxService,
    ReconciliationCron,
    BatchExportService,
    TongHopService,
  ],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
