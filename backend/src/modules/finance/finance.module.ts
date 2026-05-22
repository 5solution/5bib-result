import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostItem, CostItemSchema } from './schemas/cost-item.schema';
import {
  Contract,
  ContractSchema,
} from '../contracts/schemas/contract.schema';
import {
  ServiceCatalog,
  ServiceCatalogSchema,
} from '../contracts/schemas/service-catalog.schema';
import {
  MerchantConfig,
  MerchantConfigSchema,
} from '../merchant/schemas/merchant-config.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../reconciliation/schemas/reconciliation.schema';
import { OrderReadonly } from './entities/order-readonly.entity';
import { Tenant } from '../merchant/entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { CostItemsService } from './services/cost-items.service';
import { PnLService } from './services/pnl.service';
import { FeeService } from './services/fee.service';
import { PnLExcelService } from './services/pnl-excel.service';
import { CostSuggestionsService } from './services/cost-suggestions.service';
import { ReconciliationQueryService } from '../reconciliation/services/reconciliation-query.service';
import { CostItemsController } from './controllers/cost-items.controller';
import { PnLController } from './controllers/pnl.controller';
import { PnLExportController } from './controllers/pnl-export.controller';
import { PnLDashboardController } from './controllers/pnl-dashboard.controller';
import { PnLContractsListController } from './controllers/pnl-contracts-list.controller';
import { FeeBreakdownController } from './controllers/fee-breakdown.controller';
import { MysqlLookupController } from './controllers/mysql-lookup.controller';
import { CostSuggestionsController } from './controllers/cost-suggestions.controller';

/**
 * F-028 Finance / Deal P&L Tracking module.
 *
 * FEATURE-040 — extended with cross-domain MerchantConfig + Reconciliation
 * model injection for real-fee compute. Models imported directly via
 * MongooseModule.forFeature (NOT via ReconciliationModule re-export — avoid
 * circular DI). ReconciliationQueryService also provided here as a SECOND
 * binding (Nest treats `@Injectable()` as singleton-per-module-tree; we
 * declare it under FinanceModule's providers so its dependencies are
 * resolved from FinanceModule's imports — Tenant repo + Reconciliation
 * model both already present).
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
      // Phase 3 — Read-only ServiceCatalog cho cost-suggestions endpoint
      { name: ServiceCatalog.name, schema: ServiceCatalogSchema },
      // F-040 — MerchantConfig (rate cascade) + Reconciliation (source priority)
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
    TypeOrmModule.forFeature([OrderReadonly, Tenant], 'platform'),
    AuditModule,
  ],
  controllers: [
    CostItemsController,
    PnLController,
    PnLExportController,
    PnLDashboardController,
    PnLContractsListController,
    // F-040 — NEW fee-breakdown drill-down endpoint
    FeeBreakdownController,
    MysqlLookupController,
    CostSuggestionsController,
  ],
  providers: [
    CostItemsService,
    PnLService,
    FeeService,
    PnLExcelService,
    CostSuggestionsService,
    // F-040 — ReconciliationQueryService provided locally so FeeService can
    // inject it. ReconciliationModule still owns the canonical instance for
    // its own consumers; both bindings query the same Mongo + MySQL.
    ReconciliationQueryService,
  ],
  exports: [PnLService, CostItemsService, FeeService],
})
export class FinanceModule {}
