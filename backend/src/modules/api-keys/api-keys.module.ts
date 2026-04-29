import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysAdminController } from './api-keys-admin.controller';
import { ApiKeyGuard } from './api-key.guard';
import { LogtoOrApiKeyWriteGuard } from './logto-or-api-key-write.guard';
import { LogtoAuthModule } from '../logto-auth/logto-auth.module';

@Module({
  // LogtoAuthModule re-exports LogtoAdminGuard which the OR guard depends on;
  // any consuming module just needs to import ApiKeysModule (which transitively
  // makes LogtoAdminGuard available via re-export below).
  imports: [
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
    LogtoAuthModule,
  ],
  controllers: [ApiKeysAdminController],
  providers: [ApiKeysService, ApiKeyGuard, LogtoOrApiKeyWriteGuard],
  exports: [
    ApiKeysService,
    ApiKeyGuard,
    LogtoOrApiKeyWriteGuard,
    // Re-export so consumer modules using @UseGuards(LogtoOrApiKeyWriteGuard)
    // can resolve its LogtoAdminGuard dependency without importing
    // LogtoAuthModule themselves.
    LogtoAuthModule,
  ],
})
export class ApiKeysModule {}
