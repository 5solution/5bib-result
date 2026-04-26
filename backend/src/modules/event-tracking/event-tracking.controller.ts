import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { EventTrackingService } from './event-tracking.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@ApiTags('Event Tracking')
// Path is intentionally neutral ("log") to avoid ad-blocker pattern matching
// on keywords like "track", "analytics", "events". Old path /event-tracking/events
// was blocked by uBlock Origin / AdGuard EasyPrivacy filter lists.
@Controller('log')
export class EventTrackingController {
  private readonly logger = new Logger(EventTrackingController.name);

  constructor(private readonly eventTrackingService: EventTrackingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @Throttle({ default: { limit: 100, ttl: 1000 } })
  @ApiOperation({ summary: 'Ingest behavioral event from 5bib.com frontend' })
  @ApiSecurity('x-analytics-key')
  @ApiResponse({ status: 201, description: 'Event accepted' })
  @ApiResponse({ status: 400, description: 'Validation error — missing required fields' })
  @ApiResponse({ status: 401, description: 'Invalid or missing x-analytics-key header' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (100 req/s per IP)' })
  async trackEvent(@Body() dto: CreateTrackingEventDto): Promise<void> {
    // Fire-and-forget: respond 201 immediately, don't block on DB write
    this.eventTrackingService.ingestEvent(dto).catch((err: Error) => {
      this.logger.error(`Failed to ingest tracking event: ${err.message}`, err.stack);
    });
  }
}
