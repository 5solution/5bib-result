import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysAdminController } from './api-keys-admin.controller';
import { ApiKeyGuard } from './api-key.guard';
import { LogtoOrApiKeyWriteGuard } from './logto-or-api-key-write.guard';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';
import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
    LogtoAuthModule,
  ],
  controllers: [ApiKeysAdminController],
  providers: [ApiKeysService, ApiKeyGuard, LogtoAdminGuard, LogtoOrApiKeyWriteGuard],
  exports: [ApiKeysService, ApiKeyGuard, LogtoOrApiKeyWriteGuard],
})
export class ApiKeysModule {}
