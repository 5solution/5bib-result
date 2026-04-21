import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClerkAuthModule } from '../clerk-auth';
import {
  TimingLead,
  TimingLeadSchema,
} from './schemas/timing-lead.schema';
import {
  TimingCounter,
  TimingCounterSchema,
} from './schemas/timing-counter.schema';
import { TimingService } from './timing.service';
import { TimingPublicController } from './timing-public.controller';
import { SolutionPublicController } from './solution-public.controller';
import { Sport5PublicController } from './sport5-public.controller';
import { TimingAdminController } from './timing-admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimingLead.name, schema: TimingLeadSchema },
      { name: TimingCounter.name, schema: TimingCounterSchema },
    ]),
    // Module-scoped throttler — mirrors certificates pattern so @Throttle works
    // without interfering with app-wide config.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ClerkAuthModule,
  ],
  controllers: [
    TimingPublicController,
    SolutionPublicController,
    Sport5PublicController,
    TimingAdminController,
  ],
  providers: [TimingService],
  exports: [TimingService],
})
export class TimingModule {}
