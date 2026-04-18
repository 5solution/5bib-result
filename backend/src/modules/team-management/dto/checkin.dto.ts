import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CheckinScanDto {
  @ApiProperty({ description: 'QR payload — same value as magic_token' })
  @IsString()
  qr_code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  event_id?: number;
}

export class SelfCheckinDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class CheckinResponseDto {
  @ApiProperty() success!: true;
  @ApiProperty() full_name!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty() checked_in_at!: string;
  // v1.4: `leader_checkin` added for Leader-check-in-team-member flow.
  @ApiProperty({ enum: ['qr_scan', 'gps_verify', 'leader_checkin'] })
  method!: 'qr_scan' | 'gps_verify' | 'leader_checkin';
}

export class CheckinLookupRowDto {
  @ApiProperty() id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty({ description: 'Last 4 digits of CCCD; empty string if missing' })
  cccd_last4!: string;
  @ApiProperty({ description: 'Phone masked as 0901***567 when length matches; otherwise raw phone' })
  phone_masked!: string;
  @ApiProperty({ required: false, nullable: true })
  avatar_photo_url!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty({ required: false, nullable: true })
  checked_in_at!: string | null;
  @ApiProperty({ description: 'Pass to /checkin/scan to commit check-in' })
  qr_code!: string;
}

export class CheckinLookupResponseDto {
  @ApiProperty({ type: [CheckinLookupRowDto] })
  data!: CheckinLookupRowDto[];
}

export class CheckinStatsDto {
  @ApiProperty() total_approved!: number;
  @ApiProperty() total_checked_in!: number;
  @ApiProperty() percentage!: number;
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        role_name: { type: 'string' },
        approved: { type: 'number' },
        checked_in: { type: 'number' },
      },
    },
  })
  by_role!: Array<{ role_name: string; approved: number; checked_in: number }>;
}
