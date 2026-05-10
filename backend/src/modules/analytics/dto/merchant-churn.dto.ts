import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-13 — Merchant Churn
 * Churn = 6 tháng không tổ chức. At-risk = 4–6 tháng.
 */
export class MerchantChurnQueryDto {
  @ApiProperty({
    description: 'Period: 7d / 30d / quarter / year / custom',
    enum: ['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'],
  })
  @IsString()
  @IsIn(['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'])
  period!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() to?: string;
}

export class MerchantStatusEntryDto {
  @ApiProperty() tenantId!: number;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ description: 'Số tháng kể từ race cuối' })
  monthsSinceLastRace!: number;
  @ApiProperty({ description: 'Date của race gần nhất ISO', nullable: true })
  lastRaceDate!: string | null;
  @ApiProperty({ description: 'Số race lifetime đã tổ chức' })
  totalRaces!: number;
}

export class MerchantChurnResponseDto {
  @ApiProperty({ description: 'Tỉ lệ churn (%)' })
  churnRate!: number;

  @ApiProperty({ description: 'Tổng số merchant active đã từng tổ chức' })
  totalMerchants!: number;

  @ApiProperty({ description: 'Merchant đã churn (≥6 tháng)' })
  churnedCount!: number;

  @ApiProperty({ description: 'Merchant nguy cơ churn (4–6 tháng)' })
  atRiskCount!: number;

  @ApiProperty({ type: [MerchantStatusEntryDto] })
  atRiskList!: MerchantStatusEntryDto[];

  @ApiProperty({ type: [MerchantStatusEntryDto] })
  churnedList!: MerchantStatusEntryDto[];
}
