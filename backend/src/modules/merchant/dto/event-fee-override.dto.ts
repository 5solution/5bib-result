import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * F-043 — Create event-level fee override.
 *
 * Per BR-43-01..04, cho phép merchant set custom fee cho từng raceId.
 * Mỗi field rate/manual/vat nullable — null = fallback merchant default.
 * `effective_from` required (BR-43-07 — versioning theo ngày).
 */
export class CreateEventFeeOverrideDto {
  @ApiProperty({
    description: 'MySQL platform race.id — phải tồn tại trong races table',
    example: 12345,
  })
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId phải >= 1' })
  raceId!: number;

  @ApiPropertyOptional({
    description: '% phí dịch vụ — null = dùng merchant default',
    minimum: 0,
    maximum: 100,
    example: 7,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'service_fee_rate phải là số' })
  @Min(0, { message: 'service_fee_rate phải >= 0' })
  @Max(100, { message: 'service_fee_rate phải <= 100' })
  service_fee_rate?: number | null;

  @ApiPropertyOptional({
    description: 'Phí cố định VNĐ/vé cho MANUAL — null = dùng merchant default',
    minimum: 0,
    example: 5000,
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'manual_fee_per_ticket phải là số nguyên' })
  @Min(0, { message: 'manual_fee_per_ticket phải >= 0' })
  manual_fee_per_ticket?: number | null;

  @ApiPropertyOptional({
    description: '% VAT trên fee — null = dùng merchant default',
    minimum: 0,
    maximum: 100,
    example: 8,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fee_vat_rate?: number | null;

  @ApiProperty({
    description: 'Ngày bắt đầu áp dụng (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effective_from phải format YYYY-MM-DD',
  })
  effective_from!: string;

  @ApiPropertyOptional({
    description: 'Ghi chú admin',
    maxLength: 200,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'note tối đa 200 ký tự' })
  note?: string | null;
}

/**
 * F-043 — Update existing override (raceId immutable, từ path param).
 * Partial — admin có thể chỉ update 1 field (vd: chỉ đổi service_fee_rate
 * mà không đụng effective_from / manual / vat).
 */
export class UpdateEventFeeOverrideDto extends PartialType(
  OmitType(CreateEventFeeOverrideDto, ['raceId'] as const),
) {}

/**
 * F-043 — Response shape cho list/get/create/update.
 * Includes `raceName` joined từ MySQL platform `races` table via RaceReadonly.
 */
export class EventFeeOverrideResponseDto {
  @ApiProperty({ description: 'MySQL platform race.id' })
  raceId!: number;

  @ApiPropertyOptional({
    description: 'Tên race từ MySQL platform (joined via RaceReadonly)',
    nullable: true,
  })
  raceName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  service_fee_rate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  manual_fee_per_ticket!: number | null;

  @ApiPropertyOptional({ nullable: true })
  fee_vat_rate!: number | null;

  @ApiProperty()
  effective_from!: string;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdBy!: number | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}
