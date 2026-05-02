import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { TrackingEvent, TrackingEventSchema } from './schemas/tracking-event.schema';
import { EventTrackingController } from './event-tracking.controller';
import { EventTrackingService } from './event-tracking.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackingEvent.name, schema: TrackingEventSchema },
    ]),
    ThrottlerModule.forRoot([{ ttl: 1000, limit: 100 }]),
  ],
  controllers: [EventTrackingController],
  providers: [
    EventTrackingService,
    // DISABLED — APP_GUARD makes ThrottlerGuard global (app-wide), causing
    // unrelated endpoints to hit 429. Re-enable per-controller via
    // @UseGuards(ThrottlerGuard) only on event-tracking routes if needed.
    // { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class EventTrackingModule {}
