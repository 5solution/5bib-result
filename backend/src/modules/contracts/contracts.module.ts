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
import { ContractsService } from './services/contracts.service';
import { PartnersService } from './services/partners.service';
import { ServiceCatalogService } from './services/service-catalog.service';
import { ContractNumberService } from './services/contract-number.service';
import { ContractTemplateService } from './services/contract-template.service';
import { DocumentGeneratorService } from './services/document-generator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: ServiceCatalog.name, schema: ServiceCatalogSchema },
      { name: ContractTemplate.name, schema: ContractTemplateSchema },
    ]),
  ],
  controllers: [
    ContractsController,
    PartnersController,
    ServiceCatalogController,
  ],
  providers: [
    ContractsService,
    PartnersService,
    ServiceCatalogService,
    ContractNumberService,
    ContractTemplateService,
    DocumentGeneratorService,
  ],
  exports: [ContractsService, PartnersService],
})
export class ContractsModule {}
