import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-20/21 — Refund Rate + Cancel Rate.
 */
export class RefundCancelQueryDto {
  @ApiProperty({
    description: 'Period: 7d / 30d / quarter / year / custom',
    enum: ['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'],
  })
  @IsString()
  @IsIn(['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'])
  period!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() raceId?: string;
}

export class RateTrendPointDto {
  @ApiProperty() bucket!: string;
  @ApiProperty() rate!: number;
}

export class RefundCancelResponseDto {
  @ApiProperty() totalOrders!: number;
  @ApiProperty() refundedOrders!: number;
  @ApiProperty() cancelledOrders!: number;
  @ApiProperty({ description: 'Tỉ lệ refund (%)' }) refundRate!: number;
  @ApiProperty({ description: 'Tỉ lệ cancel (%)' }) cancelRate!: number;
  @ApiProperty({ description: 'Vượt ngưỡng đỏ refund > 3%' })
  refundOverThreshold!: boolean;
  @ApiProperty({ type: [RateTrendPointDto] })
  refundTrend!: RateTrendPointDto[];
  @ApiProperty({ type: [RateTrendPointDto] })
  cancelTrend!: RateTrendPointDto[];
}
