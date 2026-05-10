import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * F-026 BR-ANALYTICS-18/19 — Geographic + Demographic Split.
 */
export class GeoDemoQueryDto {
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

export class RegionEntryDto {
  @ApiProperty({ description: 'Mã vùng: HCM / HN / DN / KHAC' })
  region!: string;
  @ApiProperty() count!: number;
  @ApiProperty({ description: 'Tỉ lệ (%)' }) percent!: number;
}

export class GenderAgeEntryDto {
  @ApiProperty({ description: 'Gender: MALE / FEMALE / OTHER / UNKNOWN' })
  gender!: string;
  @ApiProperty({ description: 'Bucket: <25 / 25-34 / 35-44 / 45-54 / 55+ / UNKNOWN' })
  ageGroup!: string;
  @ApiProperty() count!: number;
}

export class GeographicDto {
  @ApiProperty({ type: [RegionEntryDto] })
  regions!: RegionEntryDto[];
  @ApiProperty({ description: 'Tỉ lệ user có province (% coverage)' })
  coverage!: number;
}

export class DemographicDto {
  @ApiProperty({ type: [GenderAgeEntryDto] })
  genderAge!: GenderAgeEntryDto[];
  @ApiProperty({ description: 'Tỉ lệ user có DOB (% coverage)' })
  dobCoverage!: number;
}

export class GeoDemoResponseDto {
  @ApiProperty() totalAthletes!: number;
  @ApiProperty({ type: GeographicDto }) geographic!: GeographicDto;
  @ApiProperty({ type: DemographicDto }) demographic!: DemographicDto;
}
