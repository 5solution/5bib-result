import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostItem, CostItemSchema } from './schemas/cost-item.schema';
import {
  Contract,
  ContractSchema,
} from '../contracts/schemas/contract.schema';
import { OrderReadonly } from './entities/order-readonly.entity';
import { Tenant } from '../merchant/entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { CostItemsService } from './services/cost-items.service';
import { PnLService } from './services/pnl.service';
import { FeeService } from './services/fee.service';
import { PnLExcelService } from './services/pnl-excel.service';
import { CostItemsController } from './controllers/cost-items.controller';
import { PnLController } from './controllers/pnl.controller';
import { PnLExportController } from './controllers/pnl-export.controller';
import { PnLDashboardController } from './controllers/pnl-dashboard.controller';
import { MysqlLookupController } from './controllers/mysql-lookup.controller';

/**
 * F-028 Finance / Deal P&L Tracking module.
 *
 * Cross-DB DI MySQL platform — pattern F-016 Reconciliation: load
 * `TypeOrmModule.forFeature([OrderReadonly], 'platform')`. Entity được khai
 * báo trong `app.module.ts` `platformDbModules` `entities[]` array (cùng
 * pattern AthleteReadonly etc).
 *
 * Cross-module DI Contracts: read-only Contract schema qua MongooseModule
 * `forFeature` — KHÔNG import ContractsModule (tránh circular DI). Pattern
 * F-019 awards reuse precedent.
 *
 * AuditModule import → emit audit log per cost item mutation (BR-PNL-09).
 *
 * Module load conditional theo `platformDbModules` trong app.module.ts —
 * cần platform DB cấu hình để FeeService cross-DB work. Khi PLATFORM_DB_HOST
 * unset, FeeService trả null + warning UI (graceful degradation).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CostItem.name, schema: CostItemSchema },
      // Read-only Contract — compute revenue + cross-module read
      { name: Contract.name, schema: ContractSchema },
    ]),
    TypeOrmModule.forFeature([OrderReadonly, Tenant], 'platform'),
    AuditModule,
  ],
  controllers: [
    CostItemsController,
    PnLController,
    PnLExportController,
    PnLDashboardController,
    MysqlLookupController,
  ],
  providers: [CostItemsService, PnLService, FeeService, PnLExcelService],
  exports: [PnLService, CostItemsService],
})
export class FinanceModule {}
