import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';

@Module({
  providers: [ClerkAuthGuard, ClerkService],
  exports: [ClerkAuthGuard, ClerkService],
})
export class ClerkAuthModule {}
