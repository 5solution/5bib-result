import { ApiProperty } from '@nestjs/swagger';

export class PublicRoleSummaryDto {
  @ApiProperty() id!: number;
  @ApiProperty() role_name!: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty() max_slots!: number;
  @ApiProperty() filled_slots!: number;
  @ApiProperty() is_full!: boolean;
  @ApiProperty() waitlist_enabled!: boolean;
  @ApiProperty() daily_rate!: number;
  @ApiProperty() working_days!: number;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  form_fields!: unknown[];
}

export class PublicEventSummaryDto {
  @ApiProperty() id!: number;
  @ApiProperty() event_name!: string;
  @ApiProperty({ required: false }) description?: string | null;
  @ApiProperty({ required: false }) location?: string | null;
  @ApiProperty() event_start_date!: string;
  @ApiProperty() event_end_date!: string;
  @ApiProperty() registration_open!: string;
  @ApiProperty() registration_close!: string;
  @ApiProperty({ type: [PublicRoleSummaryDto] })
  roles!: PublicRoleSummaryDto[];
}

export class RegisterResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty({ enum: ['approved', 'waitlisted'] })
  status!: 'approved' | 'waitlisted';
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;
  @ApiProperty() message!: string;
  @ApiProperty() magic_link!: string;
}

export class StatusResponseDto {
  @ApiProperty() full_name!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty() event_name!: string;
  @ApiProperty({ enum: ['approved', 'waitlisted', 'rejected', 'cancelled'] })
  status!: string;
  @ApiProperty({ required: false, nullable: true })
  waitlist_position!: number | null;
  @ApiProperty({ enum: ['not_sent', 'sent', 'signed', 'expired'] })
  contract_status!: string;
  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty({ required: false, nullable: true, description: 'Base64 PNG' })
  qr_code!: string | null;
}
