import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant } from './entities/tenant.entity';
import { MerchantConfig, MerchantConfigSchema } from './schemas/merchant-config.schema';
import { MerchantFeeHistory, MerchantFeeHistorySchema } from './schemas/merchant-fee-history.schema';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
// F-043 BR-43-10: Cross-DB validation raceId via RaceReadonly entity
// (registered globally trong app.module per promo-hub pattern — re-import here
// for explicit DI in MerchantModule, both modules share entity via 'platform' connection).
import { RaceReadonly } from '../promo-hub/entities/race-readonly.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, RaceReadonly], 'platform'),
    MongooseModule.forFeature([
      { name: MerchantConfig.name, schema: MerchantConfigSchema },
      { name: MerchantFeeHistory.name, schema: MerchantFeeHistorySchema },
    ]),
  ],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
