import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ───────── Geo ───────── */

export class CheckInGeoDto {
  @ApiProperty({ example: 21.028511 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 105.804817 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

/* ───────── Admin: tạo check-in thủ công ───────── */

export class CreateCheckInDto {
  @ApiProperty({ description: 'ID TNV/crew được check-in' })
  @IsMongoId()
  user_id: string;

  @ApiPropertyOptional({
    description:
      'Thời điểm check-in. Bỏ qua → server dùng now(). ISO 8601.',
    example: '2026-04-20T03:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checked_in_at?: string;

  @ApiPropertyOptional({ enum: ['QR', 'MANUAL'], default: 'MANUAL' })
  @IsOptional()
  @IsEnum(['QR', 'MANUAL'])
  method?: 'QR' | 'MANUAL';

  @ApiPropertyOptional({ type: CheckInGeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckInGeoDto)
  geo?: CheckInGeoDto;

  @ApiPropertyOptional({ description: 'Shift id (nếu có)' })
  @IsOptional()
  @IsMongoId()
  shift_id?: string;
}

/* ───────── Admin: query list ───────── */

export class CheckInListQueryDto {
  @ApiPropertyOptional({ description: 'Filter theo team' })
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiPropertyOptional({ description: 'Filter theo user (TNV/crew)' })
  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @ApiPropertyOptional({ enum: ['QR', 'MANUAL'] })
  @IsOptional()
  @IsIn(['QR', 'MANUAL'])
  method?: 'QR' | 'MANUAL';

  @ApiPropertyOptional({
    description: 'ISO date — chỉ lấy check-in sau thời điểm này',
  })
  @IsOptional()
  @IsDateString()
  since?: string;
}

/* ───────── Response DTOs ───────── */

export class CheckInResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() team_id: string;
  @ApiProperty({ nullable: true, type: String }) shift_id: string | null;
  @ApiProperty() checked_in_at: Date;
  @ApiProperty() checked_in_by: string;
  @ApiProperty({ enum: ['QR', 'MANUAL'] }) method: 'QR' | 'MANUAL';
  @ApiPropertyOptional({ type: CheckInGeoDto }) geo?: CheckInGeoDto;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;

  // Convenience denormalized field for admin list UI
  @ApiPropertyOptional() user_full_name?: string;
  @ApiPropertyOptional() user_phone?: string;
  @ApiPropertyOptional() user_role?: string;
}

export class CheckInListResponseDto {
  @ApiProperty({ type: [CheckInResponseDto] })
  items: CheckInResponseDto[];

  @ApiProperty()
  total: number;
}

export class CheckInTeamSummaryDto {
  @ApiProperty() team_id: string;
  @ApiProperty() team_name: string;
  @ApiProperty() team_code: string;
  @ApiProperty({ description: 'Tổng số check-in đã ghi nhận' })
  total_check_ins: number;
  @ApiProperty({ description: 'Tổng số user unique đã check-in' })
  unique_users: number;
}

export class CheckInSummaryResponseDto {
  @ApiProperty() event_id: string;
  @ApiProperty() total_check_ins: number;
  @ApiProperty({ type: [CheckInTeamSummaryDto] })
  teams: CheckInTeamSummaryDto[];
}
