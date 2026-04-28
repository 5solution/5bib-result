import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysAdminController } from './api-keys-admin.controller';
import { ApiKeyGuard } from './api-key.guard';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
    LogtoAuthModule,
  ],
  controllers: [ApiKeysAdminController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
