import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EventGeoDto {
  @ApiProperty({ example: 18.6706 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 105.6901 })
  @IsNumber()
  lng: number;
}

export class EventLocationDto {
  @ApiProperty({ example: 'Quảng trường Hồ Chí Minh, TP Vinh' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ type: EventGeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventGeoDto)
  geo?: EventGeoDto;
}

export class EventCourseDto {
  @ApiProperty({ example: '42KM' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 42.2 })
  @IsNumber()
  distance_km: number;

  @ApiProperty({ example: '2026-05-02T03:00:00+07:00' })
  @IsDateString()
  start_time: string;
}

export class EventStationDto {
  @ApiProperty({ example: 'N01' })
  @IsString()
  @MaxLength(20)
  station_id: string;

  @ApiProperty({ example: 'Trạm nước Lê Nin 2km' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['42KM', '21KM'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  courses_served?: string[];

  @ApiPropertyOptional({ type: EventGeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventGeoDto)
  geo?: EventGeoDto;
}

export class CreateEventDto {
  @ApiProperty({ example: 'HHTT2026' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 'hhtt2026',
    description: 'URL-safe slug, unique per tenant',
  })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, {
    message:
      'slug must be lowercase alphanumeric with optional dashes, max 50 chars',
  })
  slug: string;

  @ApiProperty({ example: '2026-05-02T00:00:00+07:00' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: EventLocationDto })
  @ValidateNested()
  @Type(() => EventLocationDto)
  location: EventLocationDto;

  @ApiPropertyOptional({ type: [EventCourseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventCourseDto)
  @ArrayMaxSize(20)
  courses?: EventCourseDto[];

  @ApiPropertyOptional({ type: [EventStationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventStationDto)
  @ArrayMaxSize(500)
  stations?: EventStationDto[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ enum: ['DRAFT', 'LIVE', 'ENDED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'LIVE', 'ENDED'])
  status?: 'DRAFT' | 'LIVE' | 'ENDED';
}

export class EventListQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'LIVE', 'ENDED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'LIVE', 'ENDED'])
  status?: 'DRAFT' | 'LIVE' | 'ENDED';
}

/** ───────────── Response DTOs ───────────── */

export class EventCourseResponseDto {
  @ApiProperty() name: string;
  @ApiProperty() distance_km: number;
  @ApiProperty() start_time: Date;
}

export class EventStationResponseDto {
  @ApiProperty() station_id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ type: [String] }) courses_served: string[];
  @ApiPropertyOptional() geo?: { lat: number; lng: number };
}

export class EventResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() date: Date;
  @ApiProperty() location: { name: string; geo?: { lat: number; lng: number } };
  @ApiProperty({ type: [EventCourseResponseDto] }) courses: EventCourseResponseDto[];
  @ApiProperty({ type: [EventStationResponseDto] }) stations: EventStationResponseDto[];
  @ApiProperty({ enum: ['DRAFT', 'LIVE', 'ENDED'] }) status: 'DRAFT' | 'LIVE' | 'ENDED';
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class EventListResponseDto {
  @ApiProperty({ type: [EventResponseDto] })
  items: EventResponseDto[];

  @ApiProperty()
  total: number;
}

export class EventKpiDto {
  @ApiProperty() event_id: string;
  @ApiProperty() total_teams: number;
  @ApiProperty() total_volunteers: number;
  @ApiProperty() total_volunteers_approved: number;
  @ApiProperty() total_checked_in: number;
  @ApiProperty() total_crew: number;
  @ApiProperty() total_tasks_pending: number;
  @ApiProperty() total_tasks_done: number;
  @ApiProperty() total_incidents_open: number;
  @ApiProperty() total_supply_orders_submitted: number;
  @ApiProperty() total_supply_orders_approved: number;
}
