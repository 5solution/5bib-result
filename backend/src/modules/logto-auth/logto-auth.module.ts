import { Module } from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';
import { LogtoAdminGuard } from './logto-admin.guard';
import { LogtoStaffGuard } from './logto-staff.guard';
// F-069 M1 — Merchant Portal guards (BR-MP-02 + BR-MP-03)
import { LogtoMerchantGuard } from './logto-merchant.guard';
import { LogtoMerchantFinanceGuard } from './logto-merchant-finance.guard';
import { OptionalLogtoAuthGuard } from './optional-logto-auth.guard';
import { LogtoService } from './logto.service';

@Module({
  providers: [
    LogtoAuthGuard,
    LogtoAdminGuard,
    LogtoStaffGuard,
    LogtoMerchantGuard,
    LogtoMerchantFinanceGuard,
    OptionalLogtoAuthGuard,
    LogtoService,
  ],
  exports: [
    LogtoAuthGuard,
    LogtoAdminGuard,
    LogtoStaffGuard,
    LogtoMerchantGuard,
    LogtoMerchantFinanceGuard,
    OptionalLogtoAuthGuard,
    LogtoService,
  ],
})
export class LogtoAuthModule {}
