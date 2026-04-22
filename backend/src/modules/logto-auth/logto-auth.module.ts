import { Module } from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';
import { LogtoAdminGuard } from './logto-admin.guard';
import { OptionalLogtoAuthGuard } from './optional-logto-auth.guard';
import { LogtoService } from './logto.service';

@Module({
  providers: [
    LogtoAuthGuard,
    LogtoAdminGuard,
    OptionalLogtoAuthGuard,
    LogtoService,
  ],
  exports: [
    LogtoAuthGuard,
    LogtoAdminGuard,
    OptionalLogtoAuthGuard,
    LogtoService,
  ],
})
export class LogtoAuthModule {}
