import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-12 — Repeat Athlete Rate
 * Window 12 tháng rolling default; có thể override period.
 */
export class RepeatAthleteRateQueryDto {
  @ApiProperty({
    description: 'Khoảng thời gian: 7d / 30d / quarter / year / rolling12m / custom',
    example: 'rolling12m',
    enum: ['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'],
  })
  @IsString()
  @IsIn(['7d', '30d', 'quarter', 'year', 'rolling12m', 'custom'])
  period!: string;

  @ApiProperty({ required: false, description: 'Custom from YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, description: 'Custom to YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({
    required: false,
    description:
      'Compare mode. F-062 Wave 2A extend (TD-F062-VALIDATION-COMPAREKIND): ' +
      'thêm "wow" (Week-over-Week) + "mom" (Month-over-Month) cho parity với F-062 CompareSelector. ' +
      'F-026 backward compat: "prev" / "yoy" / "custom" / "none" giữ nguyên.',
    enum: ['prev', 'yoy', 'custom', 'none', 'wow', 'mom'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['prev', 'yoy', 'custom', 'none', 'wow', 'mom'])
  compareWith?: string;

  @ApiProperty({ required: false, description: 'Drill-down race id' })
  @IsOptional()
  @IsString()
  raceId?: string;
}

export class RepeatAthleteTrendPointDto {
  @ApiProperty({ description: 'Mốc thời gian (YYYY-MM)' })
  bucket!: string;

  @ApiProperty({ description: '% repeat athlete trong tháng' })
  rate!: number;
}

export class RepeatAthleteCompareDto {
  @ApiProperty()
  rate!: number;

  @ApiProperty({ nullable: true, description: 'Delta % so với current' })
  deltaPercent!: number | null;
}

export class RepeatAthleteRateResponseDto {
  @ApiProperty({ description: 'Tỉ lệ repeat athlete (%)' })
  rate!: number;

  @ApiProperty({ description: 'Tổng số athlete unique trong period' })
  totalAthletes!: number;

  @ApiProperty({ description: 'Số athlete tham gia ≥2 race' })
  repeatAthletes!: number;

  @ApiProperty({ type: [RepeatAthleteTrendPointDto] })
  trend!: RepeatAthleteTrendPointDto[];

  @ApiProperty({ type: RepeatAthleteCompareDto, nullable: true })
  compare!: RepeatAthleteCompareDto | null;
}
