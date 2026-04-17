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
  @ApiProperty({ enum: ['qr_scan', 'gps_verify'] })
  method!: 'qr_scan' | 'gps_verify';
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
