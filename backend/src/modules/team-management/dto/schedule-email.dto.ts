import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * v1.4 BR-SCH-04 — variable set the schedule email renderer substitutes.
 * Keep in sync with TeamScheduleEmailService.buildVars + admin
 * TeamEmailEditor picker groups.
 */
export const SCHEDULE_EMAIL_VARIABLES = [
  'full_name',
  'phone',
  'email',
  'cccd',
  'dob',
  'event_name',
  'event_start_date',
  'event_end_date',
  'event_location',
  'role_name',
  'daily_rate',
  'working_days',
  'total_compensation',
  'signed_date',
  'reporting_time',
  'gathering_point',
  'team_contact_phone',
  'special_note',
] as const;

export class UpsertScheduleEmailDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject!: string;

  @ApiProperty({ description: 'HTML body with {{placeholders}}' })
  @IsString()
  @IsNotEmpty()
  body_html!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reporting_time?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gathering_point?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  team_contact_phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  special_note?: string | null;
}

export class SendTestScheduleEmailDto {
  @ApiProperty({
    required: false,
    description:
      'Destination for the test email. Defaults to the caller admin email when omitted.',
  })
  @IsOptional()
  @IsEmail()
  test_email?: string;
}

export class ScheduleEmailResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  event_id!: number;

  @ApiProperty()
  role_id!: number;

  @ApiProperty()
  role_name!: string;

  @ApiProperty({
    description:
      'Registrations eligible to receive this schedule email — status in (contract_signed, qr_sent, checked_in, completed).',
  })
  @IsInt()
  member_count_eligible!: number;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  body_html!: string;

  @ApiProperty({ nullable: true })
  reporting_time!: string | null;

  @ApiProperty({ nullable: true })
  gathering_point!: string | null;

  @ApiProperty({ nullable: true })
  team_contact_phone!: string | null;

  @ApiProperty({ nullable: true })
  special_note!: string | null;

  @ApiProperty({ nullable: true })
  last_sent_at!: string | null;

  @ApiProperty()
  last_sent_count!: number;

  @ApiProperty()
  total_sent_count!: number;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}

export class ScheduleEmailRoleSummaryDto {
  @ApiProperty()
  role_id!: number;

  @ApiProperty()
  role_name!: string;

  @ApiProperty({
    description:
      'Registrations eligible to receive — status in BR-SCH-02 eligible set.',
  })
  member_count_eligible!: number;

  @ApiProperty({
    nullable: true,
    description: 'Null when no config row exists yet for this role.',
  })
  config!: ScheduleEmailResponseDto | null;
}

export class SendTestResponseDto {
  @ApiProperty({ default: true })
  sent!: boolean;

  @ApiProperty({ description: 'Destination of the test email' })
  delivered_to!: string;
}

export class SendBulkScheduleEmailResponseDto {
  @ApiProperty({ description: 'Number of members queued for delivery' })
  queued!: number;

  @ApiProperty({
    description:
      'Members in this role that are NOT in the eligible status set',
  })
  skipped!: number;
}
