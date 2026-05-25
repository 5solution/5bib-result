import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Demographics (Age × Gender) (BR-SA-20d v3).
 *
 * 6 age brackets: 18-24, 25-34, 35-44, 45-54, 55-64, 65+, plus implicit "unknown_age"
 * bucket if athletes thiếu DOB (KHÔNG bỏ ra khỏi tổng per spec line 506).
 *
 * Gender per athlete_subinfo.gender column: MALE / FEMALE / OTHER / null = 'unknown'.
 *
 * Data source: athletes.dob (race.date - dob years) + athlete_subinfo.gender.
 */
export class RunnerDemographicsBucketDto {
  @ApiProperty({
    description: 'Age range key',
    example: '25-34',
  })
  ageRange!: string;

  @ApiProperty({ description: 'Nam count', example: 1200 })
  male!: number;

  @ApiProperty({ description: 'Nữ count', example: 850 })
  female!: number;

  @ApiProperty({ description: 'Khác count', example: 12 })
  other!: number;

  @ApiProperty({
    description: 'Không rõ gender (KHÔNG bao gồm Không rõ tuổi)',
    example: 45,
  })
  unknown!: number;

  @ApiProperty({ description: 'Total runners trong bracket', example: 2107 })
  total!: number;
}

export class RunnerDemographicsGenderSummaryEntryDto {
  @ApiProperty({ example: 6500 })
  count!: number;
  @ApiProperty({ example: 62.5 })
  pct!: number;
}

export class RunnerDemographicsGenderSummaryDto {
  @ApiProperty({ type: RunnerDemographicsGenderSummaryEntryDto })
  male!: RunnerDemographicsGenderSummaryEntryDto;
  @ApiProperty({ type: RunnerDemographicsGenderSummaryEntryDto })
  female!: RunnerDemographicsGenderSummaryEntryDto;
  @ApiProperty({ type: RunnerDemographicsGenderSummaryEntryDto })
  other!: RunnerDemographicsGenderSummaryEntryDto;
  @ApiProperty({ type: RunnerDemographicsGenderSummaryEntryDto })
  unknown!: RunnerDemographicsGenderSummaryEntryDto;
}

export class RunnerDemographicsResponseDto {
  @ApiProperty({ type: RunnerDemographicsBucketDto, isArray: true })
  brackets!: RunnerDemographicsBucketDto[];

  @ApiProperty({ type: RunnerDemographicsGenderSummaryDto })
  genderSummary!: RunnerDemographicsGenderSummaryDto;
}
