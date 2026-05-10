import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-16/17 — Claim Rate per Race + Resolution SLA.
 */
export class ClaimRateQueryDto {
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

export class ClaimRatePerRaceDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() raceName!: string;
  @ApiProperty() finishers!: number;
  @ApiProperty() claims!: number;
  @ApiProperty({ description: 'Claim rate %' })
  claimRate!: number;
  @ApiProperty({ description: 'Có vượt ngưỡng đỏ 5%' })
  isOverThreshold!: boolean;
}

export class SlaTrendPointDto {
  @ApiProperty() bucket!: string;
  @ApiProperty() slaPercentage!: number;
}

export class ClaimRateResponseDto {
  @ApiProperty({ type: [ClaimRatePerRaceDto] })
  perRace!: ClaimRatePerRaceDto[];

  @ApiProperty({ description: 'Tổng SLA % (resolve trong 24h / total resolve)' })
  slaPercentage!: number;

  @ApiProperty() totalClaims!: number;
  @ApiProperty() totalResolved!: number;
  @ApiProperty() resolvedWithinSla!: number;

  @ApiProperty({ type: [SlaTrendPointDto] })
  slaTrend!: SlaTrendPointDto[];
}
