import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class EventTrackingModule {}
