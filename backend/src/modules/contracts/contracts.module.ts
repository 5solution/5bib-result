import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { Partner, PartnerSchema } from './schemas/partner.schema';
import {
  ServiceCatalog,
  ServiceCatalogSchema,
} from './schemas/service-catalog.schema';
import {
  ContractTemplate,
  ContractTemplateSchema,
} from './schemas/contract-template.schema';
import { ContractsController } from './contracts.controller';
import { PartnersController } from './partners.controller';
import { ServiceCatalogController } from './service-catalog.controller';
import { ContractTemplatesController } from './contract-templates.controller';
import { ContractsService } from './services/contracts.service';
import { PartnersService } from './services/partners.service';
import { PartnersImportService } from './services/partners-import.service';
import { ServiceCatalogService } from './services/service-catalog.service';
import { ServiceCatalogImportService } from './services/service-catalog-import.service';
import { ContractNumberService } from './services/contract-number.service';
import { ContractTemplateService } from './services/contract-template.service';
import { DocumentGeneratorService } from './services/document-generator.service';
import { Race, RaceSchema } from '../races/schemas/race.schema';
import { AuditModule } from '../audit/audit.module';

/**
 * F-024 Contracts module — Phase 2A.
 * - Mongoose: Contract + Partner + ServiceCatalog + ContractTemplate +
 *   Race (READ-ONLY DI for auto-fill US-06).
 * - AuditModule (forwarded from F-023) for lifecycle event emit (BR-CM-07).
 * - Redis: injected via @InjectRedis from RedisModule.forRoot (in app.module).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: ServiceCatalog.name, schema: ServiceCatalogSchema },
      { name: ContractTemplate.name, schema: ContractTemplateSchema },
      // READ-ONLY race model — does not own write, just look up title/date/location
      { name: Race.name, schema: RaceSchema },
    ]),
    AuditModule,
  ],
  controllers: [
    ContractsController,
    PartnersController,
    ServiceCatalogController,
    ContractTemplatesController,
  ],
  providers: [
    ContractsService,
    PartnersService,
    PartnersImportService,
    ServiceCatalogService,
    ServiceCatalogImportService,
    ContractNumberService,
    ContractTemplateService,
    DocumentGeneratorService,
  ],
  exports: [ContractsService, PartnersService],
})
export class ContractsModule {}
