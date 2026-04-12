import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant } from './entities/tenant.entity';
import { MerchantConfig, MerchantConfigSchema } from './schemas/merchant-config.schema';
import { MerchantFeeHistory, MerchantFeeHistorySchema } from './schemas/merchant-fee-history.schema';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'platform'),
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
