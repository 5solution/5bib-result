import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkAdminGuard } from './clerk-admin.guard';
import { ClerkService } from './clerk.service';

@Module({
  providers: [ClerkAuthGuard, ClerkAdminGuard, ClerkService],
  exports: [ClerkAuthGuard, ClerkAdminGuard, ClerkService],
})
export class ClerkAuthModule {}
