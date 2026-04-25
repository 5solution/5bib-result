import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingEvent, TrackingEventDocument } from './schemas/tracking-event.schema';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';

const PII_KEY_PATTERN =
  /^(email|e_mail|mail|phone|phone_number|mobile|tel|full_name|fullname|name|first_name|last_name|address|id_number|national_id|passport|cmnd|cccd|dob|date_of_birth)$/i;

@Injectable()
export class EventTrackingService {
  private readonly logger = new Logger(EventTrackingService.name);

  constructor(
    @InjectModel(TrackingEvent.name)
    private readonly trackingEventModel: Model<TrackingEventDocument>,
  ) {}

  async ingestEvent(dto: CreateTrackingEventDto): Promise<void> {
    const sanitizedEventData = this.stripPII(dto.event_data ?? {});

    const doc = new this.trackingEventModel({
      ...dto,
      timestamp: new Date(dto.timestamp),
      event_data: sanitizedEventData,
    });

    await doc.save();
  }

  private stripPII(data: Record<string, unknown>): Record<string, unknown> {
    return this.scrub(data, '') as Record<string, unknown>;
  }

  private scrub(value: unknown, path: string): unknown {
    if (Array.isArray(value)) {
      return value.map((v, i) => this.scrub(v, `${path}[${i}]`));
    }
    if (value !== null && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (PII_KEY_PATTERN.test(k)) {
          this.logger.warn(
            `Stripped PII field "${path}${path ? '.' : ''}${k}" from tracking event_data`,
          );
          continue;
        }
        out[k] = this.scrub(v, `${path}${path ? '.' : ''}${k}`);
      }
      return out;
    }
    return value;
  }
}
