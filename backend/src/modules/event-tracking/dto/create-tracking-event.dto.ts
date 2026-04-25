import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsObject,
  IsISO8601,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTrackingEventDto {
  @ApiProperty({ example: 'registration_complete', description: 'Event name (snake_case)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  event_name: string;

  @ApiProperty({ example: 'registration', description: 'Event category' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  event_category: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  session_id: string;

  @ApiProperty({ example: '2026-04-24T10:30:00.000Z', description: 'ISO 8601 timestamp' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ example: 'https://5bib.com/races/vnexpress-marathon' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  page_url: string;

  @ApiProperty({ example: '/races/vnexpress-marathon' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  page_path: string;

  @ApiPropertyOptional({ example: 'abc123hashed', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  user_id?: string | null;

  @ApiPropertyOptional({ example: 'https://google.com', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string | null;

  @ApiPropertyOptional({ example: 'facebook' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_source?: string | null;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_medium?: string | null;

  @ApiPropertyOptional({ example: 'marathon_hp_2026' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_campaign?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_content?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_term?: string | null;

  @ApiPropertyOptional({ example: 'REF_ABC123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ref_code?: string | null;

  @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
  @IsOptional()
  @IsIn(['mobile', 'tablet', 'desktop'])
  device_type?: string | null;

  @ApiPropertyOptional({
    description: 'Flexible per-event payload — must not contain PII (email/phone/name)',
    example: { event_id: 'evt_123', total_amount: 550000, payment_method: 'momo' },
  })
  @IsOptional()
  @IsObject()
  event_data?: Record<string, unknown>;
}
